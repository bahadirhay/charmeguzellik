import webpush from "web-push";
import type { Appointment } from "@prisma/client";
import { getVapidPublicKey, isVapidSendConfigured } from "@/lib/vapid-config";
import { prisma } from "@/lib/prisma";

let warnedMissingVapidKeys = false;

/** VAPID subject; push servisleri için zorunlu (mailto: veya https: URL). */
function vapidSubject(): string {
  const s = process.env.VAPID_SUBJECT?.trim();
  if (s) return s;
  return "mailto:info@charmeguzellik.com";
}

function ensureWebPushConfigured(): boolean {
  if (!isVapidSendConfigured()) return false;
  const publicKey = getVapidPublicKey()!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!.trim();
  webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);
  return true;
}

/**
 * Kayıtlı personel cihazlarına Web Push bildirimi (Android Chrome, desktop; iOS 16.4+ Safari genelde PWA ile).
 * E-postadan bağımsız; VAPID ortam değişkenleri gerekir.
 */
export async function notifyStaffPushNewAppointment(
  row: Pick<Appointment, "clientName" | "serviceName" | "startAt">,
): Promise<void> {
  if (!ensureWebPushConfigured()) {
    if (!warnedMissingVapidKeys) {
      warnedMissingVapidKeys = true;
      console.warn(
        "appointment push: gönderim için VAPID eksik. VAPID_PRIVATE_KEY ve açık anahtar (NEXT_PUBLIC_VAPID_PUBLIC_KEY veya VAPID_PUBLIC_KEY) tanımlı olmalı; abonelik ile aynı çift kullanın.",
      );
    }
    return;
  }

  let rows: { id: string; subscriptionJson: string }[] = [];
  try {
    rows = await prisma.staffPushSubscription.findMany({ select: { id: true, subscriptionJson: true } });
  } catch {
    return;
  }
  if (rows.length === 0) return;

  const when = new Date(row.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const svc = row.serviceName?.trim() || "Randevu";
  const payload = JSON.stringify({
    title: "Yeni randevu talebi",
    body: `${row.clientName} · ${when} · ${svc}`,
    url: "/admin/appointments",
  });

  const deadIds: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        const sub = JSON.parse(r.subscriptionJson) as webpush.PushSubscription;
        await webpush.sendNotification(sub, payload, { TTL: 86_400 });
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) deadIds.push(r.id);
        else
          console.warn(
            "appointment push: gönderim hatası",
            status ?? (e instanceof Error ? e.message : e),
          );
      }
    }),
  );

  if (deadIds.length > 0) {
    try {
      await prisma.staffPushSubscription.deleteMany({ where: { id: { in: deadIds } } });
    } catch {
      /* ignore */
    }
  }
}
