import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  qty: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.enum(["purchase", "sale", "consumption", "adjustment", "count"]),
  memo: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { id: productId } = await ctx.params;
  const product = await prisma.commerceProduct.findFirst({ where: { id: productId, tenantId } });
  if (!product) return NextResponse.json({ error: "Ürün yok" }, { status: 404 });
  if (!product.trackStock) {
    return NextResponse.json({ error: "Bu ürün için stok takibi kapalı" }, { status: 400 });
  }
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
  const row = await prisma.commerceStockMovement.create({
    data: {
      tenantId,
      productId,
      qty: parsed.data.qty,
      reason: parsed.data.reason,
      memo: parsed.data.memo?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, item: row });
}
