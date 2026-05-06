"use client";

import { useEffect, useMemo, useState } from "react";

export type ReservationWeekItem = {
  id: string;
  startAt: string;
  clientName: string;
  serviceName: string | null;
  status: string;
};

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

const dayLabelsTr = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const monthLabelsTr = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** Yerel tarih bileşenleri ile `YYYY-MM-DD` (SSR ile istemci saat dilimi farklarında hidrasyon kırılmasını önler). */
function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromCalendarYmd(ymd: string): Date {
  const [yy, mm, dd] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return new Date(NaN);
  return new Date(yy, mm - 1, dd);
}

function statusLabel(status: string) {
  if (status === "approved") return "Onaylı";
  if (status === "rejected") return "Red";
  if (status === "cancelled") return "İptal";
  return "Bekliyor";
}

function statusColor(status: string) {
  if (status === "approved") return "text-emerald-600 dark:text-emerald-400";
  if (status === "rejected") return "text-red-600 dark:text-red-400";
  if (status === "cancelled") return "text-amber-700 dark:text-amber-300";
  return "text-amber-700 dark:text-amber-300";
}

/**
 * SSR + istemci aynı ağacı gönderir (tarihe bağlı içerik yok); sonra useEffect seçili günü ayarlanır → #418 önlenir.
 */
function ReservationCalendarSkeleton() {
  return (
    <section
      className="min-w-0 max-w-full rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900"
      aria-busy
      aria-label="Randevu takvimi yükleniyor"
    >
      <div className="flex w-full justify-end gap-2 sm:flex-row">
        <div className="h-9 max-w-[min(320px,100%)] flex-1 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800 sm:flex-none sm:min-w-[240px]" />
      </div>
      <div className="mt-4 grid min-h-[272px] min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="hidden animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800 lg:block" />
      </div>
    </section>
  );
}

type CalendarComputed = {
  monthStart: Date;
  monthEnd: Date;
  gridDays: Date[];
  byDayKey: Map<string, ReservationWeekItem[]>;
  selectedList: ReservationWeekItem[];
  rangeLabel: string;
  todayKey: string;
};

export function ReservationWeekCalendar({ appointments }: { appointments: ReservationWeekItem[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  /** İlk yüklemede null — sunucu ve hidrasyon aşamasında iskelet; istemciden sonra seçili gün. */
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  useEffect(() => {
    setSelectedYmd(ymdKey(new Date()));
  }, []);

  const computed = useMemo((): CalendarComputed | null => {
    if (selectedYmd === null) return null;
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    mStart.setHours(0, 0, 0, 0);
    const mEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    mEnd.setHours(0, 0, 0, 0);

    const startDay = mStart.getDay();
    const mondayBasedOffset = startDay === 0 ? 6 : startDay - 1;
    const gridStart = addDaysLocal(mStart, -mondayBasedOffset);
    const gridDays = Array.from({ length: 42 }, (_, i) => addDaysLocal(gridStart, i));

    const map = new Map<string, ReservationWeekItem[]>();
    for (const a of appointments) {
      const t = new Date(a.startAt);
      const key = ymdKey(t);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime());
    }

    const selectedList = map.get(selectedYmd) ?? [];
    const rangeLabel = `${monthLabelsTr[mStart.getMonth()]} ${mStart.getFullYear()}`;
    const todayKey = ymdKey(new Date());

    return { monthStart: mStart, monthEnd: mEnd, gridDays, byDayKey: map, selectedList, rangeLabel, todayKey };
  }, [appointments, monthOffset, selectedYmd]);

  if (selectedYmd === null || computed === null) {
    return <ReservationCalendarSkeleton />;
  }

  const { monthStart, monthEnd, gridDays, byDayKey, selectedList, rangeLabel, todayKey } = computed;

  const selectedDate = dateFromCalendarYmd(selectedYmd);

  return (
    <section className="min-w-0 max-w-full rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <div className="grid min-w-0 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:w-auto sm:gap-2">
          <button
            type="button"
            className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 sm:px-3 sm:text-xs dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setMonthOffset((m) => m - 1)}
          >
            ← Önceki
          </button>
          <span className="min-w-0 truncate text-center text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
            {rangeLabel}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 sm:px-3 sm:text-xs dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setMonthOffset((m) => m + 1)}
          >
            Sonraki →
          </button>
        </div>
        <button
          type="button"
          className="w-full shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-800 sm:w-auto sm:text-xs dark:bg-zinc-800 dark:text-zinc-100"
          onClick={() => {
            setMonthOffset(0);
            setSelectedYmd(ymdKey(new Date()));
          }}
        >
          Bu ay
        </button>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 max-w-full rounded-lg border border-zinc-200 p-1.5 sm:p-3 dark:border-zinc-700">
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <div className="mx-auto w-full min-w-0 max-w-full sm:min-w-0">
              <div className="mb-1.5 grid w-full min-w-0 [grid-template-columns:repeat(7,minmax(0,1fr))] gap-px sm:mb-2 sm:gap-1">
                {dayLabelsTr.map((d) => (
                  <span
                    key={d}
                    className="min-w-0 truncate text-center text-[9px] font-medium tabular-nums text-zinc-500 sm:text-[11px]"
                    title={d}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid w-full min-w-0 [grid-template-columns:repeat(7,minmax(0,1fr))] gap-px sm:gap-1">
                {gridDays.map((d) => {
                  const key = ymdKey(d);
                  const list = byDayKey.get(key) ?? [];
                  const inCurrentMonth = d >= monthStart && d <= monthEnd;
                  const isToday = key === todayKey;
                  const isSelected = key === selectedYmd;
                  const approvedCount = list.filter((x) => x.status === "approved").length;
                  const pendingCount = list.filter((x) => x.status === "pending").length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedYmd(key)}
                      className={`flex min-h-[52px] min-w-0 flex-col overflow-hidden rounded border p-1 text-left align-top transition sm:min-h-[68px] sm:rounded-md sm:p-1.5 ${
                        isSelected
                          ? "border-rose-500 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"
                          : isToday
                            ? "border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/20"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      } ${inCurrentMonth ? "" : "opacity-45"}`}
                    >
                      <div className="shrink-0 text-[11px] font-semibold tabular-nums leading-none text-zinc-800 dark:text-zinc-100 sm:text-xs">
                        {d.getDate()}
                      </div>
                      {list.length > 0 ? (
                        <div className="mt-0.5 min-w-0 space-y-px text-[9px] leading-tight sm:mt-1 sm:space-y-0.5 sm:text-[10px]">
                          {pendingCount > 0 ? (
                            <div className="truncate text-amber-700 dark:text-amber-300" title={`${pendingCount} bekliyor`}>
                              <span className="sm:hidden">{pendingCount}b</span>
                              <span className="hidden sm:inline">{pendingCount} bek.</span>
                            </div>
                          ) : null}
                          {approvedCount > 0 ? (
                            <div className="truncate text-emerald-600 dark:text-emerald-400" title={`${approvedCount} onaylı`}>
                              <span className="sm:hidden">{approvedCount}o</span>
                              <span className="hidden sm:inline">{approvedCount} onay</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="mb-2 border-b border-zinc-200 pb-2 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {Number.isFinite(selectedDate.getTime())
                ? selectedDate.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : selectedYmd}
            </h3>
            <p className="text-xs text-zinc-500">Seçili gün randevuları</p>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {selectedList.length === 0 ? (
              <p className="text-xs text-zinc-500">Bu gün için aktif randevu yok.</p>
            ) : (
              selectedList.map((a) => (
                <div
                  key={a.id}
                  className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {new Date(a.startAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} · {a.clientName}
                  </div>
                  {a.serviceName ? <div className="truncate text-zinc-500">{a.serviceName}</div> : null}
                  <div className={`mt-0.5 ${statusColor(a.status)}`}>{statusLabel(a.status)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
