import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  await ensureDefaultStaffRoles(prisma, tenantId);
  const users = await prisma.staffUser.findMany({
    where: { tenantId },
    include: { role: true },
    orderBy: { username: "asc" },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      active: u.active,
      roleId: u.roleId,
      roleSlug: u.role.slug,
      roleLabel: u.role.label,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  await ensureDefaultStaffRoles(prisma, tenantId);
  const body = (await req.json()) as {
    username?: string;
    password?: string;
    roleId?: string;
    displayName?: string | null;
  };
  const username = body.username?.trim().toLowerCase().replace(/\s+/g, "");
  const password = body.password ?? "";
  const roleId = body.roleId?.trim();
  if (!username || username.length < 2) {
    return NextResponse.json({ error: "Kullanıcı adı en az 2 karakter olmalı" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalı" }, { status: 400 });
  }
  if (!roleId) {
    return NextResponse.json({ error: "Rol seçin" }, { status: 400 });
  }
  const role = await prisma.staffRole.findFirst({
    where: { id: roleId, tenantId },
  });
  if (!role) {
    return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.staffUser.create({
      data: {
        tenantId,
        username,
        passwordHash: hash,
        displayName: body.displayName?.trim() || null,
        roleId: role.id,
      },
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
  } catch {
    return NextResponse.json({ error: "Bu kullanıcı adı kullanılıyor" }, { status: 409 });
  }
}
