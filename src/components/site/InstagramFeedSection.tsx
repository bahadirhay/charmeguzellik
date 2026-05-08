import { prisma } from "@/lib/prisma";
import type { InstagramFeedPostDTO } from "@/lib/instagram-feed-card";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";
import { InstagramFeedClient } from "@/components/site/InstagramFeedClient";

export async function InstagramFeedSection({
  title,
  columns = 3,
  embedHeightPx,
  displayMode,
  feedLayout,
  carouselAutoplayMs,
}: {
  title?: string;
  columns?: number;
  embedHeightPx?: number;
  displayMode?: "mediaCard" | "iframe";
  feedLayout?: "grid" | "carousel";
  carouselAutoplayMs?: number;
}) {
  const rows = await prisma.siteInstagramPost.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID, published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      permalink: true,
      caption: true,
      mediaType: true,
      mediaUrl: true,
      thumbnailUrl: true,
    },
  });
  if (!rows.length) return null;

  const posts: InstagramFeedPostDTO[] = rows.map((r) => ({
    id: r.id,
    permalink: r.permalink,
    caption: r.caption,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl,
  }));

  return (
    <InstagramFeedClient
      posts={posts}
      title={title}
      columns={columns}
      embedHeightPx={embedHeightPx}
      displayMode={displayMode}
      feedLayout={feedLayout}
      carouselAutoplayMs={carouselAutoplayMs}
    />
  );
}
