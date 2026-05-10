#!/usr/bin/env node
/**
 * Canlı geçiş ve randevu modülü için adım adım Türkçe rehber.
 * Çalıştır: node scripts/canli-gecis.mjs
 * Sadece 5 adım özeti: node scripts/canli-gecis.mjs --kisa
 * Veritabanı migration (üretim URL ile): node scripts/canli-gecis.mjs --migrate
 */
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const doMigrate = args.has("--migrate");
const kisaOnly = args.has("--kisa");

function printTitle(s) {
  process.stdout.write(`\n${"=".repeat(60)}\n${s}\n${"=".repeat(60)}\n`);
}

function printSection(title, lines) {
  process.stdout.write(`\n--- ${title} ---\n`);
  for (const l of lines) process.stdout.write(`${l}\n`);
}

function printOzeti() {
  printTitle("CANLIYA ALMAK — EN BASİT 5 ADIM (Neon + GitHub + Vercel düzeni)");
  printSection("Adımlar", [
    "1) Neon konsolda projene gir → Branch: «production» → «Connect» → connection string kopyala.",
    "   Bu adres = üretim DATABASE_URL. Asla GitHub’a koyma; sadece hosting ortamına.",
    "",
    "2) Vercel’de projene git → Settings → Environment Variables:",
    "   • DATABASE_URL  = Neon’dan kopyaladığın (Production seçili olsun)",
    "   • NEXT_PUBLIC_SITE_URL = gerçek siten (örn. https://alanadin.com)",
    "   Eksik ne varsa (.env.local’deki gibi session, SMTP vb.) aynı isimle ekle.",
    "",
    "3) Bilgisayarında kod hazırsa:",
    "   git add -A && git commit -m \"Mesajın\" && git push",
    "   → Vercel otomatik yeni deploy alır (projeyi GitHub’a bağladıysan).",
    "",
    "4) Kod sunucuya gitti; veritabanı şeması henüz güncellenmemiş olabilir.",
    "   Kendi PC’nde (PowerShell), Neon PRODUCTION bağlantısını kullan:",
    "   $env:DATABASE_URL=\"postgresql://...neon.tech/...\"; npm run db:migrate",
    "   İstersen: npm run canli:migrate (aynı şey — yine DATABASE_URL gerekli).",
    "",
    "5) Canlı adresi tarayıcıda aç → /admin ile giriş → bir sayfa randevu/ayar dene.",
    "",
    "Yerelde TipScript hatası aldıysan: npx prisma generate",
  ]);
}

printOzeti();

if (kisaOnly) {
  process.stdout.write(
    "\n[İpucu] Daha fazla açıklama ve randevu modülü kullanımı: npm run canli:rehber (aynı dosya, --kisa olmadan)\n",
  );
  if (doMigrate) {
    process.stdout.write("(Bu çalıştırmada --migrate var; devamında migration çalıştırılıyor.)\n");
  } else {
    process.stdout.write("\n");
    process.exit(0);
  }
}

if (!kisaOnly) {
  printTitle("DETAYLI REHBER — Randevu modülü ve diğer");

  printSection("1) Randevu modülü nedir?", [
    "Her müşteri sitesi (kiracı) için randevu özellikleri ayrı açılıp kapatılabilir.",
    "Kapalıyken: sitede randevu API’leri 403 verir, panelde «Randevular» menüsü çıkmaz.",
    "Açıkken: eskisi gibi randevu formu, panel ve bildirimler çalışır.",
    "Veritabanında Tenant.featuresJson alanında { \"appointments\": false } ile kapatılır.",
    "Alan boş (null) ise varsayılan: randevu AÇIK (eski siteler bozulmaz).",
  ]);

  printSection("2) Normal kullanım (müşteri paneli)", [
    "1. Müşteri alan adından admin panele girin (ör. https://musteri.com/admin).",
    "2. Sol menü: «Genel ayarlar & SEO» (site.settings yetkisi gerekir).",
    "3. Formun üstünde «Randevu modülü» kutusu → «Randevu özellikleri aktif» işaretini açın/kapatın.",
    "4. Checkbox değişince kayıt sunucuya gider; menü güncellenmesi için sayfa yenilenir.",
  ]);

  printSection("3) Platform yöneticisi (siz — birden fazla müşteri sitesi)", [
    "PLATFORM_CONTROL_TENANT_ID ile tanımlı kiracıda panele girip «Müşteri siteleri» görürsünüz.",
    "Yeni kiracı oluştururken: «Randevu modülünü başlangıçta aç» kutusu işaretliyse varsayılan açık oluşur.",
    "Liste tablosunda her müşteri için «Randevu» sütunundan aç/kapa yapılır.",
  ]);

  printSection("4) Yerel/script ile kiracı oluşturma", [
    "Örnek (randevu varsayılan açık):",
    "  npm run tenant:create -- --slug=ornek --name=\"Örnek Salon\" --host=www.ornek.com",
    "",
    "Randevu baştan kapalı olsun istiyorsanız:",
    "  npm run tenant:create -- --slug=ornek ... --host=www.ornek.com --no-appointments",
  ]);

  printSection("5) Canlıya (production) çıkarma — sıra böyle olmalı", [
    "A) Kod: değişiklikleri commit + push edin; Vercel/host deploy alsın.",
    "B) Veritabanını güncelleme (çok önemli): üretim DATABASE_URL ile migration çalıştırın.",
    "   PowerShell örneği (üretim URL’inizi yazın):",
    "   $env:DATABASE_URL=\"postgresql://...\"; npm run db:migrate",
    "   veya bu script ile:",
    "   $env:DATABASE_URL=\"postgresql://...\"; node scripts/canli-gecis.mjs --migrate",
    "C) Vercel / hosting ortamında NEXT_PUBLIC_SITE_URL canlı https adresiniz olsun.",
    "D) Build zaten prisma generate içeriyor; yine de sorun olursa: npx prisma generate",
  ]);
}

if (doMigrate) {
  printTitle("VERİTABANI: prisma migrate deploy");
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    process.stderr.write(
      "\n[HATA] DATABASE_URL tanımlı değil. Önce üretim bağlantı dizinini ortama verin.\n" +
        "Örnek (PowerShell): $env:DATABASE_URL=\"postgresql://...\"\n",
    );
    process.exit(1);
  }
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (r.status !== 0) {
    process.stderr.write("\n[HATA] migrate deploy başarısız.\n");
    process.exit(r.status ?? 1);
  }
  process.stdout.write("\n[OK] Migration uygulandı.\n");
} else if (!kisaOnly) {
  process.stdout.write(
    "\nİpucu: Üretim veritabanına migration uygulamak için:\n" +
      "  $env:DATABASE_URL=\"postgresql://...\"; node scripts/canli-gecis.mjs --migrate\n",
  );
}

process.stdout.write("\n");
