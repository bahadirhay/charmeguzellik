"use client";

import type { PageBlock } from "@/lib/blocks/schema";
import { toVideoIframeSrc } from "@/lib/video-embed";
import { BrandedIntro } from "@/components/site/BrandedIntro";
import { ContactFormBlock } from "@/components/site/blocks/ContactFormBlock";
import { HeroSlider } from "@/components/site/HeroSlider";
import { ServicePromoGrid } from "@/components/site/ServicePromoGrid";
import { TestimonialCarousel } from "@/components/site/TestimonialCarousel";
import { ImageGalleryBlock } from "@/components/site/ImageGalleryBlock";
import { MarketingFooterBlock } from "@/components/site/MarketingFooterBlock";
import { TextBlockView } from "@/components/site/TextBlockView";
import { NavMenuPreview } from "@/components/admin/NavMenuPreview";
import { resolveWaDigits } from "@/lib/whatsapp-url";

function layoutClass(
  desktop: "left" | "center" | "right" | undefined,
  mobile: "left" | "center" | "right" | undefined,
) {
  const d = desktop ?? "center";
  const m = mobile ?? d;
  const map = { left: "text-left", center: "text-center", right: "text-right" } as const;
  const mdMap = { left: "md:text-left", center: "md:text-center", right: "md:text-right" } as const;
  return `${map[m]} ${mdMap[d]}`;
}

function PreviewBlock({
  block,
  siteWhatsappNumber,
}: {
  block: PageBlock;
  siteWhatsappNumber?: string | null;
}) {
  switch (block.type) {
    case "heroSlider":
      return (
        <HeroSlider
          slides={block.props.slides}
          autoplayMs={block.props.autoplayMs}
          aspectRatio={block.props.aspectRatio}
          showDots={block.props.showDots}
          overlayDark={block.props.overlayDark}
        />
      );
    case "instagramFeed":
      return (
        <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          {block.props.title ? <p className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">{block.props.title}</p> : null}
          Instagram vitrinı — yayınlanan gönderiler sunucudan yüklenir; burada yer tutucu.
        </section>
      );
    case "youtubeFeed":
      return (
        <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          {block.props.title ? <p className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">{block.props.title}</p> : null}
          YouTube vitrinı — canlı önizleme sunucudan yüklenir.
        </section>
      );
    case "tiktokFeed":
      return (
        <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          {block.props.title ? <p className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">{block.props.title}</p> : null}
          TikTok vitrinı — canlı önizleme sunucudan yüklenir.
        </section>
      );
    case "hero": {
      const { headline, subline, imageUrl, ctaLabel, ctaHref, desktopLayout, mobileLayout } = block.props;
      return (
        <section
          className={`rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 px-6 py-14 dark:from-rose-950/40 dark:to-amber-950/30 ${layoutClass(desktopLayout, mobileLayout)}`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-center md:gap-10">
            <div className="flex-1 space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
                {headline}
              </h1>
              {subline ? <p className="text-lg text-zinc-600 dark:text-zinc-300">{subline}</p> : null}
              {ctaLabel && ctaHref ? (
                <a
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-full bg-rose-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
                >
                  {ctaLabel}
                </a>
              ) : null}
            </div>
            {imageUrl ? (
              <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl shadow-lg md:mx-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="aspect-[4/3] h-auto w-full object-cover" />
              </div>
            ) : null}
          </div>
        </section>
      );
    }
    case "text": {
      return (
        <TextBlockView
          content={block.props.content}
          as={block.props.as ?? "p"}
          align={block.props.align ?? "left"}
        />
      );
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
        <MarketingFooterBlock
          props={block.props}
          embedPreview
          siteWhatsappNumber={siteWhatsappNumber ?? null}
        />
      );
    case "navMenu":
      return (
        <div className="rounded-xl border border-zinc-200 bg-[var(--site-header-bg)] px-3 py-3 dark:border-zinc-700">
          <NavMenuPreview menuSlug={block.props.menuSlug} style={block.props.style ?? "links"} />
        </div>
      );
    case "map": {
      const url =
        block.props.embedUrl ||
        (block.props.address
          ? `https://maps.google.com/maps?q=${encodeURIComponent(block.props.address)}&output=embed`
          : null);
      const h = block.props.height ?? 320;
      if (!url) return null;
      return (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <iframe title="Harita" src={url} className="h-full w-full" style={{ height: h }} loading="lazy" />
        </div>
      );
    }
    case "contactForm":
      return (
        <ContactFormBlock
          {...block.props}
          blockId={block.id}
          previewDisabled
          showConfigHints
        />
      );
    case "whatsapp": {
      const phone = resolveWaDigits(siteWhatsappNumber, block.props.phone);
      const text = block.props.prefilledMessage
        ? `?text=${encodeURIComponent(block.props.prefilledMessage)}`
        : "";
      if (!phone) {
        return (
          <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Önizleme: <strong>Admin → WhatsApp</strong> ekranına numara girin.
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
        return <div className="hidden md:block" style={{ height: block.props.height }} />;
      }
      if (block.props.hideOnDesktop) {
        return <div className="md:hidden" style={{ height: block.props.height }} />;
      }
      return <div style={{ height: block.props.height }} />;
    }
    case "calendarEmbed": {
      const title = block.props.title?.trim();
      const body =
        block.props.body?.trim() ||
        (block.props.url?.trim() ? "Önizleme metni düzenleyicide ayarlı değil; yayında blok ayarları geçerlidir." : "Randevu bilgisi — metin ve CTA (düzenleyicide ayarlayın).");
      const ctaLabel = block.props.ctaLabel?.trim() || "İletişim";
      const ctaHref = block.props.ctaHref?.trim() || "/iletisim";
      return (
        <section className="mx-auto w-full max-w-2xl space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-center text-sm dark:border-zinc-800 dark:bg-zinc-950/40 md:text-left">
          {title ? <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2> : null}
          <p className="text-zinc-700 dark:text-zinc-300">{body}</p>
          <a
            href={ctaHref}
            className="inline-flex rounded-full bg-rose-600 px-4 py-2 text-xs font-medium text-white"
          >
            {ctaLabel}
          </a>
        </section>
      );
    }
    case "chatSnippet":
      return (
        <section className="mx-auto w-full max-w-2xl rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          {block.props.title ? <p className="mb-2 font-medium">{block.props.title}</p> : null}
          <p>
            Canlı sohbet veya üçüncü parti widget için admin panelinden özel HTML ekleyin veya buraya
            entegrasyon kodunuzu blok notu olarak saklayın.
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
          renderAdminFootnote
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
            iframe adresi girilmedi. Özellikler panelinden <strong>https://…</strong> src ekleyin.
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
    default:
      return null;
  }
}

function interactiveClickTarget(target: EventTarget | null): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

type Props = {
  blocks: PageBlock[];
  themeId: string;
  themeOverrideCss: string;
  googleFontsHref?: string | null;
  /** Ayarlar → WhatsApp (önizlemede wa.me için) */
  siteWhatsappNumber?: string | null;
  /** Site üst/alt düzen editöründe bloklar arası boşluk */
  blockGap?: "default" | "tight";
  /** Önizlemede bloğa tıklanınca (link/buton dışı) seçim */
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
};

/** Kaydetmeden güncellenen sayfa önizlemesi (iframe / DB yerine mevcut state). */
function PreviewBlockShell({
  block,
  selected,
  onSelectBlock,
  siteWhatsappNumber,
}: {
  block: PageBlock;
  selected: boolean;
  onSelectBlock?: (id: string) => void;
  siteWhatsappNumber?: string | null;
}) {
  const interactive = Boolean(onSelectBlock);
  const onCap = (e: React.MouseEvent) => {
    if (!onSelectBlock) return;
    const el = interactiveClickTarget(e.target);
    if (el?.closest("a, button, input, select, textarea, iframe, label, [contenteditable='true']")) return;
    onSelectBlock(block.id);
  };
  return (
    <div
      data-editor-preview-block={block.id}
      className={`rounded-xl transition-shadow ${
        selected ? "ring-2 ring-rose-500 ring-offset-2 ring-offset-[var(--site-bg,#fff)]" : ""
      } ${interactive ? "cursor-pointer hover:ring-1 hover:ring-rose-400/60 hover:ring-offset-2 hover:ring-offset-[var(--site-bg,#fff)]" : ""}`}
      onClickCapture={onCap}
    >
      <PreviewBlock block={block} siteWhatsappNumber={siteWhatsappNumber} />
    </div>
  );
}

export function EditorLivePreview({
  blocks,
  themeId,
  themeOverrideCss,
  googleFontsHref,
  siteWhatsappNumber = null,
  blockGap = "default",
  selectedBlockId = null,
  onSelectBlock,
}: Props) {
  return (
    <>
      {googleFontsHref ? (
        <link rel="stylesheet" href={googleFontsHref} crossOrigin="anonymous" />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: themeOverrideCss }} />
      <div
        data-site-theme={themeId}
        className="site-main-wrap min-h-0 min-w-0"
        style={{
          backgroundColor: "var(--site-bg)",
          color: "var(--site-fg)",
          fontFamily: "var(--site-font-body, ui-sans-serif, system-ui, sans-serif)",
        }}
      >
        <div className="mx-auto w-full max-w-[var(--site-content-max,72rem)] px-4 py-6">
          {blocks.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">Henüz blok yok — soldan ekleyin.</p>
          ) : (
            <div className={`flex flex-col ${blockGap === "tight" ? "gap-5 md:gap-6" : "gap-10"}`}>
              {blocks.map((block) => (
                <PreviewBlockShell
                  key={block.id}
                  block={block}
                  selected={selectedBlockId === block.id}
                  onSelectBlock={onSelectBlock}
                  siteWhatsappNumber={siteWhatsappNumber}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
