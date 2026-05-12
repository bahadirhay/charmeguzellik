import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  salePriceMinor: z.number().int().min(0).max(100_000_000).optional(),
  costMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  trackStock: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz" }, { status: 400 });
  const prev = await prisma.commerceProduct.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Ürün yok" }, { status: 404 });
  const row = await prisma.commerceProduct.update({
    where: { id: prev.id },
    data: {
      name: parsed.data.name?.trim() ?? prev.name,
      salePriceMinor: parsed.data.salePriceMinor ?? prev.salePriceMinor,
      costMinor: parsed.data.costMinor === undefined ? prev.costMinor : parsed.data.costMinor,
      trackStock: parsed.data.trackStock ?? prev.trackStock,
      active: parsed.data.active ?? prev.active,
    },
  });
  return NextResponse.json({ ok: true, item: row });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  const prev = await prisma.commerceProduct.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Ürün yok" }, { status: 404 });
  await prisma.commerceProduct.delete({ where: { id: prev.id } });
  return NextResponse.json({ ok: true });
}
