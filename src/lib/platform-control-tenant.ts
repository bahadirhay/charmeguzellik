import { normalizeHost } from "@/lib/tenant-db";

/** Randevu / SaaS kontrol kiracı cuid — Neon’dan kesin yapıştırın; yalnızca bu kiracının panelinden müşteri siteleri oluşturulabilir */
export function platformControlTenantId(): string | null {
  const raw = process.env.PLATFORM_CONTROL_TENANT_ID?.trim();
  return raw || null;
}

/** İstenirse ana panel host’u doğrulanır (`randevu.techizmet.com`). Boşsa yalnızca tenant-id kontrolü yeterli. */
export function platformControlExpectedHostNormalized(): string | null {
  const raw = process.env.PLATFORM_CONTROL_HOST?.trim();
  return normalizeHost(raw);
}

export function isPlatformProvisionAllowedForHost(requestHostNormalized: string | null): boolean {
  const expected = platformControlExpectedHostNormalized();
  if (!expected) return true;
  if (!requestHostNormalized) return false;
  return requestHostNormalized === expected;
}
