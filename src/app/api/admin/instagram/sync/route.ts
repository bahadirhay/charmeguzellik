import { NextResponse } from "next/server";
import { normalizeInstagramPermalink } from "@/lib/instagram-url";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type GraphMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
};

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const userId = settings?.instagramGraphUserId?.trim();
  const token = settings?.instagramAccessToken?.trim();
  if (!userId || !token) {
    return NextResponse.json(
      { error: "Ayarlar’da Instagram kullanıcı ID ve erişim jetonu tanımlayın" },
      { status: 400 },
    );
  }

  const fields =
    "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";
  const url = new URL(`https://graph.facebook.com/v21.0/${userId}/media`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    data?: GraphMedia[];
    error?: { message?: string };
  };

  if (!res.ok || json.error) {
    return NextResponse.json(
      { error: json.error?.message ?? "Graph API hatası" },
      { status: 502 },
    );
  }

  const items = json.data ?? [];
  let imported = 0;
  const agg = await prisma.siteInstagramPost.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  let nextOrder = (agg._max.sortOrder ?? -1) + 1;

  for (const item of items) {
    const permalink = item.permalink ? normalizeInstagramPermalink(item.permalink) : null;
    if (!permalink) continue;

    const existing = await prisma.siteInstagramPost.findFirst({
      where: {
        tenantId,
        OR: [{ instagramId: item.id }, { permalink }],
      },
    });

    if (existing) {
      await prisma.siteInstagramPost.update({
        where: { id: existing.id },
        data: {
          instagramId: item.id,
          permalink,
          caption: item.caption ?? null,
          mediaUrl: item.media_url ?? null,
          thumbnailUrl: item.thumbnail_url ?? null,
          mediaType: item.media_type ?? null,
          source: "graph",
        },
      });
    } else {
      await prisma.siteInstagramPost.create({
        data: {
          tenantId,
          instagramId: item.id,
          permalink,
          caption: item.caption ?? null,
          mediaUrl: item.media_url ?? null,
          thumbnailUrl: item.thumbnail_url ?? null,
          mediaType: item.media_type ?? null,
          published: false,
          sortOrder: nextOrder++,
          source: "graph",
        },
      });
      imported++;
    }
  }

  return NextResponse.json({
    ok: true,
    totalFromApi: items.length,
    newRows: imported,
    message:
      "Gönderiler güncellendi. Yayınlamak istediklerinizi listeden işaretleyin.",
  });
}
