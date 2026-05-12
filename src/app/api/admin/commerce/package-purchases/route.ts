import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { commerceApiJsonError, mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import {
  PACKAGE_PAYMENT_METHODS,
  packagePaymentMethodLabel,
  type PackagePaymentMethod,
} from "@/lib/commerce/package-payment-method";
import { loadPackagePaymentsByPurchaseIds, type CommercePackagePaymentRow } from "@/lib/commerce/load-package-payments";
import { recordCashReceiptForPackagePayment } from "@/lib/commerce/record-package-payment-cash-receipt";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

/** `payments` ilişkisi bazı ortamlarda eski Prisma DMMF’te yok; tahsilatlar ayrı sorguda yüklenir. */
const purchaseInclude: Prisma.CommercePackagePurchaseInclude = {
  crmContact: { select: { id: true, name: true, phoneKey: true } },
  template: { include: { lines: true } },
  credits: { orderBy: { serviceKey: "asc" } },
};

type PurchaseCore = Prisma.CommercePackagePurchaseGetPayload<{ include: typeof purchaseInclude }>;
type PurchaseRow = PurchaseCore & { payments: CommercePackagePaymentRow[] };

const paymentLineSchema = z.object({
  amountMinor: z.number().int().min(1).max(100_000_000),
  method: z.enum(PACKAGE_PAYMENT_METHODS),
  memo: z.string().max(500).optional().nullable(),
});

const postSchema = z.object({
  crmContactId: z.string().min(1),
  templateId: z.string().min(1),
  /** Anlaşılan paket bedeli (kuruş). Boşsa paidAmountMinor veya şablon liste fiyatı. */
  salePriceMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  /** Geriye uyumluluk. */
  paidAmountMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  /** Satış anında alınan tahsilatlar; her biri cariye ödeme olarak yazılır. */
  initialPayments: z.array(paymentLineSchema).max(30).optional(),
});

function mapPurchaseToDto(p: PurchaseRow) {
  const salePriceMinor =
    p.salePriceMinor ?? p.paidAmountMinor ?? p.template.listPriceMinor;
  const paymentRows = [...p.payments].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  const paidFromPaymentsMinor = paymentRows.reduce((s, x) => s + x.amountMinor, 0);
  const balanceDueMinor = Math.max(0, salePriceMinor - paidFromPaymentsMinor);

  let sessionsTotal = 0;
  let sessionsRemaining = 0;
  const lineDetails = p.template.lines.map((l) => {
    sessionsTotal += l.sessions;
    const c = p.credits.find((x) => x.serviceKey === l.serviceKey);
    const remaining = c?.remaining ?? 0;
    sessionsRemaining += remaining;
    const used = l.sessions - remaining;
    return {
      serviceKey: l.serviceKey,
      sessionsPurchased: l.sessions,
      remaining,
      used,
    };
  });
  const sessionsUsed = sessionsTotal - sessionsRemaining;

  return {
    id: p.id,
    purchasedAt: p.purchasedAt.toISOString(),
    expiresAt: p.expiresAt?.toISOString() ?? null,
    status: p.status,
    salePriceMinor,
    saleFormatted: formatTryFromMinor(salePriceMinor),
    paidAmountMinor: p.paidAmountMinor,
    paidFormatted: p.paidAmountMinor != null ? formatTryFromMinor(p.paidAmountMinor) : null,
    paidFromPaymentsMinor,
    paidFromPaymentsFormatted: formatTryFromMinor(paidFromPaymentsMinor),
    balanceDueMinor,
    balanceDueFormatted: formatTryFromMinor(balanceDueMinor),
    sessionsTotal,
    sessionsUsed,
    sessionsRemaining,
    customer: p.crmContact ? { id: p.crmContact.id, name: p.crmContact.name, phoneKey: p.crmContact.phoneKey } : null,
    template: {
      id: p.template.id,
      name: p.template.name,
      listPriceMinor: p.template.listPriceMinor,
      listFormatted: formatTryFromMinor(p.template.listPriceMinor),
      lines: p.template.lines.map((l) => ({
        serviceKey: l.serviceKey,
        sessionsPurchased: l.sessions,
      })),
    },
    lineDetails,
    credits: p.credits.map((c) => ({
      serviceKey: c.serviceKey,
      remaining: c.remaining,
    })),
    payments: paymentRows.map((pay) => ({
      id: pay.id,
      amountMinor: pay.amountMinor,
      formatted: formatTryFromMinor(pay.amountMinor),
      method: pay.method as PackagePaymentMethod,
      methodLabel: packagePaymentMethodLabel(pay.method),
      memo: pay.memo,
      paidAt: pay.paidAt.toISOString(),
    })),
  };
}

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  try {
    const tenantId = await getTenantIdForRequest(req);
    const items = await prisma.commercePackagePurchase.findMany({
      where: { tenantId },
      orderBy: { purchasedAt: "desc" },
      take: 200,
      include: purchaseInclude,
    });
    const payMap = await loadPackagePaymentsByPurchaseIds(
      tenantId,
      items.map((i) => i.id),
    );
    const merged: PurchaseRow[] = items.map((p) => ({
      ...p,
      payments: payMap.get(p.id) ?? [],
    }));
    return NextResponse.json({
      ok: true,
      items: merged.map((p) => mapPurchaseToDto(p)),
    });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[package-purchases GET]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const staffUserId = auth.staffUserId ?? null;
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

  try {
    const contact = await prisma.crmContact.findFirst({
      where: { id: parsed.data.crmContactId, tenantId },
      select: { id: true },
    });
    if (!contact) return NextResponse.json({ error: "Müşteri yok" }, { status: 404 });
    const template = await prisma.commercePackageTemplate.findFirst({
      where: { id: parsed.data.templateId, tenantId, active: true },
      include: { lines: true },
    });
    if (!template?.lines.length) return NextResponse.json({ error: "Şablon yok veya satırsız" }, { status: 404 });

    const salePriceMinor =
      parsed.data.salePriceMinor ?? parsed.data.paidAmountMinor ?? template.listPriceMinor;
    if (salePriceMinor <= 0) {
      return NextResponse.json({ error: "Paket bedeli sıfırdan büyük olmalı" }, { status: 400 });
    }

    const initialPayments = parsed.data.initialPayments ?? [];
    const paySum = initialPayments.reduce((s, x) => s + x.amountMinor, 0);
    if (paySum > salePriceMinor) {
      return NextResponse.json({ error: "Tahsilat toplamı paket bedelini aşamaz" }, { status: 400 });
    }

    const expiresAt =
      template.validityDays != null
        ? new Date(Date.now() + template.validityDays * 86_400_000)
        : null;

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.commercePackagePurchase.create({
        data: {
          tenantId,
          crmContactId: parsed.data.crmContactId,
          templateId: template.id,
          expiresAt,
          salePriceMinor,
          paidAmountMinor:
            parsed.data.paidAmountMinor ?? (paySum > 0 ? paySum : salePriceMinor),
          status: "active",
        },
      });
      for (const line of template.lines) {
        await tx.commercePackageCredit.create({
          data: {
            purchaseId: p.id,
            serviceKey: line.serviceKey,
            remaining: line.sessions,
          },
        });
      }
      await tx.commerceLedgerEntry.create({
        data: {
          tenantId,
          crmContactId: parsed.data.crmContactId,
          kind: "charge",
          amountMinor: salePriceMinor,
          memo: `Paket borç: ${template.name}`,
          refType: "package_purchase",
          refId: p.id,
        },
      });
      for (const ip of initialPayments) {
        const pay = await tx.commercePackagePayment.create({
          data: {
            tenantId,
            purchaseId: p.id,
            amountMinor: ip.amountMinor,
            method: ip.method,
            memo: ip.memo?.trim() || null,
          },
        });
        const label = packagePaymentMethodLabel(ip.method);
        const memoExtra = ip.memo?.trim() ? ` — ${ip.memo.trim()}` : "";
        const led = await tx.commerceLedgerEntry.create({
          data: {
            tenantId,
            crmContactId: parsed.data.crmContactId,
            kind: "payment",
            amountMinor: -Math.abs(ip.amountMinor),
            memo: `Paket tahsilatı (${label})${memoExtra}`,
            refType: "package_payment",
            refId: pay.id,
          },
        });
        await recordCashReceiptForPackagePayment(tx, {
          tenantId,
          crmContactId: parsed.data.crmContactId,
          amountMinor: ip.amountMinor,
          method: ip.method,
          memo: ip.memo?.trim() || null,
          paidAt: pay.paidAt,
          ledgerEntryId: led.id,
          staffUserId,
        });
      }
      return p;
    });

    const fullCore = await prisma.commercePackagePurchase.findFirstOrThrow({
      where: { id: purchase.id, tenantId },
      include: purchaseInclude,
    });
    const payMapOne = await loadPackagePaymentsByPurchaseIds(tenantId, [fullCore.id]);
    const full: PurchaseRow = { ...fullCore, payments: payMapOne.get(fullCore.id) ?? [] };

    return NextResponse.json({ ok: true, item: mapPurchaseToDto(full) });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[package-purchases POST]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}
