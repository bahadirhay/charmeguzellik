import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    label?: string;
    href?: string;
    published?: boolean;
    openInNewTab?: boolean;
    parentId?: string | null;
    menuSlug?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) data.label = String(body.label);
  if (body.href !== undefined) data.href = String(body.href);
  if (body.published !== undefined) data.published = !!body.published;
  if (body.openInNewTab !== undefined) data.openInNewTab = !!body.openInNewTab;
  if (body.menuSlug !== undefined) {
    data.menuSlug = body.menuSlug === "footer" ? "footer" : "header";
  }
  if (body.parentId !== undefined) {
    if (body.parentId === id) {
      return NextResponse.json({ error: "Öğe kendi üstü olamaz" }, { status: 400 });
    }
    data.parentId = body.parentId;
  }

  const row = await prisma.navItem.update({
    where: { id },
    data,
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("content.nav");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  await prisma.navItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
