import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { appointmentInboundNotifyRecipients } from "@/lib/appointment-inbound-notify";
import { getSiteSettings } from "@/lib/site-settings";
import { sendTransactionalEmail } from "@/lib/transactional-email";

export async function POST() {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

  const settings = await getSiteSettings();
  const recipients = appointmentInboundNotifyRecipients(settings);
  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          "Randevu bildirimi alıcısı yok. Ayarlardaki admin/operatör e-postaları veya ENV APPOINTMENT_NOTIFY_TO / APPOINTMENT_OPERATOR_NOTIFY_TO tanımlayın.",
      },
      { status: 400 },
    );
  }

  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const subject = "Test: Yeni randevu bildirimi";
  const text = [
    "Bu bir test bildirimidir.",
    "",
    "Gerçek bir randevu kaydı oluşturulmamıştır.",
    `Test zamanı: ${now}`,
    "",
    "Amaç: yeni randevu e-posta bildirimlerinin teslimatını doğrulamak.",
  ].join("\n");

  const results = await Promise.all(
    recipients.map(async (to) => {
      const r = await sendTransactionalEmail({ to, subject, text });
      return { to, ok: r.ok, error: r.ok ? null : r.error };
    }),
  );

  const sent = results.filter((x) => x.ok).length;
  const failed = results.filter((x) => !x.ok);
  if (sent === 0) {
    return NextResponse.json(
      {
        error: "Test bildirimi hiçbir alıcıya gönderilemedi.",
        detail: { recipients: recipients.length, sent, failed },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    detail: { recipients: recipients.length, sent, failed },
  });
}

