import { NextResponse } from "next/server";
import { generateAppointmentCancelSecret } from "@/lib/appointment-cancel-token";
import { notifyTelegramAppointmentReminder } from "@/lib/appointment-telegram-notify";
import { requireStaffApiAppointmentsFull } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { buildAppointmentCancelUrl } from "@/lib/site-public-url";
import { getSiteSettings } from "@/lib/site-settings";
import { sendTransactionalEmail } from "@/lib/transactional-email";

const REMINDER_NOTE_PREFIX = "Teyit hatırlatması gönderildi:";

function hasValidCronSecret(req: Request): boolean {
  const required = process.env.APPOINTMENT_REMINDER_CRON_SECRET?.trim();
  if (!required) return false;
  const fromHeader = req.headers.get("x-cron-secret")?.trim() ?? "";
  return fromHeader.length > 0 && fromHeader === required;
}

export async function POST(req: Request) {
  if (!hasValidCronSecret(req)) {
    const auth = await requireStaffApiAppointmentsFull();
    if (auth instanceof NextResponse) return auth;
  }

  const now = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000);
  const to = new Date(now + 25 * 60 * 60 * 1000);
  const settings = await getSiteSettings();
  const siteName = settings.siteName?.trim() || "Salon";
  const rows = await prisma.appointment.findMany({
    where: {
      status: "approved",
      startAt: { gte: from, lte: to },
      clientEmail: { not: null },
    },
    orderBy: { startAt: "asc" },
  });

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];
  for (const row of rows) {
    if ((row.notes ?? "").includes(REMINDER_NOTE_PREFIX)) {
      skipped += 1;
      continue;
    }
    try {
      const sec = generateAppointmentCancelSecret();
      const updated = await prisma.appointment.update({
        where: { id: row.id },
        data: {
          cancelCodeHash: sec.codeHash,
          cancelCodeLast4: sec.codeLast4,
          cancelTokenHash: sec.tokenHash,
          cancelTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 36),
          notes: [row.notes, `${REMINDER_NOTE_PREFIX} ${new Date().toLocaleString("tr-TR")}`].filter(Boolean).join("\n"),
        },
      });
      const link = buildAppointmentCancelUrl(sec.token, req);
      const when = new Date(updated.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
      const service = updated.serviceName ?? "Randevu";
      const toEmail = updated.clientEmail?.trim();
      if (!toEmail) {
        skipped += 1;
        continue;
      }
      const subject = `${siteName} — Randevu hatırlatma ve teyit`;
      const text = [
        `Merhaba ${updated.clientName},`,
        "",
        `${when} tarihli "${service}" randevunuz için teyidinizi rica ederiz.`,
        "Aşağıdaki bağlantıdan randevuyu teyit edebilir veya iptal edebilirsiniz:",
        link,
      ].join("\n");
      const mail = await sendTransactionalEmail({ to: toEmail, subject, text });
      if (!mail.ok) throw new Error(mail.error);
      const tg = await notifyTelegramAppointmentReminder(settings, updated);
      if (!tg.ok && !tg.skipped) {
        console.warn("appointment reminder telegram notify", tg.error);
      }
      sent += 1;
    } catch (e) {
      errors.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ ok: true, total: rows.length, sent, skipped, errors });
}
