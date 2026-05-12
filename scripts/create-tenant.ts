import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { provisionTenant } from "../src/lib/provision-tenant";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrlFromShell = process.env.DATABASE_URL?.trim() || "";
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
if (databaseUrlFromShell) {
  process.env.DATABASE_URL = databaseUrlFromShell;
}

const prisma = new PrismaClient();

function parseArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

async function main() {
  const slug = (parseArg("slug") ?? "").trim().toLowerCase();
  const name = (parseArg("name") ?? slug).trim();
  const hostArg = parseArg("host");
  const host = hostArg ? normalizeHost(hostArg) : "";

  if (!slug || !name || !host) {
    throw new Error(
      "Kullanim: npm run tenant:create -- --slug=<slug> --name=<ad> --host=<alan-adi> [--clone-content] [--no-appointments] [--commerce] [--bootstrap-admin]",
    );
  }

  const cloneContent = hasFlag("clone-content");
  const noAppointments = hasFlag("no-appointments");
  const withCommerce = hasFlag("commerce");
  const bootstrapAdmin = hasFlag("bootstrap-admin");

  let bootstrapAdminParams: { username: string; passwordPlain: string } | undefined;
  if (bootstrapAdmin) {
    const plain = process.env.ADMIN_PASSWORD?.trim();
    if (!plain || plain.length < 8) {
      throw new Error("--bootstrap-admin icin .env icinde ADMIN_PASSWORD en az 8 karakter olmali.");
    }
    const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
    const username = raw.length >= 2 ? raw : "admin";
    bootstrapAdminParams = { username, passwordPlain: plain };
  }

  const result = await provisionTenant(prisma, {
    slug,
    name,
    host,
    cloneContent,
    appointmentsEnabled: noAppointments ? false : undefined,
    commerceEnabled: withCommerce ? true : undefined,
    bootstrapAdmin: bootstrapAdminParams,
  });

  console.log(`Tenant hazir: ${result.slug} (${result.tenantId})`);
  console.log(`Domain map: ${result.host} -> ${result.tenantId}`);
}

main()
  .catch((e) => {
    console.error("[create-tenant] hata", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
