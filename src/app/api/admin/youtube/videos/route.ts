import { NextResponse } from "next/server";
import { extractYoutubeVideoId, youtubeWatchUrl } from "@/lib/youtube-url";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiPerm("social.youtube");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  const videos = await prisma.siteYoutubeVideo.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ videos });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("social.youtube");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const body = (await req.json()) as { url?: string };
  const videoId = extractYoutubeVideoId(body.url ?? "");
  if (!videoId) {
    return NextResponse.json(
      { error: "Geçerli bir YouTube bağlantısı veya video kimliği girin (watch, shorts, youtu.be)" },
      { status: 400 },
    );
  }
  const existing = await prisma.siteYoutubeVideo.findUnique({
    where: { tenantId_videoId: { tenantId, videoId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Bu video zaten listede" }, { status: 409 });
  }
  const agg = await prisma.siteYoutubeVideo.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  try {
    const row = await prisma.siteYoutubeVideo.create({
      data: {
        tenantId,
        videoId,
        watchUrl: youtubeWatchUrl(videoId),
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
