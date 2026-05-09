import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApi, staffPermDenied } from "@/lib/staff-auth";
import { hasStaffPermission } from "@/lib/staff-permissions";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApi();
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  if (!hasStaffPermission(auth.permissions, "site.settings")) {
    return staffPermDenied();
  }

  const rows = await prisma.cookieConsentLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      decision: true,
      preferencesJson: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      consentKey: true,
    },
  });

  return NextResponse.json({ rows });
}
