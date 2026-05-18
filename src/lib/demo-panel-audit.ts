import type { Appointment, Prisma, PrismaClient } from "@prisma/client";
import { shouldRecordDemoPanelAudit } from "@/lib/demo-staff";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type DemoAuditAction = "create" | "update" | "delete";

export type DemoAuditEntityType = "appointment" | "commerce_cash_receipt" | "staff_user";

export type RecordDemoChangeInput = {
  tenantId: string;
  actorUsername: string;
  roleSlug?: string;
  entityType: DemoAuditEntityType;
  entityId: string;
  action: DemoAuditAction;
  label?: string;
  before?: unknown;
  after?: unknown;
};

function jsonOf(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

export function appointmentAuditSnapshot(row: Appointment) {
  return {
    id: row.id,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
    serviceName: row.serviceName,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    notes: row.notes,
    crmContactId: row.crmContactId,
  };
}

export async function recordDemoPanelChange(db: Db, input: RecordDemoChangeInput): Promise<void> {
  if (!shouldRecordDemoPanelAudit(input.tenantId, { username: input.actorUsername, roleSlug: input.roleSlug })) {
    return;
  }
  await db.demoPanelAudit.create({
    data: {
      tenantId: input.tenantId,
      actorUsername: input.actorUsername,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      label: input.label ?? null,
      beforeJson: jsonOf(input.before),
      afterJson: jsonOf(input.after),
    },
  });
}

export async function countPendingDemoPanelChanges(tenantId: string): Promise<number> {
  return prisma.demoPanelAudit.count({
    where: { tenantId, revertedAt: null },
  });
}

export async function listPendingDemoPanelChanges(tenantId: string, take = 80) {
  return prisma.demoPanelAudit.findMany({
    where: { tenantId, revertedAt: null },
    orderBy: { createdAt: "desc" },
    take,
  });
}

async function revertOne(
  db: Db,
  row: {
    id: string;
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    beforeJson: string | null;
    afterJson: string | null;
  },
) {
  if (row.entityType === "appointment") {
    if (row.action === "create") {
      await db.appointment.deleteMany({ where: { id: row.entityId, tenantId: row.tenantId } });
      return;
    }
    if (row.action === "update" && row.beforeJson) {
      const before = JSON.parse(row.beforeJson) as ReturnType<typeof appointmentAuditSnapshot>;
      await db.appointment.updateMany({
        where: { id: row.entityId, tenantId: row.tenantId },
        data: {
          status: before.status,
          startAt: new Date(before.startAt),
          endAt: before.endAt ? new Date(before.endAt) : null,
          serviceName: before.serviceName,
          clientName: before.clientName,
          clientEmail: before.clientEmail,
          clientPhone: before.clientPhone,
          notes: before.notes,
          crmContactId: before.crmContactId,
        },
      });
      return;
    }
  }

  if (row.entityType === "staff_user") {
    if (row.action === "create") {
      await db.staffUserRole.deleteMany({ where: { staffUserId: row.entityId } });
      await db.staffUser.deleteMany({ where: { id: row.entityId, tenantId: row.tenantId } });
      return;
    }
  }

  if (row.entityType === "commerce_cash_receipt") {
    if (row.action === "create") {
      let ledgerId: string | null = null;
      const metaJson = row.afterJson ?? row.beforeJson;
      if (metaJson) {
        try {
          const meta = JSON.parse(metaJson) as { ledgerEntryId?: string | null };
          ledgerId = meta.ledgerEntryId ?? null;
        } catch {
          /* ignore */
        }
      }
      if (!ledgerId) {
        const ledger = await db.commerceLedgerEntry.findFirst({
          where: { tenantId: row.tenantId, refType: "cash_receipt", refId: row.entityId },
          select: { id: true },
        });
        ledgerId = ledger?.id ?? null;
      }
      if (ledgerId) {
        await db.commerceLedgerEntry.deleteMany({ where: { id: ledgerId, tenantId: row.tenantId } });
      }
      await db.commerceCashReceipt.deleteMany({ where: { id: row.entityId, tenantId: row.tenantId } });
      return;
    }
  }

  throw new Error(`Geri alınamadı: ${row.entityType} / ${row.action}`);
}

export type RevertDemoResult = {
  reverted: number;
  errors: Array<{ auditId: string; message: string }>;
};

/** Bekleyen kayıtları yeniden eskiye doğru geri alır. */
export async function revertAllPendingDemoChanges(
  tenantId: string,
  revertedBy: string,
): Promise<RevertDemoResult> {
  const pending = await prisma.demoPanelAudit.findMany({
    where: { tenantId, revertedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const errors: RevertDemoResult["errors"] = [];
  let reverted = 0;
  const now = new Date();

  for (const row of pending) {
    try {
      await prisma.$transaction(async (tx) => {
        await revertOne(tx, row);
        await tx.demoPanelAudit.update({
          where: { id: row.id },
          data: { revertedAt: now, revertedBy },
        });
      });
      reverted += 1;
    } catch (e) {
      errors.push({
        auditId: row.id,
        message: e instanceof Error ? e.message : "Bilinmeyen hata",
      });
    }
  }

  return { reverted, errors };
}
