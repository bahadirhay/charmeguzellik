import type { CSSProperties } from "react";

export type PromoItem = {
  id: string;
  faintWord: string;
  titleDark: string;
  titleAccent?: string;
  imageUrl?: string;
  gradientFrom?: string;
  gradientTo?: string;
  badgeText?: string;
  /** Açık arka planda koyu yazı; koyu planda açık yazı */
  lightOnDark?: boolean;
};

type Props = { items: PromoItem[] };

export function ServicePromoGrid({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="site-service-promo-grid grid gap-4 md:grid-cols-3">
      {items.map((item) => {
        const from = item.gradientFrom ?? "#e8ddd8";
        const to = item.gradientTo ?? "#d4c4bc";
        const style: CSSProperties = item.imageUrl
          ? {}
          : { background: `linear-gradient(145deg, ${from}, ${to})` };
        const textLight = item.lightOnDark ?? Boolean(item.imageUrl);

        return (
          <div
            key={item.id}
            className="site-service-promo-tile relative min-h-[260px] overflow-hidden rounded-2xl shadow-md sm:min-h-[300px]"
            style={style}
          >
            {item.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/10" />
              </>
            ) : null}

            <span
              className={`pointer-events-none absolute left-3 top-2 select-none text-5xl font-bold leading-none opacity-[0.12] sm:text-6xl ${
                textLight ? "text-white" : "text-zinc-900"
              }`}
            >
              {item.faintWord}
            </span>

            <div
              className={`absolute inset-x-0 bottom-0 p-4 pt-16 ${
                textLight ? "text-white" : "text-zinc-900"
              }`}
            >
              <h3 className="text-lg font-bold leading-snug sm:text-xl">
                <span className={textLight ? "text-white" : "text-zinc-900"}>{item.titleDark}</span>
                {item.titleAccent ? (
                  <span className="text-[var(--site-brand,#b84d5c)]"> {item.titleAccent}</span>
                ) : null}
              </h3>
            </div>

            {item.badgeText ? (
              <div className="absolute bottom-3 right-3 rounded-full bg-emerald-600/95 px-2.5 py-1 text-[10px] font-semibold text-white shadow">
                {item.badgeText}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
