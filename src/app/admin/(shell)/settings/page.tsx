import Link from "next/link";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { getSiteSettingsForTenant, sanitizeSiteSettingsForAdminClient } from "@/lib/site-settings";

export default async function SettingsPage() {
  await requirePagePermission("site.settings");
  const tenantId = await getTenantIdForRequest();
  const [row, tenantRow] = await Promise.all([
    getSiteSettingsForTenant(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } }),
  ]);
  const initial = sanitizeSiteSettingsForAdminClient(row);
  const appointmentsEnabledInitial = isAppointmentsModuleEnabled(tenantRow?.featuresJson);
  const commerceEnabledInitial = isCommerceModuleEnabled(tenantRow?.featuresJson);
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
          içinde listeleneceğini Site haritası ekranından yönetebilirsiniz.{" "}
          <Link className="text-rose-600 underline" href="/admin/settings/mobil-uygulama">
            Mobil Randevular uygulaması
          </Link>{" "}
          (Expo) yapılandırmasını buradan üretebilirsiniz.
        </p>
      </div>
      <SettingsForm
        initial={initial}
        appointmentsEnabledInitial={appointmentsEnabledInitial}
        commerceEnabledInitial={commerceEnabledInitial}
      />
    </div>
  );
}
