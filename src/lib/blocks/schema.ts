import { z } from "zod";

const heroProps = z.object({
  headline: z.string(),
  subline: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  desktopLayout: z.enum(["left", "center", "right"]).optional(),
  mobileLayout: z.enum(["left", "center", "right"]).optional(),
});

const textProps = z.object({
  content: z.string(),
  as: z.enum(["p", "h1", "h2", "h3"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const buttonProps = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(["primary", "secondary", "outline"]).optional(),
  fullWidthMobile: z.boolean().optional(),
});

const imageProps = z.object({
  src: z.string(),
  alt: z.string(),
  rounded: z.boolean().optional(),
});

const imageGalleryItemSchema = z.object({
  id: z.string(),
  src: z.string(),
  alt: z.string().optional(),
  /** Tıklanınca yeni sekmede açılır */
  href: z.string().optional(),
});

const imageGalleryProps = z.object({
  title: z.string().optional(),
  images: z.array(imageGalleryItemSchema).min(1).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  rounded: z.boolean().optional(),
  /** Görsellerin kırılımı: video 16:9, kare, veya doğal yükseklik */
  imageAspect: z.enum(["video", "square", "auto"]).optional(),
});

const mapProps = z.object({
  embedUrl: z.string().optional(),
  address: z.string().optional(),
  height: z.number().optional(),
});

const contactFormServiceOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const appointmentDayScheduleSchema = z.object({
  /** 0=Pazar … 6=Cumartesi (Date.getDay) */
  day: z.number().int().min(0).max(6),
  start: z.string().max(5),
  end: z.string().max(5),
});

const contactFormProps = z.object({
  title: z.string().optional(),
  successMessage: z.string().optional(),
  /** contact: klasik iletişim; appointment: hizmet + tercih tarihi/saati + randevu API */
  mode: z.enum(["contact", "appointment"]).optional(),
  serviceOptions: z.array(contactFormServiceOptionSchema).max(40).optional(),
  /** Randevu: bu menüdeki şu üst öğenin alt linkleri hizmet listesine otomatik eklenir (örn. Hizmetlerimiz) */
  serviceNavMenuSlug: z.enum(["header", "footer"]).optional(),
  /** false ise yalnızca serviceNavParentId ile seçilen öğenin alt linkleri kullanılır */
  serviceNavUseAuto: z.boolean().optional(),
  serviceNavParentId: z.string().optional(),
  /** Randevu aralığı (dakika); bitiş = başlangıç + bu süre */
  slotDurationMinutes: z.number().int().min(15).max(240).optional(),
  submitLabel: z.string().optional(),
  /** Randevu: hizmet seçimi (varsayılan açık). Kapalıysa hizmet «Belirtilmedi» kaydedilir. */
  appointmentShowService: z.boolean().optional(),
  /** Randevu: isteğe bağlı alanlar (varsayılan hepsi açık) */
  appointmentShowEmail: z.boolean().optional(),
  appointmentShowPhone: z.boolean().optional(),
  appointmentShowMessage: z.boolean().optional(),
  /** İletişim formu alanları (varsayılan açık) */
  contactShowEmail: z.boolean().optional(),
  contactShowPhone: z.boolean().optional(),
  contactShowMessage: z.boolean().optional(),
  /** IANA; çalışma saati ve tarih listesi için (varsayılan Europe/Istanbul) */
  appointmentTimeZone: z.string().max(80).optional(),
  /** Boşsa uygulama varsayılanı (Pzts–Cmt) */
  appointmentDays: z.array(appointmentDayScheduleSchema).max(7).optional(),
});

const whatsappProps = z.object({
  /** Boşsa site ayarı (Admin → WhatsApp) kullanılır */
  phone: z.string().optional(),
  label: z.string().optional(),
  prefilledMessage: z.string().optional(),
});

const spacerProps = z.object({
  height: z.number(),
  hideOnMobile: z.boolean().optional(),
  hideOnDesktop: z.boolean().optional(),
});

const calendarEmbedProps = z.object({
  title: z.string().optional(),
  /** Eski sayfalar: harici iframe kaldırıldı; site metin + CTA gösterir */
  url: z.string().optional(),
  body: z.string().max(4000).optional(),
  ctaLabel: z.string().max(120).optional(),
  ctaHref: z.string().max(500).optional(),
});

const chatSnippetProps = z.object({
  title: z.string().optional(),
  htmlNote: z.string().optional(),
});

/** Instagram / YouTube / TikTok vitrin blokları — ortak alanlar */
const socialFeedProps = z.object({
  title: z.string().optional(),
  columns: z.number().min(2).max(4).optional(),
  /**
   * mediaCard: görsel + harici bağlantı (iframe kromu yok; küçük resim gerekir)
   * iframe: resmi embed
   */
  displayMode: z.enum(["mediaCard", "iframe"]).optional(),
  /** iframe yüksekliği (px); yalnız displayMode === iframe */
  embedHeightPx: z.number().int().min(400).max(1400).optional(),
});

const instagramFeedProps = socialFeedProps.extend({
  /** grid: çok satırlı ızgara; carousel: yatay kaydırmalı şerit */
  feedLayout: z.enum(["grid", "carousel"]).optional(),
  /** 0 = yalnızca elle kaydır; carousel + pozitif değer = otomatik kaydırma (ms) */
  carouselAutoplayMs: z.number().min(0).max(120000).optional(),
});
const youtubeFeedProps = socialFeedProps;
const tiktokFeedProps = socialFeedProps;

const sliderSlideSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  headline: z.string().optional(),
  subline: z.string().optional(),
  href: z.string().optional(),
  ctaLabel: z.string().optional(),
  /** Başlık + alt metin + buton yatay hizası (flex-col cross axis) */
  contentAlignX: z.enum(["left", "center", "right"]).optional(),
  /** Dikey konum (flex-col main axis) */
  contentAlignY: z.enum(["top", "center", "bottom"]).optional(),
});

/** Slayt bloğu üst sınırı (admin + API ile aynı) */
export const HERO_SLIDER_MAX_SLIDES = 40;

const heroSliderProps = z.object({
  slides: z.array(sliderSlideSchema).min(1).max(HERO_SLIDER_MAX_SLIDES),
  /** 0 = otomatik geçiş kapalı */
  autoplayMs: z.number().min(0).max(120000).optional(),
  aspectRatio: z.enum(["wide", "tall", "square"]).optional(),
  showDots: z.boolean().optional(),
  /** Metin okunaklılığı için koyu gradient */
  overlayDark: z.boolean().optional(),
});

const testimonialItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  relativeTimeLabel: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  text: z.string(),
  sourceLabel: z.string().optional(),
  avatarUrl: z.string().optional(),
  initials: z.string().optional(),
});

const testimonialCarouselProps = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  reviews: z.array(testimonialItemSchema).min(1).max(24),
  autoplayMs: z.number().min(0).max(120000).optional(),
  footnote: z.string().optional(),
});

const brandedIntroProps = z.object({
  title: z.string(),
  body: z.string(),
  accentPhrase: z.string().optional(),
  align: z.enum(["left", "center"]).optional(),
});

const servicePromoItemSchema = z.object({
  id: z.string(),
  faintWord: z.string(),
  titleDark: z.string(),
  titleAccent: z.string().optional(),
  imageUrl: z.string().optional(),
  gradientFrom: z.string().optional(),
  gradientTo: z.string().optional(),
  badgeText: z.string().optional(),
  lightOnDark: z.boolean().optional(),
});

const servicePromoGridProps = z.object({
  items: z.array(servicePromoItemSchema).min(1).max(6),
});

/** HTTrack / statik şablondan yapıştırılan HTML (yalnızca güvenilir yönetici içeriği). */
const rawHtmlProps = z.object({
  html: z.string().max(400_000),
  /** true: sayfa genişliği kırılımı (tam genişlik), false: site içerik genişliği */
  fullBleed: z.boolean().optional(),
});

const videoEmbedProps = z.object({
  url: z.string(),
  title: z.string().optional(),
});

const audioEmbedProps = z.object({
  /** Doğrudan .mp3 vb. dosya URL’si */
  src: z.string(),
  title: z.string().optional(),
});

/** Forum / harici uygulama iframe embed (yalnızca güvenilir src). */
const embedFrameProps = z.object({
  title: z.string().optional(),
  src: z.string(),
  height: z.number().min(200).max(2400).optional(),
  fullBleed: z.boolean().optional(),
});

const marketingFooterCtaSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  variant: z.enum(["outline", "solid"]).optional(),
});

const marketingFooterColumnSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  links: z.array(z.object({ label: z.string(), href: z.string() })).max(16).optional(),
});

const marketingFooterInfoCardSchema = z.object({
  id: z.string(),
  icon: z.enum(["phone", "email", "clock", "map", "info"]),
  title: z.string(),
  lines: z.array(z.string()).min(1).max(6),
});

const navMenuProps = z.object({
  /** Admin → Menü ekranındaki hangi liste basılsın */
  menuSlug: z.enum(["header", "footer"]),
  /** links: yatay; stacked: alt alta / alt bilgi */
  style: z.enum(["links", "stacked"]).optional(),
});

const marketingFooterProps = z.object({
  brandLabel: z.string(),
  ctas: z.array(marketingFooterCtaSchema).max(3).optional(),
  columns: z.array(marketingFooterColumnSchema).min(1).max(4),
  infoCards: z.array(marketingFooterInfoCardSchema).max(8).optional(),
  copyrightLine: z.string().optional(),
  /** Telif satırı tıklanınca gidilecek adres (boşsa düz metin) */
  copyrightHref: z.string().optional(),
  /** true: yeni sekme (_blank) */
  copyrightOpenInNewTab: z.boolean().optional(),
  /** Üst CTA, sütun linkleri, sabit WA: https// için yeni sekme. Tanımsız = true. */
  externalLinksOpenInNewTab: z.boolean().optional(),
  showFloatingWhatsapp: z.boolean().optional(),
  whatsappPhone: z.string().optional(),
  showBackToTop: z.boolean().optional(),
});

export const pageBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("hero"), props: heroProps }),
  z.object({ id: z.string(), type: z.literal("text"), props: textProps }),
  z.object({ id: z.string(), type: z.literal("button"), props: buttonProps }),
  z.object({ id: z.string(), type: z.literal("image"), props: imageProps }),
  z.object({
    id: z.string(),
    type: z.literal("imageGallery"),
    props: imageGalleryProps,
  }),
  z.object({ id: z.string(), type: z.literal("map"), props: mapProps }),
  z.object({
    id: z.string(),
    type: z.literal("contactForm"),
    props: contactFormProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("whatsapp"),
    props: whatsappProps,
  }),
  z.object({ id: z.string(), type: z.literal("spacer"), props: spacerProps }),
  z.object({
    id: z.string(),
    type: z.literal("calendarEmbed"),
    props: calendarEmbedProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("chatSnippet"),
    props: chatSnippetProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("instagramFeed"),
    props: instagramFeedProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("youtubeFeed"),
    props: youtubeFeedProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("tiktokFeed"),
    props: tiktokFeedProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("heroSlider"),
    props: heroSliderProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("testimonialCarousel"),
    props: testimonialCarouselProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("brandedIntro"),
    props: brandedIntroProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("servicePromoGrid"),
    props: servicePromoGridProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("rawHtml"),
    props: rawHtmlProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("videoEmbed"),
    props: videoEmbedProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("audioEmbed"),
    props: audioEmbedProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("embedFrame"),
    props: embedFrameProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("marketingFooter"),
    props: marketingFooterProps,
  }),
  z.object({
    id: z.string(),
    type: z.literal("navMenu"),
    props: navMenuProps,
  }),
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;

export const blocksArraySchema = z.array(pageBlockSchema);

export function parseBlocks(json: string): PageBlock[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  const parsed = blocksArraySchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}
