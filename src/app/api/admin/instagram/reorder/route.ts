import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function PUT(req: Request) {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const body = (await req.json()) as { orderedIds?: string[] };
  const ids = body.orderedIds;
  if (!ids?.length) {
    return NextResponse.json({ error: "orderedIds gerekli" }, { status: 400 });
  }
  const all = await prisma.siteInstagramPost.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const set = new Set(all.map((a) => a.id));
  if (!ids.every((i) => set.has(i)) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Geçersiz veya yinelenen gönderi kimliği" }, { status: 400 });
  }
  /** İstemci eski liste gönderirse (ör. başka sekmede yeni içe aktarma) eksik id’leri sona ekle */
  const seen = new Set(ids);
  const merged = [...ids, ...all.map((a) => a.id).filter((id) => !seen.has(id))];
  await prisma.$transaction(
    merged.map((id, index) =>
      prisma.siteInstagramPost.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
