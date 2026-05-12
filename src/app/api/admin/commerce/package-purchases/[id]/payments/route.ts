import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import {
  PACKAGE_PAYMENT_METHODS,
  packagePaymentMethodLabel,
} from "@/lib/commerce/package-payment-method";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";
import { recordCashReceiptForPackagePayment } from "@/lib/commerce/record-package-payment-cash-receipt";

const postSchema = z.object({
  amountMinor: z.number().int().min(1).max(100_000_000),
  method: z.enum(PACKAGE_PAYMENT_METHODS),
  memo: z.string().max(500).optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const staffUserId = auth.staffUserId ?? null;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { id: purchaseId } = await ctx.params;
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

  const purchase = await prisma.commercePackagePurchase.findFirst({
    where: { id: purchaseId, tenantId },
    include: { template: { select: { listPriceMinor: true, name: true } } },
  });
  if (!purchase) return NextResponse.json({ error: "Satış bulunamadı" }, { status: 404 });

  const existingPayments = await prisma.commercePackagePayment.findMany({
    where: { tenantId, purchaseId },
    orderBy: { paidAt: "desc" },
  });

  const salePrice =
    purchase.salePriceMinor ?? purchase.paidAmountMinor ?? purchase.template.listPriceMinor;
  const paidSum = existingPayments.reduce((s, x) => s + x.amountMinor, 0);
  const remaining = salePrice - paidSum;
  if (parsed.data.amountMinor > remaining) {
    return NextResponse.json(
      { error: `Tutar kalan borçtan (${formatTryFromMinor(remaining)}) fazla olamaz` },
      { status: 400 },
    );
  }

  const pay = await prisma.$transaction(async (tx) => {
    const row = await tx.commercePackagePayment.create({
      data: {
        tenantId,
        purchaseId: purchase.id,
        amountMinor: parsed.data.amountMinor,
        method: parsed.data.method,
        memo: parsed.data.memo?.trim() || null,
      },
    });
    const label = packagePaymentMethodLabel(parsed.data.method);
    const memoExtra = parsed.data.memo?.trim() ? ` — ${parsed.data.memo.trim()}` : "";
    const led = await tx.commerceLedgerEntry.create({
      data: {
        tenantId,
        crmContactId: purchase.crmContactId,
        kind: "payment",
        amountMinor: -Math.abs(parsed.data.amountMinor),
        memo: `Paket tahsilatı (${label})${memoExtra}`,
        refType: "package_payment",
        refId: row.id,
      },
    });
    await recordCashReceiptForPackagePayment(tx, {
      tenantId,
      crmContactId: purchase.crmContactId,
      amountMinor: parsed.data.amountMinor,
      method: parsed.data.method,
      memo: parsed.data.memo?.trim() || null,
      paidAt: row.paidAt,
      ledgerEntryId: led.id,
      staffUserId,
    });
    return row;
  });

  return NextResponse.json({ ok: true, payment: pay });
}
