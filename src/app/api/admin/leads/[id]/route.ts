import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("crm.leads");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: string; notes?: string | null };
  const prev = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!prev) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });
  return NextResponse.json(lead);
}
