import { SiteModulesClient } from "@/components/admin/SiteModulesClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function SiteModulesPage() {
  await requirePagePermission("site.modules");
  const tenantId = await getTenantIdForRequest();
  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featuresJson: true },
  });
  return (
    <SiteModulesClient
      appointmentsEnabled={isAppointmentsModuleEnabled(tenantRow?.featuresJson)}
      commerceEnabled={isCommerceModuleEnabled(tenantRow?.featuresJson)}
    />
  );
}
