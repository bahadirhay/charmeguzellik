import { NextResponse } from "next/server";
import { normalizePhoneKey } from "@/lib/crm-contact";
import { prisma } from "@/lib/prisma";

/** Randevu formu: kayıtlı telefon için ad / e-posta önerisi (yalnız okuma) */
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone?.trim()) {
    return NextResponse.json({ ok: true, found: false });
  }
  const phoneKey = normalizePhoneKey(phone);
  if (!phoneKey) {
    return NextResponse.json({ ok: true, found: false });
  }
  const row = await prisma.crmContact.findUnique({
    where: { phoneKey },
    select: { name: true, email: true },
  });
  if (!row) {
    return NextResponse.json({ ok: true, found: false });
  }
  return NextResponse.json({
    ok: true,
    found: true,
    clientName: row.name,
    clientEmail: row.email,
  });
}
