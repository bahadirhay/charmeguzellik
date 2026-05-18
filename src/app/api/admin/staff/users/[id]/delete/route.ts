import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { transferStaffReferencesAndDeleteUser } from "@/lib/staff-transfer-delete";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { isDemoPanelActor, staffUserHasAdminRole } from "@/lib/demo-staff";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Personel silme: referans yoksa doğrudan siler; varsa `transferToStaffUserId` ile taşıyıp siler.
 * Body: `{ transferToStaffUserId?: string | null }`
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("users.manage", req);
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const { id } = await ctx.params;
  if (isDemoPanelActor(auth)) {
    return NextResponse.json({ error: "Demo hesabı personel silemez." }, { status: 403 });
  }
  if (!id?.trim()) {
    return NextResponse.json({ error: "Geçersiz kullanıcı" }, { status: 400 });
  }

  let body: { transferToStaffUserId?: string | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const r = await transferStaffReferencesAndDeleteUser(prisma, tenantId, id, body.transferToStaffUserId, {
    actorStaffUserId: auth.staffUserId,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true });
}
