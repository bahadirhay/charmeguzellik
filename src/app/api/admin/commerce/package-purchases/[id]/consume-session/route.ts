import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  /** Menüdeki hizmet adı veya normalize edilmiş anahtar ile eşleşir */
  serviceLabel: z.string().min(1).max(200),
  count: z.number().int().min(1).max(99).optional().default(1),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
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
  const key = normalizeServiceKey(parsed.data.serviceLabel);
  const count = parsed.data.count ?? 1;

  const purchase = await prisma.commercePackagePurchase.findFirst({
    where: { id: purchaseId, tenantId },
    include: { credits: true },
  });
  if (!purchase) return NextResponse.json({ error: "Satış bulunamadı" }, { status: 404 });

  const credit = purchase.credits.find((c) => c.serviceKey === key);
  if (!credit) {
    return NextResponse.json({ error: "Bu pakette bu hizmet için seans hakkı yok" }, { status: 400 });
  }
  if (credit.remaining < count) {
    return NextResponse.json({ error: "Kalan seans yetersiz" }, { status: 400 });
  }

  const updated = await prisma.commercePackageCredit.update({
    where: { id: credit.id },
    data: { remaining: credit.remaining - count },
  });

  return NextResponse.json({
    ok: true,
    credit: { serviceKey: updated.serviceKey, remaining: updated.remaining },
  });
}
