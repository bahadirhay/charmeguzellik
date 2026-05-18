/**
 * Platform kontrol kiracısı (.env) + DemoPanelAudit tablosu + demo kullanıcı.
 * Çalıştır: npm run setup:platform-control
 *
 * .env: DATABASE_URL, ADMIN_PASSWORD (admin için), isteğe DEMO_PANEL_PASSWORD (demo için, yoksa üretilir)
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_HOST = "randevu.techizmet.com";

config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

function parseEnvFile(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function quoteIfNeeded(v: string): string {
  if (/[\s#"'=]/.test(v)) return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return v;
}

function mergeEnvFile(filePath: string, updates: Record<string, string>): void {
  const original = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const map = parseEnvFile(original);
  for (const [k, v] of Object.entries(updates)) map.set(k, v);

  const seen = new Set<string>();
  const out: string[] = [];
  if (original) {
    for (const line of original.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) {
        out.push(line);
        continue;
      }
      const eq = t.indexOf("=");
      if (eq <= 0) {
        out.push(line);
        continue;
      }
      const key = t.slice(0, eq).trim();
      if (map.has(key)) {
        out.push(`${key}=${quoteIfNeeded(map.get(key)!)}`);
        seen.add(key);
      } else out.push(line);
    }
  }
  for (const [k, v] of map.entries()) {
    if (!seen.has(k)) out.push(`${k}=${quoteIfNeeded(v)}`);
  }
  const body = out.join("\n").replace(/\n*$/, "") + "\n";
  writeFileSync(filePath, body, "utf8");
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");

  const roleSpecs: { slug: string; label: string; permissions: string[] }[] = [
    {
      slug: "admin",
      label: "Yönetici",
      permissions: [
        "site.settings",
        "site.theme",
        "site.modules",
        "content.pages",
        "content.regions",
        "content.nav",
        "content.sitemap",
        "social.instagram",
        "social.youtube",
        "social.tiktok",
        "crm.leads",
        "crm.appointments",
        "crm.appointments.self",
        "commerce.manage",
        "users.manage",
        "users.roles",
        "media.manage",
        "backups.manage",
        "platform.provision",
      ],
    },
    {
      slug: "editor",
      label: "Editör",
      permissions: [
        "content.pages",
        "content.regions",
        "content.nav",
        "content.sitemap",
        "social.instagram",
        "social.youtube",
        "social.tiktok",
        "crm.leads",
        "crm.appointments",
        "crm.appointments.self",
        "commerce.manage",
        "media.manage",
      ],
    },
    { slug: "scheduler", label: "Randevu operatörü", permissions: ["crm.appointments"] },
    { slug: "commerce", label: "Ticaret (kasa, paket, cari)", permissions: ["commerce.manage"] },
    { slug: "practitioner", label: "Uygulayıcı (yalnızca kendi randevuları)", permissions: ["crm.appointments.self"] },
    {
      slug: "demo",
      label: "Demo (satış)",
      permissions: ["crm.leads", "crm.appointments", "commerce.manage", "users.manage"],
    },
  ];

  const prisma = new PrismaClient();

  async function ensureRoles(tenantId: string) {
    for (const r of roleSpecs) {
      await prisma.staffRole.upsert({
        where: { tenantId_slug: { tenantId, slug: r.slug } },
        create: {
          tenantId,
          slug: r.slug,
          label: r.label,
          permissionsJson: JSON.stringify(r.permissions),
        },
        update: { label: r.label, permissionsJson: JSON.stringify(r.permissions) },
      });
    }
  }

  try {
    const host = PLATFORM_HOST.trim().toLowerCase();
    const mapped = await prisma.tenantDomain.findUnique({
      where: { host },
      select: { tenantId: true },
    });
    if (!mapped?.tenantId) {
      throw new Error(
        `TenantDomain kaydı yok: ${PLATFORM_HOST}. Önce kiracı + domain oluşturun (tenant:create / add-domain).`,
      );
    }
    const tenantId = mapped.tenantId;
    console.log(`[setup-platform-control] Kiracı: ${tenantId} (${PLATFORM_HOST})`);

    const envUpdates: Record<string, string> = {
      PLATFORM_CONTROL_TENANT_ID: tenantId,
      PLATFORM_CONTROL_HOST: PLATFORM_HOST,
      DEMO_PANEL_USERNAMES: process.env.DEMO_PANEL_USERNAMES?.trim() || "demo",
    };

    let demoPassword = process.env.DEMO_PANEL_PASSWORD?.trim();
    if (!demoPassword || demoPassword.length < 6) {
      demoPassword = randomBytes(9).toString("base64url").slice(0, 12);
      envUpdates.DEMO_PANEL_PASSWORD = demoPassword;
    }

    mergeEnvFile(resolve(root, ".env"), envUpdates);
    mergeEnvFile(resolve(root, ".env.local"), envUpdates);
    console.log("[setup-platform-control] .env ve .env.local güncellendi.");

    console.log("[setup-platform-control] Veritabanı şeması (DemoPanelAudit)…");
    execSync("npx prisma db push --skip-generate", { cwd: root, stdio: "inherit" });

    await ensureRoles(tenantId);

    const bcryptMod = await import("bcryptjs");
    const bcrypt = bcryptMod.default ?? bcryptMod;

    const adminPlain = process.env.ADMIN_PASSWORD?.trim();
    if (adminPlain && adminPlain.length >= 6) {
      const adminRole = await prisma.staffRole.findUnique({
        where: { tenantId_slug: { tenantId, slug: "admin" } },
      });
      if (adminRole) {
        const adminUser = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase();
        const hash = await bcrypt.hash(adminPlain, 12);
        await prisma.staffUser.upsert({
          where: { tenantId_username: { tenantId, username: adminUser } },
          create: {
            tenantId,
            username: adminUser,
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
        console.log(`[setup-platform-control] Admin kullanıcı: "${adminUser}" (şifre = ADMIN_PASSWORD)`);
      }
    } else {
      console.warn("[setup-platform-control] ADMIN_PASSWORD yok — admin kullanıcı atlandı.");
    }

    const demoRole = await prisma.staffRole.findUnique({
      where: { tenantId_slug: { tenantId, slug: "demo" } },
    });
    if (!demoRole) throw new Error('StaffRole "demo" bulunamadı.');

    const demoHash = await bcrypt.hash(demoPassword, 12);
    await prisma.staffUser.upsert({
      where: { tenantId_username: { tenantId, username: "demo" } },
      create: {
        tenantId,
        username: "demo",
        passwordHash: demoHash,
        displayName: "Demo Satış",
        active: true,
        roleAssignments: { create: [{ roleId: demoRole.id }] },
      },
      update: {
        passwordHash: demoHash,
        active: true,
        roleAssignments: { deleteMany: {}, create: [{ roleId: demoRole.id }] },
      },
    });

    console.log("\n--- Platform hazır ---");
    console.log(`PLATFORM_CONTROL_TENANT_ID=${tenantId}`);
    console.log(`PLATFORM_CONTROL_HOST=${PLATFORM_HOST}`);
    console.log(`Demo giriş: kullanıcı=demo  şifre=${demoPassword}`);
    console.log("(Şifre .env içinde DEMO_PANEL_PASSWORD olarak kayıtlı)\n");
    console.log("Sizin yapmanız gerekenler (panel):");
    console.log(`  1) https://${PLATFORM_HOST}/admin/login → admin ile giriş`);
    console.log("  2) Demo sonrası üst banttan «Demo işlemlerini geri al»");
    console.log("  3) Vercel Production’da aynı PLATFORM_* değişkenlerini ekleyin (npm run vercel:sync-env)");

    try {
      execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
    } catch {
      console.warn(
        "[setup-platform-control] prisma generate atlandı (dosya kilitli — `next dev` durdurup tekrar çalıştırın).",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
