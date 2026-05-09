import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { platformControlTenantId } from "@/lib/platform-control-tenant";
import { requireStaffPage } from "@/lib/staff-auth";
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
  const plat = platformControlTenantId();
  const showPlatformNav = Boolean(plat && tenantId === plat);
  return (
    <AdminShell
      username={access.username}
      roleSlug={access.roleSlug ?? null}
      isLegacy={access.isLegacy}
      permissions={access.permissions}
      showPlatformNav={showPlatformNav}
    >
      {children}
    </AdminShell>
  );
}
