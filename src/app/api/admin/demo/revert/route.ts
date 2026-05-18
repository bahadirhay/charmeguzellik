import { NextResponse } from "next/server";
import { requireStaffApiAny } from "@/lib/admin-api-auth";
import { isDemoPanelActor } from "@/lib/demo-staff";
import { isPlatformTenantId, isStructureAdmin } from "@/lib/platform-structure-guard";
import { revertAllPendingDemoChanges } from "@/lib/demo-panel-audit";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function POST(req: Request) {
  const auth = await requireStaffApiAny(["users.manage", "crm.appointments"], req);
  if (auth instanceof NextResponse) return auth;
  if (isDemoPanelActor(auth) || !isStructureAdmin(auth)) {
    return NextResponse.json({ error: "Demo işlemlerini yalnızca yönetici (admin) geri alabilir." }, { status: 403 });
  }
  const tenantId = await getTenantIdForRequest(req);
  if (!isPlatformTenantId(tenantId)) {
    return NextResponse.json({ error: "Demo geri alma yalnızca randevu.techizmet.com panelinde kullanılır." }, { status: 403 });
  }
  const result = await revertAllPendingDemoChanges(tenantId, auth.username);
  return NextResponse.json({ ok: true, ...result });
}
