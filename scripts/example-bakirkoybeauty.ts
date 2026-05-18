/**
 * Örnek çok kiracılı salon: slug `bakirkoybeauty`, host `bakirkoybeauty.randevu.techizmet.com`
 *
 * Gereksinimler:
 * - .env içinde DATABASE_URL
 * - --bootstrap-admin kullanıyorsanız: ADMIN_PASSWORD (≥8 karakter), isteğe bağlı ADMIN_STAFF_USERNAME
 *
 * Çalıştırma:
 *   npm run example:bakirkoybeauty
 *
 * Yerel deneme (hosts dosyasına ekleyin: 127.0.0.1 bakirkoybeauty.localhost):
 *   npm run example:bakirkoybeauty -- --host=bakirkoybeauty.localhost --no-bootstrap
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { provisionTenant } from "../src/lib/provision-tenant";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

const prisma = new PrismaClient();

function parseArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const slug = "bakirkoybeauty";
  const name = "Bakırköy Beauty";
  const host =
    (parseArg("host") ?? "").trim().toLowerCase() || "bakirkoybeauty.randevu.techizmet.com";
  const noBootstrap = hasFlag("no-bootstrap");

  const bootstrapAdmin = noBootstrap
    ? undefined
    : (() => {
        const plain = process.env.ADMIN_PASSWORD?.trim();
        if (!plain || plain.length < 8) {
          throw new Error(
            "ADMIN_PASSWORD (.env) en az 8 karakter olmalı veya --no-bootstrap ile ilk kullanıcıyı sonra oluşturun.",
          );
        }
        const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
        const username = raw.length >= 2 ? raw : "admin";
        return { username, passwordPlain: plain };
      })();

  const result = await provisionTenant(prisma, {
    slug,
    name,
    host,
    cloneContent: true,
    appointmentsEnabled: true,
    commerceEnabled: true,
    bootstrapAdmin,
  });

  console.log("\n=== Bakırköy Beauty örnek kiracı ===\n");
  console.log(`tenantId: ${result.tenantId}`);
  console.log(`slug:     ${result.slug}`);
  console.log(`host:     ${result.host}  →  bu host istekte TenantDomain ile eşlenir.\n`);

  if (result.moduleUnlockTokens && Object.keys(result.moduleUnlockTokens).length > 0) {
    console.log("Modül açma anahtarları üretildi (bir kez güvenli saklayın):");
    console.log(JSON.stringify(result.moduleUnlockTokens, null, 2));
    console.log("");
  }

  console.log("--- DNS / TLS (üretim) ---");
  console.log(`1) ${host} için A veya CNAME ile uygulamanızın sunucusuna yönlendirin.`);
  console.log("2) TLS sertifikası (Let's Encrypt / barındırıcı otomasyonu) bu hostname için tanımlı olsun.");
  console.log("3) İsteğe bağlı: paneli ayrı subdomainde toplamak için örn. panel.randevu.techizmet.com → ayrı TenantDomain veya reverse proxy kuralı (ileri aşama).\n");

  console.log("--- Giriş adresleri ---");
  console.log(`Site (kiracıya özel, salon seçimi yok):  https://${host}/`);
  console.log(`Yönetim paneli:                        https://${host}/admin/login`);
  if (bootstrapAdmin) {
    const u = bootstrapAdmin.username;
    console.log(`İlk personel kullanıcı adı:           ${u}  (şifre: ADMIN_PASSWORD)`);
  } else {
    console.log("Panel kullanıcısı: Panelden veya reset:admin script ile ekleyin.");
  }

  console.log("\n--- Karşılaşacağınız gerçekler ---");
  console.log("- Her kiracının SiteSettings / SMTP / Telegram token alanları ayrıdır (clone varsayılanı kopyalar; Telegram temizlenir).");
  console.log("- E-posta gönderimi paylaşımlı SMTP kullanıyorsanız kota / itibar kiracı başına yönetilmeli.");
  console.log("- İkinci kiracıda randevu / CRM verisi boş başlar; içerik --clone-content ile sayfa+menü kopyalandı.\n");
}

main()
  .catch((e) => {
    console.error("[example-bakirkoybeauty]", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
