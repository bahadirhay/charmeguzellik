import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = (await req.json()) as { published?: boolean; sortOrder?: number };
  const data: Record<string, unknown> = {};
  if (body.published !== undefined) data.published = !!body.published;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
  const row = await prisma.siteInstagramPost.update({
    where: { id },
    data: data as { published?: boolean; sortOrder?: number },
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("social.instagram");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  await prisma.siteInstagramPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
