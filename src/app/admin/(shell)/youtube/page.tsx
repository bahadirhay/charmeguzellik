import { YoutubeAdminClient } from "@/components/admin/YoutubeAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export default async function AdminYoutubePage() {
  await requirePagePermission("social.youtube");
  const videos = await prisma.siteYoutubeVideo.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">YouTube vitrinı</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Videoları burada yönetin; sitede göstermek için ilgili sayfaya <strong>YouTube vitrinı</strong>{" "}
          bloğu ekleyin.
        </p>
      </div>
      <YoutubeAdminClient initialVideos={videos} />
    </div>
  );
}
