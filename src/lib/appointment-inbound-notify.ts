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

/**
 * Yeni randevu talebi için admin + operatör alıcıları: ENV ile veritabanı alanları birleştirilir, tekil.
 */
export function appointmentInboundNotifyRecipients(settings: Pick<
  SiteSettings,
  "appointmentNotifyAdminEmails" | "appointmentNotifyOperatorEmails"
> | null): string[] {
  const envAdmin = parseAppointmentNotifyEmailList(process.env.APPOINTMENT_NOTIFY_TO);
  const envOp = parseAppointmentNotifyEmailList(process.env.APPOINTMENT_OPERATOR_NOTIFY_TO);
  const dbAdmin = parseAppointmentNotifyEmailList(settings?.appointmentNotifyAdminEmails);
  const dbOp = parseAppointmentNotifyEmailList(settings?.appointmentNotifyOperatorEmails);
  return Array.from(new Set([...envAdmin, ...envOp, ...dbAdmin, ...dbOp]));
}
