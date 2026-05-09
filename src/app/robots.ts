import type { MetadataRoute } from "next";
import { resolvePublicSiteUrl } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await resolvePublicSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
