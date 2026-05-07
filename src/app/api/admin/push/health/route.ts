import { NextResponse } from "next/server";
import { requireStaffApiAny } from "@/lib/admin-api-auth";
import { isVapidSendConfigured } from "@/lib/vapid-config";
import { prisma } from "@/lib/prisma";

/**
 * Panelde push sorununu ayıklamak için: sunucu gönderimi hazır mı, kaç cihaz kayıtlı.
 * Kimlik bilgisi veya anahtar döndürmez.
 */
export async function GET() {
  const auth = await requireStaffApiAny(["crm.appointments", "crm.appointments.self"]);
  if (auth instanceof NextResponse) return auth;

  let subscriptionCount = 0;
  try {
    subscriptionCount = await prisma.staffPushSubscription.count();
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    sendReady: isVapidSendConfigured(),
    subscriptionCount,
  });
}
