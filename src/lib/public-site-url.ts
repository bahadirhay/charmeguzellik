import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  hostAliasesForTenantLookup,
  hostHeaderToDistinctSegments,
  normalizeHost,
} from "@/lib/tenant-db";

function isLocalDevHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h.startsWith("127.") || h.endsWith(".local");
}

function tenantDomainMatchesRequest(requestHost: string, domainHost: string): boolean {
  const r = normalizeHost(requestHost);
  const d = normalizeHost(domainHost);
  if (!r || !d) return false;
  if (r === d) return true;
  const rAliases = new Set(hostAliasesForTenantLookup(r));
  for (const cand of hostAliasesForTenantLookup(d)) {
    if (rAliases.has(cand)) return true;
  }
  return false;
}

/**
 * Çok kiracılı sitemap/robots: URL kökü önce istek host’u bu kiracının alan adlarından biriyle eşleşiyorsa o host;
 * aksi halde veritabanındaki birincil (veya ilk) TenantDomain. Böylece Host başlığı boş kalsa bile yanlış
 * NEXT_PUBLIC_SITE_URL ile başka site adresi üretilmez.
 */
export async function resolveCanonicalPublicBaseUrl(tenantId: string): Promise<string> {
  try {
    const domains = await prisma.tenantDomain.findMany({
      where: { tenantId },
      select: { host: true, isPrimary: true },
      orderBy: [{ isPrimary: "desc" }, { host: "asc" }],
    });

    let requestHost: string | null = null;
    let requestProto = "https";
    try {
      const h = await headers();
      const raw = (
        h.get("x-forwarded-host") ??
        h.get("x-vercel-forwarded-host") ??
        h.get("host") ??
        ""
      ).trim();
      const segments = hostHeaderToDistinctSegments(raw);
      requestHost = segments[0] ? normalizeHost(segments[0]) : null;
      const rawProto = h.get("x-forwarded-proto")?.trim() ?? "https";
      requestProto = rawProto.split(",")[0]?.trim() || "https";
      if (requestProto !== "http" && requestProto !== "https") requestProto = "https";
    } catch {
      /* build / önbellek */
    }

    if (requestHost && domains.length > 0) {
      for (const d of domains) {
        if (tenantDomainMatchesRequest(requestHost, d.host)) {
          const proto = isLocalDevHost(requestHost)
            ? "http"
            : requestProto === "http"
              ? "http"
              : "https";
          return `${proto}://${requestHost}`.replace(/\/$/, "");
        }
      }
    }

    if (domains.length > 0) {
      const primary = domains.find((x) => x.isPrimary) ?? domains[0];
      const host = normalizeHost(primary.host);
      if (host) {
        const proto = isLocalDevHost(host) ? "http" : "https";
        return `${proto}://${host}`.replace(/\/$/, "");
      }
    }
  } catch (e) {
    console.warn("resolveCanonicalPublicBaseUrl: tenant domain okunamadı, istek/env yedeği kullanılıyor", e);
  }

  return (await resolvePublicSiteUrl()).replace(/\/$/, "");
}

/** Tek deployment + birden fazla custom domain: sekme/SEO kökü istek host’undan (NEXT_PUBLIC_SITE_URL yedek). */
export async function resolvePublicSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const raw = (
      h.get("x-forwarded-host") ??
      h.get("x-vercel-forwarded-host") ??
      h.get("host") ??
      ""
    ).trim();
    const segments = hostHeaderToDistinctSegments(raw);
    const host = segments[0] ?? null;
    if (host) {
      const rawProto = h.get("x-forwarded-proto")?.trim() ?? "https";
      const proto = rawProto.split(",")[0]?.trim() || "https";
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    /* build / önbellek bağlamı */
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
