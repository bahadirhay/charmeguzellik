import type { Metadata } from "next";
import { APPOINTMENT_CANCEL_PATH, normalizePublicSiteUrl } from "@/lib/site-public-url";

const siteBase = normalizePublicSiteUrl();

export const metadata: Metadata = {
  title: "Randevu iptal",
  description: "Randevunu güvenlik kodunla iptal et.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Randevu iptal",
    description: "Bağlantıya dokunun; iptal kodunuzu güvenli şekilde girin.",
    type: "website",
    ...(siteBase.startsWith("http") ? { url: `${siteBase}${APPOINTMENT_CANCEL_PATH}` } : {}),
  },
};

export default function RandevuIptalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
