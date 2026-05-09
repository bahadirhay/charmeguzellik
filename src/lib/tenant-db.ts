import { DEFAULT_TENANT_ID_SEED } from "@/lib/tenant-default";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Tek-kiracılı geçiş aşaması: tüm Prisma `where` / `create` çağrıları bu id ile filtrelenir.
 * Host / subdomain ile kiracı çözümlemesi geldiğinde burası istek bağlamından beslenir.
 */
export const BOOTSTRAP_TENANT_ID = DEFAULT_TENANT_ID_SEED;

export function normalizeHost(host: string | null | undefined): string | null {
  const raw = host?.trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/:\d+$/, "");
}

export async function getRequestHost(req?: Request): Promise<string | null> {
  const directHost = normalizeHost(req?.headers.get("x-forwarded-host") ?? req?.headers.get("host"));
  if (directHost) return directHost;
  try {
    const h = await headers();
    return normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
  } catch {
    return null;
  }
}

export async function resolveTenantByHost(host: string | null | undefined) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;
  return prisma.tenantDomain.findUnique({
    where: { host: normalizedHost },
    select: { tenantId: true },
  });
}

export async function getTenantForRequest(req?: Request) {
  const host = await getRequestHost(req);
  const mapped = await resolveTenantByHost(host);
  const tenantId = mapped?.tenantId ?? BOOTSTRAP_TENANT_ID;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (tenant) return tenant;
  return prisma.tenant.findUnique({ where: { id: BOOTSTRAP_TENANT_ID } });
}

export async function getTenantIdForRequest(req?: Request): Promise<string> {
  const host = await getRequestHost(req);
  const mapped = await resolveTenantByHost(host);
  if (mapped?.tenantId) return mapped.tenantId;
  return BOOTSTRAP_TENANT_ID;
}
