import { headers } from "next/headers";
import { normalizeHost } from "@/lib/tenant-db";

/** Tek deployment + birden fazla custom domain: sekme/SEO kökü istek host’undan (NEXT_PUBLIC_SITE_URL yedek). */
export async function resolvePublicSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
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
