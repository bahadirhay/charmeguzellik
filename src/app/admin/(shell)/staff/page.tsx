import { StaffAdminClient } from "@/components/admin/StaffAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStaffRoles } from "@/lib/staff-roles-defaults";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export default async function StaffAdminPage() {
  await requirePagePermission("users.manage");
  await ensureDefaultStaffRoles(prisma);
  const [roles, users] = await Promise.all([
    prisma.staffRole.findMany({
      where: { tenantId: BOOTSTRAP_TENANT_ID },
      orderBy: { slug: "asc" },
    }),
    prisma.staffUser.findMany({
      where: { tenantId: BOOTSTRAP_TENANT_ID },
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
