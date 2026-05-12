import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ ok: true, items: [] as const });
  }

  const take = 20;
  const items = await prisma.appointment.findMany({
    where: {
      tenantId,
      OR: [
        { clientName: { contains: q, mode: "insensitive" } },
        { id: { contains: q } },
        { clientPhone: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { startAt: "desc" },
    take,
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      startAt: true,
      serviceName: true,
      quotedPriceMinor: true,
      status: true,
      crmContactId: true,
    },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((a) => ({
      id: a.id,
      clientName: a.clientName,
      clientPhone: a.clientPhone,
      startAt: a.startAt.toISOString(),
      serviceName: a.serviceName,
      quotedPriceMinor: a.quotedPriceMinor,
      status: a.status,
      crmContactId: a.crmContactId,
    })),
  });
}
