"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTestimonialAdminOnlyFootnote } from "@/lib/testimonial-admin-footnotes";

export type TestimonialItem = {
  id: string;
  name: string;
  relativeTimeLabel?: string;
  rating?: number;
  text: string;
  sourceLabel?: string;
  avatarUrl?: string;
  initials?: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  reviews: TestimonialItem[];
  autoplayMs?: number;
  footnote?: string;
  /** true: admin-only alt notlar canlı önizlemede gösterilir (site ziyaretçisinde değil). */
  renderAdminFootnote?: boolean;
};

function Stars({ n }: { n: number }) {
  const c = Math.max(1, Math.min(5, Math.round(n)));
  return (
    <div className="flex gap-0.5 text-amber-400" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < c ? "★" : "☆"}</span>
      ))}
    </div>
  );
}

function useMdUp() {
  const [mdUp, setMdUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setMdUp(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mdUp;
}

export function TestimonialCarousel({
  title,
  subtitle,
  reviews,
  autoplayMs = 0,
  footnote,
  renderAdminFootnote = false,
}: Props) {
  const [i, setI] = useState(0);
  const mdUp = useMdUp();
  const touchStartX = useRef<number | null>(null);
  const n = reviews.length;
  const visible = mdUp ? Math.min(3, n) : 1;

  const go = useCallback(
    (d: number) => {
      setI((x) => (x + d + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (n <= 1 || !autoplayMs || autoplayMs <= 0) return;
    const t = setInterval(() => go(1), autoplayMs);
    return () => clearInterval(t);
  }, [n, autoplayMs, go]);

  if (!reviews.length) return null;

  const indices = Array.from({ length: Math.min(visible, n) }, (_, k) => (i + k) % n);
  const mdGridClass =
    visible <= 1 ? "" : visible === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <section className="site-testimonial-carousel min-w-0 space-y-4" aria-label={title ?? "Müşteri yorumları"}>
      {title ? (
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className="relative touch-pan-y"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null || n <= 1) return;
          const end = e.changedTouches[0]?.clientX;
          if (end == null) return;
          const dx = end - start;
          if (dx > 56) go(-1);
          else if (dx < -56) go(1);
        }}
      >
        <button
          type="button"
          aria-label="Önceki yorumlar"
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-200 bg-white/95 p-2 text-lg leading-none text-zinc-700 shadow-sm hover:bg-white md:left-0 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-200"
          onClick={() => go(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Sonraki yorumlar"
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-200 bg-white/95 p-2 text-lg leading-none text-zinc-700 shadow-sm hover:bg-white md:right-0 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-200"
          onClick={() => go(1)}
        >
          ›
        </button>

        <div
          className={`mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 gap-4 px-3 sm:px-8 md:px-8 ${mdGridClass}`}
        >
          {indices.map((idx) => {
            const r = reviews[idx]!;
            const initials =
              r.initials ??
              r.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]!.toUpperCase())
                .join("");
            return (
              <article
                key={`${r.id}-${idx}`}
                className="site-testimonial-card flex flex-col rounded-2xl border border-zinc-100 bg-white p-4 shadow-md dark:border-zinc-700 dark:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.avatarUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ background: "var(--site-brand, #b84d5c)" }}
                      >
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{r.name}</p>
                      {r.relativeTimeLabel ? (
                        <p className="text-xs text-zinc-500">{r.relativeTimeLabel}</p>
                      ) : null}
                    </div>
                  </div>
                  {r.sourceLabel ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                      {r.sourceLabel}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Stars n={r.rating ?? 5} />
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {r.text}
                </p>
              </article>
            );
          })}
        </div>

        {n > 1 ? (
          <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Yorumlar">
            {reviews.map((_, di) => (
              <button
                key={reviews[di]!.id}
                type="button"
                role="tab"
                aria-selected={di === i}
                aria-label={`Yorum ${di + 1}`}
                className={`h-2 rounded-full transition-[width,background-color] ${
                  di === i ? "w-6 bg-[var(--site-brand,#b84d5c)]" : "w-2 bg-zinc-300 dark:bg-zinc-600"
                }`}
                onClick={() => setI(di)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {footnote && !isTestimonialAdminOnlyFootnote(footnote) ? (
        <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">{footnote}</p>
      ) : null}
      {renderAdminFootnote && footnote && isTestimonialAdminOnlyFootnote(footnote) ? (
        <p className="mx-auto max-w-2xl rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-center text-[11px] text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Yalnızca panel:</span> {footnote}
        </p>
      ) : null}
    </section>
  );
}
