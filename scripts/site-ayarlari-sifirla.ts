/**
 * Site açılmıyorsa (ayar kaydı sonrası vb.): tema JSON sıfırlama, ana sayfayı yayına alma, host eşleme.
 *
 * Üretim Neon URL (shell'deki değer .env.local'i ezer):
 *   $env:DATABASE_URL="postgresql://..."
 *   npm run site:reset-basics -- --host=randevu.techizmet.com --repair
 *
 * Tanı (domain listesi):
 *   npm run site:list
 *
 * DATABASE_URL okunmuyor / gecersiz — ne yazıldığını GUVENLI onizlemek icin:
 *   npm run db:doktor
 */
import { existsSync, readFileSync } from "node:fs";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** İşlem sistemi sürecinin başına geldi (PowerShell $env ile veya Cursor terminali ile) — dotenv yüklemeden önce */
const databaseUrlBeforeDotenv = (process.env.DATABASE_URL ?? "").trim();

config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

if (databaseUrlBeforeDotenv.length > 0) {
  process.env.DATABASE_URL = databaseUrlBeforeDotenv;
}

/** Tırnak, BOM, satır başı gereksiz metin vb. düzelt (gerçek parolayı oluşturmaz — sadece bicim). */
function normalizeDatabaseUrlInput(raw: string): string {
  let s = raw.trim().replace(/^\uFEFF/, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  const low = s.toLowerCase();
  const iq = low.indexOf("postgresql://");
  const ip = low.indexOf("postgres://");
  const idx = iq >= 0 ? iq : ip >= 0 ? ip : -1;
  if (idx > 0) {
    s = s.slice(idx).trim();
  }
  return s;
}

process.env.DATABASE_URL = normalizeDatabaseUrlInput(process.env.DATABASE_URL ?? "");

function maskedDbPreview(raw: string): string {
  if (!raw) return "(bos)";
  try {
    const httpish = raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
    const u = new URL(httpish);
    const userTag = u.username ? `***@` : "";
    return `postgresql://${userTag}${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname.slice(0, 48)}`;
  } catch {
    const vis = [...raw.slice(0, 96)].map((c) => (/[\x20-\x7E]/.test(c) ? c : "?")).join("");
    return `cozumsuz_satir ilk 96 karakter: ${JSON.stringify(vis)}`;
  }
}

function printEnvFilesDatabaseUrlPeek() {
  process.stdout.write("\n--- .env dosyalarında DATABASE_URL satırı (şifre maskeli) ---\n");
  for (const fname of [".env.local", ".env"]) {
    const p = resolve(root, fname);
    if (!existsSync(p)) {
      process.stdout.write(`${fname}: dosya yok\n`);
      continue;
    }
    const text = readFileSync(p, "utf8");
    const line = text.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    if (!line) {
      process.stdout.write(`${fname}: DATABASE_URL anahtarı yok\n`);
      continue;
    }
    const val = normalizeDatabaseUrlInput(line.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim());
    process.stdout.write(`${fname}: uzunluk=${val.length} | ${maskedDbPreview(val)}\n`);
  }
  process.stdout.write("\n");
}

function runDbDoktor() {
  const shellProvided = databaseUrlBeforeDotenv.length > 0;
  const cur = process.env.DATABASE_URL ?? "";
  const ok =
    !!cur &&
    (cur.toLowerCase().startsWith("postgresql://") || cur.toLowerCase().startsWith("postgres://"));

  process.stdout.write("=== DATABASE_URL teşhis (npm run db:doktor) ===\n\n");
  process.stdout.write(
    `[Önemli] Neon parolası bizde olamaz — script yalnızca bu bilgisayardaki ortamınızı okur ve düzgün yazılmış URL algılar.\n\n`,
  );
  process.stdout.write(
    `[1] Node başlarken PowerShell/OS ortamında DATABASE_URL var mıydı?: ${shellProvided ? "EVET (öncelik buna)" : "HAYIR — .env/.env.local kullanılıyor"}\n`,
  );
  process.stdout.write(`[2] Normalize SONRASI uzunluk: ${cur.length}\n`);
  process.stdout.write(`[3] Prisma uyumlu mu (postgresql://...): ${ok ? "EVET\n" : "HAYIR\n"}`);
  process.stdout.write(`[4] Maskeli özet: ${maskedDbPreview(cur)}\n`);

  printEnvFilesDatabaseUrlPeek();

  process.stdout.write("Ne yapmalı?\n");
  process.stdout.write("  • Neon > production dalı > Connect > URI ile başlayan satırın TAMAMI\n");
  process.stdout.write("  • Tek satır, parola içinde güçlük varsa Neon'da şifreyi yenileyip yeni URI kopyalayın\n");
  process.stdout.write("  • PowerShell aynı pencerede (npm'den ÖNCE):\n");
  process.stdout.write('    $env:DATABASE_URL="postgresql://...@ep-xxxxx.region.aws.neon.tech/neondb?sslmode=require"\n');
  process.stdout.write("  • Sonra: npm run site:list\n");
}

function assertDatabaseUrlAndLog() {
  const raw = process.env.DATABASE_URL ?? "";
  const shellProvided = databaseUrlBeforeDotenv.length > 0;

  if (!raw) {
    console.error("[site-ayarlari-sifirla] DATABASE_URL bos.");
    console.error(
      `  Okuma sırası: ${shellProvided ? "Shell'e deger verilmişti; sonra .env yüklendi ama shell degeri korunur." : "Yalnızca .env / .env.local"}`,
    );
    printEnvFilesDatabaseUrlPeek();
    console.error("  Cozum: npm run db:doktor   ve Neon'dan tam URI.");
    process.exit(1);
  }

  const lower = raw.toLowerCase();
  if (!lower.startsWith("postgresql://") && !lower.startsWith("postgres://")) {
    console.error("[site-ayarlari-sifirla] DATABASE_URL prisma icin uygun degil (postgresql:// veya postgres:// ile baslamali).");
    console.error(`  Kaynak ozeti: ${shellProvided ? "PowerShell'de deger vardi (normalize sonrası bu)" : ".env /.env.local ortami"}`);
    console.error(`  Maskeli onizleme: ${maskedDbPreview(raw)}`);
    printEnvFilesDatabaseUrlPeek();
    console.error("  Cozum: Neon Connect'ten tam URI yapistirin VEYA npm run db:doktor");
    process.exit(1);
  }

  try {
    const normalized = raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    process.stdout.write(`[bilgi] Baglanti: ${u.hostname}${u.port ? ":" + u.port : ""}\n`);
  } catch {
    console.error("[site-ayarlari-sifirla] DATABASE_URL cozulemedi (URL bicimi bozuk).");
    console.error(`  Maskeli onizleme: ${maskedDbPreview(raw)}`);
    process.exit(1);
  }
}

if (process.argv.includes("--doktor")) {
  runDbDoktor();
  process.exit(0);
}

assertDatabaseUrlAndLog();

const prisma = new PrismaClient();

function normalizeHost(host: string | null | undefined): string | null {
  const raw = host?.trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/:\d+$/, "");
}

function stripWww(h: string): string {
  return h.startsWith("www.") ? h.slice(4) : h;
}

function parseArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** TenantDomain tam eşleşme + www varyantı + kök domain eşleşmesi */
async function resolveTenantIdByFlexibleHost(host: string): Promise<{
  tenantId: string;
  matchedHost: string;
} | null> {
  const h = normalizeHost(host);
  if (!h) return null;
  const candidates = [h, h.startsWith("www.") ? stripWww(h) : `www.${h}`];
  const unique = [...new Set(candidates.filter(Boolean))];
  for (const c of unique) {
    const m = await prisma.tenantDomain.findUnique({
      where: { host: c },
      select: { tenantId: true, host: true },
    });
    if (m) return { tenantId: m.tenantId, matchedHost: m.host };
  }
  const all = await prisma.tenantDomain.findMany({ select: { host: true, tenantId: true } });
  const needle = stripWww(h);
  const fuzzy = all.find((d) => stripWww(d.host) === needle);
  if (fuzzy) return { tenantId: fuzzy.tenantId, matchedHost: fuzzy.host };
  return null;
}

async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, name: true, domains: { select: { host: true, isPrimary: true } } },
  });
  for (const t of tenants) {
    const hosts = t.domains.map((d) => `${d.host}${d.isPrimary ? " (birincil)" : ""}`).join(", ");
    const ss = await prisma.siteSettings.findUnique({
      where: { tenantId: t.id },
      select: { id: true },
    });
    process.stdout.write(`• ${t.slug} | ${t.name}\n  id: ${t.id}\n  SiteSettings: ${ss ? `id=${ss.id}` : "YOK"}\n  Alan adları: ${hosts || "—"}\n\n`);
  }
}

async function main() {
  if (hasFlag("list")) {
    await listTenants();
    return;
  }

  const slug = (parseArg("slug") ?? "").trim().toLowerCase();
  const hostRaw = parseArg("host");
  const alsoWhatsapp = hasFlag("whatsapp");
  const repair = hasFlag("repair");
  const clearHead = hasFlag("clear-custom-head");

  let tenantId: string | null = null;
  let matchedHost: string | null = null;

  if (slug) {
    const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    tenantId = t?.id ?? null;
    if (!tenantId) {
      console.error(`[site-ayarlari-sifirla] slug bulunamadi: ${slug}`);
      process.exit(1);
    }
  } else if (hostRaw) {
    const res = await resolveTenantIdByFlexibleHost(hostRaw);
    tenantId = res?.tenantId ?? null;
    matchedHost = res?.matchedHost ?? null;
    if (!tenantId) {
      console.error(
        `[site-ayarlari-sifirla] host TenantDomain'de bulunamadi: ${normalizeHost(hostRaw)}\n` +
          "  --list ile kayitli alan adlarini gorun.",
      );
      process.exit(1);
    }
    console.log(`[bilgi] Eslesen alan adi: ${matchedHost}`);
  } else {
    console.error(
      "Kullanim:\n" +
        "  npm run db:doktor          (DATABASE_URL sorununu teshis)\n" +
        "  npm run site:list\n" +
        "  npm run site:reset-basics -- --host=randevu.techizmet.com --repair\n" +
        "  npm run site:reset-basics -- --slug=kiraci-slug --repair\n" +
        "Bayraklar:\n" +
        "  --repair             themeTokensJson -> {} + ana sayfa published true\n" +
        "  --whatsapp           whatsappNumber -> null\n" +
        "  --clear-custom-head  customHeadHtml -> null (kirik script/embed)\n",
    );
    process.exit(1);
  }

  const row = await prisma.siteSettings.findUnique({ where: { tenantId } });
  if (!row) {
    console.error(`[site-ayarlari-sifirla] Bu kiraci icin SiteSettings yok: ${tenantId}`);
    process.exit(1);
  }

  const updates: Prisma.SiteSettingsUpdateInput = {
    themeTokensJson: "{}",
  };
  if (alsoWhatsapp) updates.whatsappNumber = null;
  if (clearHead) updates.customHeadHtml = null;

  await prisma.siteSettings.update({
    where: { id: row.id },
    data: updates,
  });

  let homeNote = "";
  if (repair) {
    const r = await prisma.page.updateMany({
      where: { tenantId, slug: "home" },
      data: { published: true },
    });
    homeNote = ` Ana sayfa (slug=home): ${r.count} satir yayinlandi.`;
    if (r.count === 0) {
      homeNote +=
        " (UYARI: home slug'i yok; Admin > Sayfalar'dan ana sayfa olusturun veya slug kontrol edin.)";
    }
  }

  console.log(
    `[OK] tenantId=${tenantId} siteSettings id=${row.id}: themeTokensJson -> {}` +
      (alsoWhatsapp ? ", whatsapp -> null" : "") +
      (clearHead ? ", customHeadHtml -> null" : "") +
      homeNote +
      "\nTarayiciyi sert yenileyin (Ctrl+F5). Sonra ayarlardan logo/favicon yeniden.",
  );
}

function isLikelyNeonConnectivityError(err: unknown): boolean {
  const s = String(err ?? "");
  return (
    s.includes("Can't reach database server") ||
    s.includes("P1001") ||
    s.includes("PrismaClientInitializationError") ||
    s.includes("Can't reach database server at")
  );
}

main()
  .catch((e) => {
    console.error("[site-ayarlari-sifirla] hata", e);
    if (isLikelyNeonConnectivityError(e)) {
      process.stderr.write(
        "\n--- Neon ipucu ---\n" +
          "Eski «production_old_...» dallarinda genelde baglanti ucu (compute) kapalidir.\n" +
          "Varsayilan «production» dalina gecin > Connect > tam postgresql:// adresini kopyalayin.\n" +
          "Detay: npm run neon:baglanti-yardim\n\n",
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
