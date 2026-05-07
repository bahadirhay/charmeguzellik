import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCancelToken } from "@/lib/appointment-cancel-token";
import { prisma } from "@/lib/prisma";
import { resolveWaDigits } from "@/lib/whatsapp-url";

const schema = z.object({
  token: z.string().min(20).max(200),
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
    return NextResponse.json({ ok: false, error: "Bağlantı geçersiz." }, { status: 400 });
  }

  const { token } = parsed.data;
  const rows = await prisma.appointment.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const appt = rows.find(
    (r) =>
      verifyCancelToken(token, r.cancelTokenHash) &&
      (!r.cancelTokenExpiresAt || r.cancelTokenExpiresAt.getTime() > Date.now()),
  );

  if (!appt) {
    return NextResponse.json({ ok: false, error: "Bağlantı doğrulanamadı veya süresi dolmuş." }, { status: 400 });
  }

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      status: "cancel_request",
      notes: [appt.notes, `Müşteri iptal talebi (bağlantı): ${new Date().toLocaleString("tr-TR")}`]
        .filter(Boolean)
        .join("\n"),
      cancelTokenHash: null,
      cancelTokenExpiresAt: null,
      cancelCodeHash: null,
    },
  });

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const waDigits = resolveWaDigits(settings?.whatsappNumber ?? null);
  const waText = `İptal onayı talebi: ${updated.clientName} - ${new Date(updated.startAt).toLocaleString("tr-TR")} randevumu iptal etmek istiyorum. Lütfen onaylayın.`;
  const whatsappUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : null;

  return NextResponse.json({ ok: true, whatsappUrl });
}
