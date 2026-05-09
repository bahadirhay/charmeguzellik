import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function PUT(req: Request) {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const body = (await req.json()) as { parentId?: string | null; orderedIds?: string[] };
  const parentId = body.parentId === undefined ? null : body.parentId;
  const ids = body.orderedIds;
  if (!ids?.length) {
    return NextResponse.json({ error: "orderedIds gerekli" }, { status: 400 });
  }

  const first = await prisma.navItem.findUnique({ where: { id: ids[0]! }, select: { menuSlug: true } });
  if (!first) {
    return NextResponse.json({ error: "Geçersiz öğe" }, { status: 400 });
  }
  const menuSlug = first.menuSlug;

  const siblings = await prisma.navItem.findMany({
    where: { tenantId, parentId, menuSlug },
    select: { id: true },
  });
  const set = new Set(siblings.map((s) => s.id));
  if (ids.length !== siblings.length || !ids.every((i) => set.has(i))) {
    return NextResponse.json({ error: "Aynı üst öğedeki tüm satırları gönderin" }, { status: 400 });
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.navItem.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
