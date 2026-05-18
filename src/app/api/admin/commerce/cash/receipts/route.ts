import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { CASH_RECEIPT_SOURCE_KINDS } from "@/lib/commerce/cash-source-kind";
import { commerceApiJsonError, mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { istanbulDayBoundsUtc } from "@/lib/commerce/istanbul-day-bounds";
import { PACKAGE_PAYMENT_METHODS, packagePaymentMethodLabel } from "@/lib/commerce/package-payment-method";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";
import { reconcilePackagePaymentCashReceipts } from "@/lib/commerce/reconcile-package-cash-receipts";
import { isDemoPanelActor } from "@/lib/demo-staff";
import { recordDemoPanelChange } from "@/lib/demo-panel-audit";

const postSchema = z.object({
  amountMinor: z.number().int().min(1).max(100_000_000),
  method: z.enum(PACKAGE_PAYMENT_METHODS),
  memo: z.string().max(500).optional().nullable(),
  occurredAt: z.string().datetime().optional(),
  appointmentId: z.string().optional().nullable(),
  crmContactId: z.string().optional().nullable(),
  sourceKind: z.enum(CASH_RECEIPT_SOURCE_KINDS).optional(),
  /** Varsayılan: `crmContactId` doluysa true — cariye tahsilat satırı eklenir. */
  syncLedger: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage", req);
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz" }, { status: 400 });
  }

  let sourceKind = parsed.data.sourceKind ?? "manual";
  let crmContactId = parsed.data.crmContactId?.trim() || null;
  const appointmentId = parsed.data.appointmentId?.trim() || null;

  if (appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      select: { id: true, crmContactId: true },
    });
    if (!appt) return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
    if (!parsed.data.sourceKind) sourceKind = "appointment";
    if (!crmContactId && appt.crmContactId) crmContactId = appt.crmContactId;
  }

  if (crmContactId) {
    const c = await prisma.crmContact.findFirst({ where: { id: crmContactId, tenantId }, select: { id: true } });
    if (!c) return NextResponse.json({ error: "CRM müşterisi bulunamadı" }, { status: 404 });
  }

  const syncLedger = parsed.data.syncLedger ?? (crmContactId != null);
  if (syncLedger && !crmContactId) {
    return NextResponse.json({ error: "Cariye yazmak için müşteri seçin veya syncLedger: false gönderin" }, { status: 400 });
  }

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();
  const staffUserId = auth.staffUserId ?? null;
  const amountMinor = parsed.data.amountMinor;
  const method = parsed.data.method;
  const memo = parsed.data.memo?.trim() || null;

  try {
    const item = await prisma.$transaction(async (tx) => {
      const receipt = await tx.commerceCashReceipt.create({
        data: {
          tenantId,
          occurredAt,
          amountMinor,
          method,
          memo,
          sourceKind,
          appointmentId,
          crmContactId,
          staffUserId,
        },
      });

      if (syncLedger && crmContactId) {
        const label = packagePaymentMethodLabel(method);
        const memoExtra = memo ? ` — ${memo}` : "";
        const led = await tx.commerceLedgerEntry.create({
          data: {
            tenantId,
            crmContactId,
            kind: "payment",
            amountMinor: -Math.abs(amountMinor),
            memo: `Kasa tahsilatı (${label})${memoExtra}`,
            refType: "cash_receipt",
            refId: receipt.id,
            occurredAt,
          },
        });
        await tx.commerceCashReceipt.update({
          where: { id: receipt.id },
          data: { ledgerEntryId: led.id },
        });
      }

      return tx.commerceCashReceipt.findFirstOrThrow({
        where: { id: receipt.id },
        include: {
          appointment: { select: { id: true, clientName: true, startAt: true } },
          crmContact: { select: { id: true, name: true } },
          staffUser: { select: { id: true, displayName: true } },
        },
      });
    });

    if (isDemoPanelActor(auth)) {
      await recordDemoPanelChange(prisma, {
        tenantId,
        actorUsername: auth.username,
        roleSlug: auth.roleSlug,
        entityType: "commerce_cash_receipt",
        entityId: item.id,
        action: "create",
        label: `Kasa tahsilatı: ${formatTryFromMinor(item.amountMinor)}`,
        after: { ledgerEntryId: item.ledgerEntryId ?? null },
      });
    }

    return NextResponse.json({
      ok: true,
      item: {
        ...item,
        amountFormatted: formatTryFromMinor(item.amountMinor),
      },
    });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[cash/receipts POST]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const url = new URL(req.url);
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  if (!from || !to) {
    return NextResponse.json({ error: "from ve to (YYYY-MM-DD) gerekli" }, { status: 400 });
  }
  try {
    const start = istanbulDayBoundsUtc(from).start;
    const end = istanbulDayBoundsUtc(to).end;
    if (start.getTime() > end.getTime()) {
      return NextResponse.json({ error: "from, to’dan büyük olamaz" }, { status: 400 });
    }
    await reconcilePackagePaymentCashReceipts(prisma, tenantId);

    const items = await prisma.commerceCashReceipt.findMany({
      where: { tenantId, occurredAt: { gte: start, lte: end } },
      orderBy: { occurredAt: "desc" },
      take: 3000,
      include: {
        appointment: { select: { id: true, clientName: true, startAt: true } },
        crmContact: { select: { id: true, name: true } },
        staffUser: { select: { id: true, displayName: true } },
      },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[cash/receipts GET]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}
