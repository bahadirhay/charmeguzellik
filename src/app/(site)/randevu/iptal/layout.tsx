import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { APPOINTMENT_CANCEL_PATH, normalizePublicSiteUrl } from "@/lib/site-public-url";
import { parseThemeTokens } from "@/lib/theme-tokens";

function absoluteLogoUrl(base: string, raw: string | null | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (!base.startsWith("http")) return undefined;
  if (v.startsWith("/")) return `${base.replace(/\/+$/, "")}${v}`;
  return undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  const siteBase = normalizePublicSiteUrl();
  let logoUrl: string | undefined;
  try {
    const settings = await getSiteSettings();
    const t = parseThemeTokens(settings.themeTokensJson);
    logoUrl =
      absoluteLogoUrl(siteBase, t.siteFaviconUrl) ??
      absoluteLogoUrl(siteBase, t.socialPreviewLogoUrl) ??
      (siteBase.startsWith("http") ? `${siteBase.replace(/\/+$/, "")}/uploads/charme-guzellik-logo.png` : undefined);
  } catch {
    logoUrl = siteBase.startsWith("http") ? `${siteBase.replace(/\/+$/, "")}/uploads/charme-guzellik-logo.png` : undefined;
  }

  return {
    title: "Randevu Onayı",
    description: "",
    robots: { index: false, follow: false },
    openGraph: {
      title: "Randevu Onayı",
      description: "",
      type: "website",
      ...(siteBase.startsWith("http") ? { url: `${siteBase}${APPOINTMENT_CANCEL_PATH}` } : {}),
      ...(logoUrl ? { images: [{ url: logoUrl, alt: "Charme Güzellik Salonu" }] } : {}),
    },
    ...(logoUrl
      ? {
          twitter: {
            card: "summary",
      title: "Randevu Onayı",
            description: "",
            images: [logoUrl],
          },
        }
      : {}),
  };
}

export default function RandevuIptalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
