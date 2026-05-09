import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    password?: string;
    roleId?: string;
    active?: boolean;
    displayName?: string | null;
  };

  const existing = await prisma.staffUser.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const data: {
    passwordHash?: string;
    roleId?: string;
    active?: boolean;
    displayName?: string | null;
  } = {};

  if (body.password !== undefined) {
    const p = String(body.password);
    if (p.length > 0 && p.length < 8) {
      return NextResponse.json({ error: "Şifre en az 8 karakter olmalı" }, { status: 400 });
    }
    if (p.length >= 8) {
      data.passwordHash = await bcrypt.hash(p, 12);
    }
  }
  if (body.roleId !== undefined) {
    const role = await prisma.staffRole.findFirst({
      where: { id: body.roleId, tenantId: existing.tenantId },
    });
    if (!role) return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
    data.roleId = role.id;
  }
  if (body.active !== undefined) {
    data.active = !!body.active;
  }
  if (body.displayName !== undefined) {
    data.displayName = body.displayName?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const user = await prisma.staffUser.update({
    where: { id },
    data,
    include: { role: true },
  });
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      active: user.active,
      roleId: user.roleId,
      roleSlug: user.role.slug,
      roleLabel: user.role.label,
      createdAt: user.createdAt,
    },
  });
}
