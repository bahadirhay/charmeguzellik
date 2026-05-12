import type { Prisma } from "@prisma/client";

/** Kiracı özellikleri (genişletilebilir). */
export type TenantFeaturesJson = {
  appointments?: boolean;
  /** Yalnızca `true` iken Ticaret paneli ve /api/admin/commerce/* açık (açık seçim). */
  commerce?: boolean;
};

export function isAppointmentsModuleEnabled(featuresJson: Prisma.JsonValue | null | undefined): boolean {
  if (featuresJson == null) return true;
  if (typeof featuresJson !== "object" || Array.isArray(featuresJson)) return true;
  const v = (featuresJson as Record<string, unknown>).appointments;
  if (v === false) return false;
  return true;
}

export function isCommerceModuleEnabled(featuresJson: Prisma.JsonValue | null | undefined): boolean {
  if (featuresJson == null) return false;
  if (typeof featuresJson !== "object" || Array.isArray(featuresJson)) return false;
  const v = (featuresJson as Record<string, unknown>).commerce;
  return v === true;
}
