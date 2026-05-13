import Link from "next/link";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { getSiteSettingsForTenant, sanitizeSiteSettingsForAdminClient } from "@/lib/site-settings";

export default async function SettingsPage() {
  await requirePagePermission("site.settings");
  const tenantId = await getTenantIdForRequest();
  const row = await getSiteSettingsForTenant(tenantId);
  const initial = sanitizeSiteSettingsForAdminClient(row);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ayarlar & SEO</h1>
        <p className="text-sm text-zinc-500">
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">NEXT_PUBLIC_SITE_URL</code> üretimde tanımlı
          olmalı (yedek / cron / Host olmayan bağlamlar). Sitemap ve robots kök URL’si çok kiracılı kurulumda öncelikle
          bu sitenin veritabanındaki alan adı (TenantDomain) ve istek host’u ile üretilir. Randevu iptal bağlantıları
          için de canlı kök tercih edilir. Hangi sayfaların{" "}
          <a className="text-rose-600 underline" href="/admin/sitemap">
            sitemap.xml
          </a>{" "}
          içinde listeleneceğini Site haritası ekranından yönetebilirsiniz.{" "}
          <Link className="text-rose-600 underline" href="/admin/settings/mobil-uygulama">
            Mobil Randevular uygulaması
          </Link>{" "}
          (Expo) yapılandırmasını buradan üretebilirsiniz.
        </p>
      </div>
      <SettingsForm initial={initial} />
    </div>
  );
}
