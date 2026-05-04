import Link from "next/link";
import { AnalyticsScripts } from "@/components/site/AnalyticsScripts";
import { JsonLdLocalBusiness } from "@/components/site/JsonLd";
import { PublicBlocks } from "@/components/site/PublicBlocks";
import { SiteHeader } from "@/components/site/SiteHeader";
import { parseBlocks } from "@/lib/blocks/schema";
import { getPublishedNavTree } from "@/lib/navigation";
import { cleanDisplayString, formatBusinessAddressLine } from "@/lib/site-format";
import { getSiteSettings, parseBusinessJson } from "@/lib/site-settings";
import { buildThemeOverrideCss, parseThemeTokens } from "@/lib/theme-tokens";
import { normalizeThemeId, THEMES } from "@/themes/registry";

export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const nav = await getPublishedNavTree("header");
  const business = parseBusinessJson(settings.businessJson);
  const themeId = normalizeThemeId(settings.activeThemeId);

  const topBarData =
    THEMES[themeId].topBar && settings.showHeaderTopBar
      ? {
          promo: cleanDisplayString(settings.headerPromoLine),
          address: formatBusinessAddressLine(business),
          phone: cleanDisplayString(business?.telephone),
          instagram: cleanDisplayString(settings.socialInstagramUrl),
          facebook: cleanDisplayString(settings.socialFacebookUrl),
        }
      : null;

  const tokens = parseThemeTokens(settings.themeTokensJson);
  const themeOverrideCss = buildThemeOverrideCss(themeId, settings.themeTokensJson);

  const headerLayoutBlocks = parseBlocks(settings.headerBlocks);
  const footerLayoutBlocks = parseBlocks(settings.footerBlocks);
  const year = new Date().getFullYear();
  const strip = tokens.siteFooterStrip;
  const footerLegalOn = strip?.legalLineEnabled !== false;
  const footerAdminOn = strip?.adminLinkEnabled !== false;
  const footerLegalText =
    footerLegalOn &&
    (strip?.legalLine?.trim() ? strip.legalLine.trim() : `© ${year} ${settings.siteName}`);
  const footerAdminLabel = strip?.adminLinkLabel?.trim() || "Yönetim paneli";
  const showFooterUtilityStrip = footerLegalOn || footerAdminOn;
  const hasFooterRegion = footerLayoutBlocks.length > 0 || showFooterUtilityStrip;

  const jsonLdPayload = business
    ? {
        name: business.name,
        description: business.description,
        telephone: business.telephone,
        address: business.address as typeof business.address,
        geo: business.geo,
        url: business.url,
        image: business.image,
        priceRange: business.priceRange,
      }
    : { name: settings.siteName };

  return (
    <>
      {tokens.googleFontsHref ? (
        <link rel="stylesheet" href={tokens.googleFontsHref} crossOrigin="anonymous" />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: themeOverrideCss }} />
      <JsonLdLocalBusiness {...jsonLdPayload} />
      <AnalyticsScripts
        googleAnalyticsId={settings.googleAnalyticsId}
        googleTagManagerId={settings.googleTagManagerId}
        facebookPixelId={settings.facebookPixelId}
        customHeadHtml={settings.customHeadHtml}
      />
      <div
        data-site-theme={themeId}
        className="site-main-wrap flex min-h-screen min-w-0 flex-col overflow-x-hidden"
        style={{
          backgroundColor: "var(--site-bg)",
          color: "var(--site-fg)",
          fontFamily: "var(--site-font-body, ui-sans-serif, system-ui, sans-serif)",
        }}
      >
        <SiteHeader
          siteName={settings.siteName}
          nav={nav}
          themeId={themeId}
          topBarData={topBarData}
          headerBrand={tokens.siteHeaderBrand}
        />
        <div
          className="flex min-w-0 flex-1 flex-col overflow-x-hidden"
          style={{ marginTop: "var(--site-header-h, 5rem)" }}
        >
          {headerLayoutBlocks.length > 0 ? (
            <section
              aria-label="Site üst alanı"
              className="border-b border-zinc-200/70 bg-[var(--site-bg)] dark:border-zinc-800/80"
            >
              <div className="mx-auto w-full max-w-[var(--site-content-max,72rem)] px-4 py-6 md:py-8">
                <PublicBlocks variant="tight" blocks={headerLayoutBlocks} formRegion="header" />
              </div>
            </section>
          ) : null}
          <main className="mx-auto w-full min-w-0 max-w-[var(--site-content-max,72rem)] flex-1 overflow-x-hidden px-4 py-10">
            {children}
          </main>
          {hasFooterRegion ? (
            <footer className="site-footer-themed border-t">
              {footerLayoutBlocks.length > 0 ? (
                <div className="mx-auto w-full max-w-[var(--site-content-max,72rem)] px-4 pt-8 md:pt-10">
                  <PublicBlocks variant="tight" blocks={footerLayoutBlocks} formRegion="footer" />
                </div>
              ) : null}
              {showFooterUtilityStrip ? (
                <div
                  className={`border-black/5 py-8 text-center text-sm dark:border-white/10 ${
                    footerLayoutBlocks.length > 0 ? "border-t" : ""
                  }`}
                >
                  {footerLegalText ? (
                    <p>
                      {strip?.legalLinkHref?.trim() ? (
                        <a
                          href={strip.legalLinkHref.trim()}
                          className="underline-offset-2 hover:underline"
                          {...(strip.legalLinkOpenInNewTab
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          {footerLegalText}
                        </a>
                      ) : (
                        footerLegalText
                      )}
                    </p>
                  ) : null}
                  {footerAdminOn ? (
                    <p className={footerLegalText ? "mt-2" : ""}>
                      <Link href="/admin" className="text-xs opacity-80 hover:opacity-100">
                        {footerAdminLabel}
                      </Link>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </footer>
          ) : null}
        </div>
      </div>
    </>
  );
}
