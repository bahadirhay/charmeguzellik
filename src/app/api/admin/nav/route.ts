import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
  const items = await prisma.navItem.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
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
    where: { tenantId: BOOTSTRAP_TENANT_ID, parentId, menuSlug },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max?.sortOrder ?? -1) + 1;

  const row = await prisma.navItem.create({
    data: {
      tenantId: BOOTSTRAP_TENANT_ID,
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
