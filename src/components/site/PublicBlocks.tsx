import type { ReactNode } from "react";
import type { PageBlock } from "@/lib/blocks/schema";
import { toVideoIframeSrc } from "@/lib/video-embed";
import { BrandedIntro } from "@/components/site/BrandedIntro";
import { ContactFormBlock } from "@/components/site/blocks/ContactFormBlock";
import { HeroSlider } from "@/components/site/HeroSlider";
import { InstagramFeedSection } from "@/components/site/InstagramFeedSection";
import { TiktokFeedSection } from "@/components/site/TiktokFeedSection";
import { YoutubeFeedSection } from "@/components/site/YoutubeFeedSection";
import { ServicePromoGrid } from "@/components/site/ServicePromoGrid";
import { TestimonialCarousel } from "@/components/site/TestimonialCarousel";
import { ImageGalleryBlock } from "@/components/site/ImageGalleryBlock";
import { MarketingFooterBlock } from "@/components/site/MarketingFooterBlock";
import { PublicSiteMenu } from "@/components/site/PublicSiteMenu";
import { getPublishedNavTree } from "@/lib/navigation";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveWaDigits } from "@/lib/whatsapp-url";
import { normalizePublicMediaUrl } from "@/lib/media-url";

function layoutClass(
  desktop: "left" | "center" | "right" | undefined,
  mobile: "left" | "center" | "right" | undefined,
) {
  const d = desktop ?? "center";
  const m = mobile ?? d;
  const map = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  } as const;
  const mdMap = {
    left: "md:text-left",
    center: "md:text-center",
    right: "md:text-right",
  } as const;
  return `${map[m]} ${mdMap[d]}`;
}

export async function PublicBlocks({
  blocks,
  variant = "default",
  pageSlug = null,
  formRegion = "page",
}: {
  blocks: PageBlock[];
  /** tight: üst/alt site bölgeleri için daha sık dikey aralık */
  variant?: "default" | "tight";
  /** Randevu formu doğrulaması için (örn. home, iletisim) */
  pageSlug?: string | null;
  /** page: normal sayfa; header/footer: site bölgeleri */
  formRegion?: "page" | "header" | "footer";
}) {
  const settings = await getSiteSettings();
  const siteWhatsappNumber = settings.whatsappNumber ?? null;
  const gap = variant === "tight" ? "gap-5 md:gap-6" : "gap-10";
  return (
    <div className={`flex min-w-0 flex-col ${gap}`}>
      {blocks.map((block) => (
        <PublicBlockRow
          key={block.id}
          block={block}
          pageSlug={pageSlug}
          formRegion={formRegion}
          siteWhatsappNumber={siteWhatsappNumber}
        />
      ))}
    </div>
  );
}

async function PublicBlockRow({
  block,
  pageSlug,
  formRegion,
  siteWhatsappNumber,
}: {
  block: PageBlock;
  pageSlug?: string | null;
  formRegion?: "page" | "header" | "footer";
  siteWhatsappNumber: string | null;
}) {
  if (block.type === "navMenu") {
    const nodes = await getPublishedNavTree(block.props.menuSlug);
    return <PublicSiteMenu nodes={nodes} variant={block.props.style ?? "links"} />;
  }
  if (block.type === "instagramFeed") {
    return (
      <InstagramFeedSection
        title={block.props.title}
        columns={block.props.columns}
        embedHeightPx={block.props.embedHeightPx}
        displayMode="mediaCard"
        feedLayout={block.props.feedLayout}
        carouselAutoplayMs={block.props.carouselAutoplayMs}
      />
    );
  }
  if (block.type === "youtubeFeed") {
    return (
      <YoutubeFeedSection
        title={block.props.title}
        columns={block.props.columns}
        embedHeightPx={block.props.embedHeightPx}
        displayMode={block.props.displayMode}
      />
    );
  }
  if (block.type === "tiktokFeed") {
    return (
      <TiktokFeedSection
        title={block.props.title}
        columns={block.props.columns}
        embedHeightPx={block.props.embedHeightPx}
        displayMode="mediaCard"
      />
    );
  }
  if (block.type === "heroSlider") {
    return (
      <HeroSlider
        slides={block.props.slides}
        autoplayMs={block.props.autoplayMs}
        aspectRatio={block.props.aspectRatio}
        showDots={block.props.showDots}
        overlayDark={block.props.overlayDark}
      />
    );
  }
  return (
    <BlockView
      block={block}
      pageSlug={pageSlug}
      formRegion={formRegion}
      siteWhatsappNumber={siteWhatsappNumber}
    />
  );
}

function BlockView({
  block,
  pageSlug,
  formRegion,
  siteWhatsappNumber,
}: {
  block: PageBlock;
  pageSlug?: string | null;
  formRegion?: "page" | "header" | "footer";
  siteWhatsappNumber: string | null;
}) {
  switch (block.type) {
    case "hero": {
      const { headline, subline, imageUrl, ctaLabel, ctaHref, desktopLayout, mobileLayout } =
        block.props;
      const normalizedImageUrl = normalizePublicMediaUrl(imageUrl);
      return (
        <section
          className={`rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 px-6 py-14 dark:from-rose-950/40 dark:to-amber-950/30 ${layoutClass(desktopLayout, mobileLayout)}`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-center md:gap-10">
            <div className="flex-1 space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
                {headline}
              </h1>
              {subline ? (
                <p className="text-lg text-zinc-600 dark:text-zinc-300">{subline}</p>
              ) : null}
              {ctaLabel && ctaHref ? (
                <a
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-full bg-rose-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
                >
                  {ctaLabel}
                </a>
              ) : null}
            </div>
            {normalizedImageUrl ? (
              <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl shadow-lg md:mx-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={normalizedImageUrl} alt="" className="aspect-[4/3] h-auto w-full object-cover" />
              </div>
            ) : null}
          </div>
        </section>
      );
    }
    case "text": {
      const align = block.props.align ?? "left";
      const alignCls =
        align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
      const c = block.props.content;
      const as = block.props.as ?? "p";
      const wrap = (child: ReactNode) => (
        <section
          className={`prose prose-zinc dark:prose-invert mx-auto w-full max-w-3xl ${alignCls}`}
        >
          {child}
        </section>
      );
      if (as === "h1") return wrap(<h1 className="whitespace-pre-wrap">{c}</h1>);
      if (as === "h2") return wrap(<h2 className="whitespace-pre-wrap">{c}</h2>);
      if (as === "h3") return wrap(<h3 className="whitespace-pre-wrap">{c}</h3>);
      return wrap(<p className="whitespace-pre-wrap">{c}</p>);
    }
    case "button": {
      const v = block.props.variant ?? "primary";
      const base =
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition";
      const styles =
        v === "primary"
          ? "bg-rose-600 text-white hover:bg-rose-700"
          : v === "secondary"
            ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            : "border border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900";
      const width = block.props.fullWidthMobile ? "w-full md:w-auto" : "";
      return (
        <div className="flex w-full justify-center">
          <a href={block.props.href} className={`${base} ${styles} ${width}`}>
            {block.props.label}
          </a>
        </div>
      );
    }
    case "videoEmbed": {
      const src = toVideoIframeSrc(block.props.url);
      if (!src) {
        return (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-600">
            Geçerli bir YouTube veya Vimeo bağlantısı girin.
          </p>
        );
      }
      return (
        <section className="mx-auto max-w-4xl space-y-2">
          {block.props.title ? (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{block.props.title}</h2>
          ) : null}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
            <iframe
              title={block.props.title ?? "Video"}
              src={src}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </section>
      );
    }
    case "audioEmbed": {
      const src = block.props.src?.trim();
      if (!src) return null;
      return (
        <section className="mx-auto max-w-2xl space-y-2">
          {block.props.title ? (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{block.props.title}</h2>
          ) : null}
          <audio controls className="w-full" preload="metadata">
            <source src={src} />
            Tarayıcı ses oynatmayı desteklemiyor.
          </audio>
        </section>
      );
    }
    case "image":
      return (
        <figure className="mx-auto max-w-4xl">
          <div className={`overflow-hidden ${block.props.rounded ? "rounded-2xl" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.props.src}
              alt={block.props.alt}
              className="aspect-video h-auto w-full object-cover"
            />
          </div>
          {block.props.alt ? (
            <figcaption className="mt-2 text-center text-sm text-zinc-500">{block.props.alt}</figcaption>
          ) : null}
        </figure>
      );
    case "imageGallery":
      return <ImageGalleryBlock props={block.props} />;
    case "marketingFooter":
      return (
        <MarketingFooterBlock props={block.props} siteWhatsappNumber={siteWhatsappNumber} />
      );
    case "navMenu":
      return null;
    case "map": {
      const url =
        block.props.embedUrl ||
        (block.props.address
          ? `https://maps.google.com/maps?q=${encodeURIComponent(block.props.address)}&output=embed`
          : null);
      const h = block.props.height ?? 320;
      if (!url) return null;
      return (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <iframe title="Harita" src={url} className="h-full w-full max-w-full" style={{ height: h }} loading="lazy" />
        </div>
      );
    }
    case "contactForm":
      return (
        <ContactFormBlock
          {...block.props}
          blockId={block.id}
          pageSlug={pageSlug ?? undefined}
          formContext={formRegion ?? "page"}
        />
      );
    case "whatsapp": {
      const phone = resolveWaDigits(siteWhatsappNumber, block.props.phone);
      const text = block.props.prefilledMessage
        ? `?text=${encodeURIComponent(block.props.prefilledMessage)}`
        : "";
      if (!phone) {
        return (
          <p className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50/80 px-4 py-3 text-center text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
            WhatsApp numarası tanımlı değil.{" "}
            <span className="font-medium">Admin → WhatsApp</span> ekranından kaydedin.
          </p>
        );
      }
      return (
        <div className="flex w-full justify-center">
          <a
            href={`https://wa.me/${phone}${text}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {block.props.label ?? "WhatsApp ile yazın"}
          </a>
        </div>
      );
    }
    case "spacer": {
      if (block.props.hideOnMobile) {
        return <div className={`hidden md:block`} style={{ height: block.props.height }} />;
      }
      if (block.props.hideOnDesktop) {
        return <div className={`md:hidden`} style={{ height: block.props.height }} />;
      }
      return <div style={{ height: block.props.height }} />;
    }
    case "calendarEmbed": {
      const url = block.props.url;
      if (!url) return null;
      return (
        <section className="mx-auto w-full max-w-4xl space-y-3">
          {block.props.title ? (
            <h2 className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-50 md:text-left">
              {block.props.title}
            </h2>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <iframe title="Takvim" src={url} className="h-[600px] w-full" loading="lazy" />
          </div>
        </section>
      );
    }
    case "chatSnippet":
      return (
        <section className="mx-auto w-full max-w-2xl rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          {block.props.title ? <p className="mb-2 font-medium">{block.props.title}</p> : null}
          <p>
            Canlı sohbet veya üçüncü parti widget için admin panelinden özel HTML ekleyin veya buraya
            entegrasyon kodunuzu blok notu olarak saklayın. Üretimde güvenilir kaynaklardan script
            kullanın.
          </p>
          {block.props.htmlNote ? (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-left text-xs dark:bg-zinc-900">
              {block.props.htmlNote}
            </pre>
          ) : null}
        </section>
      );
    case "testimonialCarousel":
      return (
        <TestimonialCarousel
          title={block.props.title}
          subtitle={block.props.subtitle}
          reviews={block.props.reviews}
          autoplayMs={block.props.autoplayMs}
          footnote={block.props.footnote}
        />
      );
    case "brandedIntro":
      return (
        <BrandedIntro
          title={block.props.title}
          body={block.props.body}
          accentPhrase={block.props.accentPhrase}
          align={block.props.align}
        />
      );
    case "servicePromoGrid":
      return <ServicePromoGrid items={block.props.items} />;
    case "embedFrame": {
      const src = block.props.src?.trim();
      if (!src) {
        return (
          <p className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            Gömülü çerçeve için geçerli bir <strong>https://…</strong> iframe adresi girin. Forum
            embed vermiyorsa bu blok yerine <strong>Sohbet veya AI bot (HTML)</strong> veya site
            ayarlarındaki özel HTML kullanın.
          </p>
        );
      }
      const h = block.props.height ?? 640;
      const fullBleed = block.props.fullBleed === true;
      const wrap = fullBleed ? "site-breakout-x" : "mx-auto w-full max-w-[var(--site-content-max,72rem)]";
      return (
        <section className={`min-w-0 space-y-2 ${wrap}`}>
          {block.props.title ? (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{block.props.title}</h2>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <iframe
              title={block.props.title ?? "Gömülü içerik"}
              src={src}
              className="w-full"
              style={{ height: h, minHeight: 320 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </section>
      );
    }
    case "rawHtml": {
      const html = block.props.html?.trim();
      if (!html) return null;
      const fullBleed = block.props.fullBleed !== false;
      const wrap = fullBleed ? "site-breakout-x" : "mx-auto w-full max-w-[var(--site-content-max,72rem)]";
      return (
        <div
          className={`site-raw-html-block min-w-0 ${wrap}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "instagramFeed":
    case "youtubeFeed":
    case "tiktokFeed":
    case "heroSlider":
      return null;
    default:
      return null;
  }
}
