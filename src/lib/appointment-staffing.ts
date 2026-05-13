import type { Prisma, PrismaClient } from "@prisma/client";
import { parseThemeTokens } from "@/lib/theme-tokens";

const STAFF_MARKER_PREFIX = "[[STAFF:";
const STAFF_MARKER_SUFFIX = "]]";

/** Yayınlanan cuid biçimi — panel personel kaydı id'si */
const STAFF_ID_LIKE = /^c[a-z0-9]{20,}$/i;

function normalizeText(v: string): string {
  return v.trim().toLocaleLowerCase("tr-TR");
}

export function appointmentStaffLabelsEqual(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

function serviceKey(serviceName: string | null | undefined): string {
  return normalizeText(serviceName ?? "");
}

export function isLikelyStaffUserId(v: string): boolean {
  return STAFF_ID_LIKE.test(v.trim());
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

/** Randevu notlarındaki [[STAFF:…]] atamasını başka personele taşır; eşleşme yoksa metni olduğu gibi döner. */
export function reassignAssignedStaffInNotes(
  notes: string | null | undefined,
  fromStaffLabel: string,
  toStaffLabel: string,
): string | null {
  const cur = parseAssignedStaffFromNotes(notes);
  if (!cur?.trim()) return notes ?? null;
  if (!appointmentStaffLabelsEqual(cur, fromStaffLabel)) return notes ?? null;
  const body = (notes ?? "").trim();
  const clean = body.startsWith(STAFF_MARKER_PREFIX)
    ? body.slice((body.indexOf(STAFF_MARKER_SUFFIX) + STAFF_MARKER_SUFFIX.length) || 0).trim()
    : body;
  return withAssignedStaffInNotes(clean || null, toStaffLabel);
}

export type ServiceStaffMap = Record<string, string[]>;

/** Ayarlardan ham eşleme: anahtar = menüdeki hizmet etiketi; değer = id veya eski serbest metin */
export function parseRawAppointmentStaffByService(
  themeTokensJson: string | null | undefined,
): Record<string, string[]> {
  const t = parseThemeTokens(themeTokensJson);
  const src = t.appointmentStaffByService;
  if (!src || typeof src !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [svc, arr] of Object.entries(src)) {
    if (!svc.trim() || !Array.isArray(arr)) continue;
    const tokens = arr
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (tokens.length) out[svc.trim()] = Array.from(new Set(tokens));
  }
  return out;
}

type StaffUserPick = { id: string; displayName: string | null };

function buildStaffResolution(users: StaffUserPick[]): {
  byId: Map<string, StaffUserPick>;
  normNameToId: Map<string, string>;
} {
  const byId = new Map<string, StaffUserPick>();
  const normNameToId = new Map<string, string>();
  for (const u of users) {
    byId.set(u.id, u);
    const dn = u.displayName?.trim();
    if (dn) normNameToId.set(normalizeText(dn), u.id);
  }
  return { byId, normNameToId };
}

/**
 * Temada saklanan ham değerleri (id veya eski isim) aktif personel id listesine çevirir.
 * Kayıtlı anahtarlar hizmet etiketleriyle aynı kalır (Personel Planlama state'i).
 */
export async function coerceAppointmentStaffMapToIds(
  db: Pick<PrismaClient, "staffUser">,
  themeTokensJson: string | null | undefined,
  tenantId: string,
): Promise<Record<string, string[]>> {
  const raw = parseRawAppointmentStaffByService(themeTokensJson);
  const users = await db.staffUser.findMany({
    where: { active: true, tenantId },
    select: { id: true, displayName: true },
  });
  const { byId, normNameToId } = buildStaffResolution(users);
  const out: Record<string, string[]> = {};
  for (const [svc, tokens] of Object.entries(raw)) {
    const ids: string[] = [];
    for (const t of tokens) {
      if (byId.has(t) && byId.get(t)!.displayName?.trim()) {
        ids.push(t);
        continue;
      }
      const byName = normNameToId.get(normalizeText(t));
      if (byName) ids.push(byName);
    }
    if (ids.length) out[svc] = Array.from(new Set(ids));
  }
  return out;
}

/** Randevu çakışması vb. için: hizmet (normalize) -> görünen ad listesi */
export async function resolveServiceStaffMap(
  db: Pick<PrismaClient, "staffUser">,
  themeTokensJson: string | null | undefined,
  tenantId: string,
): Promise<ServiceStaffMap> {
  const idByService = await coerceAppointmentStaffMapToIds(db, themeTokensJson, tenantId);
  const allIds = [...new Set(Object.values(idByService).flat())];
  if (allIds.length === 0) return {};
  const users = await db.staffUser.findMany({
    where: { id: { in: allIds }, active: true, tenantId },
    select: { id: true, displayName: true },
  });
  const idToLabel = new Map(
    users
      .map((u) => [u.id, (u.displayName ?? "").trim()] as const)
      .filter(([, l]) => Boolean(l)),
  );
  const out: ServiceStaffMap = {};
  for (const [svc, ids] of Object.entries(idByService)) {
    const labels = ids.map((id) => idToLabel.get(id)).filter((x): x is string => Boolean(x));
    if (labels.length) {
      const k = serviceKey(svc);
      out[k] = Array.from(new Set(labels));
    }
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
  tenantId: string,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const rows = await db.appointment.findMany({
    where: {
      tenantId,
      startAt,
      status: { in: ["pending", "approved", "confirmed", "cancel_request"] },
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
  tenantId: string,
  excludeAppointmentId?: string,
): Promise<string | null> {
  for (const s of staffCandidates) {
    const occupied = await isStaffOccupiedAt(db, startAt, s, tenantId, excludeAppointmentId);
    if (!occupied) return s;
  }
  return null;
}
