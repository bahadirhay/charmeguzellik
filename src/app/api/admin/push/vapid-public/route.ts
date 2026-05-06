import { NextResponse } from "next/server";

/**
 * Tarayıcı PushManager.subscribe için açık VAPID anahtarı (gizli tutulmaz).
 */
export async function GET() {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim();
  if (!k) {
    return NextResponse.json(
      { error: "Web bildirimi yapılandırılmamış (VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY)." },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: k });
}
