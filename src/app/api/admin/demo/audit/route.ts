import { NextResponse } from "next/server";
import { requireStaffApiAny } from "@/lib/admin-api-auth";
import { isDemoPanelActor } from "@/lib/demo-staff";
import { isPlatformTenantId, isStructureAdmin } from "@/lib/platform-structure-guard";
import { countPendingDemoPanelChanges, listPendingDemoPanelChanges } from "@/lib/demo-panel-audit";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET(req: Request) {
  const auth = await requireStaffApiAny(["users.manage", "crm.appointments"], req);
  if (auth instanceof NextResponse) return auth;
  if (isDemoPanelActor(auth) || !isStructureAdmin(auth)) {
    return NextResponse.json({ error: "Yalnızca yönetici (admin) demo işlem listesini görebilir." }, { status: 403 });
  }
  const tenantId = await getTenantIdForRequest(req);
  if (!isPlatformTenantId(tenantId)) {
    return NextResponse.json({ error: "Demo geri alma yalnızca platform panelinde geçerlidir." }, { status: 403 });
  }
  const [count, items] = await Promise.all([
    countPendingDemoPanelChanges(tenantId),
    listPendingDemoPanelChanges(tenantId, 40),
  ]);
  return NextResponse.json({
    ok: true,
    count,
    items: items.map((r) => ({
      id: r.id,
      actorUsername: r.actorUsername,
      entityType: r.entityType,
      action: r.action,
      label: r.label,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
