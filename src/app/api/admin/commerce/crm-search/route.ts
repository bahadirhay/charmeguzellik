import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { normalizePhoneKey } from "@/lib/crm-contact";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ ok: true, items: [] });
  const digits = q.replace(/\D/g, "");
  const phoneKeyEq = normalizePhoneKey(q);
  const items = await prisma.crmContact.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(phoneKeyEq ? [{ phoneKey: phoneKeyEq }] : []),
        ...(digits.length >= 4 ? [{ phoneKey: { contains: digits } }] : []),
      ],
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, phoneKey: true, email: true },
  });
  return NextResponse.json({ ok: true, items });
}
