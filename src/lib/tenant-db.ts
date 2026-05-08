import { DEFAULT_TENANT_ID_SEED } from "@/lib/tenant-default";

/**
 * Tek-kiracılı geçiş aşaması: tüm Prisma `where` / `create` çağrıları bu id ile filtrelenir.
 * Host / subdomain ile kiracı çözümlemesi geldiğinde burası istek bağlamından beslenir.
 */
export const BOOTSTRAP_TENANT_ID = DEFAULT_TENANT_ID_SEED;
