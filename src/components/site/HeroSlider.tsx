"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export type HeroSliderSlide = {
  id: string;
  imageUrl: string;
  headline?: string;
  subline?: string;
  href?: string;
  ctaLabel?: string;
  contentAlignX?: "left" | "center" | "right";
  contentAlignY?: "top" | "center" | "bottom";
};

type Props = {
  slides: HeroSliderSlide[];
  autoplayMs?: number;
  aspectRatio?: "wide" | "tall" | "square";
  showDots?: boolean;
  overlayDark?: boolean;
};

const aspectClass: Record<NonNullable<Props["aspectRatio"]>, string> = {
  wide: "aspect-[21/9] min-h-[220px] sm:min-h-[280px] md:min-h-[360px]",
  tall: "aspect-[4/5] min-h-[320px] sm:min-h-[400px]",
  square: "aspect-square min-h-[280px]",
};

function slideOverlayOuterClass(
  slide: HeroSliderSlide,
  opts: { showDots: boolean; slideCount: number },
): string {
  const y = slide.contentAlignY ?? "center";
  const justify =
    y === "top" ? "justify-start" : y === "bottom" ? "justify-end" : "justify-center";
  const topPad = y === "top" ? "pt-8 sm:pt-12" : "";
  const bottomPad =
    y === "bottom" && opts.showDots && opts.slideCount > 1
      ? "pb-20 sm:pb-28"
      : y === "bottom"
        ? "pb-12 sm:pb-16"
        : "";
  /** items-stretch: başlık / alt metin / buton aynı içerik genişliğinde hizalanır (items-end kaymasını önler) */
  return `absolute inset-0 z-[1] flex flex-col items-stretch ${justify} px-5 py-6 sm:px-8 sm:py-8 ${topPad} ${bottomPad}`;
}

function slideContentBandClass(x: "left" | "center" | "right"): string {
  const base = "w-full max-w-3xl space-y-3";
  if (x === "left") return `${base} mr-auto text-left`;
  if (x === "right") return `${base} ml-auto text-right`;
  return `${base} mx-auto text-center`;
}

function slideCtaRowClass(x: "left" | "center" | "right"): string {
  const row = "flex w-full pt-1";
  if (x === "left") return `${row} justify-start`;
  if (x === "right") return `${row} justify-end`;
  return `${row} justify-center`;
}

export function HeroSlider({
  slides,
  autoplayMs = 6000,
  aspectRatio = "wide",
  showDots = true,
  overlayDark = true,
}: Props) {
  const [i, setI] = useState(0);

  const safeSlides = useMemo(() => {
    return slides.filter(
      (s): s is HeroSliderSlide =>
        s != null &&
        typeof s === "object" &&
        typeof s.imageUrl === "string",
    );
  }, [slides]);

  const n = safeSlides.length;

  const go = useCallback(
    (d: number) => {
      setI((x) => {
        if (n <= 0) return 0;
        const base = Math.min(Math.max(0, x), n - 1);
        return (base + d + n) % n;
      });
    },
    [n],
  );

  useEffect(() => {
    if (n <= 1 || !autoplayMs || autoplayMs <= 0) return;
    const t = setInterval(() => go(1), autoplayMs);
    return () => clearInterval(t);
  }, [n, autoplayMs, go]);

  useEffect(() => {
    if (n <= 0) {
      setI(0);
      return;
    }
    setI((prev) => Math.min(prev, n - 1));
  }, [n]);

  if (!n) return null;

  const activeIndex = Math.min(Math.max(0, i), n - 1);
  const current = safeSlides[activeIndex];
  if (!current) return null;

  const alignX = current.contentAlignX ?? "center";
  const compactDots = n > 12;

  return (
    <section
      className="site-hero-slider site-breakout-x overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Slayt"
    >
      <div className={`relative ${aspectClass[aspectRatio]} w-full`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current.imageUrl ? (
          <img
            src={current.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          />
        ) : (
          <div
            className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800"
            aria-hidden
          />
        )}
        {overlayDark ? (
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
        ) : null}
        <div className={slideOverlayOuterClass(current, { showDots: showDots ?? true, slideCount: n })}>
          <div className={slideContentBandClass(alignX)}>
            {current.headline ? (
              <h2 className="text-2xl font-semibold tracking-tight text-white drop-shadow-md sm:text-3xl md:text-4xl">
                {current.headline}
              </h2>
            ) : null}
            {current.subline ? (
              <p className="w-full text-base text-white/90 drop-shadow sm:text-lg">{current.subline}</p>
            ) : null}
            {current.href && current.ctaLabel ? (
              <div className={slideCtaRowClass(alignX)}>
                <Link
                  href={current.href}
                  className="inline-flex rounded-full bg-white/95 px-6 py-2.5 text-sm font-semibold text-rose-900 shadow-lg transition hover:bg-white"
                >
                  {current.ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        {n > 1 ? (
          <>
            <button
              type="button"
              aria-label="Önceki slayt"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/50 sm:left-4"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Sonraki slayt"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/50 sm:right-4"
              onClick={() => go(1)}
            >
              ›
            </button>
            {showDots ? (
              <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center px-10 sm:px-14">
                <div
                  className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:thin]"
                  role="tablist"
                  aria-label="Slayt seçici"
                >
                  {safeSlides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-label={`Slayt ${idx + 1}`}
                      aria-current={idx === activeIndex}
                      className={`shrink-0 rounded-full transition ${
                        compactDots ? "h-1.5 w-1.5" : "h-2.5 w-2.5"
                      } ${idx === activeIndex ? "scale-125 bg-white shadow" : "bg-white/45 hover:bg-white/70"}`}
                      onClick={() => setI(idx)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
