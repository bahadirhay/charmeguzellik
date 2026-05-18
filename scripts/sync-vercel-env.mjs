#!/usr/bin/env node
/**
 * Yerel .env içindeki değerleri Vercel projesine yazar (API, upsert).
 * Panelde Key/Value karıştırmak zorunda kalmamanız için.
 *
 * Önkoşullar:
 *   1) Proje kökünde: npx vercel link   → .vercel/project.json oluşur
 *   2) Vercel → Account Settings → Tokens → Create (scope: bu proje / tam yetki)
 *   3) Token'ı bir kez ortama verin (PowerShell):
 *        $env:VERCEL_TOKEN="vercel_...."
 *      veya .env içine (dosya zaten .gitignore'da): VERCEL_TOKEN=...
 *
 * Kullanım:
 *   npm run vercel:sync-env -- --dry-run
 *   npm run vercel:sync-env
 *
 * NEXT_PUBLIC_SITE_URL Vercel'e varsayılan olarak canlı domain gider;
 * yerelde localhost kullanıyorsanız bu doğrudur. Değiştirmek için:
 *   npm run vercel:sync-env -- --site-url="https://charmeguzellik.com"
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");
const vercelProjectPath = resolve(root, ".vercel", "project.json");

const PRODUCTION_SITE_URL = "https://charmeguzellik.com";

loadDotenv({ path: envPath });

function parseArgs(argv) {
  const out = { dryRun: false, help: false, siteUrl: null, useEnvSite: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--from-env-site") out.useEnvSite = true;
    else if (a.startsWith("--site-url=")) out.siteUrl = a.slice("--site-url=".length).replace(/^["']|["']$/g, "");
  }
  return out;
}

function manualTurkish() {
  return `
================================================================================
VERCEL ORTAM DEĞİŞKENİ — ELLE (PANEL) ADIM ADIM
================================================================================
1) https://vercel.com → Giriş → Projenizi seçin (ör. charmeguzellik).

2) Üst menü: Settings → sol listeden "Environment Variables".

3) "Add New" / "Add Environment Variable" ile YENİ satır ekleyin.
   ÖNEMLİ: İki kutu vardır:
   - Sol kutu "Key"   = DEĞİŞKENİN TAM ADI (kopyala-yapıştır, elle yazmayın)
   - Sağ kutu "Value" = DEĞER (URL veya postgresql:// satırı)

4) Üç ayrı satır oluşturun (her biri için Key ve Value doğru kutuda olsun):

   Satır A
   Key   (sol):  DATABASE_URL
   Value (sağ):  Neon → Connect → "Copy snippet" ile kopyaladığınız
                 postgresql:// ile başlayan TEK satır (şifre dahil)

   Satır B
   Key   (sol):  NEXT_PUBLIC_SITE_URL
                 ↑ Sonunda mutlaka "L" harfi var: ...SITE_URL
                 (YANLIŞ: NEXT_PUBLIC_SITE_UR veya ...EXAMPLE...)
   Value (sağ):  https://charmeguzellik.com

   Satır C
   Key   (sol):  SESSION_SECRET
   Value (sağ):  Bilgisayarınızdaki .env dosyasındaki SESSION_SECRET değeri
                 (yoksa yerelde bir kez "npm run setup:env" çalıştırıp oluşturun)

5) Ortam seçimi: "Production" (ve isterseniz "Preview") işaretli olsun.

6) Kaydet → Deployments → en son deployment → "Redeploy".

7) Yanlış isimle kayıt varsa (ör. NEXT_PUBLIC_SITE_UR): o satırı silin veya
   düzenleyin; doğru isim tam olarak NEXT_PUBLIC_SITE_URL olmalı.

================================================================================
GÜVENLİK: Bağlantı dizinizi (DATABASE_URL) sohbet veya ekran görüntüsüyle
paylaştıysanız Neon panelinde "Reset password" yapın; sonra yeni URL'yi
hem Vercel hem yerel .env'de güncelleyin.
================================================================================
`;
}

async function vercelPostEnv({ token, projectId, teamId, body, upsert }) {
  const q = new URLSearchParams();
  if (upsert) q.set("upsert", "true");
  if (teamId) q.set("teamId", teamId);
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?${q}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.message ?? text.slice(0, 500);
    throw new Error(`Vercel API ${res.status}: ${msg}`);
  }
  return json;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(manualTurkish());
    process.stdout.write(`
Otomatik gönderim için:
  ${"$env:VERCEL_TOKEN=\"...\" "}   (PowerShell; token'ı tırnak içinde)
  cd proje_kökü
  npx vercel link
  npm run vercel:sync-env -- --dry-run
  npm run vercel:sync-env
`);
    process.exit(0);
  }

  process.stdout.write(manualTurkish());

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  let siteUrl = args.siteUrl?.trim();
  if (!siteUrl) {
    const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (args.useEnvSite && fromEnv) siteUrl = fromEnv;
    else if (fromEnv && !/^https?:\/\/localhost/i.test(fromEnv) && !/^http:\/\/127\./i.test(fromEnv)) {
      siteUrl = fromEnv;
    } else siteUrl = PRODUCTION_SITE_URL;
  }

  if (!databaseUrl?.startsWith("postgres")) {
    process.stderr.write(".env içinde geçerli DATABASE_URL yok (postgresql://...).\n");
    process.exit(1);
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    process.stderr.write(".env içinde SESSION_SECRET yok veya çok kısa (en az 32 karakter).\n");
    process.exit(1);
  }

  const token = process.env.VERCEL_TOKEN?.trim();
  if (!existsSync(vercelProjectPath)) {
    process.stderr.write(
      "\nOtomatik senkron için .vercel/project.json yok. Proje kökünde çalıştırın:\n  npx vercel link\n\n",
    );
    process.exit(1);
  }

  const { projectId, orgId } = JSON.parse(readFileSync(vercelProjectPath, "utf8"));
  if (!projectId) {
    process.stderr.write(".vercel/project.json içinde projectId yok.\n");
    process.exit(1);
  }

  const target = ["production", "preview"];
  const payloads = [
    { key: "DATABASE_URL", value: databaseUrl, type: "sensitive", target },
    { key: "SESSION_SECRET", value: sessionSecret, type: "sensitive", target },
    { key: "NEXT_PUBLIC_SITE_URL", value: siteUrl, type: "plain", target },
  ];

  const platformTenantId = process.env.PLATFORM_CONTROL_TENANT_ID?.trim();
  const platformHost = process.env.PLATFORM_CONTROL_HOST?.trim();
  if (platformTenantId) {
    payloads.push({ key: "PLATFORM_CONTROL_TENANT_ID", value: platformTenantId, type: "plain", target });
  }
  if (platformHost) {
    payloads.push({ key: "PLATFORM_CONTROL_HOST", value: platformHost, type: "plain", target });
  }
  const demoUsers = process.env.DEMO_PANEL_USERNAMES?.trim();
  if (demoUsers) {
    payloads.push({ key: "DEMO_PANEL_USERNAMES", value: demoUsers, type: "plain", target });
  }
  const demoPass = process.env.DEMO_PANEL_PASSWORD?.trim();
  if (demoPass) {
    payloads.push({ key: "DEMO_PANEL_PASSWORD", value: demoPass, type: "sensitive", target });
  }

  process.stdout.write(
    `\n--- Otomatik gönderim özeti (parola/URL tam metin yazdırılmaz) ---\nProje: ${projectId}\n` +
      `teamId: ${orgId ?? "(yok)"}\n` +
      `NEXT_PUBLIC_SITE_URL → Vercel'e: ${siteUrl}\n` +
      (args.dryRun ? "Mod: --dry-run (API çağrısı yok)\n" : ""),
  );

  if (args.dryRun) {
    process.stdout.write(
      "Dry-run: .env alanları tamam. Gönderilecek anahtarlar: " +
        payloads.map((p) => p.key).join(", ") +
        "\n",
    );
    if (!token) {
      process.stdout.write(
        "VERCEL_TOKEN yok; gerçek gönderim için PowerShell:\n  $env:VERCEL_TOKEN=\"vercel_...\"\n  npm run vercel:sync-env\n",
      );
    }
    process.exit(0);
  }

  if (!token) {
    process.stderr.write(
      "VERCEL_TOKEN tanımlı değil. PowerShell:\n  $env:VERCEL_TOKEN=\"vercel_...\"\nArdından tekrar: npm run vercel:sync-env\n\nYukarıdaki ELLE adımlarla da tamamlayabilirsiniz.\n",
    );
    process.exit(1);
  }

  for (const body of payloads) {
    process.stdout.write(`\nGönderiliyor: ${body.key} (${body.type}) …\n`);
    await vercelPostEnv({
      token,
      projectId,
      teamId: orgId || undefined,
      body,
      upsert: true,
    });
    process.stdout.write(`Tamam: ${body.key}\n`);
  }

  process.stdout.write(
    "\nBitti. Vercel → Deployments → son sürüm → Redeploy yapın.\nYanlış isimle kalan eski değişkenleri panelden silmeyi unutmayın.\n",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
