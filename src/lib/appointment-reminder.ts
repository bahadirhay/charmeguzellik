/** Randevu notlarına eklenir; cron ve panel aynı metni kullanır. */
export const APPOINTMENT_REMINDER_NOTE_PREFIX = "Teyit hatırlatması gönderildi:";

/** Cron ile aynı: randevuya yaklaşık 24 saat kala (23–25 saat aralığı). */
export function appointmentReminderCronWindowFromReferenceMs(ms = Date.now()): { from: Date; to: Date } {
  return {
    from: new Date(ms + 23 * 60 * 60 * 1000),
    to: new Date(ms + 25 * 60 * 60 * 1000),
  };
}
