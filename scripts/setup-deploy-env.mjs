#!/usr/bin/env node
/**
 * Yerel .env içinde DATABASE_URL (ve isteğe bağlı diğer anahtarları) ayarlar.
 * Neon ekranındaki bağlantı dizisini "Show password" ile gösterip buraya verin.
 *
 * Kullanım:
 *   node scripts/setup-deploy-env.mjs
 *   node scripts/setup-deploy-env.mjs --database-url="postgresql://..."
 *   node scripts/setup-deploy-env.mjs --from-neon-snippet   (stdin'den yapıştır)
 *
 * Vercel: Bu script Vercel API anahtarı istemez. Çıktıdaki talimatları izleyin veya:
 *   npx vercel env add DATABASE_URL
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");

/** Canlı site; Vercel Production ortamında NEXT_PUBLIC_SITE_URL ile aynı olmalı (https). */
const PRODUCTION_SITE_URL = "https://charmeguzellik.com";

function parseEnvFile(raw) {
  /** @type {Map<string, string>} */
  const map = new Map();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function serializeEnv(map, originalRaw) {
  const order = [];
  const seen = new Set();
  if (originalRaw) {
    for (const line of originalRaw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) {
        order.push({ type: "raw", line });
        continue;
      }
      const eq = t.indexOf("=");
      if (eq <= 0) {
        order.push({ type: "raw", line });
        continue;
      }
      const key = t.slice(0, eq).trim();
      order.push({ type: "kv", key, line });
      seen.add(key);
    }
  }
  const out = [];
  for (const item of order) {
    if (item.type === "raw") {
      out.push(item.line);
      continue;
    }
    const v = map.get(item.key);
    if (v === undefined) out.push(item.line);
    else out.push(`${item.key}=${quoteIfNeeded(v)}`);
  }
  for (const [k, v] of map.entries()) {
    if (!seen.has(k)) out.push(`${k}=${quoteIfNeeded(v)}`);
  }
  return out.join("\n").replace(/\n+$/, "") + "\n";
}

function quoteIfNeeded(v) {
  if (/[\s#"']/.test(v)) return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return v;
}

function randomSessionSecret() {
  return randomBytes(32).toString("base64url");
}

function parseArgs(argv) {
  const out = { databaseUrl: null, siteUrl: null, fromStdin: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-neon-snippet" || a === "--stdin") out.fromStdin = true;
    else if (a.startsWith("--database-url=")) out.databaseUrl = a.slice("--database-url=".length).replace(/^["']|["']$/g, "");
    else if (a.startsWith("--site-url=")) out.siteUrl = a.slice("--site-url=".length).replace(/^["']|["']$/g, "");
  }
  return out;
}

async function readStdinAll() {
  const chunks = [];
  for await (const c of input) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8").trim();
}

function extractPostgresUrl(text) {
  const m = text.match(/postgres(ql)?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const rl = readline.createInterface({ input, output });

  let databaseUrl = args.databaseUrl;
  if (args.fromStdin) {
    const pasted = await readStdinAll();
    databaseUrl = extractPostgresUrl(pasted) ?? pasted.trim();
  }
  if (!databaseUrl) {
    output.write("Neon bağlantı dizisini yapıştırın (postgresql://... veya tam snippet):\n");
    const pasted = await rl.question("");
    databaseUrl = extractPostgresUrl(pasted) ?? pasted.trim();
  }

  if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
    output.write("\nHata: Geçerli bir PostgreSQL URL bulunamadı (postgresql:// veya postgres:// ile başlamalı).\n");
    process.exit(1);
  }

  let siteUrl = args.siteUrl;
  if (!siteUrl) {
    siteUrl =
      (await rl.question(`NEXT_PUBLIC_SITE_URL (Enter = http://localhost:3000; canlı: ${PRODUCTION_SITE_URL}): `)).trim() ||
      "http://localhost:3000";
  }

  let raw = "";
  if (existsSync(envPath)) raw = readFileSync(envPath, "utf8");
  const map = parseEnvFile(raw);

  map.set("DATABASE_URL", databaseUrl);
  map.set("NEXT_PUBLIC_SITE_URL", siteUrl);
  if (!map.get("SESSION_SECRET")?.trim()) {
    map.set("SESSION_SECRET", randomSessionSecret());
    output.write("\nSESSION_SECRET oluşturuldu (yerel .env).\n");
  }

  writeFileSync(envPath, serializeEnv(map, raw), "utf8");
  output.write(`\nGüncellendi: ${envPath}\n`);
  output.write("- DATABASE_URL\n- NEXT_PUBLIC_SITE_URL\n");

  const hashPreview = createHash("sha256").update(databaseUrl).digest("hex").slice(0, 12);
  output.write(`\n(URL SHA256 önizleme: ${hashPreview} — paylaşmayın, sadece doğru dosyaya yazıldığını kontrol için)\n`);

  output.write(`
--- Vercel (panel veya CLI) ---
1) https://vercel.com → proje → Settings → Environment Variables
2) Sol sütun "Key" = aşağıdaki TAM metin (ör. NEXT_PUBLIC_SITE_URL sonunda L var).
   Sağ sütun "Value" = değer. Key kutusuna asla https:// yazmayın.
3) Şu üç satır (her biri ayrı ekleme):
   Key DATABASE_URL            Value = Neon "Copy snippet" (postgresql://...)
   Key NEXT_PUBLIC_SITE_URL    Value = ${PRODUCTION_SITE_URL}
   Key SESSION_SECRET          Value = .env içindeki uzun gizli metin

4) Deployments → son sürüm → Redeploy

Otomatik (token + link gerekir): npm run vercel:sync-env -- --help
   Özet: npx vercel link → Vercel hesabından token → $env:VERCEL_TOKEN="..."
   → npm run vercel:sync-env -- --dry-run → npm run vercel:sync-env

CLI tercih ederseniz (önce: npx vercel login):
   npx vercel link
   npx vercel env add DATABASE_URL production
   (yapıştırıp Enter; diğerleri için tekrarlayın)

--- Neon ---
- "Connection pooling" açıkken verilen -pooler- host'u serverless (Vercel) için uygundur.
- Şifreyi unutursanız Neon panelde "Reset password" kullanın; sonra hem Neon hem Vercel .env güncellenmeli.

--- 403: Deployment disabled ---
Vercel önizlemede "Deployment is currently disabled" görüyorsanız:
Proje → Settings → General → "Paused" / deployment kısıtı var mı bakın; projeyi yeniden etkinleştirin.
`);

  await rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
