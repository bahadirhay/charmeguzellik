import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
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
  const to = parsed.data.to.trim();

  if (smtpConfigured) {
    try {
      const port = settings?.smtpPort ?? (settings?.smtpSecure ? 465 : 587);
      const secure = settings?.smtpSecure ?? false;
      const transporter = nodemailer.createTransport({
        host: smtpHost!,
        port,
        secure,
        auth: { user: smtpUser!, pass: smtpPass! },
      });
      await transporter.verify();
      const info = await transporter.sendMail({
        from: from!,
        to,
        subject: "SMTP test — Charme Yönetim",
        text: `Bu bir test e-postasıdır.\n\nZaman: ${now}\nGönderen: Yönetim paneli SMTP test aracı`,
      });
      const accepted = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected.map(String) : [];
      const pending = Array.isArray(info.pending) ? info.pending.map(String) : [];
      if (!accepted.length || rejected.length > 0) {
        return NextResponse.json(
          {
            error: `SMTP sunucusu teslimatı kabul etmedi. accepted=${accepted.length}, rejected=${rejected.length}, pending=${pending.length}`,
            detail: { accepted, rejected, pending, response: info.response ?? null, messageId: info.messageId ?? null },
          },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        via: "SMTP",
        detail: {
          accepted,
          rejected,
          pending,
          response: info.response ?? null,
          messageId: info.messageId ?? null,
          note: "SMTP sunucusu kabul etti. Alıcı kutusuna düşme spam/sağlayıcı filtrelerine bağlıdır.",
        },
      });
    } catch (e) {
      return NextResponse.json(
        {
          error: `SMTP test gönderimi başarısız. ${e instanceof Error ? e.message : String(e)}`,
        },
        { status: 400 },
      );
    }
  }

  const result = await sendTransactionalEmail({
    to,
    subject: "SMTP test — Charme Yönetim",
    text: `Bu bir test e-postasıdır.\n\nZaman: ${now}\nGönderen: Yönetim paneli SMTP test aracı`,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Resend test gönderimi başarısız. Detay: ${result.error}` },
      { status: 400 },
    );
  }
  return NextResponse.json({
    ok: true,
    via: "Resend",
    detail: {
      note: "Resend API isteği başarılı. Alıcı kutusuna düşme spam/sağlayıcı filtrelerine bağlıdır.",
    },
  });
}

