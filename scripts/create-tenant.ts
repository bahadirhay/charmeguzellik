import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_TENANT_ID_SEED } from "../src/lib/tenant-default";
import { ensureDefaultStaffRoles } from "../src/lib/staff-roles-defaults";
import { parseThemeTokens, themeTokensToJson } from "../src/lib/theme-tokens";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env.local"), override: true });
config({ path: resolve(root, ".env") });

const prisma = new PrismaClient();

function parseArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

async function main() {
  const slug = (parseArg("slug") ?? "").trim().toLowerCase();
  const name = (parseArg("name") ?? slug).trim();
  const hostArg = parseArg("host");
  const host = hostArg ? normalizeHost(hostArg) : "";

  if (!slug || !name || !host) {
    throw new Error(
      "Kullanim: npm run tenant:create -- --slug=<slug> --name=<ad> --host=<alan-adi> [--clone-content] [--bootstrap-admin]",
    );
  }

  const cloneContent = hasFlag("clone-content");
  const bootstrapAdmin = hasFlag("bootstrap-admin");

  const defaultTenant = await prisma.tenant.findUnique({
    where: { id: DEFAULT_TENANT_ID_SEED },
    include: { siteSettings: true },
  });
  if (!defaultTenant) {
    throw new Error("Varsayilan tenant bulunamadi. Once seed calistirin.");
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

  const settings = defaultTenant.siteSettings[0];
  if (!settings) {
    await prisma.siteSettings.create({
      data: { siteName: name, tenantId: tenant.id },
    });
  } else {
    const existing = await prisma.siteSettings.findUnique({ where: { tenantId: tenant.id } });
    if (!existing) {
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
          tenantId: tenant.id,
        },
      });
    }
  }

  await ensureDefaultStaffRoles(prisma, tenant.id);

  if (bootstrapAdmin) {
    const plain = process.env.ADMIN_PASSWORD?.trim();
    if (!plain || plain.length < 6) {
      throw new Error("--bootstrap-admin icin .env icinde ADMIN_PASSWORD en az 6 karakter olmali.");
    }
    const adminRole = await prisma.staffRole.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "admin" } },
    });
    if (!adminRole) throw new Error(`Bu tenant icin admin rolu yok: ${tenant.slug}`);

    const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
    const username = raw.length >= 2 ? raw : "admin";
    const hash = await bcrypt.hash(plain, 12);

    await prisma.staffUser.upsert({
      where: { tenantId_username: { tenantId: tenant.id, username } },
      create: {
        tenantId: tenant.id,
        username,
        passwordHash: hash,
        displayName: "Yönetici",
        roleId: adminRole.id,
        active: true,
      },
      update: {
        passwordHash: hash,
        active: true,
        roleId: adminRole.id,
      },
    });
    console.log(`[admin] Panel kullanicisi ayarlandi: "${username}" (ADMIN_PASSWORD ile)`);
  }

  if (cloneContent) {
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
      console.log(`[clone] ${pages.length} sayfa kopyalandi (kaynak: ${src}).`);
    } else {
      console.log("[clone] Hedef tenantta zaten sayfa var; sayfa kopyasi atlandi.");
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
      console.log(`[clone] ${items.length} menu ogesi kopyalandi (kaynak: ${src}).`);
    } else {
      console.log("[clone] Hedef tenantta zaten menu var; menu kopyasi atlandi.");
    }
  }

  console.log(`Tenant hazir: ${tenant.slug} (${tenant.id})`);
  console.log(`Domain map: ${host} -> ${tenant.id}`);
}

main()
  .catch((e) => {
    console.error("[create-tenant] hata", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
