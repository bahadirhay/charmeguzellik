/** Türkiye saati sabit UTC+3 (yaz-kış saati yok). */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → o günün İstanbul yerel aralığı (UTC `Date`). */
export function istanbulDayBoundsUtc(ymd: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Tarih YYYY-MM-DD olmalı");
  }
  const start = new Date(`${ymd}T00:00:00.000+03:00`);
  const end = new Date(`${ymd}T23:59:59.999+03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Geçersiz tarih");
  }
  return { start, end };
}

/** İstanbul yerel günü `YYYY-MM-DD` string (UTC anından). */
export function formatYmdIstanbul(d: Date): string {
  const t = d.getTime() + TR_OFFSET_MS;
  const u = new Date(t);
  const y = u.getUTCFullYear();
  const m = String(u.getUTCMonth() + 1).padStart(2, "0");
  const day = String(u.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
