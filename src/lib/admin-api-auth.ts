import { NextResponse } from "next/server";
import {
  ensureStaffPerm,
  requireStaffApi,
  staffPermDenied,
  type StaffAccess,
} from "@/lib/staff-auth";
import { hasAnyStaffPermission, hasStaffPermission } from "@/lib/staff-permissions";

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
