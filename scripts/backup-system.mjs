#!/usr/bin/env node
/**
 * Seçenekli sistem yedeği:
 * - pages    : Page + NavItem
 * - contents : SiteSettings + sosyal vitrin tabloları
 * - database : tüm veritabanı tabloları
 * - files    : public/uploads + public/webpace-mirror
 * - all      : hepsi
 *
 * Örnek:
 *   npm run backup:create -- --all
 *   npm run backup:create -- --pages --contents --files
 */

import { mkdir, cp, writeFile } from "node:fs/promises";
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

const MODEL_READERS = {
  Page: () => prisma.page.findMany(),
  SiteSettings: () => prisma.siteSettings.findMany(),
  SiteInstagramPost: () => prisma.siteInstagramPost.findMany(),
  SiteYoutubeVideo: () => prisma.siteYoutubeVideo.findMany(),
  SiteTiktokVideo: () => prisma.siteTiktokVideo.findMany(),
  Lead: () => prisma.lead.findMany(),
  CrmContact: () => prisma.crmContact.findMany(),
  Appointment: () => prisma.appointment.findMany(),
  NavItem: () => prisma.navItem.findMany(),
  StaffRole: () => prisma.staffRole.findMany(),
  StaffUser: () => prisma.staffUser.findMany(),
};

function parseArgs(argv) {
  const has = (flag) => argv.includes(flag);
  return {
    all: has("--all"),
    pages: has("--pages"),
    contents: has("--contents"),
    database: has("--database"),
    files: has("--files"),
    help: has("--help") || has("-h"),
    out: (() => {
      const idx = argv.findIndex((x) => x === "--out");
      if (idx < 0) return null;
      return argv[idx + 1] ?? null;
    })(),
  };
}

async function askYesNo(rl, q) {
  const ans = (await rl.question(`${q} (e/h): `)).trim().toLowerCase();
  return ans === "e" || ans === "y" || ans === "yes";
}

async function chooseModesInteractive() {
  const rl = createInterface({ input, output });
  try {
    output.write("\nYedek seçimi:\n");
    const all = await askYesNo(rl, "Hepsini yedekle (pages+contents+database+files)?");
    if (all) return { all: true, pages: false, contents: false, database: false, files: false };
    const pages = await askYesNo(rl, "Sayfalar (Page + NavItem) yedeklensin mi?");
    const contents = await askYesNo(rl, "İçerikler (SiteSettings + sosyal vitrin) yedeklensin mi?");
    const database = await askYesNo(rl, "Tüm veritabanı yedeklensin mi?");
    const files = await askYesNo(rl, "Dosyalar (public/uploads + webpace-mirror) yedeklensin mi?");
    return { all: false, pages, contents, database, files };
  } finally {
    rl.close();
  }
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function backupModels(outDir, models) {
  const dbDir = join(outDir, "database");
  await mkdir(dbDir, { recursive: true });
  const counts = {};
  for (const m of models) {
    const rows = await MODEL_READERS[m]();
    counts[m] = rows.length;
    await writeJson(join(dbDir, `${m}.json`), rows);
  }
  return counts;
}

async function backupFiles(outDir) {
  const filesDir = join(outDir, "files");
  await mkdir(filesDir, { recursive: true });
  const copied = [];
  const items = [
    { name: "uploads", src: join(root, "public", "uploads") },
    { name: "webpace-mirror", src: join(root, "public", "webpace-mirror") },
  ];
  for (const it of items) {
    if (!existsSync(it.src)) continue;
    const dst = join(filesDir, it.name);
    await cp(it.src, dst, { recursive: true, force: true });
    copied.push(it.name);
  }
  return copied;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    output.write(`
backup:create — seçenekli sistem yedeği

Seçenekler:
  --all
  --pages
  --contents
  --database
  --files
  --out <klasor>

Örnek:
  npm run backup:create -- --all
  npm run backup:create -- --pages --contents --files
`);
    process.exit(0);
  }

  let modes = parsed;
  const noFlags = !parsed.all && !parsed.pages && !parsed.contents && !parsed.database && !parsed.files;
  if (noFlags) {
    modes = { ...parsed, ...(await chooseModesInteractive()) };
  }

  const outRoot = parsed.out ? resolve(root, parsed.out) : resolve(root, "backups");
  const outDir = join(outRoot, `backup-${stamp()}`);
  await mkdir(outDir, { recursive: true });

  const selected = new Set();
  if (modes.all || modes.database) {
    ALL_MODELS.forEach((m) => selected.add(m));
  } else {
    if (modes.pages) PAGES_MODELS.forEach((m) => selected.add(m));
    if (modes.contents) CONTENT_MODELS.forEach((m) => selected.add(m));
  }

  const dbCounts = selected.size ? await backupModels(outDir, [...selected]) : {};
  const copiedFiles = modes.all || modes.files ? await backupFiles(outDir) : [];

  const manifest = {
    createdAt: new Date().toISOString(),
    project: "web-page",
    selected: {
      all: Boolean(modes.all),
      pages: Boolean(modes.pages),
      contents: Boolean(modes.contents),
      database: Boolean(modes.database),
      files: Boolean(modes.files),
    },
    dbTables: Object.keys(dbCounts),
    dbCounts,
    fileFolders: copiedFiles,
    restoreHint: [
      "npm run backup:restore -- --from <backup-klasoru> --all",
      "veya: --pages --contents --database --files kombinasyonu",
    ],
  };
  await writeJson(join(outDir, "manifest.json"), manifest);

  output.write(`\nYedek tamam: ${outDir}\n`);
  output.write(`Tablolar: ${Object.keys(dbCounts).join(", ") || "-"}\n`);
  output.write(`Dosyalar: ${copiedFiles.join(", ") || "-"}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
