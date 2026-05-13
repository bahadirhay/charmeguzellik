import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyUnlessPlatformProvisioner } from "@/lib/platform-provision-auth";
import type { TenantFeaturesJson } from "@/lib/tenant-features";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";
import {
  parseModuleUnlockHashes,
  verifyModuleUnlockPlain,
} from "@/lib/tenant-module-unlock";

const patchSchema = z
  .object({
    appointmentsEnabled: z.boolean().optional(),
    commerceEnabled: z.boolean().optional(),
    appointmentsUnlockToken: z.string().optional(),
    commerceUnlockToken: z.string().optional(),
  })
  .refine((d) => d.appointmentsEnabled !== undefined || d.commerceEnabled !== undefined, {
    message: "appointmentsEnabled veya commerceEnabled gönderin",
  });

async function assertUnlockForTurningOn(
  hashes: ReturnType<typeof parseModuleUnlockHashes>,
  module: "commerce" | "appointments",
  token: string | undefined,
): Promise<NextResponse | null> {
  const hash = module === "commerce" ? hashes.commerce : hashes.appointments;
  if (!hash) {
    return NextResponse.json(
      {
        error:
          "Önce bu kiracı için güvenlik anahtarları oluşturulmalı (kiracı oluşturma yanıtı veya Site modülleri → anahtar oluştur).",
        code: "MODULE_UNLOCK_KEYS_MISSING",
        module,
      },
      { status: 400 },
    );
  }
  if (!(await verifyModuleUnlockPlain(token, hash))) {
    return NextResponse.json(
      { error: "Geçersiz veya eksik güvenlik anahtarı.", code: "UNLOCK_TOKEN_REQUIRED", module },
      { status: 403 },
    );
  }
  return null;
}

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

  const curRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featuresJson: true, moduleUnlockHashes: true },
  });
  const hashes = parseModuleUnlockHashes(curRow?.moduleUnlockHashes);
  const base: TenantFeaturesJson =
    curRow?.featuresJson != null && typeof curRow.featuresJson === "object" && !Array.isArray(curRow.featuresJson)
      ? ({ ...(curRow.featuresJson as TenantFeaturesJson) } as TenantFeaturesJson)
      : {};

  const curCommerce = isCommerceModuleEnabled(curRow?.featuresJson);
  const curAppt = isAppointmentsModuleEnabled(curRow?.featuresJson);

  if (parsed.data.commerceEnabled === true && !curCommerce) {
    const err = await assertUnlockForTurningOn(hashes, "commerce", parsed.data.commerceUnlockToken);
    if (err) return err;
  }
  if (parsed.data.appointmentsEnabled === true && !curAppt) {
    const err = await assertUnlockForTurningOn(hashes, "appointments", parsed.data.appointmentsUnlockToken);
    if (err) return err;
  }

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
