import { SettingsForm } from "@/components/admin/SettingsForm";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeSiteSettingsForAdminClient } from "@/lib/site-settings";

export default async function SettingsPage() {
  await requirePagePermission("site.settings");
  let row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.siteSettings.create({ data: { id: 1 } });
  }
  const initial = sanitizeSiteSettingsForAdminClient(row);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ayarlar & SEO</h1>
        <p className="text-sm text-zinc-500">
          Üretimde{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">NEXT_PUBLIC_SITE_URL</code>{" "}
          mutlaka canlı alan adınız olsun — örn. <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">https://charmeguzellik.com</code> (Vercel
          alt alanı değil). Böylece randevu iptal bağlantıları ve sitemap doğru domain ile üretilir. Hangi sayfaların{" "}
          <a className="text-rose-600 underline" href="/admin/sitemap">
            sitemap.xml
          </a>{" "}
          içinde listeleneceğini Site haritası ekranından yönetebilirsiniz.
        </p>
      </div>
      <SettingsForm initial={initial} />
    </div>
  );
}
