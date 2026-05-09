import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  getRequestHost,
  getTenantIdForRequest,
  normalizeHost,
} from "@/lib/tenant-db";
import {
  isPlatformProvisionAllowedForHost,
  platformControlTenantId,
} from "@/lib/platform-control-tenant";

/** Randevu (platform) panel dışından erişim — dashboard’a düşür. */
export async function redirectUnlessPlatformProvisioner() {
  const platformId = platformControlTenantId();
  const tenantId = await getTenantIdForRequest();
  const host = normalizeHost(await getRequestHost());
  if (
    !platformId ||
    tenantId !== platformId ||
    !isPlatformProvisionAllowedForHost(host)
  ) {
    redirect("/admin/dashboard?forbidden=1");
  }
}

/** API için: platform kiracı + isteğe bağlı PLATFORM_CONTROL_HOST doğruluğu */
export async function denyUnlessPlatformProvisioner(req?: Request): Promise<NextResponse | null> {
  const platformId = platformControlTenantId();
  if (!platformId) {
    return NextResponse.json({ error: "PLATFORM_CONTROL_TENANT_ID tanımlı değil." }, { status: 503 });
  }
  const tenantId = await getTenantIdForRequest(req);
  if (tenantId !== platformId) {
    return NextResponse.json({ error: "Bu işlem yalnızca platform kontrol panelinden yapılabilir." }, { status: 403 });
  }
  const rawHost = await getRequestHost(req);
  if (!isPlatformProvisionAllowedForHost(normalizeHost(rawHost))) {
    return NextResponse.json({ error: "Bu host üzerinden platform işlemi yasak." }, { status: 403 });
  }
  return null;
}
