import type { Prisma, PrismaClient } from "@prisma/client";
import {
  APPOINTMENT_EVENT_PENDING_OVERDUE,
  APPOINTMENT_EVENT_PENDING_OVERDUE_REVIEW,
  createAppointmentPanelEvent,
} from "@/lib/appointment-panel-events";

type Db = PrismaClient | Prisma.TransactionClient;

export function isAppointmentOverduePending(startAt: Date, now = new Date()): boolean {
  return startAt.getTime() < now.getTime();
}

const overdueSelect = {
  id: true,
  startAt: true,
  createdAt: true,
  clientName: true,
  serviceName: true,
  clientPhone: true,
  notes: true,
} as const;

export type OverduePendingAppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof overdueSelect }>;

/** Bekleyen ve randevu saati geçmiş kayıtlar için sistem olayı oluşturur (rapor izi). */
export async function syncOverduePendingEvents(db: Db, tenantId: string, now = new Date()): Promise<void> {
  const rows = await db.appointment.findMany({
    where: { tenantId, status: "pending", startAt: { lt: now } },
    select: { id: true, startAt: true, createdAt: true },
  });
  for (const row of rows) {
    const exists = await db.appointmentEvent.findFirst({
      where: { tenantId, appointmentId: row.id, eventType: APPOINTMENT_EVENT_PENDING_OVERDUE },
      select: { id: true },
    });
    if (exists) continue;
    await createAppointmentPanelEvent(db, {
      tenantId,
      appointmentId: row.id,
      eventType: APPOINTMENT_EVENT_PENDING_OVERDUE,
      channel: "system",
      outcome: "unactioned",
      details: {
        detectedAt: now.toISOString(),
        startAt: row.startAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        reason: "panel_no_decision_before_start",
      },
    });
  }
}

export async function fetchOverduePendingAppointments(
  db: Db,
  tenantId: string,
  now = new Date(),
): Promise<OverduePendingAppointmentRow[]> {
  return db.appointment.findMany({
    where: { tenantId, status: "pending", startAt: { lt: now } },
    select: overdueSelect,
    orderBy: { startAt: "asc" },
    take: 50,
  });
}

export function daysOverdueFromStart(startAt: Date, now = new Date()): number {
  const ms = now.getTime() - startAt.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Son panel inceleme notu (varsa). */
export async function latestOverdueReviewNoteByAppointment(
  db: Db,
  tenantId: string,
  appointmentIds: string[],
): Promise<Map<string, string>> {
  if (appointmentIds.length === 0) return new Map();
  const events = await db.appointmentEvent.findMany({
    where: {
      tenantId,
      appointmentId: { in: appointmentIds },
      eventType: { in: [APPOINTMENT_EVENT_PENDING_OVERDUE_REVIEW, "panel_decision"] },
    },
    orderBy: { createdAt: "desc" },
    select: { appointmentId: true, detailsJson: true, eventType: true },
  });
  const map = new Map<string, string>();
  for (const ev of events) {
    if (map.has(ev.appointmentId)) continue;
    if (!ev.detailsJson) continue;
    try {
      const d = JSON.parse(ev.detailsJson) as { reviewNote?: string | null };
      const note = d.reviewNote?.trim();
      if (note) map.set(ev.appointmentId, note);
    } catch {
      /* ignore */
    }
  }
  return map;
}

export async function logOverduePendingReview(
  db: Db,
  input: {
    tenantId: string;
    appointmentId: string;
    actor: string;
    reviewNote: string;
    resolution?: string | null;
  },
): Promise<void> {
  await createAppointmentPanelEvent(db, {
    tenantId: input.tenantId,
    appointmentId: input.appointmentId,
    eventType: APPOINTMENT_EVENT_PENDING_OVERDUE_REVIEW,
    outcome: input.resolution?.trim() || "noted",
    actor: input.actor,
    details: { reviewNote: input.reviewNote.trim() },
  });
}
