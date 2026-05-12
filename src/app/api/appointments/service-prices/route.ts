import { NextResponse } from "next/server";
import { z } from "zod";
import { resolvePricesForLabels } from "@/lib/commerce/resolve-prices";
import { normalizePhoneKey } from "@/lib/crm-contact";
import { prisma } from "@/lib/prisma";
import { denyIfAppointmentsDisabled } from "@/lib/appointments-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";

const postSchema = z.object({
  labels: z.array(z.string().max(200)).max(80),
  phone: z.string().max(32).optional().nullable(),
});

/** Randevu formu: hizmet etiketleri için genel + (telefon eşleşirse) müşteri özel fiyat */
export async function POST(req: Request) {
  const apptForbidden = await denyIfAppointmentsDisabled(req);
  if (apptForbidden) return apptForbidden;
  const tenantId = await getTenantIdForRequest(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Geçersiz alanlar" }, { status: 400 });
  }
  const { labels, phone } = parsed.data;
  let crmContactId: string | null = null;
  if (phone?.trim()) {
    const pk = normalizePhoneKey(phone);
    if (pk) {
      const c = await prisma.crmContact.findUnique({
        where: { tenantId_phoneKey: { tenantId, phoneKey: pk } },
        select: { id: true },
      });
      crmContactId = c?.id ?? null;
    }
  }
  const prices = await resolvePricesForLabels(prisma, tenantId, labels, crmContactId);
  return NextResponse.json({ ok: true, prices, crmMatched: Boolean(crmContactId) });
}
