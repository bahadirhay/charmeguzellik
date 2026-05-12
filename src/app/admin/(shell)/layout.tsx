import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { platformControlTenantId } from "@/lib/platform-control-tenant";
import { prisma, withPrismaEngine } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/staff-auth";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  manifest: "/admin-manifest.json",
  appleWebApp: { capable: true, title: "Charme Yönetim" },
};

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [access, tenantId] = await Promise.all([requireStaffPage(), getTenantIdForRequest()]);
  const tenantRow = await withPrismaEngine(() =>
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } }),
  );
  const appointmentsModuleEnabled = isAppointmentsModuleEnabled(tenantRow?.featuresJson);
  const commerceModuleEnabled = isCommerceModuleEnabled(tenantRow?.featuresJson);
  const plat = platformControlTenantId();
  const showPlatformNav = Boolean(plat && tenantId === plat);
  return (
    <AdminShell
      username={access.username}
      roleSlug={access.roleSlug ?? null}
      isLegacy={access.isLegacy}
      permissions={access.permissions}
      showPlatformNav={showPlatformNav}
      appointmentsModuleEnabled={appointmentsModuleEnabled}
      commerceModuleEnabled={commerceModuleEnabled}
    >
      {children}
    </AdminShell>
  );
}
