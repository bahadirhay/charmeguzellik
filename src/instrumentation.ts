/**
 * Sunucu süreci açılırken Prisma motorunu önceden bağlar (Turbopack / ilk istek yarışları).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$connect();
  } catch {
    /* ilk sorguda withPrismaEngine yeniden dener */
  }
}
