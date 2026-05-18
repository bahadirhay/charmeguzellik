import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const APPOINTMENT_EVENT_PENDING_OVERDUE = "pending_overdue";
export const APPOINTMENT_EVENT_PENDING_OVERDUE_REVIEW = "pending_overdue_review";
export const APPOINTMENT_EVENT_PANEL_DECISION = "panel_decision";

export type PanelDecisionOutcome = "approved" | "rejected" | "cancelled" | "cancel_request" | "checked_in" | "no_show";

export async function createAppointmentPanelEvent(
  db: Db,
  input: {
    tenantId: string;
    appointmentId: string;
    eventType: string;
    outcome: string;
    channel?: string | null;
    actor?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await db.appointmentEvent.create({
    data: {
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      eventType: input.eventType,
      channel: input.channel ?? "panel",
      outcome: input.outcome,
      actor: input.actor ?? null,
      detailsJson: input.details ? JSON.stringify(input.details) : null,
    },
  });
}

export async function logPanelStatusDecision(
  db: Db,
  input: {
    tenantId: string;
    appointmentId: string;
    actor: string;
    fromStatus: string;
    toStatus: PanelDecisionOutcome;
    wasOverdue: boolean;
    reviewNote?: string | null;
  },
): Promise<void> {
  await createAppointmentPanelEvent(db, {
    tenantId: input.tenantId,
    appointmentId: input.appointmentId,
    eventType: APPOINTMENT_EVENT_PANEL_DECISION,
    outcome: input.toStatus,
    actor: input.actor,
    details: {
      fromStatus: input.fromStatus,
      wasOverdue: input.wasOverdue,
      reviewNote: input.reviewNote?.trim() || null,
    },
  });
}
