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
 * X-Forwarded-Host bazen virgülle zincir gelir ("uç host, üst proxy"). Tek string ile
 * TenantDomain eşleşmez → bootstrap kiracı + girişte/sessionda farklı tenantId görülür → panel sürekli "çıkmış".
 * Her segment sırayla denenir; duplikasyon atlanır.
 */
export function hostHeaderToDistinctSegments(primary: string | null | undefined): string[] {
  const raw = primary?.trim().toLowerCase() ?? "";
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of raw.split(",")) {
    const n = normalizeHost(chunk.trim());
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
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
  const segments = hostHeaderToDistinctSegments(host ?? "");
  if (segments.length === 0) return null;
  const triedHosts = new Set<string>();
  for (const seg of segments) {
    for (const cand of hostAliasesForTenantLookup(seg)) {
      if (triedHosts.has(cand)) continue;
      triedHosts.add(cand);
      const row = await prisma.tenantDomain.findUnique({
        where: { host: cand },
        select: { tenantId: true },
      });
      if (row) return row;
    }
  }
  return null;
}

/**
 * Host TenantDomain ile eşlenmeyince kullanılacak kiracı.
 * Neon DB’de yalnızca cuid’li Tenant varken `tenant_single_site_default` yoksa doğrudan
 * bootstrap id ile SiteSettings/Page FK’leri kırılıp RSC 500 üretebilir.
 * Varsayılan: önce migrate seed id’si, yoksa isPrimary domain, sonra herhangi bir domain / ilk Tenant satırı.
 */
async function tenantIdWhenNoDomainMaps(): Promise<string> {
  const boot = await prisma.tenant.findUnique({ where: { id: BOOTSTRAP_TENANT_ID }, select: { id: true } });
  if (boot) return BOOTSTRAP_TENANT_ID;

  const primary = await prisma.tenantDomain.findFirst({
    where: { isPrimary: true },
    select: { tenantId: true },
    orderBy: { updatedAt: "asc" },
  });
  if (primary?.tenantId) return primary.tenantId;

  const viaDomain = await prisma.tenantDomain.findFirst({
    select: { tenantId: true },
    orderBy: { updatedAt: "asc" },
  });
  if (viaDomain?.tenantId) return viaDomain.tenantId;

  const anyTenant = await prisma.tenant.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  return anyTenant?.id ?? BOOTSTRAP_TENANT_ID;
}

export async function getTenantIdForRequest(req?: Request): Promise<string> {
  const host = await getRequestHost(req);
  const mapped = await resolveTenantByHost(host);
  if (mapped?.tenantId) return mapped.tenantId;
  return tenantIdWhenNoDomainMaps();
}

export async function getTenantForRequest(req?: Request) {
  const tenantId = await getTenantIdForRequest(req);
  let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (tenant) return tenant;
  tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  return tenant;
}
