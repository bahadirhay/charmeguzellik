"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { instagramPermalinkToEmbedUrl } from "@/lib/instagram-url";
import {
  cardImageSrc,
  hasCardAssets,
  type InstagramFeedPostDTO,
} from "@/lib/instagram-feed-card";
import { clampSocialEmbedHeightPx, socialFeedColClass } from "@/lib/social-feed-layout";

type Props = {
  posts: InstagramFeedPostDTO[];
  title?: string;
  columns?: number;
  embedHeightPx?: number;
  displayMode?: "mediaCard" | "iframe";
  feedLayout?: "grid" | "carousel";
  carouselAutoplayMs?: number;
};

function IgCard({
  p,
  mode,
  iframeH,
}: {
  p: InstagramFeedPostDTO;
  mode: "mediaCard" | "iframe";
  iframeH: number;
}) {
  const useCard = mode === "mediaCard" && hasCardAssets(p);
  const imgSrc = cardImageSrc(p);

  if (useCard && imgSrc) {
    return (
      <article
        data-ig-card
        className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
      >
        <Link
          href={p.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block aspect-square w-full bg-zinc-100 dark:bg-zinc-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
          {p.mediaType === "VIDEO" ? (
            <span
              className="pointer-events-none absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-md"
              aria-hidden
            >
              ▶
            </span>
          ) : null}
        </Link>
        <div className="border-t border-black/5 px-4 py-3">
          <Link
            href={p.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#0095f6] hover:underline dark:text-[#4db5ff]"
          >
            Instagram&apos;da daha fazlasını gör
          </Link>
        </div>
      </article>
    );
  }

  return (
    <div data-ig-card className="min-w-0 rounded-2xl border border-black/10 bg-white shadow-sm">
      <iframe
        title={p.caption?.slice(0, 80) ?? "Instagram"}
        src={instagramPermalinkToEmbedUrl(p.permalink)}
        className="w-full max-w-full border-0"
        style={{ height: `${iframeH}px` }}
        loading="lazy"
      />
    </div>
  );
}

export function InstagramFeedClient({
  posts,
  title,
  columns = 3,
  embedHeightPx,
  displayMode,
  feedLayout = "grid",
  carouselAutoplayMs = 0,
}: Props) {
  const cols = columns >= 2 && columns <= 4 ? columns : 3;
  const grid = socialFeedColClass[cols] ?? socialFeedColClass[3]!;
  const iframeH = clampSocialEmbedHeightPx(embedHeightPx);
  const mode = displayMode ?? "mediaCard";
  const isCarousel = feedLayout === "carousel";
  const scrollRef = useRef<HTMLDivElement>(null);

  const gapPx = 24;
  const cardBasis = `calc((100% - ${(cols - 1) * gapPx}px) / ${cols})`;
  /** Mobilde okunaklı genişlik; masaüstünde sütun sayısına göre daralır */
  const flexBasis = `max(17rem, min(100%, ${cardBasis}))`;

  useEffect(() => {
    if (!isCarousel || carouselAutoplayMs <= 0 || posts.length <= 1) return;
    const root = scrollRef.current;
    if (!root) return;
    const tick = () => {
      const first = root.querySelector("[data-ig-card]") as HTMLElement | null;
      const step = (first?.offsetWidth ?? Math.floor(root.clientWidth / cols)) + gapPx;
      const max = root.scrollWidth - root.clientWidth;
      if (max <= 4) return;
      if (root.scrollLeft >= max - 4) root.scrollTo({ left: 0, behavior: "smooth" });
      else root.scrollBy({ left: step, behavior: "smooth" });
    };
    const id = window.setInterval(tick, carouselAutoplayMs);
    return () => window.clearInterval(id);
  }, [isCarousel, carouselAutoplayMs, posts.length, cols]);

  return (
    <section className="space-y-6">
      {title ? <h2 className="text-2xl font-semibold text-[var(--site-fg)]">{title}</h2> : null}

      {isCarousel ? (
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {posts.map((p) => (
            <div
              key={p.id}
              className="min-w-0 shrink-0 snap-start"
              style={{ flex: `0 0 ${flexBasis}` }}
            >
              <IgCard p={p} mode={mode} iframeH={iframeH} />
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${grid}`}>
          {posts.map((p) => (
            <IgCard key={p.id} p={p} mode={mode} iframeH={iframeH} />
          ))}
        </div>
      )}
    </section>
  );
}
