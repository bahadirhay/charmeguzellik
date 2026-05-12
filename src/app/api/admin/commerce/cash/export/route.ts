import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { cashSourceKindLabel } from "@/lib/commerce/cash-source-kind";
import { mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import { istanbulDayBoundsUtc } from "@/lib/commerce/istanbul-day-bounds";
import { packagePaymentMethodLabel } from "@/lib/commerce/package-payment-method";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
    const receipts = await prisma.commerceCashReceipt.findMany({
      where: { tenantId, occurredAt: { gte: start, lte: end } },
      orderBy: { occurredAt: "desc" },
      take: 10000,
      include: {
        appointment: { select: { id: true, clientName: true, startAt: true } },
        crmContact: { select: { id: true, name: true } },
        staffUser: { select: { displayName: true } },
      },
    });

    const header = [
      "TarihSaat",
      "Tutar_Kurus",
      "Tutar_TRY",
      "Odeme_Yontemi",
      "Kaynak",
      "Randevu_Id",
      "Randevu_Musteri",
      "CRM_Id",
      "CRM_Ad",
      "Kaydeden",
      "Not",
    ].join(",");

    const rows = receipts.map((r) => {
      const tryStr = (r.amountMinor / 100).toFixed(2);
      const line = [
        csvEscape(r.occurredAt.toISOString()),
        String(r.amountMinor),
        csvEscape(tryStr),
        csvEscape(packagePaymentMethodLabel(r.method)),
        csvEscape(cashSourceKindLabel(r.sourceKind)),
        csvEscape(r.appointment?.id ?? ""),
        csvEscape(r.appointment?.clientName ?? ""),
        csvEscape(r.crmContact?.id ?? ""),
        csvEscape(r.crmContact?.name ?? ""),
        csvEscape(r.staffUser?.displayName ?? ""),
        csvEscape(r.memo ?? ""),
      ];
      return line.join(",");
    });

    const bom = "\uFEFF";
    const body = bom + [header, ...rows].join("\r\n");
    const filename = `kasa-${from}_${to}.csv`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("YYYY-MM-DD")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const m = mapPrismaCommerceError(e);
    console.error("[cash/export GET]", e);
    return NextResponse.json({ ok: false, error: m.message, code: m.code }, { status: m.status });
  }
}
