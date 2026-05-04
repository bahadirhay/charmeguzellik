import { NextResponse } from "next/server";
import {
  extractTiktokVideoIdFromPermalink,
  fetchTiktokOembed,
  normalizeTiktokPermalink,
} from "@/lib/tiktok-url";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

export async function GET() {
  const auth = await requireStaffApiPerm("social.tiktok");
  if (auth instanceof NextResponse) return auth;
  const videos = await prisma.siteTiktokVideo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ videos });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("social.tiktok");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json()) as { permalink?: string };
  const permalink = normalizeTiktokPermalink(body.permalink ?? "");
  if (!permalink) {
    return NextResponse.json(
      { error: "Geçerli bir TikTok paylaşım bağlantısı girin (ör. tiktok.com/@…/video/…)" },
      { status: 400 },
    );
  }
  const existing = await prisma.siteTiktokVideo.findUnique({ where: { permalink } });
  if (existing) {
    return NextResponse.json({ error: "Bu video zaten listede" }, { status: 409 });
  }
  const videoId = extractTiktokVideoIdFromPermalink(permalink);
  const oembed = await fetchTiktokOembed(permalink);
  const agg = await prisma.siteTiktokVideo.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  try {
    const row = await prisma.siteTiktokVideo.create({
      data: {
        permalink,
        videoId,
        thumbnailUrl: oembed?.thumbnail_url ?? null,
        title: oembed?.title ?? null,
        published: false,
        sortOrder,
        source: "manual",
      },
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Kayıt başarısız" }, { status: 500 });
  }
}
