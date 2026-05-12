/**
 * Panel girişi (StaffUser) — seed yalnızca tablo boşken oluşturuyordu; bu script
 * kullanıcıyı her zaman .env içindeki ADMIN_PASSWORD ile günceller / oluşturur.
 *
 * .env: DATABASE_URL, ADMIN_PASSWORD (>=6), isteğe ADMIN_STAFF_USERNAME (varsayılan admin)
 *
 * Varsayılan kiracı (bootstrap):  npm run reset:admin
 * Belirli alan adı (çok kiracılı): npm run reset:admin -- --host=randevu.techizmet.com
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env"), override: true });
config({ path: resolve(root, ".env.local"), override: true });

function parseHostArg(): string | null {
  const p = "--host=";
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

async function main() {
  const plain = process.env.ADMIN_PASSWORD?.trim();
  if (!plain || plain.length < 6) {
    throw new Error("ADMIN_PASSWORD (.env veya .env.local) en az 6 karakter olmalı.");
  }

  const bcryptMod = await import("bcryptjs");
  const bcrypt = bcryptMod.default ?? bcryptMod;
  const { PrismaClient } = await import("@prisma/client");
  const { ensureDefaultStaffRoles } = await import("../src/lib/staff-roles-defaults");
  const { BOOTSTRAP_TENANT_ID, resolveTenantByHost } = await import("../src/lib/tenant-db");

  const prisma = new PrismaClient();

  try {
    const hostArg = parseHostArg()?.trim().toLowerCase();
    let tenantId: string = BOOTSTRAP_TENANT_ID;
    if (hostArg) {
      const mapped = await resolveTenantByHost(hostArg);
      if (!mapped?.tenantId) {
        throw new Error(
          `Bu alan için TenantDomain kaydı yok: "${hostArg}". Önce kiracı + domain oluşturun veya doğru host girin.`,
        );
      }
      tenantId = mapped.tenantId;
      console.log(`[reset-staff-admin] Kiracı: ${tenantId} (host=${hostArg})`);
    }

    await ensureDefaultStaffRoles(prisma, tenantId);
    const adminRole = await prisma.staffRole.findUnique({
      where: { tenantId_slug: { tenantId, slug: "admin" } },
    });
    if (!adminRole) throw new Error(`StaffRole "admin" bulunamadı (tenant=${tenantId}).`);

    const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
    const username = raw.length >= 2 ? raw : "admin";
    const hash = await bcrypt.hash(plain, 12);

    await prisma.staffUser.upsert({
      where: { tenantId_username: { tenantId, username } },
      create: {
        tenantId,
        username,
        passwordHash: hash,
        displayName: "Yönetici",
        active: true,
        roleAssignments: { create: [{ roleId: adminRole.id }] },
      },
      update: {
        passwordHash: hash,
        active: true,
        roleAssignments: { deleteMany: {}, create: [{ roleId: adminRole.id }] },
      },
    });

    console.log(`[reset-staff-admin] Tamam: tenant=${tenantId} kullanıcı="${username}" → şifre = .env ADMIN_PASSWORD`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
