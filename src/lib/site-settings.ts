import type { SiteSettings } from "@prisma/client";
import { prisma, withPrismaEngine } from "@/lib/prisma";

/** Admin istemcisi: SMTP şifresi gönderilmez; yalnızca yapılandırılmış mı bilgisi */
export type SiteSettingsAdminClient = Omit<SiteSettings, "smtpPass"> & {
  /** İstemcide yalnızca yeni şifre girilir; sunucudan her zaman null gelir */
  smtpPass: string | null;
  smtpPassConfigured: boolean;
};

export function sanitizeSiteSettingsForAdminClient(row: SiteSettings): SiteSettingsAdminClient {
  const { smtpPass, ...rest } = row;
  return {
    ...rest,
    smtpPass: null,
    smtpPassConfigured: Boolean(smtpPass?.trim()),
  };
}

export async function getSiteSettings() {
  let row = await withPrismaEngine(() =>
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  );
  if (!row) {
    row = await withPrismaEngine(() =>
      prisma.siteSettings.create({
        data: { id: 1, siteName: "Güzellik Merkezi" },
      }),
    );
  }
  return row;
}

export function parseBusinessJson(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      name: string;
      description?: string;
      telephone?: string;
      address?: Record<string, string>;
      geo?: { latitude: number; longitude: number };
      url?: string;
      image?: string;
      priceRange?: string;
    };
  } catch {
    return null;
  }
}
