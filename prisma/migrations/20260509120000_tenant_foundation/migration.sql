-- Kiracı altyapısı — faz 1: tek varsayılan kiracı + mevcut SiteSettings satırına bağlantı (uygulama kodu henüz host bazlı seçim yapmıyor).

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- Deterministik id: tek-site kurulumu ve ilk tenant (Prisma `@default(cuid())` ile yeni kayıtlar farklı id alır.)
INSERT INTO "Tenant" ("id", "slug", "name", "status", "createdAt", "updatedAt")
VALUES (
    'tenant_single_site_default',
    'default',
    'Varsayılan site',
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

ALTER TABLE "SiteSettings" ADD COLUMN "tenantId" TEXT;

CREATE UNIQUE INDEX "SiteSettings_tenantId_key" ON "SiteSettings"("tenantId");

ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "SiteSettings"
SET "tenantId" = 'tenant_single_site_default'
WHERE "id" = 1 AND "tenantId" IS NULL;
