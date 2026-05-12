import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

const userInclude = {
  roleAssignments: { include: { role: { select: { id: true, slug: true, label: true } } } },
} as const;

function mapUser(u: {
  id: string;
  username: string;
  displayName: string | null;
  active: boolean;
  createdAt: Date;
  roleAssignments: { role: { id: string; slug: string; label: string } }[];
}) {
  const roles = u.roleAssignments.map((a) => a.role);
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    active: u.active,
    roleIds: roles.map((r) => r.id),
    roles,
    rolesSummary: roles.map((r) => r.label).join(", "),
    createdAt: u.createdAt,
  };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    password?: string;
    roleIds?: string[];
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
  if (body.active !== undefined) {
    data.active = !!body.active;
  }
  if (body.displayName !== undefined) {
    data.displayName = body.displayName?.trim() || null;
  }

  const wantsRoleUpdate = body.roleIds !== undefined || body.roleId !== undefined;
  let roleIds: string[] | null = null;
  if (wantsRoleUpdate) {
    const roleIdsRaw = Array.isArray(body.roleIds)
      ? body.roleIds
      : body.roleId?.trim()
        ? [body.roleId.trim()]
        : [];
    roleIds = [...new Set(roleIdsRaw.map((x) => x.trim()).filter(Boolean))];
    if (roleIds.length === 0) {
      return NextResponse.json({ error: "En az bir rol seçili olmalı" }, { status: 400 });
    }
    const roles = await prisma.staffRole.findMany({
      where: { tenantId: existing.tenantId, id: { in: roleIds } },
    });
    if (roles.length !== roleIds.length) {
      return NextResponse.json({ error: "Geçersiz rol seçimi" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0 && !wantsRoleUpdate) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const user = await prisma.$transaction(async (tx) => {
    if (wantsRoleUpdate && roleIds) {
      await tx.staffUserRole.deleteMany({ where: { staffUserId: id } });
      await tx.staffUserRole.createMany({
        data: roleIds.map((roleId) => ({ staffUserId: id, roleId })),
      });
    }
    if (Object.keys(data).length > 0) {
      await tx.staffUser.update({ where: { id }, data });
    }
    return tx.staffUser.findFirstOrThrow({
      where: { id },
      include: userInclude,
    });
  });

  return NextResponse.json({ user: mapUser(user) });
}
