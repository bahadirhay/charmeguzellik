import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveServiceStaffMap } from "@/lib/appointment-staffing";
import { getSiteSettingsForTenant } from "@/lib/site-settings";
import { denyIfAppointmentsDisabled } from "@/lib/appointments-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET(req: Request) {
  const apptForbidden = await denyIfAppointmentsDisabled(req);
  if (apptForbidden) return apptForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const settings = await getSiteSettingsForTenant(tenantId);
  const map = await resolveServiceStaffMap(prisma, settings.themeTokensJson, tenantId);
  return NextResponse.json({ ok: true, map });
}

