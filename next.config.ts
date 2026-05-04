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
  async rewrites() {
    return [
      {
        source: "/wp-content/:path*",
        destination: "/webpace-mirror/wp-content/:path*",
      },
    ];
  },
};

export default nextConfig;
