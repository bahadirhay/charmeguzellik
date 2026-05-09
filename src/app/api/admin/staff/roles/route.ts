import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  await ensureDefaultStaffRoles(prisma, tenantId);
  const roles = await prisma.staffRole.findMany({
    where: { tenantId },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json({ roles });
}
