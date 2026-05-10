import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import {
  allStaffPermissions,
  hasAnyStaffPermission,
  hasStaffPermission,
  parsePermissionsJson,
} from "@/lib/staff-permissions";

export type StaffAccess = {
  isLoggedIn: true;
  username: string;
  permissions: string[];
  isLegacy: boolean;
  staffUserId?: string;
  /** Oturumdaki personel görünen adı — `crm.appointments.self` için randevu eşleşmesi */
  staffDisplayName?: string | null;
  roleSlug?: string;
};

function permissionsFromSession(s: {
  isLoggedIn?: boolean;
  permissionsJson?: string;
  authKind?: string;
  email?: string;
}): string[] {
  if (s.permissionsJson) {
    const p = parsePermissionsJson(s.permissionsJson);
    if (p.length) return p;
  }
  if (s.isLoggedIn && (s.authKind === "legacy" || s.email)) {
    return allStaffPermissions();
  }
  return [];
}

export async function getStaffAccess(): Promise<StaffAccess | null> {
  const s = await getAdminSession();
  if (!s.isLoggedIn) return null;
  const currentTenantId = await getTenantIdForRequest();
  /**
   * Personel oturumu: yetkiyi host’tan çözülen kiracı ile StaffUser.tenantId üzerinden doğrularız.
   * Eski bug’larda session.tenantId ile header çözümü uyuşmasa bile aynı personel doğru kiracıdaysa panele düşmez.
   * Legacy (staffUserId yok): session.tenantId hâlâ zorunlu — yoksa çapraz site denemesi açılırdı.
   */
  if (s.staffUserId) {
    const u = await prisma.staffUser.findUnique({
      where: { id: s.staffUserId },
      select: { tenantId: true, active: true },
    });
    if (!u?.active || u.tenantId !== currentTenantId) return null;
  } else if (s.tenantId != null && s.tenantId !== currentTenantId) {
    return null;
  }
  const raw = permissionsFromSession(s);
  const permissions = raw.length ? raw : allStaffPermissions();
  const username = (s.username ?? s.email ?? "admin").trim();
  const isLegacy = s.authKind === "legacy" || (!s.staffUserId && !!s.email);
  return {
    isLoggedIn: true,
    username,
    permissions,
    isLegacy,
    staffUserId: s.staffUserId,
    staffDisplayName: typeof s.staffDisplayName === "string" ? s.staffDisplayName.trim() || null : null,
    roleSlug: s.roleSlug,
  };
}

export async function requireStaffPage(): Promise<StaffAccess> {
  const a = await getStaffAccess();
  if (!a) redirect("/admin/login");
  return a;
}

/** Sunucu bileşenlerinde: yetersiz yetki → özet sayfasına */
export async function requirePagePermission(need: string | readonly string[]) {
  const a = await requireStaffPage();
  const needs = Array.isArray(need) ? need : [need];
  if (!hasAnyStaffPermission(a.permissions, needs)) {
    redirect("/admin/dashboard?forbidden=1");
  }
  return a;
}

export async function requireStaffApi(): Promise<StaffAccess | NextResponse> {
  const a = await getStaffAccess();
  if (!a) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  return a;
}

export function staffPermDenied(): NextResponse {
  return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
}

export function ensureStaffPerm(a: StaffAccess, perm: string): NextResponse | null {
  if (!hasStaffPermission(a.permissions, perm)) return staffPermDenied();
  return null;
}
