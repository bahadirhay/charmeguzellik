import type { Prisma } from "@prisma/client";

/** Kiracı özellikleri (genişletilebilir). */
export type TenantFeaturesJson = {
  appointments?: boolean;
  /** false ise Ticaret paneli ve /api/admin/commerce/* kapalı. Boş/undefined = açık (geriye uyum). */
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
  if (featuresJson == null) return true;
  if (typeof featuresJson !== "object" || Array.isArray(featuresJson)) return true;
  const v = (featuresJson as Record<string, unknown>).commerce;
  if (v === false) return false;
  return true;
}
