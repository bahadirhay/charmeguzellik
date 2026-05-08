import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  await ensureDefaultStaffRoles(prisma);
  const roles = await prisma.staffRole.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json({ roles });
}
