import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";
import { normalizeSitemapChangeFrequency, sitemapExtrasArraySchema } from "@/lib/sitemap-config";

const pageUpdateSchema = z.object({
  id: z.string().min(1),
  includeInSitemap: z.boolean().optional(),
  sitemapPriority: z.number().min(0).max(1).nullable().optional(),
  sitemapChangeFrequency: z.string().min(1).max(32).nullable().optional(),
});

const putBodySchema = z.object({
  sitemapHomePriority: z.number().min(0).max(1).optional(),
  sitemapPagePriority: z.number().min(0).max(1).optional(),
  sitemapExtras: sitemapExtrasArraySchema.optional(),
  pageUpdates: z.array(pageUpdateSchema).max(500).optional(),
});

export async function GET() {
  const auth = await requireStaffApiPerm("content.sitemap");
  if (auth instanceof NextResponse) return auth;

  let settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.siteSettings.create({ data: { id: 1 } });
  }

  const pages = await prisma.page.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      noIndex: true,
      includeInSitemap: true,
      sitemapPriority: true,
      sitemapChangeFrequency: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    sitemapHomePriority: settings.sitemapHomePriority,
    sitemapPagePriority: settings.sitemapPagePriority,
    sitemapExtrasJson: settings.sitemapExtrasJson,
    pages,
  });
}

export async function PUT(req: Request) {
  const auth = await requireStaffApiPerm("content.sitemap");
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek", details: parsed.error.flatten() }, { status: 400 });
  }

  const { sitemapHomePriority, sitemapPagePriority, sitemapExtras, pageUpdates } = parsed.data;

  if (
    sitemapHomePriority === undefined &&
    sitemapPagePriority === undefined &&
    sitemapExtras === undefined &&
    (pageUpdates === undefined || pageUpdates.length === 0)
  ) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  try {
    if (
      sitemapHomePriority !== undefined ||
      sitemapPagePriority !== undefined ||
      sitemapExtras !== undefined
    ) {
      const data: Record<string, unknown> = {};
      if (sitemapHomePriority !== undefined) data.sitemapHomePriority = sitemapHomePriority;
      if (sitemapPagePriority !== undefined) data.sitemapPagePriority = sitemapPagePriority;
      if (sitemapExtras !== undefined) data.sitemapExtrasJson = JSON.stringify(sitemapExtras);
      await prisma.siteSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...data },
        update: data,
      });
    }

    if (pageUpdates && pageUpdates.length > 0) {
      for (const u of pageUpdates) {
        const data: Record<string, unknown> = {};
        if (u.includeInSitemap !== undefined) data.includeInSitemap = u.includeInSitemap;
        if (u.sitemapPriority !== undefined) {
          data.sitemapPriority = u.sitemapPriority === null ? null : u.sitemapPriority;
        }
        if (u.sitemapChangeFrequency !== undefined) {
          if (u.sitemapChangeFrequency === null || u.sitemapChangeFrequency === "") {
            data.sitemapChangeFrequency = null;
          } else {
            const f = normalizeSitemapChangeFrequency(u.sitemapChangeFrequency);
            if (!f) {
              return NextResponse.json(
                { error: `Geçersiz güncelleme sıklığı: ${u.sitemapChangeFrequency}` },
                { status: 400 },
              );
            }
            data.sitemapChangeFrequency = f;
          }
        }
        if (Object.keys(data).length === 0) continue;
        await prisma.page.update({
          where: { id: u.id, tenantId: BOOTSTRAP_TENANT_ID },
          data,
        });
      }
    }

    let settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (!settings) settings = await prisma.siteSettings.create({ data: { id: 1 } });

    const pages = await prisma.page.findMany({
      where: { tenantId: BOOTSTRAP_TENANT_ID },
      orderBy: { slug: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        published: true,
        noIndex: true,
        includeInSitemap: true,
        sitemapPriority: true,
        sitemapChangeFrequency: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      sitemapHomePriority: settings.sitemapHomePriority,
      sitemapPagePriority: settings.sitemapPagePriority,
      sitemapExtrasJson: settings.sitemapExtrasJson,
      pages,
    });
  } catch (e) {
    console.error("admin sitemap PUT", e);
    const msg = e instanceof Error ? e.message : "Veritabanı hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
