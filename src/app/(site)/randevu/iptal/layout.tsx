import type { Metadata } from "next";

const siteBase =
  typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
    ? process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "")
    : "";

export const metadata: Metadata = {
  title: "Randevu iptal",
  description: "Randevunu güvenlik kodunla iptal et.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Randevu iptal",
    description: "Bağlantıya dokunun; iptal kodunuzu güvenli şekilde girin.",
    type: "website",
    ...(siteBase.startsWith("http") ? { url: `${siteBase}/randevu/iptal` } : {}),
  },
};

export default function RandevuIptalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
