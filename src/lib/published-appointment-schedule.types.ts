import type { AppointmentDaySchedule } from "@/lib/appointment-schedule";

/** Sunucudan istemciye — `getFirstPublishedAppointmentSchedule` çıktısı */
export type PublishedAppointmentSchedule = {
  appointmentDays: AppointmentDaySchedule[];
  slotDurationMinutes: number;
  appointmentTimeZone: string;
};
