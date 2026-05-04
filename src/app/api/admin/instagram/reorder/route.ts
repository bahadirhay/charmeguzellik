import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

export async function PUT(req: Request) {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json()) as { orderedIds?: string[] };
  const ids = body.orderedIds;
  if (!ids?.length) {
    return NextResponse.json({ error: "orderedIds gerekli" }, { status: 400 });
  }
  const all = await prisma.siteInstagramPost.findMany({ select: { id: true } });
  const set = new Set(all.map((a) => a.id));
  if (ids.length !== all.length || !ids.every((i) => set.has(i))) {
    return NextResponse.json({ error: "Tüm satırlar gerekli" }, { status: 400 });
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.siteInstagramPost.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
