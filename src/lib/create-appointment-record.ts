import type { Appointment, Prisma } from "@prisma/client";
import {
  appointmentDuplicateExists,
  normalizeClientNameKey,
  normalizePhoneKey,
  upsertCrmContactForAppointment,
} from "@/lib/crm-contact";

export class AppointmentDuplicateError extends Error {
  constructor() {
    super("duplicate_appointment");
    this.name = "AppointmentDuplicateError";
  }
}

export type CreateAppointmentRecordInput = {
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
  const nameKey = normalizeClientNameKey(trimName);
  const phoneKey = normalizePhoneKey(input.clientPhone);
  const dup = await appointmentDuplicateExists(tx, {
    startAt: input.startAt,
    serviceName: input.serviceName,
    nameKey,
    phoneKey,
  });
  if (dup) throw new AppointmentDuplicateError();

  let crmContactId: string | null = null;
  if (phoneKey) {
    const c = await upsertCrmContactForAppointment(tx, {
      phoneKey,
      name: trimName,
      email: input.clientEmail?.trim() || null,
    });
    crmContactId = c.id;
  }

  return tx.appointment.create({
    data: {
      startAt: input.startAt,
      endAt: input.endAt,
      serviceName: input.serviceName,
      clientName: trimName,
      clientEmail: input.clientEmail?.trim() || null,
      clientPhone: input.clientPhone?.trim() || null,
      clientNameKey: nameKey,
      clientPhoneKey: phoneKey,
      notes: input.notes,
      status: input.status ?? "pending",
      crmContactId,
    },
  });
}
