#!/usr/bin/env node
/**
 * Bir PostgreSQL verisini başka bir PostgreSQL üzerine kopyalar (sayfa, ayar, menü, vitrin, personel, lead/randevu).
 *
 * Hedef: DATABASE_URL (.env)
 * Kaynak: MIRROR_SOURCE_DATABASE_URL (PowerShell'de set; Git'e yazmayın)
 *
 *   $env:MIRROR_SOURCE_DATABASE_URL="postgresql://...kaynak..."
 *   npm run db:mirror -- --dry-run
 *   npm run db:mirror -- --apply
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

loadEnv({ path: resolve(root, ".env"), override: true });
loadEnv({ path: resolve(root, ".env.local"), override: true });

/** Aynı DB tespiti için (sorgu parametre sırası farkını yumuşatır). */
function normalizeDbUrl(u) {
  try {
    const x = new URL(u);
    const keys = [...x.searchParams.keys()].sort();
    const q = keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(x.searchParams.get(k) ?? "")}`).join("&");
    return `${x.protocol}//${x.host}${x.pathname}${q ? `?${q}` : ""}`;
  } catch {
    return u.trim();
  }
}

function parseArgs(argv) {
  return {
    dryRun: !argv.includes("--apply"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function sortNavItems(items) {
  const byId = new Map(items.map((n) => [n.id, n]));
  function depth(n) {
    if (!n.parentId) return 0;
    const p = byId.get(n.parentId);
    return p ? 1 + depth(p) : 0;
  }
  return [...items].sort((a, b) => {
    const da = depth(a);
    const db = depth(b);
    if (da !== db) return da - db;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`
db:mirror — Kaynak PostgreSQL → hedef (DATABASE_URL)

Ortam:
  MIRROR_SOURCE_DATABASE_URL  kaynak bağlantı
  DATABASE_URL                hedef (Neon üretim)

Komutlar:
  npm run db:mirror -- --dry-run
  npm run db:mirror -- --apply
`);
    process.exit(0);
  }

  const sourceUrl = process.env.MIRROR_SOURCE_DATABASE_URL?.trim();
  const targetUrl = process.env.DATABASE_URL?.trim();

  if (!sourceUrl?.startsWith("postgres")) {
    process.stderr.write("MIRROR_SOURCE_DATABASE_URL tanımlayın (postgresql://...).\n");
    process.exit(1);
  }
  if (!targetUrl?.startsWith("postgres")) {
    process.stderr.write("DATABASE_URL hedef olarak tanımlı değil.\n");
    process.exit(1);
  }
  if (normalizeDbUrl(sourceUrl) === normalizeDbUrl(targetUrl)) {
    process.stdout.write(
      "\nKaynak ve hedef aynı veritabanı (DATABASE_URL = MIRROR_SOURCE_DATABASE_URL).\n" +
        "Kopyalama gerekmez; veri zaten tek yerde. Farklı bir Neon dalı / başka proje URL’si ile kopyalarsınız.\n",
    );
    if (args.dryRun) process.exit(0);
    process.stderr.write("\n--apply ile aynı veritabanına yazma yapılmaz.\n");
    process.exit(1);
  }

  const src = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const dst = new PrismaClient({ datasources: { db: { url: targetUrl } } });

  try {
    const snap = async (label, client) => ({
      label,
      page: await client.page.count(),
      nav: await client.navItem.count(),
      ig: await client.siteInstagramPost.count(),
      yt: await client.siteYoutubeVideo.count(),
      tt: await client.siteTiktokVideo.count(),
      staff: await client.staffUser.count(),
      roles: await client.staffRole.count(),
    });
    process.stdout.write(`\n${JSON.stringify({ kaynak: await snap("src", src), hedef: await snap("dst", dst) }, null, 2)}\n`);

    if (args.dryRun) {
      process.stdout.write("\nDry-run bitti. Uygulamak için: npm run db:mirror -- --apply\n");
      return;
    }

    const roles = await src.staffRole.findMany();
    const users = await src.staffUser.findMany();
    const settings = await src.siteSettings.findUnique({ where: { id: 1 } });
    const pages = await src.page.findMany();
    const nav = sortNavItems(await src.navItem.findMany());
    const ig = await src.siteInstagramPost.findMany();
    const yt = await src.siteYoutubeVideo.findMany();
    const tt = await src.siteTiktokVideo.findMany();
    const leads = await src.lead.findMany();
    const crm = await src.crmContact.findMany();
    const appts = await src.appointment.findMany();

    await dst.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        TRUNCATE TABLE
          "Appointment",
          "CrmContact",
          "Lead",
          "NavItem",
          "Page",
          "SiteInstagramPost",
          "SiteYoutubeVideo",
          "SiteTiktokVideo",
          "StaffUser",
          "StaffRole"
        RESTART IDENTITY CASCADE;
      `);

      if (roles.length) await tx.staffRole.createMany({ data: roles });
      if (users.length) await tx.staffUser.createMany({ data: users });

      if (settings) {
        await tx.siteSettings.upsert({
          where: { id: 1 },
          create: settings,
          update: {
            siteName: settings.siteName,
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
            themeTokensJson: settings.themeTokensJson,
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
          },
        });
      }

      if (pages.length) await tx.page.createMany({ data: pages });
      if (nav.length) await tx.navItem.createMany({ data: nav });
      if (ig.length) await tx.siteInstagramPost.createMany({ data: ig });
      if (yt.length) await tx.siteYoutubeVideo.createMany({ data: yt });
      if (tt.length) await tx.siteTiktokVideo.createMany({ data: tt });
      if (leads.length) await tx.lead.createMany({ data: leads });
      if (crm.length) await tx.crmContact.createMany({ data: crm });
      if (appts.length) await tx.appointment.createMany({ data: appts });
    });

    process.stdout.write("\nKopya tamam (SiteSettings id=1 korunarak güncellendi).\n");
  } finally {
    await src.$disconnect();
    await dst.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
