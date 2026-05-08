import { NextResponse } from "next/server";
import { normalizePhoneKey } from "@/lib/crm-contact";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

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
    where: { tenantId_phoneKey: { tenantId: BOOTSTRAP_TENANT_ID, phoneKey } },
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
