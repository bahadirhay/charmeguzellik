import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteSettings } from "@/lib/site-settings";
import { parseThemeTokens } from "@/lib/theme-tokens";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function toAbsoluteAssetUrl(raw: string | null | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (!URL.canParse(siteUrl)) return undefined;
  if (v.startsWith("/")) return `${siteUrl.replace(/\/+$/, "")}${v}`;
  return undefined;
}

/** Bozuk favicon/metadata URL Next.js Metadata’da sayfa hatasına yol açmasın diye doğrulanır */
function safeIconMetadataUrl(candidate: string | undefined): string | undefined {
  if (!candidate?.trim()) return undefined;
  try {
    const u = new URL(candidate.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl: string | undefined;
  let brandTitle = "Güzellik & Hizmet";
  try {
    const settings = await getSiteSettings();
    const n = settings.siteName?.trim();
    if (n) brandTitle = n;
    const t = parseThemeTokens(settings.themeTokensJson);
    faviconUrl = safeIconMetadataUrl(toAbsoluteAssetUrl(t.siteFaviconUrl));
  } catch {
    faviconUrl = undefined;
  }

  return {
    title: {
      default: brandTitle,
      template: `%s · ${brandTitle}`,
    },
    description: "Yerel olarak düzenleyin, SEO uyumlu yayınlayın.",
    ...(URL.canParse(siteUrl) ? { metadataBase: new URL(siteUrl) } : {}),
    ...(faviconUrl
      ? {
          icons: {
            icon: faviconUrl,
            apple: faviconUrl,
            shortcut: faviconUrl,
          },
        }
      : {}),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
