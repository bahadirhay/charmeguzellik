import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("social.youtube");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = (await req.json()) as { published?: boolean; sortOrder?: number; title?: string | null };
  const data: Record<string, unknown> = {};
  if (body.published !== undefined) data.published = !!body.published;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
  if (body.title !== undefined) data.title = body.title;
  const row = await prisma.siteYoutubeVideo.update({
    where: { id },
    data: data as { published?: boolean; sortOrder?: number; title?: string | null },
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("social.youtube");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  await prisma.siteYoutubeVideo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
