-- CreateTable
CREATE TABLE "StaffUserRole" (
    "staffUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "StaffUserRole_pkey" PRIMARY KEY ("staffUserId","roleId")
);

-- CreateIndex
CREATE INDEX "StaffUserRole_staffUserId_idx" ON "StaffUserRole"("staffUserId");

CREATE INDEX "StaffUserRole_roleId_idx" ON "StaffUserRole"("roleId");

-- AddForeignKey
ALTER TABLE "StaffUserRole" ADD CONSTRAINT "StaffUserRole_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffUserRole" ADD CONSTRAINT "StaffUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mevcut tek rol atamasını çoklu rol tablosuna taşı
INSERT INTO "StaffUserRole" ("staffUserId", "roleId")
SELECT "id", "roleId" FROM "StaffUser";

-- AlterTable
ALTER TABLE "StaffUser" DROP CONSTRAINT "StaffUser_roleId_fkey";

ALTER TABLE "StaffUser" DROP COLUMN "roleId";
