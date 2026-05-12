import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { getTenantIdForRequest } from "@/lib/tenant-db";

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

export async function GET() {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  await ensureDefaultStaffRoles(prisma, tenantId);
  const users = await prisma.staffUser.findMany({
    where: { tenantId },
    include: userInclude,
    orderBy: { username: "asc" },
  });
  return NextResponse.json({
    users: users.map((u) => mapUser(u)),
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
    roleIds?: string[];
    /** Geriye uyumluluk: tek rol */
    roleId?: string;
    displayName?: string | null;
  };
  const username = body.username?.trim().toLowerCase().replace(/\s+/g, "");
  const password = body.password ?? "";
  const roleIdsRaw = Array.isArray(body.roleIds)
    ? body.roleIds
    : body.roleId?.trim()
      ? [body.roleId.trim()]
      : [];
  const roleIds = [...new Set(roleIdsRaw.map((id) => id.trim()).filter(Boolean))];
  if (!username || username.length < 2) {
    return NextResponse.json({ error: "Kullanıcı adı en az 2 karakter olmalı" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalı" }, { status: 400 });
  }
  if (roleIds.length === 0) {
    return NextResponse.json({ error: "En az bir rol seçin" }, { status: 400 });
  }
  const roles = await prisma.staffRole.findMany({
    where: { tenantId, id: { in: roleIds } },
  });
  if (roles.length !== roleIds.length) {
    return NextResponse.json({ error: "Geçersiz rol seçimi" }, { status: 400 });
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.staffUser.create({
      data: {
        tenantId,
        username,
        passwordHash: hash,
        displayName: body.displayName?.trim() || null,
        roleAssignments: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      include: userInclude,
    });
    return NextResponse.json({ user: mapUser(user) });
  } catch {
    return NextResponse.json({ error: "Bu kullanıcı adı kullanılıyor" }, { status: 409 });
  }
}
