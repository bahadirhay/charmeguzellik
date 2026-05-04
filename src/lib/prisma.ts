import { PrismaClient } from "@prisma/client";

/**
 * `globalThis.prisma` yaygın bir isim; başka araçlar / eski süreç aynı anahtara yazarsa
 * eksik delegate’li yanlış nesne kullanılıyordu. Bu projeye özel anahtar kullan.
 */
const PRISMA_GLOBAL_KEY = "__web_page_prisma_singleton_v2__" as const;
type GlobalPrisma = typeof globalThis & { [PRISMA_GLOBAL_KEY]?: PrismaClient };
const globalForPrisma = globalThis as GlobalPrisma;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasCrmContactDelegate(client: unknown): boolean {
  const c = client as { crmContact?: { findMany?: unknown } };
  return typeof c.crmContact?.findMany === "function";
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
  };
  return (
    typeof c.navItem?.findMany === "function" &&
    typeof c.siteInstagramPost?.findMany === "function" &&
    typeof c.siteYoutubeVideo?.findMany === "function" &&
    typeof c.siteTiktokVideo?.findMany === "function" &&
    typeof c.staffRole?.findMany === "function" &&
    typeof c.staffUser?.findMany === "function" &&
    typeof c.crmContact?.findMany === "function"
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
  if (!hasCrmContactDelegate(created)) {
    throw new Error(
      "Prisma istemcisi şemada CrmContact içermiyor. Tüm dev süreçlerini durdurup proje kökünde çalıştırın: npx prisma generate",
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
