import type { Appointment } from "@prisma/client";
import { phoneDigitsForWaMe } from "@/lib/customer-phone";

export type AppointmentDecision = "approved" | "rejected";
export type AppointmentCancelInfo = {
  cancelCode: string;
  cancelUrl: string;
};

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
  cancelInfo?: AppointmentCancelInfo,
): { whatsappPrefill: string; emailSubject: string; emailText: string } {
  const when = formatStartTr(new Date(row.startAt));
  const svc = row.serviceName?.trim() || "Randevu";
  const name = row.clientName.trim() || "Merhaba";

  if (decision === "approved") {
    /**
     * WhatsApp yalnızca tam adresleri (örn. https://…) otomatik tıklanabilir yapar; “tıklayın” gibi düz yazı için
     * özel bağlantı metni oluşturmak — wa.me/sohbet hazır metnine mümkün değildir.
     * En iyi pratik: *kalın tek satır başlık* + hemen altında yalın URL + kod.
     * @see https://faq.whatsapp.com/539178204879377/
     */
    const waCancelBlock = cancelInfo
      ? `\n\n*Randevunu iptal için tıklayıp kullanacağınız bağlantı*\n${cancelInfo.cancelUrl}\n\n*İptal kodunuz:* ${cancelInfo.cancelCode}\n(Uyarı: kodu paylaşmayın.)`
      : "";

    /** E-posta: kod + bağlantı ayrı satırlarda. */
    const emailCancelBlock = cancelInfo
      ? `\n\nRandevuyu iptal etmek için güvenlik kodunuz: ${cancelInfo.cancelCode}\nİptal bağlantısı:\n${cancelInfo.cancelUrl}\n(Kodu başkalarıyla paylaşmayın.)`
      : "";

    const intro = `Merhaba ${name}, ${siteName} — ${when} tarihindeki "${svc}" randevu talebiniz onaylanmıştır.`;
    const whatsappPrefill = `${intro}${waCancelBlock}\n\nGörüşmek üzere.`;
    const emailSubject = `${siteName} — Randevunuz onaylandı`;
    const emailText = `${intro}${emailCancelBlock}\n\nGörüşmek üzere.\n\nİyi günler,\n${siteName}`;
    return { whatsappPrefill, emailSubject, emailText };
  }

  const body = `Merhaba ${name}, ${siteName} — ${when} tarihindeki "${svc}" randevu talebiniz maalesef uygun bulunmamıştır. Başka bir zaman için iletişime geçebilirsiniz.`;
  const emailSubject = `${siteName} — Randevu talebiniz`;
  const emailText = `${body}\n\nİyi günler,\n${siteName}`;
  return { whatsappPrefill: body, emailSubject, emailText };
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
  cancelInfo?: AppointmentCancelInfo,
): { whatsappUrl: string | null; mailtoUrl: string | null; waDigits: string | null } {
  const { whatsappPrefill, emailSubject, emailText } = buildAppointmentNotifyCopy(row, decision, siteName, cancelInfo);
  const waDigits = phoneDigitsForWaMe(row.clientPhone);
  const whatsappUrl = waDigits ? whatsappUrlToCustomer(waDigits, whatsappPrefill) : null;
  const email = row.clientEmail?.trim();
  const mailtoUrl = email ? mailtoNotifyUrl(email, emailSubject, emailText) : null;
  return { whatsappUrl, mailtoUrl, waDigits };
}
