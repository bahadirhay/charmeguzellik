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
  const items = await prisma.commerceCommissionRule.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, items });
}

const postSchema = z.object({
  name: z.string().min(1).max(120),
  serviceLabel: z.string().max(200).optional().nullable(),
  percentBps: z.number().int().min(0).max(100_000).optional().nullable(),
  fixedMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
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
  if (
    (parsed.data.percentBps == null || parsed.data.percentBps === 0) &&
    (parsed.data.fixedMinor == null || parsed.data.fixedMinor === 0)
  ) {
    return NextResponse.json({ error: "Yüzde veya sabit tutardan en az biri dolu olmalı" }, { status: 400 });
  }
  const serviceKey = parsed.data.serviceLabel?.trim()
    ? normalizeServiceKey(parsed.data.serviceLabel.trim())
    : null;
  const row = await prisma.commerceCommissionRule.create({
    data: {
      tenantId,
      name: parsed.data.name.trim(),
      serviceKey,
      percentBps: parsed.data.percentBps ?? null,
      fixedMinor: parsed.data.fixedMinor ?? null,
      active: parsed.data.active !== false,
    },
  });
  return NextResponse.json({ ok: true, item: row });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  serviceLabel: z.string().max(200).optional().nullable(),
  percentBps: z.number().int().min(0).max(100_000).optional().nullable(),
  fixedMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz" }, { status: 400 });
  }
  const prev = await prisma.commerceCommissionRule.findFirst({
    where: { id: parsed.data.id, tenantId },
  });
  if (!prev) return NextResponse.json({ error: "Kayıt yok" }, { status: 404 });

  const nextName = parsed.data.name?.trim() ?? prev.name;
  const nextPercent = parsed.data.percentBps === undefined ? prev.percentBps : parsed.data.percentBps;
  const nextFixed = parsed.data.fixedMinor === undefined ? prev.fixedMinor : parsed.data.fixedMinor;
  if (
    (nextPercent == null || nextPercent === 0) &&
    (nextFixed == null || nextFixed === 0)
  ) {
    return NextResponse.json({ error: "Yüzde veya sabit tutardan en az biri sıfırdan büyük olmalı" }, { status: 400 });
  }

  let nextServiceKey: string | null = prev.serviceKey;
  if (parsed.data.serviceLabel !== undefined) {
    nextServiceKey = parsed.data.serviceLabel?.trim()
      ? normalizeServiceKey(parsed.data.serviceLabel.trim())
      : null;
  }

  const row = await prisma.commerceCommissionRule.update({
    where: { id: prev.id },
    data: {
      name: nextName,
      serviceKey: nextServiceKey,
      percentBps: nextPercent,
      fixedMinor: nextFixed,
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
  const prev = await prisma.commerceCommissionRule.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Kayıt yok" }, { status: 404 });
  await prisma.commerceCommissionRule.delete({ where: { id: prev.id } });
  return NextResponse.json({ ok: true });
}
