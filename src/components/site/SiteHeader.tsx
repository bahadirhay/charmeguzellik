"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NavNode } from "@/lib/navigation";
import { cleanDisplayString } from "@/lib/site-format";
import type { SiteHeaderBrand } from "@/lib/theme-tokens";
import type { ThemeId } from "@/themes/registry";
import { THEMES } from "@/themes/registry";

export type SiteTopBarData = {
  promo?: string | null;
  address?: string | null;
  phone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
};

type Props = {
  siteName: string;
  nav: NavNode[];
  themeId: ThemeId;
  topBarData: SiteTopBarData | null;
  headerBrand?: SiteHeaderBrand | null;
};

function desktopShowsLogo(brand: SiteHeaderBrand | null | undefined) {
  const b = brand ?? {};
  return b.desktopDisplay === "logo" && Boolean(b.desktopLogoUrl?.trim());
}

function mobileExpandedIsLogo(brand: SiteHeaderBrand | null | undefined) {
  const b = brand ?? {};
  const mode = b.mobileDisplay ?? "same";
  if (mode === "text") return false;
  if (mode === "logo") {
    return Boolean((b.mobileLogoUrl?.trim() || b.desktopLogoUrl?.trim()) ?? "");
  }
  return desktopShowsLogo(b);
}

function mobileExpandedLogoUrl(brand: SiteHeaderBrand | null | undefined) {
  const b = brand ?? {};
  const mode = b.mobileDisplay ?? "same";
  if (mode === "logo") {
    return (b.mobileLogoUrl?.trim() || b.desktopLogoUrl?.trim()) ?? "";
  }
  if (mode === "same" && desktopShowsLogo(b)) return b.desktopLogoUrl!.trim();
  return "";
}

const DEFAULT_DESKTOP_LOGO_H = 48;
const DEFAULT_MOBILE_LOGO_H = 44;

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function desktopLogoMaxHeightPx(brand: SiteHeaderBrand | null | undefined) {
  return clampInt(brand?.desktopLogoMaxHeightPx, 24, 120, DEFAULT_DESKTOP_LOGO_H);
}

function mobileLogoMaxHeightPx(brand: SiteHeaderBrand | null | undefined) {
  const b = brand ?? {};
  const fromMobile = b.mobileLogoMaxHeightPx;
  if (fromMobile != null && typeof fromMobile === "number" && !Number.isNaN(fromMobile)) {
    return clampInt(fromMobile, 24, 100, DEFAULT_MOBILE_LOGO_H);
  }
  const d = desktopLogoMaxHeightPx(b);
  return Math.min(100, d);
}

function linkProps(openInNewTab: boolean) {
  return openInNewTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
    : {};
}

function navLinkClass() {
  return "text-[var(--site-fg)] hover:bg-[var(--site-nav-hover)]";
}

function SiteTopBar({ data }: { data: SiteTopBarData }) {
  const promo = cleanDisplayString(data.promo);
  const address = cleanDisplayString(data.address);
  const phone = cleanDisplayString(data.phone);
  const instagram = cleanDisplayString(data.instagram);
  const facebook = cleanDisplayString(data.facebook);
  if (!promo && !address && !phone && !instagram && !facebook) return null;
  const tel = phone?.replace(/\s/g, "") ?? "";
  return (
    <div className="border-b border-white/20 bg-[var(--site-topbar-bg)] text-[var(--site-topbar-fg)]">
      <div className="mx-auto flex max-w-[var(--site-content-max,72rem)] flex-col gap-1.5 px-4 py-2 text-[11px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:text-xs">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          {promo ? <span className="shrink-0 font-semibold tracking-wide">{promo}</span> : null}
          {address ? <span className="min-w-0 opacity-95">{address}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {instagram ? (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline"
            >
              Instagram
            </a>
          ) : null}
          {facebook ? (
            <a
              href={facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline"
            >
              Facebook
            </a>
          ) : null}
          {phone ? (
            <a href={tel ? `tel:${tel}` : "#"} className="font-semibold tabular-nums">
              {phone}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DesktopNavItemNested({ node, compact }: { node: NavNode; compact?: boolean }) {
  const has = node.children.length > 0;
  const pad = compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";
  if (!has) {
    return (
      <li>
        <Link
          href={node.href}
          {...linkProps(node.openInNewTab)}
          className={`block ${pad} ${navLinkClass()} rounded-md`}
        >
          {node.label}
        </Link>
      </li>
    );
  }
  return (
    <li className="group/sub relative">
      <div className={`flex items-center justify-between gap-2 ${pad} ${navLinkClass()} rounded-md`}>
        <Link href={node.href} {...linkProps(node.openInNewTab)} className="min-w-0 flex-1 truncate">
          {node.label}
        </Link>
        <span className="shrink-0 text-[10px] text-[var(--site-muted)]" aria-hidden>
          ▸
        </span>
      </div>
      <ul className="invisible absolute left-full top-0 z-[120] min-w-[12rem] rounded-lg border border-black/10 bg-[var(--site-header-bg)] py-1 opacity-0 shadow-xl backdrop-blur-md transition group-hover/sub:visible group-hover/sub:opacity-100">
        {node.children.map((c) => (
          <DesktopNavItemNested key={c.id} node={c} compact={compact} />
        ))}
      </ul>
    </li>
  );
}

function DesktopNavItemTop({ node, compact }: { node: NavNode; compact?: boolean }) {
  const has = node.children.length > 0;
  const pad = compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";
  if (!has) {
    return (
      <li>
        <Link
          href={node.href}
          {...linkProps(node.openInNewTab)}
          className={`block rounded-lg ${pad} font-medium text-[var(--site-fg)] ${navLinkClass()}`}
        >
          {node.label}
        </Link>
      </li>
    );
  }
  return (
    <li className="group/menu relative">
      <div className={`flex items-center rounded-lg ${navLinkClass()}`}>
        <Link
          href={node.href}
          {...linkProps(node.openInNewTab)}
          className={`${pad} font-medium text-[var(--site-fg)]`}
        >
          {node.label}
        </Link>
        <span className="pr-2 text-[10px] text-[var(--site-muted)]" aria-hidden>
          ▾
        </span>
      </div>
      <ul className="pointer-events-none invisible absolute left-0 top-full z-[110] min-w-[14rem] rounded-xl border border-black/10 bg-[var(--site-header-bg)] py-1 pt-1 opacity-0 shadow-xl backdrop-blur-md transition group-hover/menu:pointer-events-auto group-hover/menu:visible group-hover/menu:opacity-100">
        {node.children.map((c) => (
          <DesktopNavItemNested key={c.id} node={c} compact={compact} />
        ))}
      </ul>
    </li>
  );
}

function MobileBranch({ nodes, onNavigate }: { nodes: NavNode[]; onNavigate: () => void }) {
  return (
    <ul className="space-y-0.5 border-l border-black/10 pl-3">
      {nodes.map((n) => (
        <li key={n.id}>
          {n.children.length > 0 ? (
            <details className="group border-b border-black/5 py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium text-[var(--site-fg)] [&::-webkit-details-marker]:hidden">
                <span>{n.label}</span>
                <span className="text-xs text-[var(--site-muted)] group-open:rotate-180">▼</span>
              </summary>
              <div className="pb-2 pt-1">
                <Link
                  href={n.href}
                  {...linkProps(n.openInNewTab)}
                  onClick={onNavigate}
                  className="mb-2 block text-xs font-medium text-[var(--site-brand)] hover:underline"
                >
                  {n.label} — sayfaya git
                </Link>
                <MobileBranch nodes={n.children} onNavigate={onNavigate} />
              </div>
            </details>
          ) : (
            <Link
              href={n.href}
              {...linkProps(n.openInNewTab)}
              onClick={onNavigate}
              className="block py-2 text-sm text-[var(--site-fg)] hover:text-[var(--site-brand)]"
            >
              {n.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader({ siteName, nav, themeId, topBarData, headerBrand }: Props) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const showTop = THEMES[themeId].topBar && topBarData;
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY ?? document.documentElement.scrollTop ?? 0;
      setCompact(y > 36);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const desktopNavAlign = headerBrand?.desktopNavAlign ?? "end";
  const desktopNavJustify =
    desktopNavAlign === "start"
      ? "justify-start"
      : desktopNavAlign === "center"
        ? "justify-center"
        : "justify-end";

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty(
        "--site-header-h",
        `${Math.ceil(el.getBoundingClientRect().height)}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--site-header-h");
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="site-header-themed fixed top-0 left-0 right-0 z-[100] w-full border-b border-black/10 shadow-sm backdrop-blur-md transition-[box-shadow] duration-200"
      style={{ background: "var(--site-header-bg)" }}
    >
      {showTop ? <SiteTopBar data={topBarData} /> : null}
      <div
        className={`mx-auto flex min-w-0 max-w-[var(--site-content-max,72rem)] items-center justify-between gap-4 px-4 transition-[padding] duration-200 ${
          compact ? "py-2" : "py-3"
        }`}
      >
        <Link
          href="/"
          className={`flex shrink-0 items-center tracking-tight text-[var(--site-brand)] transition-[font-size] duration-200 ${
            compact ? "min-h-0 text-base font-semibold" : "min-h-[2.25rem] font-semibold md:min-h-[2.5rem]"
          }`}
          aria-label={siteName}
          onClick={() => setOpen(false)}
        >
          {compact ? (
            <span>{siteName}</span>
          ) : (
            <>
              <span className="hidden items-center md:flex">
                {desktopShowsLogo(headerBrand) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(headerBrand?.desktopLogoUrl ?? "").trim()}
                    alt=""
                    className="h-auto w-auto max-w-[min(100%,18rem)] object-contain object-left"
                    style={{ maxHeight: desktopLogoMaxHeightPx(headerBrand) }}
                  />
                ) : (
                  <span className="text-lg leading-tight">{siteName}</span>
                )}
              </span>
              <span className="flex items-center md:hidden">
                {mobileExpandedIsLogo(headerBrand) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mobileExpandedLogoUrl(headerBrand)}
                    alt=""
                    className="h-auto w-auto max-w-[min(100%,16rem)] object-contain object-left"
                    style={{ maxHeight: mobileLogoMaxHeightPx(headerBrand) }}
                  />
                ) : (
                  <span className="text-lg leading-tight">{siteName}</span>
                )}
              </span>
            </>
          )}
        </Link>

        <nav className="hidden min-w-0 flex-1 md:block" aria-label="Ana menü">
          <ul className={`flex flex-wrap items-center gap-0.5 ${desktopNavJustify}`}>
            {nav.map((n) => (
              <DesktopNavItemTop key={n.id} node={n} compact={compact} />
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-black/10 p-2 text-[var(--site-fg)] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menü</span>
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="max-h-[min(70vh,520px)] overflow-y-auto border-t border-black/5 px-4 py-4 md:hidden"
          style={{ background: "var(--site-header-bg)" }}
        >
          <nav aria-label="Mobil menü">
            <ul className="space-y-1">
              {nav.map((n) =>
                n.children.length > 0 ? (
                  <li key={n.id} className="border-b border-black/5 pb-2">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold text-[var(--site-fg)] [&::-webkit-details-marker]:hidden">
                        {n.label}
                        <span className="text-xs text-[var(--site-muted)] group-open:rotate-180">▼</span>
                      </summary>
                      <div className="pt-1">
                        <Link
                          href={n.href}
                          {...linkProps(n.openInNewTab)}
                          onClick={() => setOpen(false)}
                          className="mb-2 block text-xs font-medium text-[var(--site-brand)]"
                        >
                          {n.label} — sayfaya git
                        </Link>
                        <MobileBranch nodes={n.children} onNavigate={() => setOpen(false)} />
                      </div>
                    </details>
                  </li>
                ) : (
                  <li key={n.id} className="border-b border-black/5">
                    <Link
                      href={n.href}
                      {...linkProps(n.openInNewTab)}
                      onClick={() => setOpen(false)}
                      className="block py-3 text-sm font-medium text-[var(--site-fg)]"
                    >
                      {n.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
