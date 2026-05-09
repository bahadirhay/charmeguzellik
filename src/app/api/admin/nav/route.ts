import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  const items = await prisma.navItem.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const body = (await req.json()) as {
    label?: string;
    href?: string;
    parentId?: string | null;
    published?: boolean;
    openInNewTab?: boolean;
    menuSlug?: string;
  };
  const label = body.label?.trim() || "Yeni menü";
  const href = body.href?.trim() || "/";
  const parentId = body.parentId === undefined ? null : body.parentId;
  const menuSlug = body.menuSlug === "footer" ? "footer" : "header";

  const agg = await prisma.navItem.aggregate({
    where: { tenantId, parentId, menuSlug },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max?.sortOrder ?? -1) + 1;

  const row = await prisma.navItem.create({
    data: {
      tenantId,
      label,
      href,
      parentId,
      menuSlug,
      sortOrder,
      published: body.published ?? true,
      openInNewTab: body.openInNewTab ?? false,
    },
  });
  return NextResponse.json(row);
}
