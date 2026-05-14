import { hasAnyStaffPermission } from "@/lib/staff-permissions";

/** Rapor sayfası ve dışa aktarma için yeterli olan en az bir yetki. */
export const ADMIN_REPORT_PERMISSION_KEYS = [
  "crm.appointments",
  "crm.appointments.self",
  "crm.leads",
  "commerce.manage",
  "users.manage",
] as const;

export function canAccessAdminReports(permissions: readonly string[]): boolean {
  return hasAnyStaffPermission(permissions, [...ADMIN_REPORT_PERMISSION_KEYS]);
}
