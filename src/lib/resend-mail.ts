/**
 * E-posta: Resend HTTP API (https://resend.com/docs/send-with-nodejs)
 * .env: RESEND_API_KEY, MAIL_FROM="Charme <onboarding@resend.dev>" veya doğrulanmış domain
 */
import { prisma } from "@/lib/prisma";

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const fromEnv = process.env.MAIL_FROM?.trim();
  let from = fromEnv;
  if (!from) {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { transactionalMailFrom: true },
    });
    from = settings?.transactionalMailFrom?.trim() || "";
  }
  if (!key || !from) {
    return { ok: false, error: "RESEND_API_KEY veya gonderen e-posta (MAIL_FROM / transactionalMailFrom) tanımlı değil" };
  }
  const to = opts.to.trim();
  if (!to) return { ok: false, error: "Alıcı yok" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: opts.subject,
      text: opts.text,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(raw) as { message?: string };
      if (typeof j.message === "string") msg = j.message;
    } catch {
      if (raw) msg = raw.slice(0, 200);
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}
