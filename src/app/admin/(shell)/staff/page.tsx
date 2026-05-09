import { StaffAdminClient } from "@/components/admin/StaffAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export default async function StaffAdminPage() {
  await requirePagePermission("users.manage");
  const tenantId = await getTenantIdForRequest();
  await ensureDefaultStaffRoles(prisma, tenantId);
  const [roles, users] = await Promise.all([
    prisma.staffRole.findMany({
      where: { tenantId },
      orderBy: { slug: "asc" },
    }),
    prisma.staffUser.findMany({
      where: { tenantId },
      include: { role: true },
      orderBy: { username: "asc" },
    }),
  ]);

  return (
    <StaffAdminClient
      roles={roles.map((r) => ({
        id: r.id,
        slug: r.slug,
        label: r.label,
        permissionsJson: r.permissionsJson,
      }))}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        active: u.active,
        roleId: u.roleId,
        roleSlug: u.role.slug,
        roleLabel: u.role.label,
      }))}
    />
  );
}
