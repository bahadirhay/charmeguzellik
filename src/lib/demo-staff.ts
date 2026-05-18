import { NextResponse } from "next/server";
import { isPlatformTenantId } from "@/lib/platform-structure-guard";
import type { StaffAccess } from "@/lib/staff-auth";

/** Virgülle ayrılmış; varsayılan: demo */
export function demoPanelUsernames(): Set<string> {
  const raw = process.env.DEMO_PANEL_USERNAMES?.trim() || "demo";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isDemoRoleSlug(roleSlug: string | undefined): boolean {
  if (!roleSlug?.trim()) return false;
  return roleSlug
    .split(",")
    .map((s) => s.trim())
    .includes("demo");
}

/** Platform demo hesabı (kullanıcı adı veya demo rolü). */
export function isDemoPanelActor(auth: Pick<StaffAccess, "username" | "roleSlug">): boolean {
  if (demoPanelUsernames().has(auth.username.trim().toLowerCase())) return true;
  return isDemoRoleSlug(auth.roleSlug);
}

/** Demo denetim kaydı yalnızca platform kiracısında (randevu.techizmet.com). */
export function shouldRecordDemoPanelAudit(tenantId: string, auth: Pick<StaffAccess, "username" | "roleSlug">): boolean {
  return isPlatformTenantId(tenantId) && isDemoPanelActor(auth);
}

const DEMO_BLOCKED_PATH_PREFIXES = [
  "/api/admin/settings",
  "/api/admin/pages",
  "/api/admin/nav",
  "/api/admin/site-regions",
  "/api/admin/theme",
  "/api/admin/backups",
  "/api/admin/platform",
  "/api/admin/tenant-features",
  "/api/admin/media",
  "/api/admin/sitemap",
  "/api/admin/staff/roles",
  "/api/admin/instagram",
  "/api/admin/youtube",
  "/api/admin/tiktok",
] as const;

const ROLES_DEMO_MAY_ASSIGN = new Set([
  "demo",
  "editor",
  "scheduler",
  "commerce",
  "practitioner",
]);

export function denyIfDemoRestrictedRoute(
  req: Request,
  auth: Pick<StaffAccess, "username" | "roleSlug">,
): NextResponse | null {
  if (!isDemoPanelActor(auth)) return null;
  const path = new URL(req.url).pathname;
  for (const p of DEMO_BLOCKED_PATH_PREFIXES) {
    if (path.startsWith(p)) {
      return NextResponse.json(
        {
          error:
            "Demo hesabı site yapısını değiştiremez. Randevu, ticaret ve sınırlı personel ekleme kullanılabilir; işlemler yönetici tarafından geri alınabilir.",
        },
        { status: 403 },
      );
    }
  }
  return null;
}

export function demoRoleAssignmentError(roles: Array<{ slug: string }>): string | null {
  if (roles.some((r) => r.slug === "admin")) {
    return "Demo hesabı Yönetici (admin) rolü atayamaz.";
  }
  const bad = roles.filter((r) => !ROLES_DEMO_MAY_ASSIGN.has(r.slug));
  if (bad.length > 0) {
    return `Demo hesabı yalnızca şu rolleri atayabilir: ${[...ROLES_DEMO_MAY_ASSIGN].join(", ")}`;
  }
  return null;
}

export async function staffUserHasAdminRole(tenantId: string, userId: string): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const u = await prisma.staffUser.findFirst({
    where: { id: userId, tenantId },
    include: {
      roleAssignments: { include: { role: { select: { slug: true } } } },
    },
  });
  return Boolean(u?.roleAssignments.some((a) => a.role.slug === "admin"));
}
