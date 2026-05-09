import { NavEditor } from "@/components/admin/NavEditor";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export default async function AdminNavigationPage() {
  await requirePagePermission("content.nav");
  const tenantId = await getTenantIdForRequest();
  const items = await prisma.navItem.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Menü & kategoriler</h1>
        <p className="text-sm text-zinc-500">
          <strong>Üst menü</strong> sabit site başlığındaki linklerdir. <strong>Alt bilgi menüsü</strong> ayrı bir
          listedir; alt bilgide veya sayfa içinde göstermek için <strong>Site düzeni</strong> veya sayfa düzenleyicide{" "}
          <em>Site menüsü (Admin)</em> widget’ını ekleyip <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            footer
          </code>{" "}
          seçin. Öğe eklemek: sekmeden menüyü seçin, pembe kutudaki buton ve satırdaki «+ Alt kategori». Bağlantı:{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/hizmetler</code> veya tam URL.
        </p>
      </div>
      <NavEditor initialItems={items} />
    </div>
  );
}
