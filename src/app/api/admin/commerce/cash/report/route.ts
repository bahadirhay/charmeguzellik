import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { cashSourceKindLabel } from "@/lib/commerce/cash-source-kind";
import { commerceApiJsonError, mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { formatYmdIstanbul, istanbulDayBoundsUtc } from "@/lib/commerce/istanbul-day-bounds";
import { reconcilePackagePaymentCashReceipts } from "@/lib/commerce/reconcile-package-cash-receipts";
import { packagePaymentMethodLabel } from "@/lib/commerce/package-payment-method";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

function ymdToUtcDateOnly(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) throw new Error("bad");
  return new Date(Date.UTC(y, m - 1, d));
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

    const reconciled = await reconcilePackagePaymentCashReceipts(prisma, tenantId);

    const [receipts, dayCloses] = await Promise.all([
      prisma.commerceCashReceipt.findMany({
        where: { tenantId, occurredAt: { gte: start, lte: end } },
        orderBy: { occurredAt: "desc" },
        take: 5000,
        include: {
          appointment: { select: { id: true, clientName: true, startAt: true } },
          crmContact: { select: { id: true, name: true } },
          staffUser: { select: { id: true, displayName: true } },
        },
      }),
      prisma.commerceCashDayClose.findMany({
        where: {
          tenantId,
          businessDate: {
            gte: ymdToUtcDateOnly(from),
            lte: ymdToUtcDateOnly(to),
          },
        },
        orderBy: { businessDate: "asc" },
        include: { staffUser: { select: { id: true, displayName: true } } },
      }),
    ]);

    const totalsByMethod: Record<string, number> = {};
    let grandTotal = 0;
    const byDay = new Map<string, { total: number; byMethod: Record<string, number> }>();

    for (const r of receipts) {
      grandTotal += r.amountMinor;
      totalsByMethod[r.method] = (totalsByMethod[r.method] ?? 0) + r.amountMinor;
      const dayKey = formatYmdIstanbul(r.occurredAt);
      const bucket = byDay.get(dayKey) ?? { total: 0, byMethod: {} };
      bucket.total += r.amountMinor;
      bucket.byMethod[r.method] = (bucket.byMethod[r.method] ?? 0) + r.amountMinor;
      byDay.set(dayKey, bucket);
    }

    const byDayList = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        totalMinor: v.total,
        totalFormatted: formatTryFromMinor(v.total),
        byMethod: Object.fromEntries(
          Object.entries(v.byMethod).map(([method, minor]) => [
            method,
            {
              minor,
              formatted: formatTryFromMinor(minor),
              label: packagePaymentMethodLabel(method),
            },
          ]),
        ),
      }));

    return NextResponse.json({
      ok: true,
      from,
      to,
      packageReceiptsReconciled: reconciled.inserted,
      grandTotalMinor: grandTotal,
      grandTotalFormatted: formatTryFromMinor(grandTotal),
      totalsByMethod: Object.fromEntries(
        Object.entries(totalsByMethod).map(([method, minor]) => [
          method,
          { minor, formatted: formatTryFromMinor(minor), label: packagePaymentMethodLabel(method) },
        ]),
      ),
      byDay: byDayList,
      receipts: receipts.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        amountMinor: r.amountMinor,
        amountFormatted: formatTryFromMinor(r.amountMinor),
        method: r.method,
        methodLabel: packagePaymentMethodLabel(r.method),
        memo: r.memo,
        sourceKind: r.sourceKind,
        sourceKindLabel: cashSourceKindLabel(r.sourceKind),
        appointment: r.appointment
          ? {
              id: r.appointment.id,
              clientName: r.appointment.clientName,
              startAt: r.appointment.startAt.toISOString(),
            }
          : null,
        crmContact: r.crmContact,
        recordedBy: r.staffUser?.displayName ?? null,
      })),
      dayCloses: dayCloses.map((c) => ({
        id: c.id,
        businessDate: c.businessDate.toISOString().slice(0, 10),
        closedAt: c.closedAt.toISOString(),
        expectedTotalMinor: c.expectedTotalMinor,
        expectedTotalFormatted:
          c.expectedTotalMinor != null ? formatTryFromMinor(c.expectedTotalMinor) : null,
        countedTotalMinor: c.countedTotalMinor,
        countedTotalFormatted:
          c.countedTotalMinor != null ? formatTryFromMinor(c.countedTotalMinor) : null,
        varianceMinor:
          c.countedTotalMinor != null && c.expectedTotalMinor != null
            ? c.countedTotalMinor - c.expectedTotalMinor
            : null,
        notes: c.notes,
        staff: c.staffUser?.displayName ?? null,
      })),
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("YYYY-MM-DD")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const m = mapPrismaCommerceError(e);
    console.error("[cash/report GET]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}
