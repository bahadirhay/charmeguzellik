import { NextResponse } from "next/server";
import { appointmentRowForbiddenForStaff, requireStaffApiAppointments } from "@/lib/admin-api-auth";
import { generateAppointmentCancelSecret } from "@/lib/appointment-cancel-token";
import { notifyTelegramAppointmentReminder } from "@/lib/appointment-telegram-notify";
import { phoneDigitsForWaMe } from "@/lib/customer-phone";
import { prisma } from "@/lib/prisma";
import { buildAppointmentCancelUrl } from "@/lib/site-public-url";
import { getSiteSettings } from "@/lib/site-settings";
import { sendTransactionalEmail } from "@/lib/transactional-email";

type Ctx = { params: Promise<{ id: string }> };

const REMINDER_NOTE_PREFIX = "Teyit hatırlatması gönderildi:";

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiAppointments();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const row = await prisma.appointment.findUnique({ where: { id } });
  const rowForbidden = appointmentRowForbiddenForStaff(auth, row);
  if (rowForbidden) return rowForbidden;
  if (!row) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (row.status !== "approved" && row.status !== "confirmed") {
    return NextResponse.json({ error: "Teyit mesajı sadece onaylı/teyitli randevu için gönderilir." }, { status: 400 });
  }

  const settings = await getSiteSettings();
  const siteName = settings.siteName?.trim() || "Salon";
  const sec = generateAppointmentCancelSecret();
  const updated = await prisma.appointment.update({
    where: { id: row.id },
    data: {
      cancelCodeHash: sec.codeHash,
      cancelCodeLast4: sec.codeLast4,
      cancelTokenHash: sec.tokenHash,
      cancelTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 36),
      notes: [row.notes, `${REMINDER_NOTE_PREFIX} ${auth.username} (${new Date().toLocaleString("tr-TR")})`]
        .filter(Boolean)
        .join("\n"),
    },
  });
  const link = buildAppointmentCancelUrl(sec.token, req);
  const when = new Date(updated.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const service = updated.serviceName ?? "Randevu";
  const smsText = `Merhaba ${updated.clientName}, ${when} tarihli "${service}" randevunuz icin teyidinizi rica ederiz. Teyit/iptal: ${link}`;
  const waDigits = phoneDigitsForWaMe(updated.clientPhone);
  const whatsappUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(smsText)}` : null;

  let emailSent = false;
  let emailError: string | null = null;
  const toEmail = updated.clientEmail?.trim();
  if (toEmail) {
    const subject = `${siteName} — Randevu teyit hatırlatması`;
    const text = [
      `Merhaba ${updated.clientName},`,
      "",
      `${when} tarihli "${service}" randevunuz için teyidinizi rica ederiz.`,
      "Aşağıdaki bağlantıdan randevuyu teyit edebilir veya iptal edebilirsiniz:",
      link,
    ].join("\n");
    const sent = await sendTransactionalEmail({ to: toEmail, subject, text });
    if (sent.ok) {
      emailSent = true;
      await prisma.appointmentEvent.create({
        data: {
          tenantId: updated.tenantId,
          appointmentId: updated.id,
          eventType: "reminder_sent",
          channel: "email",
          outcome: "success",
          actor: auth.username,
        },
      });
    } else {
      emailError = sent.error;
      await prisma.appointmentEvent.create({
        data: {
          tenantId: updated.tenantId,
          appointmentId: updated.id,
          eventType: "reminder_sent",
          channel: "email",
          outcome: "failed",
          actor: auth.username,
          detailsJson: JSON.stringify({ error: sent.error }),
        },
      });
    }
  }

  try {
    const tg = await notifyTelegramAppointmentReminder(settings, updated);
    if (!tg.ok && !tg.skipped) {
      console.warn("manual appointment reminder telegram notify", tg.error);
      await prisma.appointmentEvent.create({
        data: {
          tenantId: updated.tenantId,
          appointmentId: updated.id,
          eventType: "reminder_sent",
          channel: "telegram",
          outcome: "failed",
          actor: auth.username,
          detailsJson: JSON.stringify({ error: tg.error }),
        },
      });
    } else {
      await prisma.appointmentEvent.create({
        data: {
          tenantId: updated.tenantId,
          appointmentId: updated.id,
          eventType: "reminder_sent",
          channel: "telegram",
          outcome: "success",
          actor: auth.username,
        },
      });
    }
  } catch (e) {
    console.warn("manual appointment reminder telegram notify", e);
  }

  return NextResponse.json({
    ok: true,
    notifications: {
      emailSent,
      emailError,
      emailSkipped: !toEmail,
      whatsappUrl,
      mailtoUrl: toEmail
        ? `mailto:${toEmail}?subject=${encodeURIComponent(`${siteName} — Randevu teyit hatırlatması`)}&body=${encodeURIComponent(smsText)}`
        : null,
    },
  });
}
