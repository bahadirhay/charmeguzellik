import type { SiteSettings } from "@prisma/client";

/**
 * Virgül / noktalı virgül / satır sonu ile ayrılmış e-posta listesi (admin ayarı veya ENV).
 */
export function parseAppointmentNotifyEmailList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n\r]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 3 && x.includes("@"));
}

function parseSingleEmailFromFromHeader(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const s = raw.trim();
  const m = s.match(/<([^>]+)>/);
  if (m?.[1]) {
    const e = m[1].trim().toLowerCase();
    return e.includes("@") ? [e] : [];
  }
  return parseAppointmentNotifyEmailList(s);
}

/**
 * Yeni randevu talebi için admin + operatör alıcıları: ENV ile veritabanı alanları birleştirilir, tekil.
 */
export function appointmentInboundNotifyRecipients(settings: Pick<
  SiteSettings,
  "appointmentNotifyAdminEmails" | "appointmentNotifyOperatorEmails" | "smtpUser" | "transactionalMailFrom"
> | null): string[] {
  const envAdmin = parseAppointmentNotifyEmailList(process.env.APPOINTMENT_NOTIFY_TO);
  const envOp = parseAppointmentNotifyEmailList(process.env.APPOINTMENT_OPERATOR_NOTIFY_TO);
  const dbAdmin = parseAppointmentNotifyEmailList(settings?.appointmentNotifyAdminEmails);
  const dbOp = parseAppointmentNotifyEmailList(settings?.appointmentNotifyOperatorEmails);
  const smtpUser = parseAppointmentNotifyEmailList(settings?.smtpUser);
  const fromMail = parseSingleEmailFromFromHeader(settings?.transactionalMailFrom);
  return Array.from(new Set([...envAdmin, ...envOp, ...dbAdmin, ...dbOp, ...smtpUser, ...fromMail]));
}
