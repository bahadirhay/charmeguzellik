import { CookieConsentLogs } from "@/components/admin/CookieConsentLogs";
import { requirePagePermission } from "@/lib/auth";

export default async function CookieConsentsPage() {
  await requirePagePermission("site.settings");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Çerez Onay Kayıtları</h1>
        <p className="text-sm text-zinc-500">
          Kabul, red ve ayar bazlı tercihleri IP, zaman ve tarayıcı bilgisiyle listeler.
        </p>
      </div>
      <CookieConsentLogs />
    </div>
  );
}
