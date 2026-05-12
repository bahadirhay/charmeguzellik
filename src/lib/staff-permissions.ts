/** Panel yetki anahtarları — API ve sayfa korumasında kullanılır */
export const STAFF_PERMISSION_KEYS = [
  "site.settings",
  "site.theme",
  /** Kiracı randevu/ticaret modül anahtarları — yalnızca tam yönetici rolünde (editörde yok). */
  "site.modules",
  "content.pages",
  "content.regions",
  "content.nav",
  "content.sitemap",
  "social.instagram",
  "social.youtube",
  "social.tiktok",
  "crm.leads",
  "crm.appointments",
  /** Yalnızca kendisine atanmış randevular (notes içi [[STAFF:…]] ile eşleşir) */
  "crm.appointments.self",
  /** Fiyat listesi, cari, stok, paket, prim (Ticaret paneli) */
  "commerce.manage",
  "users.manage",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

export function allStaffPermissions(): string[] {
  return [...STAFF_PERMISSION_KEYS];
}

/** Editör: `site.settings`, `site.theme`, `site.modules` dışındaki tüm panel yetkileri. */
export function editorStaffPermissions(): string[] {
  return STAFF_PERMISSION_KEYS.filter(
    (k) => k !== "site.settings" && k !== "site.theme" && k !== "site.modules",
  );
}

export function parsePermissionsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function hasStaffPermission(perms: readonly string[], need: string): boolean {
  return perms.includes(need);
}

export function hasAnyStaffPermission(perms: readonly string[], needs: readonly string[]): boolean {
  return needs.some((n) => perms.includes(n));
}

/** Birden fazla rolün `permissionsJson` değerlerinden tekilleştirilmiş yetki listesi. */
export function mergePermissionsFromRoles(
  roles: ReadonlyArray<{ permissionsJson: string }>,
): string[] {
  const out = new Set<string>();
  for (const role of roles) {
    for (const p of parsePermissionsJson(role.permissionsJson)) {
      out.add(p);
    }
  }
  return [...out];
}
