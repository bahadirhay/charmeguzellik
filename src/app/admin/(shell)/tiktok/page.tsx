import { TiktokAdminClient } from "@/components/admin/TiktokAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminTiktokPage() {
  await requirePagePermission("social.tiktok");
  const videos = await prisma.siteTiktokVideo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">TikTok vitrinı</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paylaşım bağlantılarını burada yönetin; sitede <strong>TikTok vitrinı</strong> bloğu ile
          listelersiniz.
        </p>
      </div>
      <TiktokAdminClient initialVideos={videos} />
    </div>
  );
}
