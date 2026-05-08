import type { Appointment } from "@prisma/client";
import { parseThemeTokens } from "@/lib/theme-tokens";

function telegramConfig(themeTokensJson: string | null | undefined): { botToken: string; chatId: string } | null {
  const t = parseThemeTokens(themeTokensJson);
  const botToken = t.telegramBotToken?.trim() ?? "";
  const chatId = t.telegramChatId?.trim() ?? "";
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const raw = (await res.text().catch(() => "")) || "";
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}${raw ? `: ${raw.slice(0, 300)}` : ""}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function notifyTelegramNewAppointment(
  settings: { themeTokensJson: string | null | undefined; siteName?: string | null },
  row: Pick<Appointment, "clientName" | "serviceName" | "startAt" | "clientPhone" | "clientEmail">,
  meta?: {
    source?: "site" | "admin";
    createdBy?: string | null;
    assignedStaff?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const cfg = telegramConfig(settings.themeTokensJson);
  if (!cfg) return { ok: false, error: "Telegram bot token/chat id eksik.", skipped: true };
  const when = new Date(row.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const site = settings.siteName?.trim() || "Salon";
  const sourceLine = meta?.source === "admin" ? "Kaynak: Admin panel" : "Kaynak: Web sitesi";
  const createdByLine = meta?.createdBy?.trim() ? `Oluşturan: ${meta.createdBy.trim()}` : null;
  const assignedStaffLine = meta?.assignedStaff?.trim() ? `Atanan personel: ${meta.assignedStaff.trim()}` : null;
  const text = [
    "Yeni randevu talebi",
    "",
    `İşletme: ${site}`,
    sourceLine,
    createdByLine,
    `Tarih/Saat: ${when}`,
    `Müşteri: ${row.clientName}`,
    `Telefon: ${row.clientPhone ?? "-"}`,
    `E-posta: ${row.clientEmail ?? "-"}`,
    `Hizmet: ${row.serviceName ?? "-"}`,
    assignedStaffLine,
  ]
    .filter(Boolean)
    .join("\n");
  const sent = await sendTelegramMessage(cfg.botToken, cfg.chatId, text);
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true };
}

export async function sendTelegramTestMessage(settings: {
  themeTokensJson: string | null | undefined;
  siteName?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = telegramConfig(settings.themeTokensJson);
  if (!cfg) return { ok: false, error: "Telegram bot token/chat id eksik." };
  const site = settings.siteName?.trim() || "Salon";
  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  return sendTelegramMessage(
    cfg.botToken,
    cfg.chatId,
    [`Telegram test bildirimi`, "", `İşletme: ${site}`, `Zaman: ${now}`].join("\n"),
  );
}

export async function notifyTelegramAppointmentAction(
  settings: { themeTokensJson: string | null | undefined; siteName?: string | null },
  row: Pick<Appointment, "clientName" | "serviceName" | "startAt" | "clientPhone" | "clientEmail">,
  action: "customer_rescheduled" | "customer_cancel_request" | "appointment_cancelled" | "customer_confirmed",
  meta?: { createdBy?: string | null },
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const cfg = telegramConfig(settings.themeTokensJson);
  if (!cfg) return { ok: false, error: "Telegram bot token/chat id eksik.", skipped: true };
  const site = settings.siteName?.trim() || "Salon";
  const when = new Date(row.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const title =
    action === "customer_rescheduled"
      ? "Müşteri randevuyu güncelledi"
      : action === "customer_cancel_request"
        ? "Müşteri iptal talebi gönderdi"
        : action === "customer_confirmed"
          ? "Müşteri randevusunu teyit etti"
          : "Randevu iptal edildi";
  const actor = meta?.createdBy?.trim() ? `İşlemi yapan: ${meta.createdBy.trim()}` : null;
  const text = [
    title,
    "",
    `İşletme: ${site}`,
    actor,
    `Tarih/Saat: ${when}`,
    `Müşteri: ${row.clientName}`,
    `Telefon: ${row.clientPhone ?? "-"}`,
    `E-posta: ${row.clientEmail ?? "-"}`,
    `Hizmet: ${row.serviceName ?? "-"}`,
  ]
    .filter(Boolean)
    .join("\n");
  const sent = await sendTelegramMessage(cfg.botToken, cfg.chatId, text);
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true };
}

export async function notifyTelegramAppointmentReminder(
  settings: { themeTokensJson: string | null | undefined; siteName?: string | null },
  row: Pick<Appointment, "clientName" | "serviceName" | "startAt" | "clientPhone" | "clientEmail">,
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const cfg = telegramConfig(settings.themeTokensJson);
  if (!cfg) return { ok: false, error: "Telegram bot token/chat id eksik.", skipped: true };
  const when = new Date(row.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const site = settings.siteName?.trim() || "Salon";
  const text = [
    "Randevu teyit hatırlatması gönderildi",
    "",
    `İşletme: ${site}`,
    `Tarih/Saat: ${when}`,
    `Müşteri: ${row.clientName}`,
    `Telefon: ${row.clientPhone ?? "-"}`,
    `E-posta: ${row.clientEmail ?? "-"}`,
    `Hizmet: ${row.serviceName ?? "-"}`,
  ].join("\n");
  const sent = await sendTelegramMessage(cfg.botToken, cfg.chatId, text);
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true };
}

