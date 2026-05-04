import { NextResponse } from "next/server";
import { blocksArraySchema } from "@/lib/blocks/schema";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("content.pages");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(page);
}

export async function PUT(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("content.pages");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    blocks?: unknown;
    blocksMobile?: unknown | null;
    title?: string;
    slug?: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
    published?: boolean;
    noIndex?: boolean;
    canonicalPath?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (body.blocks !== undefined) {
    const parsed = blocksArraySchema.safeParse(body.blocks);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz blok verisi" }, { status: 400 });
    }
    data.blocks = JSON.stringify(parsed.data);
  }
  if (body.blocksMobile !== undefined) {
    if (body.blocksMobile === null) {
      data.blocksMobile = null;
    } else {
      const parsed = blocksArraySchema.safeParse(body.blocksMobile);
      if (!parsed.success) {
        return NextResponse.json({ error: "Geçersiz mobil blok verisi" }, { status: 400 });
      }
      data.blocksMobile = JSON.stringify(parsed.data);
    }
  }
  if (body.title !== undefined) data.title = String(body.title);
  if (body.slug !== undefined) {
    const existing = await prisma.page.findUnique({ where: { id } });
    if (existing?.slug === "home" && body.slug !== "home") {
      return NextResponse.json({ error: "Ana sayfa slug home olmalı" }, { status: 400 });
    }
    data.slug = String(body.slug);
  }
  if (body.metaTitle !== undefined) data.metaTitle = body.metaTitle;
  if (body.metaDescription !== undefined) data.metaDescription = body.metaDescription;
  if (body.published !== undefined) data.published = body.published;
  if (body.noIndex !== undefined) data.noIndex = body.noIndex;
  if (body.canonicalPath !== undefined) data.canonicalPath = body.canonicalPath;

  const page = await prisma.page.update({
    where: { id },
    data,
  });
  return NextResponse.json(page);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("content.pages");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (existing.slug === "home") {
    return NextResponse.json({ error: "Ana sayfa silinemez" }, { status: 400 });
  }
  await prisma.page.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
