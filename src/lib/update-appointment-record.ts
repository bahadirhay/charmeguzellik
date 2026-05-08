import type { Appointment, Prisma } from "@prisma/client";
import {
  AppointmentDuplicateError,
  AppointmentPendingSameDayServiceError,
  AppointmentSlotOccupiedError,
  AppointmentTooCloseOtherServiceError,
} from "@/lib/create-appointment-record";
import {
  appointmentConflictExists,
  normalizeClientNameKey,
  normalizePhoneKey,
  pendingSameDaySameServiceExists,
  slotOccupiedExists,
  withinOneHourOtherServiceExists,
  upsertCrmContactForAppointment,
} from "@/lib/crm-contact";

export type UpdateAppointmentRecordInput = {
  startAt?: Date;
  endAt?: Date | null;
  serviceName?: string | null;
  clientName?: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  notes?: string | null;
};

export async function updateAppointmentRecord(
  tx: Prisma.TransactionClient,
  appointmentId: string,
  input: UpdateAppointmentRecordInput,
): Promise<Appointment> {
  const existing = await tx.appointment.findUnique({ where: { id: appointmentId } });
  if (!existing) {
    throw new Error("not_found");
  }

  const nextStart = input.startAt ?? existing.startAt;
  let nextEnd = existing.endAt;
  if (input.endAt !== undefined) {
    nextEnd = input.endAt;
  } else if (input.startAt != null) {
    const prevEndMs = (existing.endAt ?? new Date(existing.startAt.getTime() + 60 * 60_000)).getTime();
    const duration = Math.max(15 * 60_000, prevEndMs - existing.startAt.getTime());
    nextEnd = new Date(nextStart.getTime() + duration);
  }

  const trimName = (input.clientName ?? existing.clientName).trim();
  const trimPhone = (input.clientPhone ?? existing.clientPhone)?.trim() ?? "";
  if (!trimPhone) {
    throw new Error("phone_required");
  }

  const nameKey = normalizeClientNameKey(trimName);
  const phoneKey = normalizePhoneKey(trimPhone);
  const serviceName =
    input.serviceName !== undefined ? input.serviceName : existing.serviceName;

  const dup = await appointmentConflictExists(tx, {
    tenantId: existing.tenantId,
    startAt: nextStart,
    serviceName,
    nameKey,
    phoneKey,
    excludeAppointmentId: appointmentId,
  });
  if (dup) throw new AppointmentDuplicateError();
  const sameDayPending = await pendingSameDaySameServiceExists(tx, {
    tenantId: existing.tenantId,
    startAt: nextStart,
    serviceName,
    nameKey,
    phoneKey,
    excludeAppointmentId: appointmentId,
  });
  if (sameDayPending && existing.status === "pending") {
    throw new AppointmentPendingSameDayServiceError();
  }
  const tooClose = await withinOneHourOtherServiceExists(tx, {
    tenantId: existing.tenantId,
    startAt: nextStart,
    serviceName,
    nameKey,
    phoneKey,
    excludeAppointmentId: appointmentId,
  });
  if (tooClose) throw new AppointmentTooCloseOtherServiceError();
  const slotOccupied = await slotOccupiedExists(tx, {
    startAt: nextStart,
    excludeAppointmentId: appointmentId,
  });
  if (slotOccupied) throw new AppointmentSlotOccupiedError();

  let crmContactId = existing.crmContactId;
  if (phoneKey) {
    const c = await upsertCrmContactForAppointment(tx, {
      tenantId: existing.tenantId,
      phoneKey,
      name: trimName,
      email: (input.clientEmail ?? existing.clientEmail)?.trim() || null,
    });
    crmContactId = c.id;
  }

  return tx.appointment.update({
    where: { id: appointmentId },
    data: {
      startAt: nextStart,
      endAt: nextEnd,
      serviceName,
      clientName: trimName,
      clientEmail: (input.clientEmail ?? existing.clientEmail)?.trim() || null,
      clientPhone: trimPhone,
      clientNameKey: nameKey,
      clientPhoneKey: phoneKey,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      crmContactId,
    },
  });
}
