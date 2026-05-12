import "server-only";

import { createRequire } from "node:module";
import type { PrismaClient } from "@prisma/client";

/**
 * Turbopack bazen `@prisma/client` importunu tarayıcı koşuluna düşürür; tarayıcı stub'ında
 * `commerceServicePrice` vb. yok → "upsert undefined". `createRequire` ile Node çözümlemesi zorlanır.
 */
const require = createRequire(import.meta.url);

/**
 * `globalThis.prisma` yaygın bir isim; başka araçlar / eski süreç aynı anahtara yazarsa
 * eksik delegate’li yanlış nesne kullanılıyordu. Bu projeye özel anahtar kullan.
 */
/** v6: kasa (`commerceCashReceipt`, `commerceCashDayClose`) şemada; eksik client reddedilir */
const PRISMA_GLOBAL_KEY = "__web_page_prisma_singleton_v6__" as const;
type GlobalPrisma = typeof globalThis & { [PRISMA_GLOBAL_KEY]?: PrismaClient };
const globalForPrisma = globalThis as GlobalPrisma;

function createPrismaClient(): PrismaClient {
  const { PrismaClient: PrismaClientCtor } = require("@prisma/client") as typeof import("@prisma/client");
  return new PrismaClientCtor({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Şema güncellendiğinde eski dev önbelleğinde kalan client eksik delegate içerebilir. */
function clientMatchesSchema(client: PrismaClient): boolean {
  const c = client as unknown as {
    navItem?: { findMany?: unknown };
    siteInstagramPost?: { findMany?: unknown };
    siteYoutubeVideo?: { findMany?: unknown };
    siteTiktokVideo?: { findMany?: unknown };
    staffRole?: { findMany?: unknown };
    staffUser?: { findMany?: unknown };
    crmContact?: { findMany?: unknown };
    commerceServicePrice?: { findMany?: unknown; upsert?: unknown };
    commercePackagePayment?: { findMany?: unknown; create?: unknown };
    commercePackagePurchase?: { findMany?: unknown };
    commerceCashReceipt?: { findMany?: unknown; create?: unknown };
    commerceCashDayClose?: { findMany?: unknown; upsert?: unknown };
  };
  return (
    typeof c.navItem?.findMany === "function" &&
    typeof c.siteInstagramPost?.findMany === "function" &&
    typeof c.siteYoutubeVideo?.findMany === "function" &&
    typeof c.siteTiktokVideo?.findMany === "function" &&
    typeof c.staffRole?.findMany === "function" &&
    typeof c.staffUser?.findMany === "function" &&
    typeof c.crmContact?.findMany === "function" &&
    typeof c.commerceServicePrice?.findMany === "function" &&
    typeof c.commerceServicePrice?.upsert === "function" &&
    typeof c.commercePackagePayment?.findMany === "function" &&
    typeof c.commercePackagePayment?.create === "function" &&
    typeof c.commercePackagePurchase?.findMany === "function" &&
    typeof c.commerceCashReceipt?.findMany === "function" &&
    typeof c.commerceCashReceipt?.create === "function"
  );
}

function resolveSingleton(): PrismaClient {
  const existing = globalForPrisma[PRISMA_GLOBAL_KEY];
  if (existing && clientMatchesSchema(existing)) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => {});
    delete globalForPrisma[PRISMA_GLOBAL_KEY];
  }
  const created = createPrismaClient();
  if (!clientMatchesSchema(created)) {
    void created.$disconnect().catch(() => {});
    throw new Error(
      "Prisma client şema ile uyumsuz (ticaret / kasa / paket modelleri eksik). Çözüm: tüm Node süreçlerini durdurun, proje kökünde `npx prisma generate`, ardından `npm run dev`. Windows EPERM: önce tüm node.exe ve IDE terminalindeki dev sunucularını kapatın.",
    );
  }
  globalForPrisma[PRISMA_GLOBAL_KEY] = created;
  return created;
}

const prisma: PrismaClient = resolveSingleton();

/**
 * Turbopack / HMR’da sorgu bazen “Engine is not yet connected” verir; kısa gecikmeyle yeniden dener.
 * İlk çağrıda `$connect` tamamlanana kadar bekler.
 */
export async function withPrismaEngine<T>(run: () => Promise<T>): Promise<T> {
  const delaysMs = [0, 15, 35, 60, 100, 160, 250, 400];
  let last: unknown;
  for (let i = 0; i < delaysMs.length; i++) {
    const wait = delaysMs[i]!;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      await prisma.$connect();
      return await run();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      const transient =
        msg.includes("Engine is not yet connected") ||
        msg.includes("not yet connected") ||
        msg.includes("Response from the Engine was empty");
      if (!transient || i === delaysMs.length - 1) throw e;
    }
  }
  throw last;
}

export { prisma };
