import type { NextConfig } from "next";

/**
 * HTTrack aynası `public/webpace-mirror/` — referans için doğrudan açılır:
 * `/webpace-mirror/index.html`
 * Ana sayfa uygulama içindedir: `src/app/(site)/page.tsx` (slug: home).
 * WordPress mutlak yolları `/wp-content/...` → aynadaki dosyalara rewrite edilir.
 */
const nextConfig: NextConfig = {
  /** Prisma native engine’in Turbopack ile tek kopyada yüklenmesi (Engine is not yet connected). */
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  /**
   * Admin paneli ve yönetim API’si asla edge/CDN’de önbelleğe alınmasın;
   * aksi halde eski menü / eski JS paketi canlıda kalabiliyor.
   */
  /** Eski `/randevu/iptal` bağlantıları → kısa kanonik yol (sorgu dizisi korunur). */
  async redirects() {
    return [{ source: "/randevu/iptal", destination: "/rezervasyoniptal", permanent: true }];
  },
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Vercel-CDN-Cache-Control", value: "no-store" },
    ] as const;
    return [
      { source: "/admin/:path*", headers: [...noStore] },
      { source: "/api/admin/:path*", headers: [...noStore] },
    ];
  },
  async rewrites() {
    return [
      /** Müşteri yüzü kısa güvenilir URL; içerik `/randevu/iptal` ile aynı (alan adı + izlenim için). */
      { source: "/rezervasyoniptal", destination: "/randevu/iptal" },
      {
        source: "/wp-content/:path*",
        destination: "/webpace-mirror/wp-content/:path*",
      },
    ];
  },
};

export default nextConfig;
