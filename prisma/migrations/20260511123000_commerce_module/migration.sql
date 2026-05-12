-- Ticaret modülü: hizmet fiyatları, müşteri fiyatı, cari, ürün/stok, prim, paketler + randevu fiyat alanları

ALTER TABLE "Appointment" ADD COLUMN "quotedPriceMinor" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN "priceSource" TEXT;

CREATE TABLE "CommerceServicePrice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceServicePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceServicePrice_tenantId_serviceKey_key" ON "CommerceServicePrice"("tenantId", "serviceKey");
CREATE INDEX "CommerceServicePrice_tenantId_idx" ON "CommerceServicePrice"("tenantId");
ALTER TABLE "CommerceServicePrice" ADD CONSTRAINT "CommerceServicePrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommerceCustomerPriceOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crmContactId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceCustomerPriceOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceCustomerPriceOverride_tenantId_crmContactId_serviceKey_key" ON "CommerceCustomerPriceOverride"("tenantId", "crmContactId", "serviceKey");
CREATE INDEX "CommerceCustomerPriceOverride_tenantId_idx" ON "CommerceCustomerPriceOverride"("tenantId");
CREATE INDEX "CommerceCustomerPriceOverride_crmContactId_idx" ON "CommerceCustomerPriceOverride"("crmContactId");
ALTER TABLE "CommerceCustomerPriceOverride" ADD CONSTRAINT "CommerceCustomerPriceOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceCustomerPriceOverride" ADD CONSTRAINT "CommerceCustomerPriceOverride_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommerceLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crmContactId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "memo" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommerceLedgerEntry_tenantId_crmContactId_occurredAt_idx" ON "CommerceLedgerEntry"("tenantId", "crmContactId", "occurredAt");
ALTER TABLE "CommerceLedgerEntry" ADD CONSTRAINT "CommerceLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceLedgerEntry" ADD CONSTRAINT "CommerceLedgerEntry_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommerceProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salePriceMinor" INTEGER NOT NULL DEFAULT 0,
    "costMinor" INTEGER,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceProduct_tenantId_sku_key" ON "CommerceProduct"("tenantId", "sku");
CREATE INDEX "CommerceProduct_tenantId_idx" ON "CommerceProduct"("tenantId");
ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommerceStockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "memo" TEXT,
    "refType" TEXT,
    "refId" TEXT,

    CONSTRAINT "CommerceStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommerceStockMovement_tenantId_productId_occurredAt_idx" ON "CommerceStockMovement"("tenantId", "productId", "occurredAt");
ALTER TABLE "CommerceStockMovement" ADD CONSTRAINT "CommerceStockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceStockMovement" ADD CONSTRAINT "CommerceStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommerceCommissionRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceKey" TEXT,
    "percentBps" INTEGER,
    "fixedMinor" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceCommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommerceCommissionRule_tenantId_idx" ON "CommerceCommissionRule"("tenantId");
ALTER TABLE "CommerceCommissionRule" ADD CONSTRAINT "CommerceCommissionRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommerceCommissionAccrual" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "staffUserId" TEXT,
    "staffNameSnapshot" TEXT,
    "ruleId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceCommissionAccrual_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommerceCommissionAccrual_tenantId_appointmentId_idx" ON "CommerceCommissionAccrual"("tenantId", "appointmentId");
CREATE INDEX "CommerceCommissionAccrual_tenantId_status_idx" ON "CommerceCommissionAccrual"("tenantId", "status");
ALTER TABLE "CommerceCommissionAccrual" ADD CONSTRAINT "CommerceCommissionAccrual_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceCommissionAccrual" ADD CONSTRAINT "CommerceCommissionAccrual_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceCommissionAccrual" ADD CONSTRAINT "CommerceCommissionAccrual_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceCommissionAccrual" ADD CONSTRAINT "CommerceCommissionAccrual_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommerceCommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommercePackageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "validityDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercePackageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommercePackageTemplate_tenantId_idx" ON "CommercePackageTemplate"("tenantId");
ALTER TABLE "CommercePackageTemplate" ADD CONSTRAINT "CommercePackageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommercePackageTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CommercePackageTemplateLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommercePackageTemplateLine_templateId_idx" ON "CommercePackageTemplateLine"("templateId");
ALTER TABLE "CommercePackageTemplateLine" ADD CONSTRAINT "CommercePackageTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommercePackageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercePackagePurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crmContactId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "paidAmountMinor" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "CommercePackagePurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommercePackagePurchase_tenantId_crmContactId_idx" ON "CommercePackagePurchase"("tenantId", "crmContactId");
ALTER TABLE "CommercePackagePurchase" ADD CONSTRAINT "CommercePackagePurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePackagePurchase" ADD CONSTRAINT "CommercePackagePurchase_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercePackagePurchase" ADD CONSTRAINT "CommercePackagePurchase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommercePackageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommercePackageCredit" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL,

    CONSTRAINT "CommercePackageCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercePackageCredit_purchaseId_serviceKey_key" ON "CommercePackageCredit"("purchaseId", "serviceKey");
ALTER TABLE "CommercePackageCredit" ADD CONSTRAINT "CommercePackageCredit_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CommercePackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
