import { NextResponse } from "next/server";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { computeStaffTransferImpact } from "@/lib/staff-transfer-delete";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

/** Silmeden önce taşınacak kayıt sayıları (GET). */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Geçersiz kullanıcı" }, { status: 400 });
  }
  const row = await prisma.staffUser.findFirst({
    where: { id, tenantId },
    select: { id: true, username: true, displayName: true, active: true },
  });
  if (!row) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const preview = await computeStaffTransferImpact(prisma, tenantId, id);
  if (!preview) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const total =
    preview.impact.appointmentNotes +
    preview.impact.themeServiceEntries +
    preview.impact.commissionAccruals +
    preview.impact.cashReceipts +
    preview.impact.cashDayCloses;

  return NextResponse.json({
    user: {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      active: row.active,
    },
    fromLabel: preview.fromLabel,
    impact: preview.impact,
    totalReferences: total,
    requiresTransferTarget: total > 0,
  });
}
