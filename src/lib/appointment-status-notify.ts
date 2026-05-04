import type { Appointment } from "@prisma/client";
import { phoneDigitsForWaMe } from "@/lib/customer-phone";

export type AppointmentDecision = "approved" | "rejected";

function formatStartTr(startAt: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(startAt);
}

export function buildAppointmentNotifyCopy(
  row: Pick<Appointment, "clientName" | "serviceName" | "startAt">,
  decision: AppointmentDecision,
  siteName: string,
): { smsText: string; emailSubject: string; emailText: string } {
  const when = formatStartTr(new Date(row.startAt));
  const svc = row.serviceName?.trim() || "Randevu";
  const name = row.clientName.trim() || "Merhaba";

  if (decision === "approved") {
    const smsText = `Merhaba ${name}, ${siteName} — ${when} tarihindeki "${svc}" randevu talebiniz onaylanmıştır. Görüşmek üzere.`;
    const emailSubject = `${siteName} — Randevunuz onaylandı`;
    const emailText = `${smsText}\n\nİyi günler,\n${siteName}`;
    return { smsText, emailSubject, emailText };
  }
  const smsText = `Merhaba ${name}, ${siteName} — ${when} tarihindeki "${svc}" randevu talebiniz maalesef uygun bulunmamıştır. Başka bir zaman için iletişime geçebilirsiniz.`;
  const emailSubject = `${siteName} — Randevu talebiniz`;
  const emailText = `${smsText}\n\nİyi günler,\n${siteName}`;
  return { smsText, emailSubject, emailText };
}

export function whatsappUrlToCustomer(phoneDigits: string, text: string): string {
  const q = text.trim() ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${phoneDigits}${q}`;
}

export function mailtoNotifyUrl(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildNotifyLinks(
  row: Pick<Appointment, "clientName" | "clientPhone" | "clientEmail" | "serviceName" | "startAt">,
  decision: AppointmentDecision,
  siteName: string,
): { whatsappUrl: string | null; mailtoUrl: string | null; waDigits: string | null } {
  const { smsText, emailSubject, emailText } = buildAppointmentNotifyCopy(row, decision, siteName);
  const waDigits = phoneDigitsForWaMe(row.clientPhone);
  const whatsappUrl = waDigits ? whatsappUrlToCustomer(waDigits, smsText) : null;
  const email = row.clientEmail?.trim();
  const mailtoUrl = email ? mailtoNotifyUrl(email, emailSubject, emailText) : null;
  return { whatsappUrl, mailtoUrl, waDigits };
}
