/**
 * Mevcut kiracıya ikinci (üçüncü…) alan adı bağlar — TenantDomain upsert.
 *
 * Örnek (resimdeki gibi yalnızca randevu.techizmet.com kayıtlıysa):
 *   npm run tenant:add-domain -- --host=charmeguzellik.com --copy-tenant-from-host=randevu.techizmet.com
 *
 * .env: DATABASE_URL (Neon production branch ile aynı endpoint olmalı)
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { normalizeHost, resolveTenantByHost } from "../src/lib/tenant-db";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

function parseArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

const prisma = new PrismaClient();

async function main() {
  const rawHost = (parseArg("host") ?? "").trim();
  const copyFrom = (parseArg("copy-tenant-from-host") ?? "").trim();
  const tenantIdArg = (parseArg("tenant-id") ?? "").trim();

  const host = normalizeHost(rawHost);
  if (!host) {
    throw new Error("--host=alanadiniz.com gerekli");
  }

  let tenantId = tenantIdArg || null;

  if (!tenantId && copyFrom) {
    const src = normalizeHost(copyFrom);
    if (!src) throw new Error("--copy-tenant-from-host için geçerli bir host girin");
    const row = await resolveTenantByHost(src);
    tenantId = row?.tenantId ?? null;
    if (!tenantId) throw new Error(`Kaynak host kiraciya map edilmiyor: ${src}`);
  }

  if (!tenantId) {
    throw new Error("--tenant-id=... veya --copy-tenant-from-host=meger-kayitlı-host gerekli");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true } });
  if (!tenant) throw new Error(`Tenant yok: ${tenantId}`);

  await prisma.tenantDomain.upsert({
    where: { host },
    create: { tenantId, host, isPrimary: false },
    update: { tenantId },
  });

  console.log(`[add-tenant-domain] OK: ${host} -> tenant ${tenant.slug} (${tenantId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
