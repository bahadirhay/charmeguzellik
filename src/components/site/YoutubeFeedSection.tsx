import Link from "next/link";
import { clampSocialEmbedHeightPx, socialFeedColClass } from "@/lib/social-feed-layout";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube-url";

export async function YoutubeFeedSection({
  title,
  columns = 3,
  embedHeightPx,
  displayMode,
}: {
  title?: string;
  columns?: number;
  embedHeightPx?: number;
  displayMode?: "mediaCard" | "iframe";
}) {
  const videos = await prisma.siteYoutubeVideo.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID, published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  if (!videos.length) return null;

  const cols = columns >= 2 && columns <= 4 ? columns : 3;
  const grid = socialFeedColClass[cols] ?? socialFeedColClass[3]!;
  const iframeH = clampSocialEmbedHeightPx(embedHeightPx);
  const mode = displayMode ?? "mediaCard";

  return (
    <section className="space-y-6">
      {title ? (
        <h2 className="text-2xl font-semibold text-[var(--site-fg)]">{title}</h2>
      ) : null}
      <div className={`grid grid-cols-1 gap-6 ${grid}`}>
        {videos.map((v) => {
          const watch = v.watchUrl?.trim() || youtubeWatchUrl(v.videoId);
          const thumb = youtubeThumbnailUrl(v.videoId);
          const useCard = mode === "mediaCard";

          if (useCard) {
            return (
              <article
                key={v.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
              >
                <Link
                  href={watch}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-video w-full bg-zinc-100 dark:bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span
                    className="pointer-events-none absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-md"
                    aria-hidden
                  >
                    ▶
                  </span>
                </Link>
                <div className="border-t border-black/5 px-4 py-3">
                  <Link
                    href={watch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    YouTube&apos;da izle
                  </Link>
                  {v.title ? (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{v.title}</p>
                  ) : null}
                </div>
              </article>
            );
          }

          return (
            <div
              key={v.id}
              className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
            >
              <iframe
                title={v.title?.slice(0, 80) ?? "YouTube"}
                src={youtubeEmbedUrl(v.videoId)}
                className="w-full max-w-full border-0"
                style={{ height: `${iframeH}px` }}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
