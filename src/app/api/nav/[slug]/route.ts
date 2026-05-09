import { NextResponse } from "next/server";
import { buildNavTree } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";

const ALLOWED = new Set(["header", "footer"]);

type Ctx = { params: Promise<{ slug: string }> };

/** Yayınlanmış menü (salt okunur) — önizleme ve genel kullanım */
export async function GET(_req: Request, ctx: Ctx) {
  const tenantId = await getTenantIdForRequest();
  const { slug } = await ctx.params;
  if (!ALLOWED.has(slug)) {
    return NextResponse.json({ error: "Geçersiz menü" }, { status: 404 });
  }
  const items = await prisma.navItem.findMany({
    where: { tenantId, published: true, menuSlug: slug },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const nodes = buildNavTree(items);
  return NextResponse.json({ nodes }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
