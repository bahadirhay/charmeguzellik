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

/**
 * Apex ↔ www TenantDomain tek satırında tutulunca ikisi de aynı kiracıya düşer;
 * oturum (tenantId) ile çözüm aynı host ailesinde kalır — aksi halde panel "çıkış" görünür.
 */
export function hostAliasesForTenantLookup(normalizedHost: string | null | undefined): string[] {
  const h = typeof normalizedHost === "string" ? normalizedHost.trim().toLowerCase() : "";
  if (!h) return [];
  const out: string[] = [h];
  if (h.startsWith("www.")) {
    const stripped = h.slice(4);
    if (stripped.length > 0 && !out.includes(stripped)) out.push(stripped);
    return out;
  }
  if (!h.includes(".")) return out;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return out;
  const withWww = `www.${h}`;
  if (!out.includes(withWww)) out.push(withWww);
  return out;
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
  const candidates = hostAliasesForTenantLookup(normalizedHost);
  if (candidates.length === 0) return null;
  for (const cand of candidates) {
    const row = await prisma.tenantDomain.findUnique({
      where: { host: cand },
      select: { tenantId: true },
    });
    if (row) return row;
  }
  return null;
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
