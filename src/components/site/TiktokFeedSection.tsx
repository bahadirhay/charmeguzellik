import Link from "next/link";
import { clampSocialEmbedHeightPx, socialFeedColClass } from "@/lib/social-feed-layout";
import { prisma } from "@/lib/prisma";
import { extractTiktokVideoIdFromPermalink, tiktokEmbedUrl } from "@/lib/tiktok-url";

export async function TiktokFeedSection({
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
  const items = await prisma.siteTiktokVideo.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  if (!items.length) return null;

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
        {items.map((p) => {
          const canonical = p.permalink.replace(/\/+$/, "");
          const vid = p.videoId?.trim() || extractTiktokVideoIdFromPermalink(canonical);
          const thumb = p.thumbnailUrl?.trim();
          const useCard = mode === "mediaCard" && Boolean(thumb);

          if (useCard && thumb) {
            return (
              <article
                key={p.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
              >
                <Link
                  href={canonical}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-[9/16] max-h-[min(85vh,640px)] w-full max-w-sm mx-auto bg-zinc-100 dark:bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span
                    className="pointer-events-none absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-md"
                    aria-hidden
                  >
                    ▶
                  </span>
                </Link>
                <div className="border-t border-black/5 px-4 py-3">
                  <Link
                    href={canonical}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#fe2c55] hover:underline"
                  >
                    TikTok&apos;ta aç
                  </Link>
                  {p.title ? (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{p.title}</p>
                  ) : null}
                </div>
              </article>
            );
          }

          if (!vid) {
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              >
                TikTok video kimliği çözülemedi:{" "}
                <a href={canonical} className="underline" target="_blank" rel="noopener noreferrer">
                  Bağlantıyı aç
                </a>
              </div>
            );
          }

          return (
            <div
              key={p.id}
              className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
            >
              <iframe
                title={p.title?.slice(0, 80) ?? "TikTok"}
                src={tiktokEmbedUrl(vid)}
                className="w-full max-w-full border-0"
                style={{ height: `${iframeH}px` }}
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
