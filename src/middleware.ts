import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { APPOINTMENT_CANCEL_PATH } from "@/lib/site-public-url";

/**
 * Yönetim paneli hiçbir katmanda CDN’ye yapışmasın — eski açıklama metinleri gibi JSX’ler
 * yanlışlıkla cache’te kalmasın diye başlığı tekrarlar (next.config headers ile uyumlu).
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === APPOINTMENT_CANCEL_PATH) {
    const target = req.nextUrl.clone();
    target.pathname = "/randevu/iptal";
    return NextResponse.rewrite(target);
  }

  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  const res = NextResponse.next();
  const noStore = "private, no-store, max-age=0, must-revalidate";
  res.headers.set("Cache-Control", noStore);
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/rezervasyoniptal"],
};
