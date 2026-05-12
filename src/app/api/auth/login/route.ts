import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { allStaffPermissions, mergePermissionsFromRoles } from "@/lib/staff-permissions";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type Body = { login?: string; email?: string; password?: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const password = body.password;
  const loginRaw = (body.login ?? body.email ?? "").trim().toLowerCase();

  if (!password || !loginRaw) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const session = await getAdminSession();
  const tenantId = await getTenantIdForRequest(req);

  const staff = await prisma.staffUser.findFirst({
    where: { tenantId, username: loginRaw, active: true },
    include: { roleAssignments: { include: { role: true } } },
  });

  if (staff) {
    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (!staff.roleAssignments.length) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    const roles = staff.roleAssignments.map((a) => a.role);
    const perms = mergePermissionsFromRoles(roles);
    const roleSlug = roles
      .map((r) => r.slug)
      .sort()
      .join(", ");
    session.isLoggedIn = true;
    session.authKind = "staff";
    session.staffUserId = staff.id;
    session.username = staff.username;
    session.staffDisplayName = staff.displayName?.trim() || null;
    session.roleSlug = roleSlug;
    session.tenantId = tenantId;
    session.permissionsJson = JSON.stringify(perms.length ? perms : allStaffPermissions());
    session.email = undefined;
    await session.save();
    return NextResponse.json({ ok: true });
  }

  const legacyEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plain = process.env.ADMIN_PASSWORD;

  if (loginRaw !== legacyEmail.toLowerCase()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let valid = false;
  if (passwordHash) {
    valid = await bcrypt.compare(password, passwordHash);
  } else if (plain) {
    valid = password === plain;
  }

  if (!valid) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  session.isLoggedIn = true;
  session.authKind = "legacy";
  session.email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  session.username = undefined;
  session.staffUserId = undefined;
  session.staffDisplayName = undefined;
  session.roleSlug = undefined;
  session.tenantId = tenantId;
  session.permissionsJson = JSON.stringify(allStaffPermissions());
  await session.save();

  return NextResponse.json({ ok: true });
}
