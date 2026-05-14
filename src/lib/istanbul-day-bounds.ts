const ISTANBUL = "Europe/Istanbul";

const ymdFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ISTANBUL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function ymdAtUtcInstant(ms: number): string {
  return ymdFmt.format(new Date(ms));
}

/** İstanbul takvim günü `ymd` (YYYY-MM-DD) için UTC [start, end) aralığı. */
export function istanbulDayUtcRange(ymd: string): { startUtc: Date; endUtc: Date } {
  let lo = Date.UTC(2000, 0, 1);
  let hi = Date.UTC(2100, 0, 1);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ymdAtUtcInstant(mid) < ymd) lo = mid + 1;
    else hi = mid;
  }
  const startMs = lo;
  let endProbe = startMs + 26 * 60 * 60 * 1000;
  while (ymdAtUtcInstant(endProbe - 1) === ymd) {
    endProbe += 60 * 60 * 1000;
  }
  lo = startMs;
  hi = endProbe;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ymdAtUtcInstant(mid) !== ymd) hi = mid;
    else lo = mid + 1;
  }
  return { startUtc: new Date(startMs), endUtc: new Date(lo) };
}

export function getIstanbulTodayYmd(reference = new Date()): string {
  return ymdFmt.format(reference);
}

export function formatYmdInIstanbul(d: Date): string {
  return ymdFmt.format(d);
}

/** `ymd` üzerinden `delta` gün (Gregoryen, İstanbul etiketi ile uyumlu). */
export function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, mo, da] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const u = new Date(Date.UTC(y, mo - 1, da + delta));
  return u.toISOString().slice(0, 10);
}

/** `todayYmd` İstanbul gününü içeren haftanın Pazartesi günü (YYYY-MM-DD). */
export function getIstanbulMondayYmdContaining(todayYmd: string): string {
  const { startUtc } = istanbulDayUtcRange(todayYmd);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: ISTANBUL, weekday: "short" }).format(startUtc);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  const daysBackFromMonday = idx === 0 ? 6 : idx - 1;
  return addCalendarDaysYmd(todayYmd, -daysBackFromMonday);
}

/** Pazartesi `ymd` ile başlayan 7 gün: [startUtc, endExclusiveUtc). */
export function getIstanbulWeekRangeUtcFromMonday(mondayYmd: string): { startUtc: Date; endExclusiveUtc: Date } {
  const startUtc = istanbulDayUtcRange(mondayYmd).startUtc;
  const nextMondayYmd = addCalendarDaysYmd(mondayYmd, 7);
  const endExclusiveUtc = istanbulDayUtcRange(nextMondayYmd).startUtc;
  return { startUtc, endExclusiveUtc };
}

/** `todayYmd` içindeki ayın 1'i (YYYY-MM-DD). */
export function getIstanbulMonthFirstYmdContaining(todayYmd: string): string {
  const [y, m] = todayYmd.split("-").map((x) => Number.parseInt(x, 10));
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Ayın 1'inden sonraki ayın 1'ine kadar [startUtc, endExclusiveUtc). */
export function getIstanbulMonthRangeUtcFromMonthFirst(monthFirstYmd: string): { startUtc: Date; endExclusiveUtc: Date } {
  const startUtc = istanbulDayUtcRange(monthFirstYmd).startUtc;
  const [y, mo] = monthFirstYmd.split("-").map((x) => Number.parseInt(x, 10));
  const ny = mo === 12 ? y + 1 : y;
  const nm = mo === 12 ? 1 : mo + 1;
  const nextFirst = `${ny}-${String(nm).padStart(2, "0")}-01`;
  const endExclusiveUtc = istanbulDayUtcRange(nextFirst).startUtc;
  return { startUtc, endExclusiveUtc };
}
