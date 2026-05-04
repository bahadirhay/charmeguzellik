import { AdminShell } from "@/components/admin/AdminShell";
import { requireStaffPage } from "@/lib/staff-auth";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireStaffPage();
  return (
    <AdminShell
      username={access.username}
      roleSlug={access.roleSlug ?? null}
      isLegacy={access.isLegacy}
      permissions={access.permissions}
    >
      {children}
    </AdminShell>
  );
}
