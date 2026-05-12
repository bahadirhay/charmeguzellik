import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import type { TenantFeaturesJson } from "@/lib/tenant-features";

const patchSchema = z
  .object({
    appointmentsEnabled: z.boolean().optional(),
    commerceEnabled: z.boolean().optional(),
  })
  .refine((d) => d.appointmentsEnabled !== undefined || d.commerceEnabled !== undefined, {
    message: "appointmentsEnabled veya commerceEnabled gönderin",
  });

export async function PATCH(req: Request) {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

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

  const tenantId = await getTenantIdForRequest(req);

  const cur = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } });
  const base =
    cur?.featuresJson != null &&
    typeof cur.featuresJson === "object" &&
    !Array.isArray(cur.featuresJson)
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
