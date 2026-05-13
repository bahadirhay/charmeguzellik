import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { ensureTenantModuleUnlockKeys } from "@/lib/tenant-module-unlock";

/** Eksik modül anahtarlarını üretir; düz metin yalnızca bu yanıtta döner (bir kez kopyalayın). */
export async function POST() {
  const auth = await requireStaffApiPerm("site.modules");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  const newTokens = await ensureTenantModuleUnlockKeys(prisma, tenantId);
  if (Object.keys(newTokens).length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Tüm modül anahtarları zaten tanımlı. Yenilemek için destek ile iletişime geçin veya veritabanında hash sıfırlanır.",
      newTokens: {},
    });
  }
  return NextResponse.json({
    ok: true,
    message: "Yeni anahtarlar üretildi. GitHub Secret veya güvenli kasaya kaydedin; tekrar gösterilmez.",
    newTokens,
  });
}
