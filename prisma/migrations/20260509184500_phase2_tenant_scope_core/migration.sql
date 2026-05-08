-- Faz 2: iş verisi kiracı kapsamlı — mevcut tüm satırlar bootstrap kiracıya bağlanır.
-- Varsayılan kiracı id: prisma/migrations/20260509120000_tenant_foundation/migration.sql ile aynı.

-- 1) Sütunlar (önce FK yok — toplu doldurma sonrası eklenir)
ALTER TABLE "Page" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SiteInstagramPost" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SiteYoutubeVideo" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SiteTiktokVideo" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CrmContact" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AppointmentEvent" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "NavItem" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "StaffRole" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "StaffUser" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CookieConsentLog" ADD COLUMN "tenantId" TEXT;

-- 2) Backfill (tek site)
UPDATE "Page" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "SiteInstagramPost" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "SiteYoutubeVideo" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "SiteTiktokVideo" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "Lead" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "CrmContact" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "Appointment" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "NavItem" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "StaffRole" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "StaffUser" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;
UPDATE "CookieConsentLog" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;

UPDATE "AppointmentEvent" ae
SET "tenantId" = a."tenantId"
FROM "Appointment" a
WHERE ae."appointmentId" = a."id"
  AND ae."tenantId" IS NULL;

UPDATE "AppointmentEvent" SET "tenantId" = 'tenant_single_site_default' WHERE "tenantId" IS NULL;

-- 3) Eski UNIQUE / INDEX kaldır
DROP INDEX IF EXISTS "Page_slug_key";
DROP INDEX IF EXISTS "SiteInstagramPost_instagramId_key";
DROP INDEX IF EXISTS "SiteInstagramPost_permalink_key";
DROP INDEX IF EXISTS "SiteYoutubeVideo_videoId_key";
DROP INDEX IF EXISTS "SiteTiktokVideo_permalink_key";
DROP INDEX IF EXISTS "CrmContact_phoneKey_key";
DROP INDEX IF EXISTS "Appointment_startAt_serviceName_status_idx";
DROP INDEX IF EXISTS "AppointmentEvent_appointmentId_createdAt_idx";
DROP INDEX IF EXISTS "AppointmentEvent_eventType_createdAt_idx";
DROP INDEX IF EXISTS "NavItem_menuSlug_parentId_sortOrder_idx";
DROP INDEX IF EXISTS "StaffRole_slug_key";
DROP INDEX IF EXISTS "StaffUser_username_key";
DROP INDEX IF EXISTS "CookieConsentLog_consentKey_createdAt_idx";

-- 4) NOT NULL
ALTER TABLE "Page" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SiteInstagramPost" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SiteYoutubeVideo" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SiteTiktokVideo" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CrmContact" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AppointmentEvent" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "NavItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StaffRole" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StaffUser" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CookieConsentLog" ALTER COLUMN "tenantId" SET NOT NULL;

-- 5) Kiracı FK
ALTER TABLE "Page" ADD CONSTRAINT "Page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteInstagramPost" ADD CONSTRAINT "SiteInstagramPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteYoutubeVideo" ADD CONSTRAINT "SiteYoutubeVideo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteTiktokVideo" ADD CONSTRAINT "SiteTiktokVideo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NavItem" ADD CONSTRAINT "NavItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CookieConsentLog" ADD CONSTRAINT "CookieConsentLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) Yeni UNIQUE / INDEX
CREATE UNIQUE INDEX "Page_tenantId_slug_key" ON "Page"("tenantId", "slug");
CREATE INDEX "Page_tenantId_idx" ON "Page"("tenantId");

CREATE UNIQUE INDEX "SiteInstagramPost_tenantId_instagramId_key" ON "SiteInstagramPost"("tenantId", "instagramId");
CREATE UNIQUE INDEX "SiteInstagramPost_tenantId_permalink_key" ON "SiteInstagramPost"("tenantId", "permalink");
CREATE INDEX "SiteInstagramPost_tenantId_idx" ON "SiteInstagramPost"("tenantId");

CREATE UNIQUE INDEX "SiteYoutubeVideo_tenantId_videoId_key" ON "SiteYoutubeVideo"("tenantId", "videoId");
CREATE INDEX "SiteYoutubeVideo_tenantId_idx" ON "SiteYoutubeVideo"("tenantId");

CREATE UNIQUE INDEX "SiteTiktokVideo_tenantId_permalink_key" ON "SiteTiktokVideo"("tenantId", "permalink");
CREATE INDEX "SiteTiktokVideo_tenantId_idx" ON "SiteTiktokVideo"("tenantId");

CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");

CREATE UNIQUE INDEX "CrmContact_tenantId_phoneKey_key" ON "CrmContact"("tenantId", "phoneKey");
CREATE INDEX "CrmContact_tenantId_idx" ON "CrmContact"("tenantId");

CREATE INDEX "Appointment_tenantId_startAt_serviceName_status_idx" ON "Appointment"("tenantId", "startAt", "serviceName", "status");

CREATE INDEX "AppointmentEvent_tenantId_appointmentId_createdAt_idx" ON "AppointmentEvent"("tenantId", "appointmentId", "createdAt");
CREATE INDEX "AppointmentEvent_tenantId_eventType_createdAt_idx" ON "AppointmentEvent"("tenantId", "eventType", "createdAt");

CREATE INDEX "NavItem_tenantId_menuSlug_parentId_sortOrder_idx" ON "NavItem"("tenantId", "menuSlug", "parentId", "sortOrder");

CREATE UNIQUE INDEX "StaffRole_tenantId_slug_key" ON "StaffRole"("tenantId", "slug");
CREATE INDEX "StaffRole_tenantId_idx" ON "StaffRole"("tenantId");

CREATE UNIQUE INDEX "StaffUser_tenantId_username_key" ON "StaffUser"("tenantId", "username");
CREATE INDEX "StaffUser_tenantId_idx" ON "StaffUser"("tenantId");

CREATE INDEX "CookieConsentLog_tenantId_consentKey_createdAt_idx" ON "CookieConsentLog"("tenantId", "consentKey", "createdAt");
