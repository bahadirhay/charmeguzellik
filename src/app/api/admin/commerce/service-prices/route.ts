import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { commerceApiJsonError, mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma, withPrismaEngine } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  try {
    const tenantId = await getTenantIdForRequest(req);
    const rows = await withPrismaEngine(() =>
      prisma.commerceServicePrice.findMany({
        where: { tenantId },
        orderBy: { label: "asc" },
      }),
    );
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[service-prices GET]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}

const postSchema = z.object({
  label: z.string().min(1).max(200),
  priceMinor: z.number().int().min(0).max(100_000_000),
  active: z.boolean().optional(),
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
  const label = parsed.data.label.trim();
  const serviceKey = normalizeServiceKey(label);
  try {
    const row = await withPrismaEngine(() =>
      prisma.commerceServicePrice.upsert({
        where: { tenantId_serviceKey: { tenantId, serviceKey } },
        create: {
          tenantId,
          serviceKey,
          label,
          priceMinor: parsed.data.priceMinor,
          active: parsed.data.active !== false,
        },
        update: {
          label,
          priceMinor: parsed.data.priceMinor,
          active: parsed.data.active !== false,
        },
      }),
    );
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[service-prices POST]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
  priceMinor: z.number().int().min(0).max(100_000_000).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request) {
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 400 });
  }
  const prev = await prisma.commerceServicePrice.findFirst({
    where: { id: parsed.data.id, tenantId },
  });
  if (!prev) return NextResponse.json({ error: "Kayıt yok" }, { status: 404 });
  const nextLabel = parsed.data.label?.trim() ?? prev.label;
  const nextKey = normalizeServiceKey(nextLabel);
  if (nextKey !== prev.serviceKey) {
    const clash = await prisma.commerceServicePrice.findUnique({
      where: { tenantId_serviceKey: { tenantId, serviceKey: nextKey } },
    });
    if (clash && clash.id !== prev.id) {
      return NextResponse.json({ error: "Bu hizmet anahtarı zaten kullanılıyor" }, { status: 409 });
    }
  }
  const row = await prisma.commerceServicePrice.update({
    where: { id: prev.id },
    data: {
      label: nextLabel,
      serviceKey: nextKey,
      priceMinor: parsed.data.priceMinor ?? prev.priceMinor,
      active: parsed.data.active ?? prev.active,
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
  const prev = await prisma.commerceServicePrice.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Kayıt yok" }, { status: 404 });
  await prisma.commerceServicePrice.delete({ where: { id: prev.id } });
  return NextResponse.json({ ok: true });
}
