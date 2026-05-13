import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyUnlessPlatformProvisioner } from "@/lib/platform-provision-auth";
import { ensureTenantModuleUnlockKeys } from "@/lib/tenant-module-unlock";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const denied = await denyUnlessPlatformProvisioner(req);
  if (denied) return denied;
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;

  const { tenantId } = await ctx.params;
  if (!tenantId?.trim()) {
    return NextResponse.json({ error: "Geçersiz kiracı" }, { status: 400 });
  }

  const exists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Kiracı bulunamadı" }, { status: 404 });

  const newTokens = await ensureTenantModuleUnlockKeys(prisma, tenantId);
  if (Object.keys(newTokens).length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Bu kiracıda tüm modül anahtarları zaten tanımlı.",
      newTokens: {},
    });
  }
  return NextResponse.json({
    ok: true,
    message: "Yeni anahtarlar üretildi. GitHub Secret olarak saklayın; tekrar gösterilmez.",
    newTokens,
  });
}
