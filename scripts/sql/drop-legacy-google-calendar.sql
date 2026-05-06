-- Mevcut PostgreSQL veritabanında Google Takvim sütunlarını kaldırır (Prisma şemasından silindikten sonra bir kez çalıştırın).
-- Neon / psql: bu dosyayı yapıştırıp çalıştırın veya: psql $DATABASE_URL -f scripts/sql/drop-legacy-google-calendar.sql

ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "googleCalendarEmbedUrl";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "googleCalendarIcsUrl";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "googleCalendarClientId";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "googleCalendarSecret";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "googleRefreshToken";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "googleCalendarWriteCalendarId";

ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "googleEventId";
