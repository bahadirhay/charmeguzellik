import { NextResponse } from "next/server";
import { normalizeInstagramPermalink } from "@/lib/instagram-url";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

export async function GET() {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const posts = await prisma.siteInstagramPost.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json()) as { permalink?: string };
  const permalink = normalizeInstagramPermalink(body.permalink ?? "");
  if (!permalink) {
    return NextResponse.json({ error: "Geçerli bir Instagram bağlantısı girin" }, { status: 400 });
  }
  const agg = await prisma.siteInstagramPost.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  try {
    const row = await prisma.siteInstagramPost.create({
      data: {
        permalink,
        published: false,
        sortOrder,
        source: "manual",
      },
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Bu gönderi zaten listede" }, { status: 409 });
  }
}
