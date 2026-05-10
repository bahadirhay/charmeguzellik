import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAppointmentsModuleEnabled } from "@/lib/tenant-features";
import { getTenantIdForRequest } from "@/lib/tenant-db";

const MSG = "Bu site için randevu modülü kapalıdır.";

/** Public / admin randevu API’leri: modül kapalıysa 403. */
export async function denyIfAppointmentsDisabled(req?: Request): Promise<NextResponse | null> {
  const tenantId = await getTenantIdForRequest(req);
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } });
  if (isAppointmentsModuleEnabled(t?.featuresJson)) return null;
  return NextResponse.json({ error: MSG }, { status: 403 });
}
