import { NextResponse } from "next/server";
import { requireStaffApiAny } from "@/lib/admin-api-auth";
import { ADMIN_REPORT_PERMISSION_KEYS } from "@/lib/admin-reports-gate";
import { notesAssignedStaffMatchesLabel, resolveAppointmentPanelScope } from "@/lib/appointment-panel-access";
import { parseAssignedStaffFromNotes } from "@/lib/appointment-staffing";
import { denyIfAppointmentsDisabled } from "@/lib/appointments-module-guard";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { istanbulDayUtcRange } from "@/lib/istanbul-day-bounds";
import { prisma } from "@/lib/prisma";
import { hasStaffPermission } from "@/lib/staff-permissions";
import { getTenantIdForRequest } from "@/lib/tenant-db";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ymdOrDefault(v: string | null, fallback: string): string {
  const t = v?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : fallback;
}

function ymdToUtcDateOnly(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function csvAttachment(body: string, filename: string): NextResponse {
  return new NextResponse("\uFEFF" + body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const EXPORT_TYPES = [
  "events",
  "appointments",
  "operations",
  "cash",
  "ledger",
  "crm_balances",
  "package_payments",
  "package_purchases",
  "commission_accruals",
  "cash_day_closes",
  "leads",
  "staff_users",
] as const;

type ExportType = (typeof EXPORT_TYPES)[number];

function isExportType(v: string): v is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(v);
}

export async function GET(req: Request) {
  const auth = await requireStaffApiAny([...ADMIN_REPORT_PERMISSION_KEYS]);
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const url = new URL(req.url);
  const typeRaw = (url.searchParams.get("type") ?? "events").trim().toLowerCase();
  if (!isExportType(typeRaw)) {
    return NextResponse.json({ error: `type: ${EXPORT_TYPES.join(" | ")}` }, { status: 400 });
  }
  const type = typeRaw;

  const todayYmd = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const fromYmd = ymdOrDefault(url.searchParams.get("from"), todayYmd);
  const toYmd = ymdOrDefault(url.searchParams.get("to"), todayYmd);
  const { startUtc: fromUtc } = istanbulDayUtcRange(fromYmd);
  const { endUtc: toDayEnd } = istanbulDayUtcRange(toYmd);
  const toExclusive = new Date(toDayEnd.getTime());

  const { scope: apptScope, selfStaffLabel } = resolveAppointmentPanelScope(auth);

  const permAppt = hasStaffPermission(auth.permissions, "crm.appointments");
  const permApptSelf = hasStaffPermission(auth.permissions, "crm.appointments.self");
  const canApptExport = permAppt || permApptSelf;

  function filterApptNotesRows<T extends { notes: string | null }>(rows: T[]): T[] {
    if (apptScope === "self" && selfStaffLabel?.trim()) {
      return rows.filter((r) => notesAssignedStaffMatchesLabel(r.notes, selfStaffLabel));
    }
    return rows;
  }

  /** Randevu olayları + randevu satırları (self: atanmış randevular) */
  if (type === "events") {
    const denied = await denyIfAppointmentsDisabled(req);
    if (denied) return denied;
    if (!canApptExport) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    const rows = await prisma.appointmentEvent.findMany({
      where: { tenantId, createdAt: { gte: fromUtc, lt: toExclusive } },
      include: {
        appointment: { select: { id: true, clientName: true, notes: true, startAt: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    });
    const filtered =
      apptScope === "self"
        ? rows.filter(
            (r) =>
              r.appointment &&
              selfStaffLabel?.trim() &&
              notesAssignedStaffMatchesLabel(r.appointment.notes, selfStaffLabel),
          )
        : rows;
    const header = [
      "id",
      "createdAt",
      "eventType",
      "channel",
      "outcome",
      "actor",
      "appointmentId",
      "appointmentClient",
      "appointmentStartAt",
      "detailsJson",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.createdAt.toISOString()),
          csvCell(r.eventType),
          csvCell(r.channel),
          csvCell(r.outcome),
          csvCell(r.actor),
          csvCell(r.appointmentId),
          csvCell(r.appointment?.clientName ?? ""),
          csvCell(r.appointment?.startAt?.toISOString() ?? ""),
          csvCell(r.detailsJson),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `randevu-olaylari-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "appointments") {
    const denied = await denyIfAppointmentsDisabled(req);
    if (denied) return denied;
    if (!canApptExport) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    const rows = await prisma.appointment.findMany({
      where: { tenantId, startAt: { gte: fromUtc, lt: toExclusive } },
      orderBy: { startAt: "asc" },
      take: 50_000,
    });
    const filtered = filterApptNotesRows(rows);
    const header = [
      "id",
      "startAt",
      "endAt",
      "status",
      "serviceName",
      "quotedPriceTry",
      "priceSource",
      "clientName",
      "clientEmail",
      "clientPhone",
      "assignedStaffLabel",
      "crmContactId",
      "createdAt",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.startAt.toISOString()),
          csvCell(r.endAt?.toISOString() ?? ""),
          csvCell(r.status),
          csvCell(r.serviceName),
          csvCell(r.quotedPriceMinor == null ? "" : formatTryFromMinor(r.quotedPriceMinor)),
          csvCell(r.priceSource),
          csvCell(r.clientName),
          csvCell(r.clientEmail),
          csvCell(r.clientPhone),
          csvCell(parseAssignedStaffFromNotes(r.notes) ?? ""),
          csvCell(r.crmContactId),
          csvCell(r.createdAt.toISOString()),
          csvCell(r.notes),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `randevular-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "operations") {
    const denied = await denyIfAppointmentsDisabled(req);
    if (denied) return denied;
    if (!canApptExport) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    const rows = await prisma.appointment.findMany({
      where: {
        tenantId,
        startAt: { gte: fromUtc, lt: toExclusive },
        status: { in: ["checked_in", "no_show"] },
      },
      orderBy: { startAt: "asc" },
      take: 50_000,
    });
    const filtered = filterApptNotesRows(rows);
    const header = [
      "id",
      "startAt",
      "status",
      "serviceName",
      "quotedPriceTry",
      "clientName",
      "clientPhone",
      "assignedStaffLabel",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.startAt.toISOString()),
          csvCell(r.status),
          csvCell(r.serviceName),
          csvCell(r.quotedPriceMinor == null ? "" : formatTryFromMinor(r.quotedPriceMinor)),
          csvCell(r.clientName),
          csvCell(r.clientPhone),
          csvCell(parseAssignedStaffFromNotes(r.notes) ?? ""),
          csvCell(r.notes),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `yapilan-hizmetler-geldi-gelmedi-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "cash") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.commerceCashReceipt.findMany({
      where: { tenantId, occurredAt: { gte: fromUtc, lt: toExclusive } },
      include: {
        staffUser: { select: { username: true, displayName: true } },
        appointment: { select: { id: true, clientName: true, startAt: true } },
        crmContact: { select: { id: true, name: true, phoneKey: true } },
      },
      orderBy: { occurredAt: "asc" },
      take: 50_000,
    });
    const header = [
      "id",
      "occurredAt",
      "amountTry",
      "method",
      "memo",
      "sourceKind",
      "staffUserId",
      "staffUsername",
      "staffDisplayName",
      "appointmentId",
      "appointmentClient",
      "crmContactId",
      "crmContactName",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.occurredAt.toISOString()),
          csvCell(formatTryFromMinor(r.amountMinor)),
          csvCell(r.method),
          csvCell(r.memo),
          csvCell(r.sourceKind),
          csvCell(r.staffUserId),
          csvCell(r.staffUser?.username ?? ""),
          csvCell(r.staffUser?.displayName ?? ""),
          csvCell(r.appointmentId),
          csvCell(r.appointment?.clientName ?? ""),
          csvCell(r.crmContactId),
          csvCell(r.crmContact?.name ?? ""),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `kasa-tahsilatlari-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "ledger") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.commerceLedgerEntry.findMany({
      where: { tenantId, occurredAt: { gte: fromUtc, lt: toExclusive } },
      include: {
        crmContact: { select: { id: true, name: true, phoneKey: true, email: true } },
      },
      orderBy: { occurredAt: "asc" },
      take: 50_000,
    });
    const header = [
      "id",
      "occurredAt",
      "kind",
      "amountTry",
      "currency",
      "memo",
      "refType",
      "refId",
      "crmContactId",
      "contactName",
      "contactPhoneKey",
      "createdAt",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.occurredAt.toISOString()),
          csvCell(r.kind),
          csvCell(formatTryFromMinor(r.amountMinor)),
          csvCell(r.currency),
          csvCell(r.memo),
          csvCell(r.refType),
          csvCell(r.refId),
          csvCell(r.crmContactId),
          csvCell(r.crmContact?.name ?? ""),
          csvCell(r.crmContact?.phoneKey ?? ""),
          csvCell(r.createdAt.toISOString()),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `cari-hareketler-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "crm_balances") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const [contacts, sums] = await Promise.all([
      prisma.crmContact.findMany({
        where: { tenantId },
        select: { id: true, name: true, email: true, phoneKey: true, createdAt: true },
        orderBy: { name: "asc" },
        take: 50_000,
      }),
      prisma.commerceLedgerEntry.groupBy({
        by: ["crmContactId"],
        where: { tenantId },
        _sum: { amountMinor: true },
      }),
    ]);
    const sumByContact = new Map(sums.map((s) => [s.crmContactId, s._sum.amountMinor ?? 0]));
    const header = ["crmContactId", "name", "email", "phoneKey", "balanceTry", "createdAt"];
    const lines = [header.join(",")];
    for (const c of contacts) {
      const bal = sumByContact.get(c.id) ?? 0;
      lines.push(
        [
          csvCell(c.id),
          csvCell(c.name),
          csvCell(c.email),
          csvCell(c.phoneKey),
          csvCell(formatTryFromMinor(bal)),
          csvCell(c.createdAt.toISOString()),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `crm-cari-bakiyeleri-${fromYmd}.csv`);
  }

  if (type === "package_payments") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.commercePackagePayment.findMany({
      where: { tenantId, paidAt: { gte: fromUtc, lt: toExclusive } },
      include: {
        purchase: {
          select: {
            id: true,
            status: true,
            salePriceMinor: true,
            crmContact: { select: { name: true, phoneKey: true } },
            template: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: "asc" },
      take: 50_000,
    });
    const header = [
      "id",
      "paidAt",
      "amountTry",
      "method",
      "memo",
      "purchaseId",
      "packageName",
      "purchaseStatus",
      "salePriceTry",
      "contactName",
      "contactPhoneKey",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.paidAt.toISOString()),
          csvCell(formatTryFromMinor(r.amountMinor)),
          csvCell(r.method),
          csvCell(r.memo),
          csvCell(r.purchaseId),
          csvCell(r.purchase.template.name),
          csvCell(r.purchase.status),
          csvCell(
            r.purchase.salePriceMinor == null ? "" : formatTryFromMinor(r.purchase.salePriceMinor),
          ),
          csvCell(r.purchase.crmContact.name),
          csvCell(r.purchase.crmContact.phoneKey),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `paket-odemeleri-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "package_purchases") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.commercePackagePurchase.findMany({
      where: { tenantId, purchasedAt: { gte: fromUtc, lt: toExclusive } },
      include: {
        template: { select: { name: true } },
        crmContact: { select: { name: true, phoneKey: true, email: true } },
      },
      orderBy: { purchasedAt: "asc" },
      take: 50_000,
    });
    const header = [
      "id",
      "purchasedAt",
      "expiresAt",
      "status",
      "packageName",
      "salePriceTry",
      "paidAmountTry",
      "contactName",
      "contactPhoneKey",
      "contactEmail",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.purchasedAt.toISOString()),
          csvCell(r.expiresAt?.toISOString() ?? ""),
          csvCell(r.status),
          csvCell(r.template.name),
          csvCell(r.salePriceMinor == null ? "" : formatTryFromMinor(r.salePriceMinor)),
          csvCell(r.paidAmountMinor == null ? "" : formatTryFromMinor(r.paidAmountMinor)),
          csvCell(r.crmContact.name),
          csvCell(r.crmContact.phoneKey),
          csvCell(r.crmContact.email),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `paket-satislari-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "commission_accruals") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.commerceCommissionAccrual.findMany({
      where: { tenantId, createdAt: { gte: fromUtc, lt: toExclusive } },
      include: {
        staffUser: { select: { username: true, displayName: true } },
        appointment: { select: { id: true, clientName: true, startAt: true, serviceName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    });
    const header = [
      "id",
      "createdAt",
      "status",
      "amountTry",
      "memo",
      "staffUserId",
      "staffUsername",
      "staffDisplayName",
      "staffNameSnapshot",
      "appointmentId",
      "appointmentClient",
      "appointmentStartAt",
      "serviceName",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.createdAt.toISOString()),
          csvCell(r.status),
          csvCell(formatTryFromMinor(r.amountMinor)),
          csvCell(r.memo),
          csvCell(r.staffUserId),
          csvCell(r.staffUser?.username ?? ""),
          csvCell(r.staffUser?.displayName ?? ""),
          csvCell(r.staffNameSnapshot),
          csvCell(r.appointmentId),
          csvCell(r.appointment?.clientName ?? ""),
          csvCell(r.appointment?.startAt?.toISOString() ?? ""),
          csvCell(r.appointment?.serviceName ?? ""),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `prim-tahakkuklari-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "cash_day_closes") {
    const denied = await denyIfCommerceModuleDisabled(req);
    if (denied) return denied;
    if (!hasStaffPermission(auth.permissions, "commerce.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.commerceCashDayClose.findMany({
      where: {
        tenantId,
        businessDate: { gte: ymdToUtcDateOnly(fromYmd), lte: ymdToUtcDateOnly(toYmd) },
      },
      include: {
        staffUser: { select: { username: true, displayName: true } },
      },
      orderBy: { businessDate: "asc" },
      take: 50_000,
    });
    const header = [
      "id",
      "businessDate",
      "closedAt",
      "expectedTotalTry",
      "countedTotalTry",
      "notes",
      "staffUserId",
      "staffUsername",
      "staffDisplayName",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.businessDate.toISOString().slice(0, 10)),
          csvCell(r.closedAt.toISOString()),
          csvCell(r.expectedTotalMinor == null ? "" : formatTryFromMinor(r.expectedTotalMinor)),
          csvCell(r.countedTotalMinor == null ? "" : formatTryFromMinor(r.countedTotalMinor)),
          csvCell(r.notes),
          csvCell(r.staffUserId),
          csvCell(r.staffUser?.username ?? ""),
          csvCell(r.staffUser?.displayName ?? ""),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `kasa-gun-sonu-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "leads") {
    if (!hasStaffPermission(auth.permissions, "crm.leads")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.lead.findMany({
      where: { tenantId, createdAt: { gte: fromUtc, lt: toExclusive } },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    });
    const header = ["id", "createdAt", "name", "email", "phone", "source", "status", "message", "notes"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.createdAt.toISOString()),
          csvCell(r.name),
          csvCell(r.email),
          csvCell(r.phone),
          csvCell(r.source),
          csvCell(r.status),
          csvCell(r.message),
          csvCell(r.notes),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `crm-leadler-${fromYmd}_${toYmd}.csv`);
  }

  if (type === "staff_users") {
    if (!hasStaffPermission(auth.permissions, "users.manage")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    const rows = await prisma.staffUser.findMany({
      where: { tenantId },
      select: {
        id: true,
        username: true,
        displayName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { username: "asc" },
      take: 50_000,
    });
    const header = ["id", "username", "displayName", "active", "createdAt", "updatedAt"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.username),
          csvCell(r.displayName),
          csvCell(r.active ? "1" : "0"),
          csvCell(r.createdAt.toISOString()),
          csvCell(r.updatedAt.toISOString()),
        ].join(","),
      );
    }
    return csvAttachment(lines.join("\n"), `personel-kullanicilar-${fromYmd}.csv`);
  }

  return NextResponse.json({ error: "Desteklenmeyen type" }, { status: 400 });
}
