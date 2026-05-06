#!/usr/bin/env node
/**
 * Seçenekli geri yükleme:
 * - pages    : Page + NavItem
 * - contents : SiteSettings + sosyal vitrin tabloları
 * - database : tüm veritabanı tabloları
 * - files    : public/uploads + public/webpace-mirror
 * - all      : hepsi
 *
 * Örnek:
 *   npm run backup:restore -- --from backups/backup-20260506-140000 --all
 *   npm run backup:restore -- --from backups/backup-... --pages --contents --files
 */

import { readFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
loadEnv({ path: resolve(root, ".env"), override: true });
loadEnv({ path: resolve(root, ".env.local"), override: true });

const prisma = new PrismaClient();

const ALL_MODELS = [
  "Page",
  "SiteSettings",
  "SiteInstagramPost",
  "SiteYoutubeVideo",
  "SiteTiktokVideo",
  "Lead",
  "CrmContact",
  "Appointment",
  "NavItem",
  "StaffRole",
  "StaffUser",
];

const PAGES_MODELS = ["Page", "NavItem"];
const CONTENT_MODELS = ["SiteSettings", "SiteInstagramPost", "SiteYoutubeVideo", "SiteTiktokVideo"];

function parseArgs(argv) {
  const has = (flag) => argv.includes(flag);
  return {
    all: has("--all"),
    pages: has("--pages"),
    contents: has("--contents"),
    database: has("--database"),
    files: has("--files"),
    apply: has("--apply"),
    help: has("--help") || has("-h"),
    from: (() => {
      const idx = argv.findIndex((x) => x === "--from");
      if (idx < 0) return null;
      return argv[idx + 1] ?? null;
    })(),
  };
}

async function askYesNo(rl, q) {
  const ans = (await rl.question(`${q} (e/h): `)).trim().toLowerCase();
  return ans === "e" || ans === "y" || ans === "yes";
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
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

async function restoreDatabase(backupDir, models) {
  const dbDir = join(backupDir, "database");
  const has = (m) => models.includes(m) && existsSync(join(dbDir, `${m}.json`));

  await prisma.$transaction(async (tx) => {
    // FK güvenli sıra: bağımlı -> parent sil, parent -> bağımlı ekle
    if (has("Appointment")) await tx.appointment.deleteMany({});
    if (has("CrmContact")) await tx.crmContact.deleteMany({});
    if (has("Lead")) await tx.lead.deleteMany({});
    if (has("NavItem")) await tx.navItem.deleteMany({});
    if (has("Page")) await tx.page.deleteMany({});
    if (has("SiteInstagramPost")) await tx.siteInstagramPost.deleteMany({});
    if (has("SiteYoutubeVideo")) await tx.siteYoutubeVideo.deleteMany({});
    if (has("SiteTiktokVideo")) await tx.siteTiktokVideo.deleteMany({});
    if (has("StaffUser")) await tx.staffUser.deleteMany({});
    if (has("StaffRole")) await tx.staffRole.deleteMany({});
    if (has("SiteSettings")) await tx.siteSettings.deleteMany({});

    if (has("StaffRole")) {
      const rows = await readJson(join(dbDir, "StaffRole.json"));
      if (rows.length) await tx.staffRole.createMany({ data: rows });
    }
    if (has("StaffUser")) {
      const rows = await readJson(join(dbDir, "StaffUser.json"));
      if (rows.length) await tx.staffUser.createMany({ data: rows });
    }
    if (has("SiteSettings")) {
      const rows = await readJson(join(dbDir, "SiteSettings.json"));
      if (rows.length) await tx.siteSettings.createMany({ data: rows });
    }
    if (has("Page")) {
      const rows = await readJson(join(dbDir, "Page.json"));
      if (rows.length) await tx.page.createMany({ data: rows });
    }
    if (has("NavItem")) {
      const rows = sortNavItems(await readJson(join(dbDir, "NavItem.json")));
      if (rows.length) await tx.navItem.createMany({ data: rows });
    }
    if (has("SiteInstagramPost")) {
      const rows = await readJson(join(dbDir, "SiteInstagramPost.json"));
      if (rows.length) await tx.siteInstagramPost.createMany({ data: rows });
    }
    if (has("SiteYoutubeVideo")) {
      const rows = await readJson(join(dbDir, "SiteYoutubeVideo.json"));
      if (rows.length) await tx.siteYoutubeVideo.createMany({ data: rows });
    }
    if (has("SiteTiktokVideo")) {
      const rows = await readJson(join(dbDir, "SiteTiktokVideo.json"));
      if (rows.length) await tx.siteTiktokVideo.createMany({ data: rows });
    }
    if (has("Lead")) {
      const rows = await readJson(join(dbDir, "Lead.json"));
      if (rows.length) await tx.lead.createMany({ data: rows });
    }
    if (has("CrmContact")) {
      const rows = await readJson(join(dbDir, "CrmContact.json"));
      if (rows.length) await tx.crmContact.createMany({ data: rows });
    }
    if (has("Appointment")) {
      const rows = await readJson(join(dbDir, "Appointment.json"));
      if (rows.length) await tx.appointment.createMany({ data: rows });
    }
  });
}

async function restoreFiles(backupDir) {
  const filesDir = join(backupDir, "files");
  const items = [
    { name: "uploads", dst: join(root, "public", "uploads") },
    { name: "webpace-mirror", dst: join(root, "public", "webpace-mirror") },
  ];
  const copied = [];
  for (const it of items) {
    const src = join(filesDir, it.name);
    if (!existsSync(src)) continue;
    await cp(src, it.dst, { recursive: true, force: true });
    copied.push(it.name);
  }
  return copied;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help || !parsed.from) {
    output.write(`
backup:restore — seçenekli geri yükleme

Zorunlu:
  --from <backup-klasoru>

Seçenekler:
  --all
  --pages
  --contents
  --database
  --files
  --apply

Örnek:
  npm run backup:restore -- --from backups/backup-20260506-140000 --all --apply
`);
    process.exit(parsed.from ? 0 : 1);
  }

  const backupDir = resolve(root, parsed.from);
  const manifestPath = join(backupDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.json bulunamadı: ${manifestPath}`);
  }

  const manifest = await readJson(manifestPath);
  output.write(`\nYedek: ${backupDir}\n`);
  output.write(`Tarih: ${manifest.createdAt}\n`);
  output.write(`DB tabloları: ${(manifest.dbTables || []).join(", ") || "-"}\n`);
  output.write(`Dosya klasörleri: ${(manifest.fileFolders || []).join(", ") || "-"}\n`);

  let modes = parsed;
  const noFlags = !parsed.all && !parsed.pages && !parsed.contents && !parsed.database && !parsed.files;
  if (noFlags) {
    const rl = createInterface({ input, output });
    try {
      const all = await askYesNo(rl, "Hepsini geri yüklemek istiyor musunuz?");
      if (all) modes = { ...parsed, all: true };
      else {
        const pages = await askYesNo(rl, "Sayfalar geri yüklensin mi?");
        const contents = await askYesNo(rl, "İçerikler geri yüklensin mi?");
        const database = await askYesNo(rl, "Tüm veritabanı geri yüklensin mi?");
        const files = await askYesNo(rl, "Dosyalar geri yüklensin mi?");
        modes = { ...parsed, pages, contents, database, files };
      }
    } finally {
      rl.close();
    }
  }

  if (!modes.apply) {
    output.write("\nDry-run: Değişiklik uygulanmadı. Uygulamak için komuta --apply ekleyin.\n");
    process.exit(0);
  }

  const selected = new Set();
  if (modes.all || modes.database) {
    ALL_MODELS.forEach((m) => selected.add(m));
  } else {
    if (modes.pages) PAGES_MODELS.forEach((m) => selected.add(m));
    if (modes.contents) CONTENT_MODELS.forEach((m) => selected.add(m));
  }

  if (selected.size) {
    await restoreDatabase(backupDir, [...selected]);
    output.write(`\nDB geri yüklendi: ${[...selected].join(", ")}\n`);
  }
  if (modes.all || modes.files) {
    const copied = await restoreFiles(backupDir);
    output.write(`Dosyalar geri yüklendi: ${copied.join(", ") || "-"}\n`);
  }

  output.write("\nGeri yükleme tamam.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
