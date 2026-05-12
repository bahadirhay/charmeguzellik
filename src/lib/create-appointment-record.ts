import type { Appointment, Prisma } from "@prisma/client";
import {
  appointmentConflictExists,
  normalizeClientNameKey,
  pendingSameDaySameServiceExists,
  normalizePhoneKey,
  slotOccupiedExists,
  withinOneHourOtherServiceExists,
  upsertCrmContactForAppointment,
} from "@/lib/crm-contact";
import { resolveQuotedPriceForAppointment } from "@/lib/commerce/resolve-prices";

export class AppointmentDuplicateError extends Error {
  constructor() {
    super("duplicate_appointment");
    this.name = "AppointmentDuplicateError";
  }
}

export class AppointmentPendingSameDayServiceError extends Error {
  constructor() {
    super("pending_same_day_same_service");
    this.name = "AppointmentPendingSameDayServiceError";
  }
}

export class AppointmentTooCloseOtherServiceError extends Error {
  constructor() {
    super("too_close_other_service");
    this.name = "AppointmentTooCloseOtherServiceError";
  }
}

export class AppointmentSlotOccupiedError extends Error {
  constructor() {
    super("slot_occupied");
    this.name = "AppointmentSlotOccupiedError";
  }
}

export type CreateAppointmentRecordInput = {
  tenantId: string;
  startAt: Date;
  endAt: Date | null;
  serviceName: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  notes: string | null;
  status?: string;
};

export async function createAppointmentRecord(
  tx: Prisma.TransactionClient,
  input: CreateAppointmentRecordInput,
): Promise<Appointment> {
  const trimName = input.clientName.trim();
  const trimPhone = input.clientPhone?.trim() || "";
  if (!trimPhone) {
    throw new Error("phone_required");
  }
  const nameKey = normalizeClientNameKey(trimName);
  const phoneKey = normalizePhoneKey(trimPhone);
  const dup = await appointmentConflictExists(tx, {
    tenantId: input.tenantId,
    startAt: input.startAt,
    serviceName: input.serviceName,
    nameKey,
    phoneKey,
  });
  if (dup) throw new AppointmentDuplicateError();
  const sameDayPending = await pendingSameDaySameServiceExists(tx, {
    tenantId: input.tenantId,
    startAt: input.startAt,
    serviceName: input.serviceName,
    nameKey,
    phoneKey,
  });
  if (sameDayPending && (input.status ?? "pending") === "pending") {
    throw new AppointmentPendingSameDayServiceError();
  }
  const tooClose = await withinOneHourOtherServiceExists(tx, {
    tenantId: input.tenantId,
    startAt: input.startAt,
    serviceName: input.serviceName,
    nameKey,
    phoneKey,
  });
  if (tooClose) throw new AppointmentTooCloseOtherServiceError();
  const slotOccupied = await slotOccupiedExists(tx, { tenantId: input.tenantId, startAt: input.startAt });
  if (slotOccupied) throw new AppointmentSlotOccupiedError();

  let crmContactId: string | null = null;
  if (phoneKey) {
    const c = await upsertCrmContactForAppointment(tx, {
      tenantId: input.tenantId,
      phoneKey,
      name: trimName,
      email: input.clientEmail?.trim() || null,
    });
    crmContactId = c.id;
  }

  const pq = await resolveQuotedPriceForAppointment(tx, input.tenantId, input.serviceName, crmContactId);

  return tx.appointment.create({
    data: {
      tenantId: input.tenantId,
      startAt: input.startAt,
      endAt: input.endAt,
      serviceName: input.serviceName,
      quotedPriceMinor: pq.quotedPriceMinor,
      priceSource: pq.priceSource,
      clientName: trimName,
      clientEmail: input.clientEmail?.trim() || null,
      clientPhone: trimPhone,
      clientNameKey: nameKey,
      clientPhoneKey: phoneKey,
      notes: input.notes,
      status: input.status ?? "pending",
      crmContactId,
    },
  });
}
