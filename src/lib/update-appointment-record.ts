import type { Appointment, Prisma } from "@prisma/client";
import { AppointmentDuplicateError } from "@/lib/create-appointment-record";
import {
  appointmentDuplicateExists,
  normalizeClientNameKey,
  normalizePhoneKey,
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

  const dup = await appointmentDuplicateExists(tx, {
    startAt: nextStart,
    serviceName,
    nameKey,
    phoneKey,
    excludeAppointmentId: appointmentId,
  });
  if (dup) throw new AppointmentDuplicateError();

  let crmContactId = existing.crmContactId;
  if (phoneKey) {
    const c = await upsertCrmContactForAppointment(tx, {
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
