import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyUnlessPlatformProvisioner } from "@/lib/platform-provision-auth";
import type { TenantFeaturesJson } from "@/lib/tenant-features";

const patchSchema = z
  .object({
    appointmentsEnabled: z.boolean().optional(),
    commerceEnabled: z.boolean().optional(),
  })
  .refine((d) => d.appointmentsEnabled !== undefined || d.commerceEnabled !== undefined, {
    message: "appointmentsEnabled veya commerceEnabled gönderin",
  });

type Ctx = { params: Promise<{ tenantId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await denyUnlessPlatformProvisioner(req);
  if (denied) return denied;
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;

  const { tenantId } = await ctx.params;
  if (!tenantId?.trim()) {
    return NextResponse.json({ error: "Geçersiz kiracı" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek", details: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Kiracı bulunamadı" }, { status: 404 });

  const cur = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } });
  const base: TenantFeaturesJson =
    cur?.featuresJson != null && typeof cur.featuresJson === "object" && !Array.isArray(cur.featuresJson)
      ? ({ ...(cur.featuresJson as TenantFeaturesJson) } as TenantFeaturesJson)
      : {};

  const nextJson: TenantFeaturesJson = { ...base };
  if (parsed.data.appointmentsEnabled !== undefined) {
    nextJson.appointments = parsed.data.appointmentsEnabled;
  }
  if (parsed.data.commerceEnabled !== undefined) {
    nextJson.commerce = parsed.data.commerceEnabled;
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { featuresJson: nextJson as object },
  });

  return NextResponse.json({
    ok: true,
    appointmentsEnabled: parsed.data.appointmentsEnabled,
    commerceEnabled: parsed.data.commerceEnabled,
  });
}
