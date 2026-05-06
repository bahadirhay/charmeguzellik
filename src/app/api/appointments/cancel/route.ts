import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCancelCode, verifyCancelToken } from "@/lib/appointment-cancel-token";
import { prisma } from "@/lib/prisma";
import { resolveWaDigits } from "@/lib/whatsapp-url";

const schema = z.object({
  token: z.string().min(20).max(200),
  code: z.string().min(4).max(12),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Kod veya bağlantı geçersiz." }, { status: 400 });
  }

  const { token, code } = parsed.data;
  const rows = await prisma.appointment.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const appt = rows.find(
    (r) =>
      verifyCancelToken(token, r.cancelTokenHash) &&
      verifyCancelCode(code, r.cancelCodeHash) &&
      (!r.cancelTokenExpiresAt || r.cancelTokenExpiresAt.getTime() > Date.now()),
  );

  if (!appt) {
    return NextResponse.json({ ok: false, error: "Kod doğrulanamadı veya süresi dolmuş." }, { status: 400 });
  }

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      status: "cancelled",
      notes: [appt.notes, `Müşteri iptal (kodlu): ${new Date().toLocaleString("tr-TR")}`]
        .filter(Boolean)
        .join("\n"),
      cancelTokenHash: null,
      cancelTokenExpiresAt: null,
      cancelCodeHash: null,
    },
  });

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const waDigits = resolveWaDigits(settings?.whatsappNumber ?? null);
  const waText = `İptal onayı: ${updated.clientName} - ${new Date(updated.startAt).toLocaleString("tr-TR")} randevumu kod ile iptal ettim.`;
  const whatsappUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : null;

  return NextResponse.json({ ok: true, whatsappUrl });
}
