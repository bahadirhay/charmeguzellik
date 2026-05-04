/**
 * prisma/seed-data.ts ile birebir aynı şema + tam seed verisini tek SQL dosyasında üretir.
 *
 *   npm run sql:neon-full
 *
 * Çıktı: scripts/sql/neon-full-bootstrap.sql
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED_NAV_ITEMS,
  SEED_STAFF_ROLES,
  SEED_STAFF_USER_ID,
  buildAllSeedPages,
  salonSettingsData,
} from "../prisma/seed-data";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "scripts", "sql");
const outFile = join(outDir, "neon-full-bootstrap.sql");

function dollarQuote(body: string): string {
  let i = 0;
  let tag: string;
  do {
    tag = `d${i}`;
    i++;
  } while (body.includes(`$${tag}$`));
  return `$${tag}$${body}$${tag}$`;
}

function qIdent(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** Neon SQL Editor’da değiştirin (en az 6 karakter). */
const BOOTSTRAP_ADMIN_PASSWORD = "CharmeGecici2026!";

function prismaDiffDdl(): string {
  return execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { cwd: root, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

function siteSettingsUpsertSql(): string {
  const cols = ['"id"', ...Object.keys(salonSettingsData).map((k) => qIdent(k)), '"updatedAt"'];
  const vals = [
    "1",
    ...Object.values(salonSettingsData).map((v) => dollarQuote(String(v))),
    "NOW()",
  ];
  const setParts = Object.keys(salonSettingsData)
    .map((k) => `${qIdent(k)} = EXCLUDED.${qIdent(k)}`)
    .concat([`"updatedAt" = NOW()`]);
  return `INSERT INTO "SiteSettings" (${cols.join(", ")})\nVALUES (${vals.join(", ")})\nON CONFLICT ("id") DO UPDATE SET\n  ${setParts.join(",\n  ")};`;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  const ddl = prismaDiffDdl();

  const pageRows = buildAllSeedPages();
  const pageSql = pageRows
    .map((p) => {
      const cols = [
        '"id"',
        '"slug"',
        '"title"',
        '"metaTitle"',
        '"metaDescription"',
        '"blocks"',
        '"published"',
        '"noIndex"',
        '"includeInSitemap"',
        '"createdAt"',
        '"updatedAt"',
      ];
      const vals = [
        dollarQuote(p.id),
        dollarQuote(p.slug),
        dollarQuote(p.title),
        dollarQuote(p.metaTitle),
        dollarQuote(p.metaDescription),
        dollarQuote(p.blocks),
        p.published ? "true" : "false",
        "false",
        "true",
        "NOW()",
        "NOW()",
      ];
      return `INSERT INTO "Page" (${cols.join(", ")})\nVALUES (${vals.join(", ")})\nON CONFLICT ("slug") DO UPDATE SET\n  "title" = EXCLUDED."title",\n  "metaTitle" = EXCLUDED."metaTitle",\n  "metaDescription" = EXCLUDED."metaDescription",\n  "blocks" = EXCLUDED."blocks",\n  "published" = EXCLUDED."published",\n  "updatedAt" = NOW();`;
    })
    .join("\n\n");

  const navCols = ['"id"', '"menuSlug"', '"parentId"', '"label"', '"href"', '"sortOrder"', '"published"', '"openInNewTab"'];
  const navSql = SEED_NAV_ITEMS.map((n) => {
    const parent = n.parentId == null ? "NULL" : dollarQuote(n.parentId);
    const vals = [
      dollarQuote(n.id),
      dollarQuote(n.menuSlug ?? "header"),
      parent,
      dollarQuote(n.label),
      dollarQuote(n.href),
      String(n.sortOrder),
      (n.published ?? true) ? "true" : "false",
      (n.openInNewTab ?? false) ? "true" : "false",
    ];
    return `INSERT INTO "NavItem" (${navCols.join(", ")})\nVALUES (${vals.join(", ")});`;
  }).join("\n");

  const roleSql = SEED_STAFF_ROLES.map(
    (r) =>
      `INSERT INTO "StaffRole" ("id", "slug", "label", "permissionsJson")\nVALUES (${dollarQuote(r.id)}, ${dollarQuote(r.slug)}, ${dollarQuote(r.label)}, ${dollarQuote(r.permissionsJson)})\nON CONFLICT ("slug") DO UPDATE SET\n  "label" = EXCLUDED."label",\n  "permissionsJson" = EXCLUDED."permissionsJson";`,
  ).join("\n\n");

  const adminRoleId = SEED_STAFF_ROLES[0]!.id;
  const pwEsc = BOOTSTRAP_ADMIN_PASSWORD.replace(/'/g, "''");
  const staffUserSql = `INSERT INTO "StaffUser" ("id", "username", "passwordHash", "displayName", "roleId", "active", "createdAt", "updatedAt")
VALUES (
  ${dollarQuote(SEED_STAFF_USER_ID)},
  'admin',
  crypt('${pwEsc}', gen_salt('bf', 12)),
  'Yönetici',
  ${dollarQuote(adminRoleId)},
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "displayName" = EXCLUDED."displayName",
  "roleId" = EXCLUDED."roleId",
  "active" = true,
  "updatedAt" = NOW();`;

  const header = `-- =============================================================================
-- Neon / PostgreSQL — TAM şema + prisma/seed.ts ile aynı içerik (tek dosya)
-- Oluşturma: npm run sql:neon-full
-- =============================================================================
-- ADIM 1 — BOŞ veritabanı / yeni branch: Aşağıdaki DDL (BÖLÜM A) çalıştırın.
-- ADIM 2 — Tablolar ZATEN varsa: BÖLÜM A'yı ATLAYIN; BÖLÜM B + C yeter.
-- =============================================================================
-- Panel girişi (ilk kurulum): kullanıcı adı  admin  şifre  ${BOOTSTRAP_ADMIN_PASSWORD}
-- (Bu dosyayı yeniden üretmeden önce scripts/generate-neon-full-sql.ts içinde şifreyi değiştirin.)
-- =============================================================================

`;

  const sectionA = `
-- -----------------------------------------------------------------------------
-- BÖLÜM A — Şema (Prisma migrate diff; boş DB için)
-- -----------------------------------------------------------------------------
${ddl}

`;

  const sectionB = `
-- -----------------------------------------------------------------------------
-- BÖLÜM B — Uygulama verisini temizle (şemaya dokunmaz)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
  "StaffUser",
  "Appointment",
  "CrmContact",
  "NavItem",
  "Lead",
  "SiteInstagramPost",
  "SiteYoutubeVideo",
  "SiteTiktokVideo",
  "Page",
  "SiteSettings",
  "StaffRole"
RESTART IDENTITY CASCADE;

`;

  const sectionC = `
-- -----------------------------------------------------------------------------
-- BÖLÜM C — Site ayarları, sayfalar, menü, panel rolleri + admin
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

${siteSettingsUpsertSql()}

${pageSql}

${navSql}

${roleSql}

${staffUserSql}
`;

  writeFileSync(outFile, `${header}${sectionA}\n${sectionB}\n${sectionC}\n`, "utf-8");
  console.log(`[sql:neon-full] Yazıldı: ${outFile}`);
}

main();
