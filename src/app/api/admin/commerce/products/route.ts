import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const items = await prisma.commerceProduct.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
  const productIds = items.map((p) => p.id);
  const sums =
    productIds.length === 0
      ? []
      : await prisma.commerceStockMovement.groupBy({
          by: ["productId"],
          where: { tenantId, productId: { in: productIds } },
          _sum: { qty: true },
        });
  const qtyByProduct = new Map(sums.map((s) => [s.productId, s._sum.qty ?? 0]));
  return NextResponse.json({
    ok: true,
    items: items.map((p) => ({ ...p, stockQty: p.trackStock ? (qtyByProduct.get(p.id) ?? 0) : null })),
  });
}

const postSchema = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  salePriceMinor: z.number().int().min(0).max(100_000_000),
  costMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  trackStock: z.boolean().optional(),
  active: z.boolean().optional(),
  /** Stok takibi açıksa oluşturma sonrası ilk stok hareketi (pozitif = depoya giriş). */
  initialStockQty: z.number().int().min(0).max(100_000_000).optional(),
});

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
  const sku = parsed.data.sku.trim();
  const trackStock = parsed.data.trackStock !== false;
  const initial = parsed.data.initialStockQty ?? 0;

  const row = await prisma.$transaction(async (tx) => {
    const product = await tx.commerceProduct.create({
      data: {
        tenantId,
        sku,
        name: parsed.data.name.trim(),
        salePriceMinor: parsed.data.salePriceMinor,
        costMinor: parsed.data.costMinor ?? null,
        trackStock,
        active: parsed.data.active !== false,
      },
    });
    if (trackStock && initial > 0) {
      await tx.commerceStockMovement.create({
        data: {
          tenantId,
          productId: product.id,
          qty: initial,
          reason: "adjustment",
          memo: "Başlangıç stoku",
        },
      });
    }
    return product;
  });

  return NextResponse.json({ ok: true, item: row });
}
