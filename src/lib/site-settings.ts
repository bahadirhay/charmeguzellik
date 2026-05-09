import type { SiteSettings } from "@prisma/client";
import { prisma, withPrismaEngine } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";

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

export async function getSiteSettings(req?: Request) {
  const tenantId = await getTenantIdForRequest(req);
  let rowByTenant = await withPrismaEngine(() =>
    prisma.siteSettings.findUnique({ where: { tenantId } }),
  );
  if (rowByTenant) return rowByTenant;

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
  if (!row.tenantId) {
    row = await withPrismaEngine(() =>
      prisma.siteSettings.update({
        where: { id: 1 },
        data: { tenantId },
      }),
    );
    return row;
  }
  const maxId = await withPrismaEngine(() =>
    prisma.siteSettings.aggregate({ _max: { id: true } }),
  );
  const nextId = (maxId._max.id ?? 1) + 1;
  rowByTenant = await withPrismaEngine(() =>
    prisma.siteSettings.create({
      data: {
        id: nextId,
        siteName: row.siteName,
        activeThemeId: row.activeThemeId,
        mediaUploadSlug: row.mediaUploadSlug,
        headerPromoLine: row.headerPromoLine,
        showHeaderTopBar: row.showHeaderTopBar,
        socialInstagramUrl: row.socialInstagramUrl,
        socialFacebookUrl: row.socialFacebookUrl,
        defaultMetaTitle: row.defaultMetaTitle,
        defaultMetaDescription: row.defaultMetaDescription,
        businessJson: row.businessJson,
        googleAnalyticsId: row.googleAnalyticsId,
        googleTagManagerId: row.googleTagManagerId,
        facebookPixelId: row.facebookPixelId,
        customHeadHtml: row.customHeadHtml,
        whatsappNumber: row.whatsappNumber,
        seoKeywords: row.seoKeywords,
        instagramGraphUserId: row.instagramGraphUserId,
        instagramAccessToken: row.instagramAccessToken,
        themeTokensJson: row.themeTokensJson,
        headerBlocks: row.headerBlocks,
        footerBlocks: row.footerBlocks,
        sitemapExtrasJson: row.sitemapExtrasJson,
        sitemapHomePriority: row.sitemapHomePriority,
        sitemapPagePriority: row.sitemapPagePriority,
        smtpHost: row.smtpHost,
        smtpPort: row.smtpPort,
        smtpUser: row.smtpUser,
        smtpPass: row.smtpPass,
        smtpSecure: row.smtpSecure,
        transactionalMailFrom: row.transactionalMailFrom,
        cookieConsentJson: row.cookieConsentJson,
        appointmentNotifyAdminEmails: row.appointmentNotifyAdminEmails,
        appointmentNotifyOperatorEmails: row.appointmentNotifyOperatorEmails,
        tenantId,
      },
    }),
  );
  return rowByTenant;
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
