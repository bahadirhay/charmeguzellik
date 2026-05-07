import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";

const schema = z.object({
  to: z.string().email("Geçerli bir e-posta adresi girin."),
});

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Geçersiz e-posta adresi.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const smtpHost = settings?.smtpHost?.trim();
  const smtpUser = settings?.smtpUser?.trim();
  const smtpPass = settings?.smtpPass?.trim();
  const fromDb = settings?.transactionalMailFrom?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEnv = process.env.MAIL_FROM?.trim();
  const from = fromDb || fromEnv;

  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && from);
  const resendConfigured = Boolean(resendKey && fromEnv);
  if (!smtpConfigured && !resendConfigured) {
    const details = [
      `SMTP host: ${smtpHost ? "ok" : "eksik"}`,
      `SMTP kullanıcı: ${smtpUser ? "ok" : "eksik"}`,
      `SMTP şifre: ${smtpPass ? "ok" : "eksik"}`,
      `Gönderen (From): ${from ? "ok" : "eksik"}`,
      `RESEND_API_KEY: ${resendKey ? "ok" : "eksik"}`,
      `MAIL_FROM: ${fromEnv ? "ok" : "eksik"}`,
    ].join(" | ");
    return NextResponse.json(
      {
        error: `Gönderim yapılandırması eksik. ${details}`,
      },
      { status: 400 },
    );
  }

  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const result = await sendTransactionalEmail({
    to: parsed.data.to.trim(),
    subject: "SMTP test — Charme Yönetim",
    text: `Bu bir test e-postasıdır.\n\nZaman: ${now}\nGönderen: Yönetim paneli SMTP test aracı`,
  });

  if (!result.ok) {
    const channel = smtpConfigured ? "SMTP" : "Resend";
    const fromHint = from ? `From: ${from}` : "From eksik";
    return NextResponse.json(
      { error: `${channel} test gönderimi başarısız. ${fromHint}. Detay: ${result.error}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, via: smtpConfigured ? "SMTP" : "Resend" });
}

