import nodemailer from "nodemailer";
import { getSiteSettingsForTenant } from "@/lib/site-settings";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { sendViaResend } from "@/lib/resend-mail";

/**
 * Önce kiracının SiteSettings SMTP'si; eksikse Resend (.env RESEND_API_KEY + MAIL_FROM).
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
  /** Yoksa Host’tan kiracı çözülür; iptal/teyit bağlantılarında randevunun tenantId verin. */
  tenantId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = opts.to.trim();
  if (!to) return { ok: false, error: "Alıcı yok" };

  const tenantId = opts.tenantId ?? (await getTenantIdForRequest());
  const settings = await getSiteSettingsForTenant(tenantId);
  const host = settings?.smtpHost?.trim();
  const user = settings?.smtpUser?.trim();
  const pass = settings?.smtpPass?.trim();
  const fromDb = settings?.transactionalMailFrom?.trim();
  const fromEnv = process.env.MAIL_FROM?.trim();
  const from = fromDb || fromEnv;

  if (host && user && pass && from) {
    const port = settings?.smtpPort ?? (settings?.smtpSecure ? 465 : 587);
    const secure = settings?.smtpSecure ?? false;
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from,
        to,
        subject: opts.subject,
        text: opts.text,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string }).code ?? "";
      const responseCode = (e as { responseCode?: number }).responseCode;
      const response = (e as { response?: string }).response ?? "";
      const lower = `${msg} ${response}`.toLowerCase();
      const smtpRateLimited =
        responseCode === 452 ||
        code === "EMESSAGE" ||
        lower.includes("452") ||
        lower.includes("maximum number of sent messages is exceeded") ||
        lower.includes("rate limit");

      if (smtpRateLimited) {
        const fallback = await sendViaResend({
          subject: opts.subject,
          text: opts.text,
          to,
          from: fromDb || fromEnv,
        });
        if (fallback.ok) {
          console.warn("SMTP 452/rate-limit algılandı; Resend fallback ile gönderildi.");
          return { ok: true };
        }
        return {
          ok: false,
          error: `SMTP limiti aşıldı (${msg}). Resend fallback da başarısız: ${fallback.error}`,
        };
      }

      return { ok: false, error: msg };
    }
  }

  return sendViaResend({ subject: opts.subject, text: opts.text, to, from: fromDb || fromEnv });
}
