import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getSiteSettings } from "@/lib/site-settings";
import { sendTelegramTestMessage } from "@/lib/appointment-telegram-notify";

export async function POST() {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

  const settings = await getSiteSettings();
  const sent = await sendTelegramTestMessage(settings);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

