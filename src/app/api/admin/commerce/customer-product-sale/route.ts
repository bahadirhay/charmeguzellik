import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { commerceApiJsonError, mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  crmContactId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100_000),
  /** Boşsa ürün liste fiyatı × adet */
  lineTotalMinor: z.number().int().min(1).max(100_000_000).optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
});

type TxOk = {
  ok: true;
  productName: string;
  qty: number;
  lineTotalMinor: number;
  stockMovementId: string | null;
  ledgerId: string;
};
type TxErr = { ok: false; status: number; msg: string };

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
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

  const contact = await prisma.crmContact.findFirst({
    where: { id: parsed.data.crmContactId, tenantId },
    select: { id: true },
  });
  if (!contact) return NextResponse.json({ error: "Müşteri yok" }, { status: 404 });

  try {
    const out = await prisma.$transaction(async (tx): Promise<TxOk | TxErr> => {
      const product = await tx.commerceProduct.findFirst({
        where: { id: parsed.data.productId, tenantId, active: true },
      });
      if (!product) return { ok: false, status: 404, msg: "Ürün yok veya pasif" };

      const qty = parsed.data.qty;
      const defaultLine = product.salePriceMinor * qty;
      const lineTotal =
        parsed.data.lineTotalMinor != null && parsed.data.lineTotalMinor > 0
          ? parsed.data.lineTotalMinor
          : defaultLine;
      if (lineTotal <= 0) return { ok: false, status: 400, msg: "Satır tutarı sıfırdan büyük olmalı" };

      let stockMovementId: string | null = null;
      if (product.trackStock) {
        const agg = await tx.commerceStockMovement.aggregate({
          where: { tenantId, productId: product.id },
          _sum: { qty: true },
        });
        const onHand = agg._sum.qty ?? 0;
        if (onHand < qty) {
          return { ok: false, status: 400, msg: `Yetersiz stok (mevcut: ${onHand}, istenen: ${qty})` };
        }
        const mov = await tx.commerceStockMovement.create({
          data: {
            tenantId,
            productId: product.id,
            qty: -qty,
            reason: "sale",
            memo: parsed.data.memo?.trim() || `CRM: ${parsed.data.crmContactId}`,
            refType: "crm_contact",
            refId: parsed.data.crmContactId,
          },
        });
        stockMovementId = mov.id;
      }

      const memoExtra = parsed.data.memo?.trim() ? ` — ${parsed.data.memo.trim()}` : "";
      const led = await tx.commerceLedgerEntry.create({
        data: {
          tenantId,
          crmContactId: parsed.data.crmContactId,
          kind: "charge",
          amountMinor: lineTotal,
          memo: `Ürün: ${product.name} (${qty} ad)${memoExtra}`,
          refType: "product_sale",
          refId: stockMovementId ?? product.id,
        },
      });

      return {
        ok: true,
        productName: product.name,
        qty,
        lineTotalMinor: lineTotal,
        stockMovementId,
        ledgerId: led.id,
      };
    });

    if (!out.ok) {
      return NextResponse.json({ error: out.msg }, { status: out.status });
    }

    return NextResponse.json({
      ok: true,
      item: {
        productName: out.productName,
        qty: out.qty,
        lineTotalMinor: out.lineTotalMinor,
        stockMovementId: out.stockMovementId,
        ledgerId: out.ledgerId,
      },
    });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[customer-product-sale POST]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}
