"use client";

import type { PageBlock } from "@/lib/blocks/schema";
import { resolveWaDigits, rewriteWhatsappHref } from "@/lib/whatsapp-url";

type Props = Extract<PageBlock, { type: "marketingFooter" }>["props"];

/** Harici http(s) / protokol-bağımlı URL; tel/mailto/sms/# ve göreli yollar hariç */
function newTabAttrsForFooterHref(
  href: string,
  openExternalInNewTab: boolean,
): { target?: "_blank"; rel?: string } {
  if (!openExternalInNewTab) return {};
  const t = href.trim();
  if (!t) return {};
  const low = t.toLowerCase();
  if (low.startsWith("tel:") || low.startsWith("mailto:") || low.startsWith("sms:")) return {};
  if (low.startsWith("#")) return {};
  if (low.startsWith("http://") || low.startsWith("https://") || low.startsWith("//")) {
    return { target: "_blank", rel: "noopener noreferrer" };
  }
  return {};
}

type InfoIcon = NonNullable<Props["infoCards"]>[number]["icon"];

function IconGlyph({ kind }: { kind: InfoIcon }) {
  const stroke = "currentColor";
  const common = { width: 20, height: 20, fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "phone":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
  }
}

export function MarketingFooterBlock({
  props,
  /** Editör önizlemesinde sabit düğmeleri gizle */
  embedPreview,
  /** Ayarlar → WhatsApp (site geneli); boşsa bloktaki yedek numara */
  siteWhatsappNumber,
}: {
  props: Props;
  embedPreview?: boolean;
  siteWhatsappNumber?: string | null;
}) {
  /** Tema `--site-footer-fg` vermezse: açık footer zeminde okunaklı olsun diye `--site-fg` zinciri */
  const fg = "var(--site-footer-fg, var(--site-fg, #171717))";
  const muted = "var(--site-footer-muted, var(--site-muted, #52525b))";
  const link = "var(--site-footer-link, #2563eb)";
  const accent = "var(--site-footer-accent, #2563eb)";
  const border = "var(--site-footer-border, rgba(0,0,0,0.1))";

  const waDigitsCombined = resolveWaDigits(siteWhatsappNumber, props.whatsappPhone);
  const ctas = props.ctas ?? [];
  const info = props.infoCards ?? [];
  const wa = props.showFloatingWhatsapp && waDigitsCombined ? waDigitsCombined : "";
  const openExternalInNewTab = props.externalLinksOpenInNewTab !== false;
  const floatingTabAttrs = openExternalInNewTab
    ? ({ target: "_blank" as const, rel: "noopener noreferrer" })
    : {};

  return (
    <>
      <section
        className="marketing-footer-block space-y-10 md:space-y-12"
        style={{ color: fg }}
      >
        <div className="flex flex-col gap-4 border-b pb-8 md:flex-row md:items-center md:justify-between" style={{ borderColor: border }}>
          <p className="text-lg font-bold tracking-wide md:text-xl" style={{ fontFamily: "var(--site-font-heading)" }}>
            {props.brandLabel}
          </p>
          {ctas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ctas.map((c) => {
                const solid = c.variant === "solid";
                const href =
                  waDigitsCombined ? rewriteWhatsappHref(c.href, waDigitsCombined) : c.href;
                return (
                  <a
                    key={c.id}
                    href={href}
                    {...newTabAttrsForFooterHref(href, openExternalInNewTab)}
                    className={`inline-flex min-h-[2.5rem] items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                      solid
                        ? "bg-white text-zinc-900 hover:bg-zinc-100"
                        : "border bg-transparent hover:bg-white/5"
                    }`}
                    style={
                      solid
                        ? undefined
                        : { borderColor: border, color: fg }
                    }
                  >
                    {c.label}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {props.columns.map((col) => (
            <div key={col.id} className="min-w-0 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: fg }}>
                {col.title}
              </h3>
              {col.body ? (
                <p className="text-sm leading-relaxed" style={{ color: muted }}>
                  {col.body}
                </p>
              ) : null}
              {col.links && col.links.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {col.links.map((l, i) => (
                    <li key={`${col.id}-${i}`}>
                      <a
                        href={
                          waDigitsCombined ? rewriteWhatsappHref(l.href, waDigitsCombined) : l.href
                        }
                        {...newTabAttrsForFooterHref(
                          waDigitsCombined ? rewriteWhatsappHref(l.href, waDigitsCombined) : l.href,
                          openExternalInNewTab,
                        )}
                        className="underline-offset-2 transition hover:underline hover:opacity-90"
                        style={{ color: link }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        {info.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {info.map((card) => (
              <div
                key={card.id}
                className="flex gap-3 rounded-xl border p-4"
                style={{ borderColor: border, backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  <IconGlyph kind={card.icon} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: fg }}>
                    {card.title}
                  </p>
                  <div className="mt-1 space-y-0.5 text-sm" style={{ color: muted }}>
                    {card.lines.map((line, i) => (
                      <p key={i} className="whitespace-pre-wrap leading-snug">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {props.copyrightLine ? (
          <p className="border-t pt-6 text-center text-xs md:text-left" style={{ borderColor: border, color: muted }}>
            {props.copyrightHref?.trim() ? (
              <a
                href={props.copyrightHref.trim()}
                className="underline-offset-2 hover:underline"
                style={{ color: link }}
                {...(props.copyrightOpenInNewTab
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {props.copyrightLine}
              </a>
            ) : (
              props.copyrightLine
            )}
          </p>
        ) : null}
      </section>

      {wa && !embedPreview ? (
        <a
          href={`https://wa.me/${wa}`}
          {...floatingTabAttrs}
          className="fixed bottom-5 left-5 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white/10 transition hover:scale-105 hover:shadow-xl"
          aria-label="WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </a>
      ) : null}

      {props.showBackToTop && !embedPreview ? (
        <button
          type="button"
          className="fixed bottom-5 right-5 z-[90] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-zinc-800 text-white shadow-lg transition hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          aria-label="Yukarı çık"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
