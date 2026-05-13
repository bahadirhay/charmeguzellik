import type { MetadataRoute } from "next";
import { resolveCanonicalPublicBaseUrl, resolvePublicSiteUrl } from "@/lib/public-site-url";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  let base: string;
  if (process.env.DATABASE_URL?.trim()) {
    try {
      const tenantId = await getTenantIdForRequest();
      base = await resolveCanonicalPublicBaseUrl(tenantId);
    } catch {
      base = await resolvePublicSiteUrl();
    }
  } else {
    base = await resolvePublicSiteUrl();
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
