import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const crmContactId = new URL(req.url).searchParams.get("crmContactId")?.trim();
  if (!crmContactId) return NextResponse.json({ error: "crmContactId gerekli" }, { status: 400 });
  const contact = await prisma.crmContact.findFirst({
    where: { id: crmContactId, tenantId },
    select: { id: true, name: true, phoneKey: true },
  });
  if (!contact) return NextResponse.json({ error: "Müşteri yok" }, { status: 404 });
  const items = await prisma.commerceCustomerPriceOverride.findMany({
    where: { tenantId, crmContactId },
    orderBy: { serviceKey: "asc" },
  });
  return NextResponse.json({ ok: true, contact, items });
}

const postSchema = z.object({
  crmContactId: z.string().min(1),
  serviceLabel: z.string().min(1).max(200),
  priceMinor: z.number().int().min(0).max(100_000_000),
  note: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
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
  const c = await prisma.crmContact.findFirst({
    where: { id: parsed.data.crmContactId, tenantId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Müşteri yok" }, { status: 404 });
  const serviceKey = normalizeServiceKey(parsed.data.serviceLabel);
  const row = await prisma.commerceCustomerPriceOverride.upsert({
    where: {
      tenantId_crmContactId_serviceKey: {
        tenantId,
        crmContactId: parsed.data.crmContactId,
        serviceKey,
      },
    },
    create: {
      tenantId,
      crmContactId: parsed.data.crmContactId,
      serviceKey,
      priceMinor: parsed.data.priceMinor,
      note: parsed.data.note?.trim() || null,
    },
    update: {
      priceMinor: parsed.data.priceMinor,
      note: parsed.data.note?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, item: row });
}

export async function DELETE(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const prev = await prisma.commerceCustomerPriceOverride.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Kayıt yok" }, { status: 404 });
  await prisma.commerceCustomerPriceOverride.delete({ where: { id: prev.id } });
  return NextResponse.json({ ok: true });
}
