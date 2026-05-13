#!/usr/bin/env node
/**
 * Uretim / staging Tenant.moduleUnlockHashes ozeti.
 * Calistir: DATABASE_URL tanimli iken  node scripts/check-tenant-module-unlock-keys.mjs
 * Uyarilari hata say: ... --strict
 */
import { PrismaClient } from "@prisma/client";

const strict = process.argv.includes("--strict");

function isAppointmentsOn(featuresJson) {
  if (featuresJson == null) return true;
  if (typeof featuresJson !== "object" || Array.isArray(featuresJson)) return true;
  const v = featuresJson.appointments;
  if (v === false) return false;
  return true;
}

function isCommerceOn(featuresJson) {
  if (featuresJson == null) return false;
  if (typeof featuresJson !== "object" || Array.isArray(featuresJson)) return false;
  return featuresJson.commerce === true;
}

function parseHashes(moduleUnlockHashes) {
  if (moduleUnlockHashes == null || typeof moduleUnlockHashes !== "object" || Array.isArray(moduleUnlockHashes)) {
    return { commerce: null, appointments: null };
  }
  const o = moduleUnlockHashes;
  const commerce = typeof o.commerce === "string" && o.commerce.length > 10 ? o.commerce : null;
  const appointments = typeof o.appointments === "string" && o.appointments.length > 10 ? o.appointments : null;
  return { commerce, appointments };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    process.stderr.write("\n[tenant-module-keys] DATABASE_URL tanimli degil.\n\n");
    return strict ? 1 : 0;
  }

  const prisma = new PrismaClient();
  let exitCode = 0;

  try {
    const rows = await prisma.tenant.findMany({
      select: { id: true, slug: true, featuresJson: true, moduleUnlockHashes: true },
      orderBy: { slug: "asc" },
    });

    process.stdout.write(`\n[tenant-module-keys] ${rows.length} kiraci incelendi.\n`);

    let issues = 0;
    for (const t of rows) {
      const h = parseHashes(t.moduleUnlockHashes);
      const apptOn = isAppointmentsOn(t.featuresJson);
      const commOn = isCommerceOn(t.featuresJson);
      const missAppt = apptOn && !h.appointments;
      const missComm = commOn && !h.commerce;

      if (!missAppt && !missComm) continue;

      issues += 1;
      const bits = [];
      if (t.moduleUnlockHashes == null) bits.push("moduleUnlockHashes=NULL");
      if (missAppt) bits.push("randevu acik, appointments hash eksik");
      if (missComm) bits.push("ticaret acik, commerce hash eksik");
      process.stdout.write(`  - ${t.slug} (${t.id.slice(0, 8)}...): ${bits.join("; ")}\n`);
    }

    if (issues === 0) {
      process.stdout.write(
        "[tenant-module-keys] Uyum: acik moduller icin hash var (veya her iki modul de kapali).\n\n",
      );
      exitCode = 0;
    } else {
      process.stdout.write(
        `\n[tenant-module-keys] ${issues} kiraci: acik modul icin hash eksik.\n` +
          "  Cozum: Admin > Site modulleri > Guvenlik anahtarlari olustur; veya platformda Anahtar.\n" +
          "  Duz anahtari GitHub Secret olarak saklayin.\n",
      );
      if (strict) {
        process.stderr.write("[tenant-module-keys] --strict: cikis kodu 1.\n\n");
        exitCode = 1;
      } else {
        process.stdout.write("[tenant-module-keys] (Uyari; --strict ile cikis kodu 1.)\n\n");
        exitCode = 0;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unknown column|moduleUnlockHashes|does not exist/i.test(msg)) {
      process.stderr.write(
        "\n[tenant-module-keys] Tenant.moduleUnlockHashes bulunamadi. Once migration: npm run db:migrate\n\n",
      );
      exitCode = strict ? 1 : 0;
    } else {
      process.stderr.write(`\n[tenant-module-keys] Hata: ${msg}\n\n`);
      exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }

  return exitCode;
}

const code = await main();
process.exit(code);
