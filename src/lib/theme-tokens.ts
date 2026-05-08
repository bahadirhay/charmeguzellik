import { z } from "zod";
import type { ThemeId } from "@/themes/types";

/** Alt telif + yönetim paneli şeridi — `themeTokensJson` içinde saklanır (Prisma şemasına yeni sütun gerekmez) */
const siteFooterStripFields = z.object({
  legalLineEnabled: z.boolean().optional(),
  legalLine: z.string().nullable().optional(),
  /** Telif satırı tıklanabilir bağlantı (boşsa yalnızca metin) */
  legalLinkHref: z.string().nullable().optional(),
  /** true: yeni sekmede aç */
  legalLinkOpenInNewTab: z.boolean().optional(),
  adminLinkEnabled: z.boolean().optional(),
  adminLinkLabel: z.string().nullable().optional(),
});

export type SiteFooterStrip = z.infer<typeof siteFooterStripFields>;

/** Üst menü sol marka: logo veya site adı; yapışkan modda her zaman metin */
const siteHeaderBrandFields = z.object({
  desktopDisplay: z.enum(["text", "logo"]).optional(),
  desktopLogoUrl: z.string().nullable().optional(),
  /** Masaüstü geniş menüde logo yüksekliği (px), varsayılan ~48 */
  desktopLogoMaxHeightPx: z.number().int().min(24).max(120).optional(),
  /** Mobil geniş menüde logo yüksekliği (px); boşsa masaüstü değeri, o da yoksa ~44 */
  mobileLogoMaxHeightPx: z.number().int().min(24).max(100).optional(),
  /** same = masaüstüyle aynı kural; mobilde ayrı metin/logo */
  mobileDisplay: z.enum(["same", "text", "logo"]).optional(),
  mobileLogoUrl: z.string().nullable().optional(),
  /** Masaüstü yatay menü hizası (logo solda kalır) */
  desktopNavAlign: z.enum(["start", "center", "end"]).optional(),
});

export type SiteHeaderBrand = z.infer<typeof siteHeaderBrandFields>;

const themeTokensSchema = z
  .object({
    brand: z.string().optional(),
    brandHover: z.string().optional(),
    siteBg: z.string().optional(),
    siteFg: z.string().optional(),
    siteMuted: z.string().optional(),
    headerBg: z.string().optional(),
    footerBg: z.string().optional(),
    /** Alt bilgi ana metin (klinik footer bloğu dahil) */
    footerFg: z.string().optional(),
    footerMuted: z.string().optional(),
    footerLink: z.string().optional(),
    footerLinkHover: z.string().optional(),
    footerAccent: z.string().optional(),
    footerBorder: z.string().optional(),
    topbarBg: z.string().optional(),
    topbarFg: z.string().optional(),
    navHover: z.string().optional(),
    contentMaxWidth: z.string().optional(),
    radiusMd: z.string().optional(),
    fontHeading: z.string().optional(),
    fontBody: z.string().optional(),
    googleFontsHref: z.string().optional(),
    /** WhatsApp / sosyal önizleme kartlarında kullanılacak logo (URL) */
    socialPreviewLogoUrl: z.string().nullable().optional(),
    /** Sitenin favicon / app icon görseli (URL) */
    siteFaviconUrl: z.string().nullable().optional(),
    /** Telegram bot bildirimi (panelde yönetilir) */
    telegramBotToken: z.string().nullable().optional(),
    telegramChatId: z.string().nullable().optional(),
    /** Hizmet (menü etiketi) -> panel personel kullanıcı id'leri; randevu formlarında gösterilen ad StaffUser.displayName üzerinden çözülür */
    appointmentStaffByService: z.record(z.string(), z.array(z.string())).optional(),
    siteFooterStrip: siteFooterStripFields.optional(),
    siteHeaderBrand: siteHeaderBrandFields.optional(),
  })
  .partial();

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

type Defaults = Record<
  | "brand"
  | "brandHover"
  | "siteBg"
  | "siteFg"
  | "siteMuted"
  | "headerBg"
  | "footerBg"
  | "footerFg"
  | "footerMuted"
  | "footerLink"
  | "footerLinkHover"
  | "footerAccent"
  | "footerBorder"
  | "topbarBg"
  | "topbarFg"
  | "navHover"
  | "contentMaxWidth"
  | "radiusMd"
  | "fontHeading"
  | "fontBody",
  string
>;

const THEME_DEFAULTS: Record<ThemeId, Defaults> = {
  cherry: {
    brand: "#b84d5c",
    brandHover: "#9a3e4b",
    siteBg: "#fdf8f6",
    siteFg: "#2c2826",
    siteMuted: "#6b6460",
    headerBg: "rgba(255, 252, 250, 0.97)",
    footerBg: "#2c2826",
    footerFg: "#f4f4f5",
    footerMuted: "#a8a29e",
    footerLink: "#93c5fd",
    footerLinkHover: "#ffffff",
    footerAccent: "#2563eb",
    footerBorder: "rgba(255,255,255,0.1)",
    topbarBg: "#b84d5c",
    topbarFg: "#fffefc",
    navHover: "#fce8ec",
    contentMaxWidth: "72rem",
    radiusMd: "0.75rem",
    fontHeading: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    fontBody: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  default: {
    brand: "#be123c",
    brandHover: "#9f1239",
    siteBg: "#ffffff",
    siteFg: "#171717",
    siteMuted: "#71717a",
    headerBg: "rgba(255, 255, 255, 0.95)",
    footerBg: "#fafafa",
    footerFg: "#18181b",
    footerMuted: "#52525b",
    footerLink: "#be123c",
    footerLinkHover: "#9f1239",
    footerAccent: "#2563eb",
    footerBorder: "#e4e4e7",
    topbarBg: "#be123c",
    topbarFg: "#ffffff",
    navHover: "#fff1f2",
    contentMaxWidth: "72rem",
    radiusMd: "0.75rem",
    fontHeading: "ui-sans-serif, system-ui, sans-serif",
    fontBody: "ui-sans-serif, system-ui, sans-serif",
  },
};

export function parseThemeTokens(raw: string | null | undefined): ThemeTokens {
  if (!raw?.trim()) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    return themeTokensSchema.parse(data);
  } catch {
    return {};
  }
}

/** Yerleşim + tipografi değişkenleri — [data-site-theme] altına enjekte edilir */
export function buildThemeOverrideCss(themeId: ThemeId, raw: string | null | undefined): string {
  const t = parseThemeTokens(raw);
  const d = THEME_DEFAULTS[themeId];
  const pick = (k: keyof Defaults) => (t[k as keyof ThemeTokens] as string | undefined) ?? d[k];

  const rules: string[] = [
    `--site-brand: ${pick("brand")};`,
    `--site-brand-hover: ${pick("brandHover")};`,
    `--site-bg: ${pick("siteBg")};`,
    `--site-fg: ${pick("siteFg")};`,
    `--site-muted: ${pick("siteMuted")};`,
    `--site-header-bg: ${pick("headerBg")};`,
    `--site-footer-bg: ${pick("footerBg")};`,
    `--site-footer-fg: ${pick("footerFg")};`,
    `--site-footer-muted: ${pick("footerMuted")};`,
    `--site-footer-link: ${pick("footerLink")};`,
    `--site-footer-link-hover: ${pick("footerLinkHover")};`,
    `--site-footer-accent: ${pick("footerAccent")};`,
    `--site-footer-border: ${pick("footerBorder")};`,
    `--site-topbar-bg: ${pick("topbarBg")};`,
    `--site-topbar-fg: ${pick("topbarFg")};`,
    `--site-nav-hover: ${pick("navHover")};`,
    `--site-content-max: ${pick("contentMaxWidth")};`,
    `--site-radius-md: ${pick("radiusMd")};`,
    `--site-font-heading: ${pick("fontHeading")};`,
    `--site-font-body: ${pick("fontBody")};`,
  ];

  const base = `[data-site-theme="${themeId}"] {\n  ${rules.join("\n  ")}\n}`;
  const headings = `\n[data-site-theme="${themeId}"] h1,\n[data-site-theme="${themeId}"] h2,\n[data-site-theme="${themeId}"] h3 {\n  font-family: var(--site-font-heading);\n}`;
  return base + headings;
}

export function themeTokensToJson(tokens: ThemeTokens): string {
  return JSON.stringify(tokens, null, 2);
}
