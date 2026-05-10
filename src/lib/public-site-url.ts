import { headers } from "next/headers";
import { hostHeaderToDistinctSegments } from "@/lib/tenant-db";

/** Tek deployment + birden fazla custom domain: sekme/SEO kökü istek host’undan (NEXT_PUBLIC_SITE_URL yedek). */
export async function resolvePublicSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const raw = (h.get("x-forwarded-host") ?? h.get("host") ?? "").trim();
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
