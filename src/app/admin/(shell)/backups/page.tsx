import { BackupCenter } from "@/components/admin/BackupCenter";
import { requirePagePermission } from "@/lib/auth";

export default async function BackupsPage() {
  await requirePagePermission("site.settings");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Yedekleme Merkezi</h1>
        <p className="text-sm text-zinc-500">
          Çoklu kurulum / domain taşıma için seçimli yedek ve geri yükleme ekranı.
        </p>
      </div>
      <BackupCenter />
    </div>
  );
}
