import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
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

  const now = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const result = await sendTransactionalEmail({
    to: parsed.data.to.trim(),
    subject: "SMTP test — Charme Yönetim",
    text: `Bu bir test e-postasıdır.\n\nZaman: ${now}\nGönderen: Yönetim paneli SMTP test aracı`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

