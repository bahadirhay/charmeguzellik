import { PlatformCustomersClient, type TenantListRow } from "@/components/admin/PlatformCustomersClient";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/auth";
import { redirectUnlessPlatformProvisioner } from "@/lib/platform-provision-auth";
import { platformControlTenantId } from "@/lib/platform-control-tenant";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";

export const dynamic = "force-dynamic";

export default async function PlatformCustomersPage() {
  await requirePagePermission("users.manage");
  await redirectUnlessPlatformProvisioner();

  const platformId = platformControlTenantId();
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      domains: { select: { host: true, isPrimary: true } },
      _count: { select: { pages: true } },
    },
  });

  const rows: TenantListRow[] = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    isPlatformTenant: platformId !== null && t.id === platformId,
    appointmentsEnabled: isAppointmentsModuleEnabled(t.featuresJson),
    commerceEnabled: isCommerceModuleEnabled(t.featuresJson),
    pageCount: t._count.pages,
    hosts: t.domains.map((d) => ({ host: d.host, primary: d.isPrimary })),
  }));

  return <PlatformCustomersClient initialTenants={rows} platformTenantId={platformId} />;
}
