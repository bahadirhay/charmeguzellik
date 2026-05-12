import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const lineSchema = z.object({
  serviceLabel: z.string().min(1).max(200),
  sessions: z.number().int().min(1).max(999),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  listPriceMinor: z.number().int().min(0).max(100_000_000).optional(),
  validityDays: z.number().int().min(1).max(3650).optional().nullable(),
  active: z.boolean().optional(),
  lines: z.array(lineSchema).min(1).max(40).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
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
  const prev = await prisma.commercePackageTemplate.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Paket şablonu yok" }, { status: 404 });

  const nextName = parsed.data.name?.trim() ?? prev.name;
  const nameClash = await prisma.commercePackageTemplate.findFirst({
    where: { tenantId, name: nextName, NOT: { id: prev.id } },
    select: { id: true },
  });
  if (nameClash) {
    return NextResponse.json(
      { ok: false, error: "Bu paket adı bu işletmede zaten kullanılıyor" },
      { status: 409 },
    );
  }

  const tpl = await prisma.$transaction(async (tx) => {
    if (parsed.data.lines?.length) {
      await tx.commercePackageTemplateLine.deleteMany({ where: { templateId: id } });
    }
    const updated = await tx.commercePackageTemplate.update({
      where: { id: prev.id },
      data: {
        name: nextName,
        listPriceMinor: parsed.data.listPriceMinor ?? prev.listPriceMinor,
        validityDays:
          parsed.data.validityDays === undefined ? prev.validityDays : parsed.data.validityDays,
        active: parsed.data.active ?? prev.active,
      },
    });
    if (parsed.data.lines?.length) {
      await tx.commercePackageTemplateLine.createMany({
        data: parsed.data.lines.map((l) => ({
          templateId: updated.id,
          serviceKey: normalizeServiceKey(l.serviceLabel),
          sessions: l.sessions,
        })),
      });
    }
    return tx.commercePackageTemplate.findFirstOrThrow({
      where: { id: updated.id },
      include: { lines: true },
    });
  });
  return NextResponse.json({ ok: true, item: tpl });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  const prev = await prisma.commercePackageTemplate.findFirst({ where: { id, tenantId } });
  if (!prev) return NextResponse.json({ error: "Paket şablonu yok" }, { status: 404 });
  await prisma.commercePackageTemplate.delete({ where: { id: prev.id } });
  return NextResponse.json({ ok: true });
}
