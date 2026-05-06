import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("crm.appointments");
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const body = (await req.json()) as { name?: string; email?: string | null };

  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  if (!nameRaw) {
    return NextResponse.json({ error: "Ad boş olamaz." }, { status: 400 });
  }

  const contact = await prisma.crmContact.update({
    where: { id },
    data: {
      name: nameRaw,
      email: typeof body.email === "string" ? body.email.trim() || null : null,
    },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("crm.appointments");
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  await prisma.crmContact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
