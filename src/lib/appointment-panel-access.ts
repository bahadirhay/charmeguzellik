import type { StaffAccess } from "@/lib/staff-auth";
import { parseAssignedStaffFromNotes } from "@/lib/appointment-staffing";
import { hasStaffPermission } from "@/lib/staff-permissions";

export type AppointmentPanelScope = "full" | "self";

export function resolveAppointmentPanelScope(access: StaffAccess): {
  scope: AppointmentPanelScope | null;
  selfStaffLabel: string | null;
} {
  if (hasStaffPermission(access.permissions, "crm.appointments")) {
    return { scope: "full", selfStaffLabel: null };
  }
  if (hasStaffPermission(access.permissions, "crm.appointments.self")) {
    const label = access.staffDisplayName?.trim() || null;
    return { scope: "self", selfStaffLabel: label };
  }
  return { scope: null, selfStaffLabel: null };
}

export function notesAssignedStaffMatchesLabel(notes: string | null | undefined, label: string | null | undefined): boolean {
  const want = label?.trim();
  if (!want) return false;
  const assigned = parseAssignedStaffFromNotes(notes);
  if (!assigned) return false;
  return assigned.trim().toLocaleLowerCase("tr-TR") === want.toLocaleLowerCase("tr-TR");
}

export function filterAppointmentsForSelfScope<T extends { notes: string | null }>(
  rows: T[],
  selfStaffLabel: string | null | undefined,
): T[] {
  const want = selfStaffLabel?.trim();
  if (!want) return [];
  const k = want.toLocaleLowerCase("tr-TR");
  return rows.filter((r) => {
    const a = parseAssignedStaffFromNotes(r.notes);
    return a && a.trim().toLocaleLowerCase("tr-TR") === k;
  });
}
