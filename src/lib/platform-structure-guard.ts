import { NextResponse } from "next/server";
import { platformControlTenantId } from "@/lib/platform-control-tenant";
import type { StaffAccess } from "@/lib/staff-auth";

/** Platform panelinde yalnızca tam yönetici (admin rolü) değiştirebilir. */
export function isPlatformTenantId(tenantId: string): boolean {
  const plat = platformControlTenantId();
  return Boolean(plat && tenantId === plat);
}

export function isStructureAdmin(auth: Pick<StaffAccess, "roleSlug" | "isLegacy">): boolean {
  if (auth.isLegacy) return true;
  const slugs = (auth.roleSlug ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return slugs.includes("admin");
}

/** Site iskeleti API’leri — platform kiracısında admin dışına kapalı. */
export const PLATFORM_STRUCTURE_PATH_PREFIXES = [
  "/api/admin/settings",
  "/api/admin/pages",
  "/api/admin/nav",
  "/api/admin/site-regions",
  "/api/admin/theme",
  "/api/admin/media",
  "/api/admin/sitemap",
  "/api/admin/backups",
  "/api/admin/platform",
  "/api/admin/tenant-features",
  "/api/admin/staff/roles",
  "/api/admin/instagram",
  "/api/admin/youtube",
  "/api/admin/tiktok",
] as const;

export function denyUnlessStructureAdminOnPlatform(
  tenantId: string,
  auth: Pick<StaffAccess, "roleSlug" | "isLegacy">,
  pathname: string,
  method: string,
): NextResponse | null {
  if (!isPlatformTenantId(tenantId)) return null;
  if (method === "GET" || method === "HEAD") return null;
  if (isStructureAdmin(auth)) return null;
  for (const p of PLATFORM_STRUCTURE_PATH_PREFIXES) {
    if (pathname.startsWith(p)) {
      return NextResponse.json(
        {
          error:
            "randevu.techizmet.com üzerinde site yapısı (ayarlar, sayfalar, menü, roller tanımı vb.) yalnızca Yönetici (admin) rolü ile değiştirilebilir.",
        },
        { status: 403 },
      );
    }
  }
  return null;
}
