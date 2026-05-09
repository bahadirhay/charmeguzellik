import { YoutubeAdminClient } from "@/components/admin/YoutubeAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export default async function AdminYoutubePage() {
  await requirePagePermission("social.youtube");
  const tenantId = await getTenantIdForRequest();
  const videos = await prisma.siteYoutubeVideo.findMany({
    where: { tenantId },
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
