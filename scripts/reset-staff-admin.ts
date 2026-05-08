/**
 * Panel girişi (StaffUser) — seed yalnızca tablo boşken oluşturuyordu; bu script
 * kullanıcıyı her zaman .env içindeki ADMIN_PASSWORD ile günceller / oluşturur.
 *
 * .env: DATABASE_URL, ADMIN_PASSWORD (>=6), isteğe ADMIN_STAFF_USERNAME (varsayılan admin)
 *
 *   npm run reset:admin
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env"), override: true });
config({ path: resolve(root, ".env.local"), override: true });

async function main() {
  const plain = process.env.ADMIN_PASSWORD?.trim();
  if (!plain || plain.length < 6) {
    throw new Error("ADMIN_PASSWORD (.env veya .env.local) en az 6 karakter olmalı.");
  }

  const bcryptMod = await import("bcryptjs");
  const bcrypt = bcryptMod.default ?? bcryptMod;
  const { PrismaClient } = await import("@prisma/client");
  const { ensureDefaultStaffRoles } = await import("../src/lib/staff-roles-defaults");
  const { BOOTSTRAP_TENANT_ID } = await import("../src/lib/tenant-db");

  const prisma = new PrismaClient();

  try {
    await ensureDefaultStaffRoles(prisma);
    const adminRole = await prisma.staffRole.findUnique({
      where: { tenantId_slug: { tenantId: BOOTSTRAP_TENANT_ID, slug: "admin" } },
    });
    if (!adminRole) throw new Error('StaffRole "admin" bulunamadı.');

    const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
    const username = raw.length >= 2 ? raw : "admin";
    const hash = await bcrypt.hash(plain, 12);

    await prisma.staffUser.upsert({
      where: { tenantId_username: { tenantId: BOOTSTRAP_TENANT_ID, username } },
      create: {
        tenantId: BOOTSTRAP_TENANT_ID,
        username,
        passwordHash: hash,
        displayName: "Yönetici",
        roleId: adminRole.id,
        active: true,
      },
      update: {
        passwordHash: hash,
        active: true,
        roleId: adminRole.id,
      },
    });

    console.log(`[reset-staff-admin] Tamam: "${username}" şifresi ADMIN_PASSWORD ile güncellendi.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
