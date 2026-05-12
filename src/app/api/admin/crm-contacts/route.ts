import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiAny } from "@/lib/admin-api-auth";
import { normalizePhoneKey, upsertCrmContactForAppointment } from "@/lib/crm-contact";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(40),
  email: z
    .union([z.literal(""), z.string().email().max(200)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

/**
 * CRM müşteri kartı oluşturur veya aynı telefonda günceller (randevu / ticaret akışları için).
 */
export async function POST(req: Request) {
  const auth = await requireStaffApiAny(["commerce.manage", "crm.appointments"]);
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz" }, { status: 400 });
  }
  const phoneKey = normalizePhoneKey(parsed.data.phone);
  if (!phoneKey) {
    return NextResponse.json(
      { error: "Geçerli bir telefon girin (örn. 05xx xxx xx xx veya 5xx…)" },
      { status: 400 },
    );
  }
  const contact = await upsertCrmContactForAppointment(prisma, {
    tenantId,
    phoneKey,
    name: parsed.data.name.trim(),
    email: parsed.data.email?.trim() || null,
  });
  return NextResponse.json({
    ok: true as const,
    contact: { id: contact.id, name: contact.name, phoneKey: contact.phoneKey, email: contact.email },
  });
}
