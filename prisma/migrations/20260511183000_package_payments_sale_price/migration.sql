-- Paket satışı: anlaşılan bedel (salePriceMinor) + tahsilat satırları (CommercePackagePayment)

ALTER TABLE "CommercePackagePurchase" ADD COLUMN "salePriceMinor" INTEGER;

UPDATE "CommercePackagePurchase" AS p
SET "salePriceMinor" = COALESCE(p."paidAmountMinor", t."listPriceMinor")
FROM "CommercePackageTemplate" AS t
WHERE t."id" = p."templateId";

CREATE TABLE "CommercePackagePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "memo" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercePackagePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommercePackagePayment_tenantId_purchaseId_idx" ON "CommercePackagePayment"("tenantId", "purchaseId");
ALTER TABLE "CommercePackagePayment" ADD CONSTRAINT "CommercePackagePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePackagePayment" ADD CONSTRAINT "CommercePackagePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CommercePackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
