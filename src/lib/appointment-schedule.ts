/** JS getDay(): 0=Pazar … 6=Cumartesi */

export const WEEKDAY_LABELS_TR = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
] as const;

export type AppointmentDaySchedule = {
  day: number;
  start: string;
  end: string;
};

export const DEFAULT_APPOINTMENT_TIMEZONE = "Europe/Istanbul";

/** Pazartesi–Cuma 09–19, Cumartesi 09–15; Pazar kapalı */
export const DEFAULT_APPOINTMENT_DAYS: AppointmentDaySchedule[] = [
  { day: 1, start: "09:00", end: "19:00" },
  { day: 2, start: "09:00", end: "19:00" },
  { day: 3, start: "09:00", end: "19:00" },
  { day: 4, start: "09:00", end: "19:00" },
  { day: 5, start: "09:00", end: "19:00" },
  { day: 6, start: "09:00", end: "15:00" },
];

const WEEKDAY_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;

export function mergeAppointmentDays(
  days: AppointmentDaySchedule[] | null | undefined,
): AppointmentDaySchedule[] {
  if (days?.length) {
    return days
      .filter((d) => d.day >= 0 && d.day <= 6 && d.start && d.end)
      .map((d) => ({
        day: d.day,
        start: d.start.trim().slice(0, 5),
        end: d.end.trim().slice(0, 5),
      }));
  }
  return [...DEFAULT_APPOINTMENT_DAYS];
}

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function getWeekdayInTimeZone(d: Date, timeZone: string): number {
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  const w = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(
    d,
  ) as keyof typeof WEEKDAY_SHORT;
  return WEEKDAY_SHORT[w] ?? 0;
}

export function getClockMinutesInTimeZone(d: Date, timeZone: string): number {
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const min = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + min;
}

/** Takvim günü öğleni — Europe/Istanbul için +03 sabit; diğer TZ’lerde tarayıcı yerel öğlen (sınırlı). */
export function calendarDateNoonForWeekdayProbe(dateYmd: string, timeZone: string): Date {
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  if (tz === "Europe/Istanbul") {
    return new Date(`${dateYmd}T12:00:00+03:00`);
  }
  return new Date(`${dateYmd}T12:00:00`);
}

/** Verilen gün için (timezone içindeki takvim günü) uygun randevu başlangıç saatleri (HH:mm) */
export function slotStartLabelsForCalendarDate(
  dateYmd: string,
  days: AppointmentDaySchedule[],
  slotDurationMinutes: number,
  timeZone: string,
): string[] {
  const probe = calendarDateNoonForWeekdayProbe(dateYmd, timeZone);
  if (Number.isNaN(probe.getTime())) return [];
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  const wd = getWeekdayInTimeZone(probe, tz);
  const rule = days.find((x) => x.day === wd);
  if (!rule) return [];
  const open = parseHHMM(rule.start);
  const close = parseHHMM(rule.end);
  if (open == null || close == null || close <= open || slotDurationMinutes < 1) return [];
  const out: string[] = [];
  for (let t = open; t + slotDurationMinutes <= close; t += slotDurationMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
}

export function todayYmdInTimeZone(timeZone: string): string {
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const da = parts.find((p) => p.type === "day")?.value;
  if (!y || !mo || !da) return new Date().toISOString().slice(0, 10);
  return `${y}-${mo}-${da}`;
}

/** Europe/Istanbul için +03:00 ile ISO (Türkiye sürekli yaz saati yok) */
export function naiveLocalToAppointmentIso(dateYmd: string, hhmm: string, timeZone: string): string {
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  if (tz === "Europe/Istanbul") {
    return `${dateYmd}T${hhmm}:00+03:00`;
  }
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const base = new Date(`${dateYmd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  if (Number.isNaN(base.getTime())) return `${dateYmd}T${hhmm}:00Z`;
  return base.toISOString();
}

export function validatePreferredStartAgainstSchedule(
  preferredStart: Date,
  days: AppointmentDaySchedule[],
  slotDurationMinutes: number,
  timeZone: string,
): boolean {
  const tz = timeZone.trim() || DEFAULT_APPOINTMENT_TIMEZONE;
  const wd = getWeekdayInTimeZone(preferredStart, tz);
  const rule = days.find((x) => x.day === wd);
  if (!rule) return false;
  const open = parseHHMM(rule.start);
  const close = parseHHMM(rule.end);
  if (open == null || close == null || close <= open) return false;
  const clock = getClockMinutesInTimeZone(preferredStart, tz);
  const allowed = new Set<number>();
  for (let t = open; t + slotDurationMinutes <= close; t += slotDurationMinutes) {
    allowed.add(t);
  }
  return allowed.has(clock);
}
