import { z } from "zod";

export const sitemapChangeFrequencyValues = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;

export type SitemapChangeFrequency = (typeof sitemapChangeFrequencyValues)[number];

const changeFrequencySchema = z.enum(sitemapChangeFrequencyValues);

/** Harici veya statik yollar: site köküne göre path (örn. /kampanya) veya tam URL aynı origin */
export const sitemapExtraEntrySchema = z.object({
  path: z.string().min(1).max(2048),
  changeFrequency: changeFrequencySchema.optional(),
  priority: z.number().min(0).max(1).optional(),
});

export type SitemapExtraEntry = z.infer<typeof sitemapExtraEntrySchema>;

export const sitemapExtrasArraySchema = z.array(sitemapExtraEntrySchema).max(200);

export function parseSitemapExtrasJson(raw: string | null | undefined): SitemapExtraEntry[] {
  if (raw == null || !String(raw).trim()) return [];
  try {
    const j = JSON.parse(String(raw)) as unknown;
    const p = sitemapExtrasArraySchema.safeParse(j);
    return p.success ? p.data : [];
  } catch {
    return [];
  }
}

export function normalizeSitemapChangeFrequency(
  v: string | null | undefined,
): SitemapChangeFrequency | undefined {
  if (v == null || !String(v).trim()) return undefined;
  const p = changeFrequencySchema.safeParse(String(v).trim());
  return p.success ? p.data : undefined;
}

/** Sitemap’te listelenecek tercih edilen URL (aynı origin canonical / path) */
export function pageUrlForSitemap(base: string, slug: string, canonicalPath: string | null): string {
  const root = base.replace(/\/$/, "");
  let origin: string;
  try {
    origin = new URL(root).origin;
  } catch {
    return slug === "home" ? root : `${root}/${slug}`;
  }

  const applyCanonical = (cRaw: string): string | null => {
    const c = cRaw.trim();
    if (!c) return null;
    if (c.startsWith("http")) {
      try {
        const u = new URL(c);
        if (u.origin === origin) return u.href.replace(/\/$/, "") || root;
      } catch {
        return null;
      }
      return null;
    }
    const path = c.startsWith("/") ? c : `/${c}`;
    if (slug === "home" && (path === "/" || path === "")) return root;
    return `${root}${path}`;
  };

  if (slug === "home") {
    const fromCanon = canonicalPath ? applyCanonical(canonicalPath) : null;
    return fromCanon ?? root;
  }

  const def = `${root}/${slug}`;
  if (!canonicalPath?.trim()) return def;
  return applyCanonical(canonicalPath) ?? def;
}

export function extraPathToSitemapUrl(base: string, path: string): string | null {
  const root = base.replace(/\/$/, "");
  const p = path.trim();
  if (!p) return null;
  let origin: string;
  try {
    origin = new URL(root).origin;
  } catch {
    return null;
  }
  if (p.startsWith("http")) {
    try {
      const u = new URL(p);
      if (u.origin !== origin) return null;
      return u.href.replace(/\/$/, "") || root;
    } catch {
      return null;
    }
  }
  const seg = p.startsWith("/") ? p : `/${p}`;
  return `${root}${seg}`;
}
