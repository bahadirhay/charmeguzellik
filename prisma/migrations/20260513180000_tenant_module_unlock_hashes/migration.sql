-- Kiracı modül açma anahtarları (bcrypt hash, düz metin yok)
-- Deploy notu (tek sefer, migration sonrası):
--   Eski satırlarda moduleUnlockHashes NULL kalır; randevu/ticaret şu anki featuresJson ile çalışmaya devam eder.
--   Modülü panelden kapatıp tekrar AÇMAK için önce hash gerekir: Admin → Ayarlar → Site modülleri (veya platformda
--   Müşteri siteleri → «Anahtar») ile «Güvenlik anahtarları oluştur»; düz anahtarı GitHub Secret olarak saklayın.
--   Kontrol: DATABASE_URL ile  node scripts/check-tenant-module-unlock-keys.mjs
ALTER TABLE "Tenant" ADD COLUMN "moduleUnlockHashes" JSONB;
