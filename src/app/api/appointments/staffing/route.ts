import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveServiceStaffMap } from "@/lib/appointment-staffing";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET(req: Request) {
  const tenantId = await getTenantIdForRequest(req);
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { themeTokensJson: true },
  });
  const map = await resolveServiceStaffMap(prisma, settings?.themeTokensJson, tenantId);
  return NextResponse.json({ ok: true, map });
}

