import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import {
  extraPathToSitemapUrl,
  normalizeSitemapChangeFrequency,
  pageUrlForSitemap,
  parseSitemapExtrasJson,
} from "@/lib/sitemap-config";

/** Vercel build aşamasında DATABASE_URL olmayabilir; sitemap’i istek anında üret. */
export const dynamic = "force-dynamic";

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

function clampPriority(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!process.env.DATABASE_URL?.trim()) {
    return [
      {
        url: `${base}/`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const homePriority = clampPriority(settings?.sitemapHomePriority ?? 1, 1);
  const pageDefaultPriority = clampPriority(settings?.sitemapPagePriority ?? 0.7, 0.7);
  const extras = parseSitemapExtrasJson(settings?.sitemapExtrasJson);

  const pages = await prisma.page.findMany({
    where: { published: true, noIndex: false, includeInSitemap: true },
    select: {
      slug: true,
      updatedAt: true,
      canonicalPath: true,
      sitemapPriority: true,
      sitemapChangeFrequency: true,
    },
  });

  const home = pages.find((p) => p.slug === "home");
  const homeCf =
    (normalizeSitemapChangeFrequency(home?.sitemapChangeFrequency) as ChangeFreq | undefined) ??
    "weekly";
  const homePr =
    home?.sitemapPriority != null && Number.isFinite(home.sitemapPriority)
      ? clampPriority(home.sitemapPriority, homePriority)
      : homePriority;

  const entries: MetadataRoute.Sitemap = [];
  if (home) {
    entries.push({
      url: pageUrlForSitemap(base, "home", home.canonicalPath),
      lastModified: home.updatedAt,
      changeFrequency: homeCf,
      priority: homePr,
    });
  }

  const seen = new Set(entries.map((e) => e.url));

  for (const p of pages) {
    if (p.slug === "home") continue;
    const url = pageUrlForSitemap(base, p.slug, p.canonicalPath);
    if (seen.has(url)) continue;
    seen.add(url);
    const cf =
      (normalizeSitemapChangeFrequency(p.sitemapChangeFrequency) as ChangeFreq | undefined) ??
      "monthly";
    const pr =
      p.sitemapPriority != null && Number.isFinite(p.sitemapPriority)
        ? clampPriority(p.sitemapPriority, pageDefaultPriority)
        : pageDefaultPriority;
    entries.push({
      url,
      lastModified: p.updatedAt,
      changeFrequency: cf,
      priority: pr,
    });
  }

  for (const ex of extras) {
    const url = extraPathToSitemapUrl(base, ex.path);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const cf =
      (normalizeSitemapChangeFrequency(ex.changeFrequency) as ChangeFreq | undefined) ?? "monthly";
    const pr =
      ex.priority != null && Number.isFinite(ex.priority)
        ? clampPriority(ex.priority, pageDefaultPriority)
        : pageDefaultPriority;
    entries.push({
      url,
      lastModified: new Date(),
      changeFrequency: cf,
      priority: pr,
    });
  }

  return entries;
}
