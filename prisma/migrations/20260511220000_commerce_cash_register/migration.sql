-- Kasa tahsilatları + gün sonu özeti

CREATE TABLE "CommerceCashReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountMinor" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "memo" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'manual',
    "appointmentId" TEXT,
    "crmContactId" TEXT,
    "staffUserId" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceCashReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceCashReceipt_ledgerEntryId_key" ON "CommerceCashReceipt"("ledgerEntryId");

CREATE INDEX "CommerceCashReceipt_tenantId_occurredAt_idx" ON "CommerceCashReceipt"("tenantId", "occurredAt");

CREATE INDEX "CommerceCashReceipt_tenantId_appointmentId_idx" ON "CommerceCashReceipt"("tenantId", "appointmentId");

ALTER TABLE "CommerceCashReceipt" ADD CONSTRAINT "CommerceCashReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommerceCashReceipt" ADD CONSTRAINT "CommerceCashReceipt_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommerceCashReceipt" ADD CONSTRAINT "CommerceCashReceipt_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommerceCashReceipt" ADD CONSTRAINT "CommerceCashReceipt_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommerceCashReceipt" ADD CONSTRAINT "CommerceCashReceipt_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "CommerceLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommerceCashDayClose" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffUserId" TEXT,
    "expectedTotalMinor" INTEGER,
    "countedTotalMinor" INTEGER,
    "notes" TEXT,

    CONSTRAINT "CommerceCashDayClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceCashDayClose_tenantId_businessDate_key" ON "CommerceCashDayClose"("tenantId", "businessDate");

CREATE INDEX "CommerceCashDayClose_tenantId_businessDate_idx" ON "CommerceCashDayClose"("tenantId", "businessDate");

ALTER TABLE "CommerceCashDayClose" ADD CONSTRAINT "CommerceCashDayClose_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommerceCashDayClose" ADD CONSTRAINT "CommerceCashDayClose_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
