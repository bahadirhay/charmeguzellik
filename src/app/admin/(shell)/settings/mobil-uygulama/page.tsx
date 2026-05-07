import Link from "next/link";
import { headers } from "next/headers";
import { MobilRandevuAppGuide } from "@/components/admin/MobilRandevuAppGuide";
import { requirePagePermission } from "@/lib/auth";
import { normalizePublicSiteUrl, resolvePublicSiteOrigin } from "@/lib/site-public-url";

const ADMIN_PANEL_PATH = "/admin/appointments";

export default async function MobilRandevuAppPage() {
  await requirePagePermission("site.settings");

  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .toString()
    .split(",")[0]
    ?.trim() ?? "";
  const proto = (h.get("x-forwarded-proto") ?? "https").toString().split(",")[0]?.trim() || "https";
  const req = new Request(`${proto}://${host}/`, {
    headers: new Headers({
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
    }),
  });

  let canonicalOrigin = resolvePublicSiteOrigin(req).replace(/\/+$/, "");
  if (!canonicalOrigin) {
    const n = normalizePublicSiteUrl();
    if (n) canonicalOrigin = n.startsWith("http") ? n.replace(/\/+$/, "") : `https://${n.replace(/\/+$/, "")}`;
  }
  if (!canonicalOrigin) {
    canonicalOrigin = "https://charmeguzellik.com";
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/admin/settings" className="text-rose-600 hover:underline">
            Ayarlar & SEO
          </Link>{" "}
          <span className="text-zinc-400">/</span> Mobil Randevular uygulaması
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mobil Randevular uygulaması</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Expo ile sarılmış WebView; kaynak kod <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            apps/randevu-panel
          </code>{" "}
          klasöründedir. Canlı köken bu istekten çıkarılır — paneli hangi domain üzerinden açtıysanız (veya{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">NEXT_PUBLIC_SITE_URL</code>) o adres kullanılır.
        </p>
      </div>

      <MobilRandevuAppGuide canonicalOrigin={canonicalOrigin} adminPath={ADMIN_PANEL_PATH} />
    </div>
  );
}
