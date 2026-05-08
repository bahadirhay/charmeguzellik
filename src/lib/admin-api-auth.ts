import { NextResponse } from "next/server";
import {
  ensureStaffPerm,
  requireStaffApi,
  staffPermDenied,
  type StaffAccess,
} from "@/lib/staff-auth";
import { notesAssignedStaffMatchesLabel, resolveAppointmentPanelScope, type AppointmentPanelScope } from "@/lib/appointment-panel-access";
import { hasAnyStaffPermission, hasStaffPermission } from "@/lib/staff-permissions";
import type { Appointment } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function requireStaffApiPerm(perm: string): Promise<StaffAccess | NextResponse> {
  const auth = await requireStaffApi();
  if (auth instanceof NextResponse) return auth;
  const denied = ensureStaffPerm(auth, perm);
  if (denied) return denied;
  return auth;
}

export async function requireStaffApiAny(perms: readonly string[]): Promise<StaffAccess | NextResponse> {
  const auth = await requireStaffApi();
  if (auth instanceof NextResponse) return auth;
  if (!hasAnyStaffPermission(auth.permissions, perms)) return staffPermDenied();
  return auth;
}

export function hasPerm(a: StaffAccess, perm: string): boolean {
  return hasStaffPermission(a.permissions, perm);
}

export type StaffAppointmentAuth = StaffAccess & {
  appointmentScope: AppointmentPanelScope;
  selfStaffLabel: string | null;
};

/** Randevu API — tam (`crm.appointments`) veya yalnızca kendi (`crm.appointments.self`) */
export async function requireStaffApiAppointments(): Promise<StaffAppointmentAuth | NextResponse> {
  const auth = await requireStaffApi();
  if (auth instanceof NextResponse) return auth;
  const { scope, selfStaffLabel: fromPerm } = resolveAppointmentPanelScope(auth);
  if (!scope) return staffPermDenied();
  let selfStaffLabel = fromPerm;
  if (scope === "self" && auth.staffUserId) {
    const u = await prisma.staffUser.findUnique({
      where: { id: auth.staffUserId },
      select: { displayName: true },
    });
    selfStaffLabel = u?.displayName?.trim() || null;
  }
  return { ...auth, appointmentScope: scope, selfStaffLabel };
}

/** Tam randevu yönetimi (personel planlama, tüm kayıtlar) */
export async function requireStaffApiAppointmentsFull(): Promise<StaffAccess | NextResponse> {
  return requireStaffApiPerm("crm.appointments");
}

export function appointmentRowForbiddenForStaff(
  auth: StaffAppointmentAuth,
  row: Pick<Appointment, "notes"> | null,
): NextResponse | null {
  if (!row) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (auth.appointmentScope === "full") return null;
  const label = auth.selfStaffLabel;
  if (!label?.trim()) {
    return NextResponse.json(
      { error: "Hesabınızda görünen ad tanımlı değil. Yönetici: Personel → Görünen ad." },
      { status: 403 },
    );
  }
  if (!notesAssignedStaffMatchesLabel(row.notes, label)) {
    return NextResponse.json({ error: "Bu kayıt size atanmamış." }, { status: 403 });
  }
  return null;
}
