import type { Prisma, PrismaClient } from "@prisma/client";
import { parseThemeTokens } from "@/lib/theme-tokens";

const STAFF_MARKER_PREFIX = "[[STAFF:";
const STAFF_MARKER_SUFFIX = "]]";

function normalizeText(v: string): string {
  return v.trim().toLocaleLowerCase("tr-TR");
}

function serviceKey(serviceName: string | null | undefined): string {
  return normalizeText(serviceName ?? "");
}

export function parseAssignedStaffFromNotes(notes: string | null | undefined): string | null {
  const raw = notes?.trim() ?? "";
  if (!raw.startsWith(STAFF_MARKER_PREFIX)) return null;
  const end = raw.indexOf(STAFF_MARKER_SUFFIX);
  if (end < 0) return null;
  const value = raw.slice(STAFF_MARKER_PREFIX.length, end).trim();
  return value || null;
}

export function withAssignedStaffInNotes(notes: string | null | undefined, staffName: string | null): string | null {
  const body = (notes ?? "").trim();
  const clean = body.startsWith(STAFF_MARKER_PREFIX)
    ? body.slice((body.indexOf(STAFF_MARKER_SUFFIX) + STAFF_MARKER_SUFFIX.length) || 0).trim()
    : body;
  if (!staffName?.trim()) return clean || null;
  return `${STAFF_MARKER_PREFIX}${staffName.trim()}${STAFF_MARKER_SUFFIX}${clean ? `\n${clean}` : ""}`;
}

export type ServiceStaffMap = Record<string, string[]>;

export function getServiceStaffMap(themeTokensJson: string | null | undefined): ServiceStaffMap {
  const t = parseThemeTokens(themeTokensJson);
  const src = t.appointmentStaffByService;
  if (!src || typeof src !== "object") return {};
  const out: ServiceStaffMap = {};
  for (const [svc, arr] of Object.entries(src)) {
    if (!svc.trim() || !Array.isArray(arr)) continue;
    const k = serviceKey(svc);
    const staff = arr
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (staff.length) out[k] = Array.from(new Set(staff));
  }
  return out;
}

export function eligibleStaffForService(serviceName: string | null | undefined, map: ServiceStaffMap): string[] {
  const k = serviceKey(serviceName);
  return map[k] ?? [];
}

export async function isStaffOccupiedAt(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  startAt: Date,
  staffName: string,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const rows = await db.appointment.findMany({
    where: {
      startAt,
      status: { in: ["pending", "approved", "cancel_request"] },
      ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
    },
    select: { notes: true },
  });
  const key = normalizeText(staffName);
  return rows.some((r) => normalizeText(parseAssignedStaffFromNotes(r.notes) ?? "") === key);
}

export async function pickAvailableStaff(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  startAt: Date,
  staffCandidates: string[],
  excludeAppointmentId?: string,
): Promise<string | null> {
  for (const s of staffCandidates) {
    const occupied = await isStaffOccupiedAt(db, startAt, s, excludeAppointmentId);
    if (!occupied) return s;
  }
  return null;
}

