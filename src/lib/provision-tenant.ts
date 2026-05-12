import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TENANT_ID_SEED, DEFAULT_TENANT_SLUG } from "@/lib/tenant-default";
import type { TenantFeaturesJson } from "@/lib/tenant-features";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { parseThemeTokens, themeTokensToJson } from "@/lib/theme-tokens";

export type ProvisionTenantParams = {
  slug: string;
  name: string;
  host: string;
  cloneContent: boolean;
  /** false ise randevu modülü kapalı (tenant.featuresJson). Varsayılan: açık. */
  appointmentsEnabled?: boolean;
  /** true ise ticaret modülü açık. Atlanırsa kapalı (açık seçim). */
  commerceEnabled?: boolean;
  bootstrapAdmin?: { username: string; passwordPlain: string };
};

export type ProvisionTenantResult = {
  tenantId: string;
  slug: string;
  host: string;
};

export class ProvisionConflictError extends Error {
  readonly code = "conflict";

  constructor(
    readonly kind: "host_taken" | "invalid_slug" | "invalid_host" | "platform_slug",
    message: string,
  ) {
    super(message);
    this.name = "ProvisionConflictError";
  }
}

const SLUG_RE = /^[a-z]([a-z0-9-]*)[a-z0-9]$/;

function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, "");
}

function validateSlug(slug: string) {
  if (slug.length < 2 || slug.length > 64 || !SLUG_RE.test(slug)) {
    throw new ProvisionConflictError(
      "invalid_slug",
      "Slug 2-64 karakter; küçük harf ile başlar, küçük harf, rakam ve tire içerebilir.",
    );
  }
}

function validateHost(host: string) {
  const h = normalizeHost(host);
  if (!h || h.length > 253 || !/^[a-z0-9.-]+$/.test(h) || h.includes("..")) {
    throw new ProvisionConflictError("invalid_host", "Geçersiz alan adı.");
  }
}

export async function provisionTenant(
  prisma: PrismaClient,
  params: ProvisionTenantParams,
  opts?: { forbidSlugs?: readonly string[] },
): Promise<ProvisionTenantResult> {
  const slug = normalizeSlug(params.slug);
  const name = params.name.trim() || slug;
  const host = normalizeHost(params.host);

  validateSlug(slug);
  validateHost(host);
  const reserved = [...(opts?.forbidSlugs ?? []), DEFAULT_TENANT_SLUG].filter(Boolean);
  if (reserved.includes(slug)) {
    throw new ProvisionConflictError("platform_slug", "Bu slug ayrılmış veya zaten kullanılıyor.");
  }

  const defaultTenant = await prisma.tenant.findUnique({
    where: { id: DEFAULT_TENANT_ID_SEED },
    include: { siteSettings: true },
  });
  if (!defaultTenant) {
    throw new Error("Varsayılan tenant bulunamadı.");
  }

  const existingDom = await prisma.tenantDomain.findUnique({ where: { host } });
  if (existingDom) {
    const t = await prisma.tenant.findUnique({ where: { slug } });
    if (!t || t.id !== existingDom.tenantId) {
      throw new ProvisionConflictError("host_taken", "Bu alan adı başka bir kiracıya bağlı.");
    }
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    create: { slug, name, status: "active" },
    update: { name, status: "active" },
  });

  await prisma.tenantDomain.upsert({
    where: { host },
    create: { tenantId: tenant.id, host, isPrimary: true },
    update: { tenantId: tenant.id, isPrimary: true },
  });

  const featurePatch: TenantFeaturesJson = {
    appointments: params.appointmentsEnabled !== false,
    commerce: params.commerceEnabled === true,
  };
  {
    const cur = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { featuresJson: true } });
    const base: TenantFeaturesJson =
      cur?.featuresJson != null && typeof cur.featuresJson === "object" && !Array.isArray(cur.featuresJson)
        ? { ...(cur.featuresJson as TenantFeaturesJson) }
        : {};
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { featuresJson: { ...base, ...featurePatch } as object },
    });
  }

  const settings = defaultTenant.siteSettings[0];
  if (!settings) {
    await prisma.siteSettings.create({
      data: { siteName: name, tenantId: tenant.id },
    });
  } else {
    const existingTs = await prisma.siteSettings.findUnique({ where: { tenantId: tenant.id } });
    if (!existingTs) {
      const maxId = await prisma.siteSettings.aggregate({ _max: { id: true } });
      const tokens = parseThemeTokens(settings.themeTokensJson);
      delete tokens.telegramBotToken;
      delete tokens.telegramChatId;
      delete tokens.appointmentStaffByService;
      const themeTokensJson = themeTokensToJson(tokens);
      await prisma.siteSettings.create({
        data: {
          id: (maxId._max.id ?? 1) + 1,
          siteName: name,
          activeThemeId: settings.activeThemeId,
          mediaUploadSlug: settings.mediaUploadSlug,
          headerPromoLine: settings.headerPromoLine,
          showHeaderTopBar: settings.showHeaderTopBar,
          socialInstagramUrl: settings.socialInstagramUrl,
          socialFacebookUrl: settings.socialFacebookUrl,
          defaultMetaTitle: settings.defaultMetaTitle,
          defaultMetaDescription: settings.defaultMetaDescription,
          businessJson: settings.businessJson,
          googleAnalyticsId: settings.googleAnalyticsId,
          googleTagManagerId: settings.googleTagManagerId,
          facebookPixelId: settings.facebookPixelId,
          customHeadHtml: settings.customHeadHtml,
          whatsappNumber: settings.whatsappNumber,
          seoKeywords: settings.seoKeywords,
          instagramGraphUserId: settings.instagramGraphUserId,
          instagramAccessToken: settings.instagramAccessToken,
          themeTokensJson,
          headerBlocks: settings.headerBlocks,
          footerBlocks: settings.footerBlocks,
          sitemapExtrasJson: settings.sitemapExtrasJson,
          sitemapHomePriority: settings.sitemapHomePriority,
          sitemapPagePriority: settings.sitemapPagePriority,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPass: settings.smtpPass,
          smtpSecure: settings.smtpSecure,
          transactionalMailFrom: settings.transactionalMailFrom,
          cookieConsentJson: settings.cookieConsentJson,
          appointmentNotifyAdminEmails: null,
          appointmentNotifyOperatorEmails: null,
          appointmentPanelShowListPrices: false,
          tenantId: tenant.id,
        },
      });
    }
  }

  await ensureDefaultStaffRoles(prisma, tenant.id);

  const ba = params.bootstrapAdmin;
  if (ba?.passwordPlain) {
    if (ba.passwordPlain.length < 8) {
      throw new Error("Panel şifresi en az 8 karakter olmalı.");
    }
    const adminRole = await prisma.staffRole.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "admin" } },
    });
    if (!adminRole) throw new Error(`Admin rolü yok: ${tenant.slug}`);
    let uname = ba.username.trim().toLowerCase().replace(/\s+/g, "");
    if (uname.length < 2) uname = "admin";
    const hash = await bcrypt.hash(ba.passwordPlain, 12);
    await prisma.staffUser.upsert({
      where: { tenantId_username: { tenantId: tenant.id, username: uname } },
      create: {
        tenantId: tenant.id,
        username: uname,
        passwordHash: hash,
        displayName: "Yönetici",
        active: true,
        roleAssignments: { create: [{ roleId: adminRole.id }] },
      },
      update: {
        passwordHash: hash,
        active: true,
        roleAssignments: { deleteMany: {}, create: [{ roleId: adminRole.id }] },
      },
    });
  }

  if (params.cloneContent) {
    const src = DEFAULT_TENANT_ID_SEED;
    const pageCount = await prisma.page.count({ where: { tenantId: tenant.id } });
    if (pageCount === 0) {
      const pages = await prisma.page.findMany({ where: { tenantId: src } });
      for (const p of pages) {
        await prisma.page.create({
          data: {
            tenantId: tenant.id,
            slug: p.slug,
            title: p.title,
            metaTitle: p.metaTitle,
            metaDescription: p.metaDescription,
            ogImage: p.ogImage,
            canonicalPath: p.canonicalPath,
            blocks: p.blocks,
            blocksMobile: p.blocksMobile,
            published: p.published,
            noIndex: p.noIndex,
            includeInSitemap: p.includeInSitemap,
            sitemapPriority: p.sitemapPriority,
            sitemapChangeFrequency: p.sitemapChangeFrequency,
          },
        });
      }
    }

    const navCount = await prisma.navItem.count({ where: { tenantId: tenant.id } });
    if (navCount === 0) {
      const items = await prisma.navItem.findMany({ where: { tenantId: src } });

      const roots = items
        .filter((i) => i.parentId == null)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

      async function cloneItem(
        it: (typeof items)[number],
        newParentId: string | null,
      ): Promise<void> {
        const row = await prisma.navItem.create({
          data: {
            tenantId: tenant.id,
            menuSlug: it.menuSlug,
            parentId: newParentId,
            label: it.label,
            href: it.href,
            sortOrder: it.sortOrder,
            published: it.published,
            openInNewTab: it.openInNewTab,
          },
        });
        const kids = items
          .filter((c) => c.parentId === it.id)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
        for (const k of kids) await cloneItem(k, row.id);
      }

      for (const r of roots) await cloneItem(r, null);
    }
  }

  return { tenantId: tenant.id, slug: tenant.slug, host };
}
