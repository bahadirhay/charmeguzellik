import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { sendViaResend } from "@/lib/resend-mail";

/**
 * Önce SiteSettings SMTP; eksikse Resend (.env RESEND_API_KEY + MAIL_FROM).
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = opts.to.trim();
  if (!to) return { ok: false, error: "Alıcı yok" };

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
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
      return { ok: false, error: msg };
    }
  }

  return sendViaResend({ ...opts, to });
}
