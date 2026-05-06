"use client";

import { useMemo, useState } from "react";

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

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

export function ReservationWeekCalendar({ appointments }: { appointments: ReservationWeekItem[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedYmd, setSelectedYmd] = useState(() => ymdKey(new Date()));

  const { monthStart, monthEnd, gridDays, byDayKey, selectedList } = useMemo(() => {
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    mStart.setHours(0, 0, 0, 0);
    const mEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
    mEnd.setHours(0, 0, 0, 0);

    const startDay = mStart.getDay();
    const mondayBasedOffset = startDay === 0 ? 6 : startDay - 1;
    const gridStart = addDaysLocal(mStart, -mondayBasedOffset);
    const days = Array.from({ length: 42 }, (_, i) => addDaysLocal(gridStart, i));

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

    const selected = map.get(selectedYmd) ?? [];
    return { monthStart: mStart, monthEnd: mEnd, gridDays: days, byDayKey: map, selectedList: selected };
  }, [appointments, monthOffset, selectedYmd]);

  const rangeLabel = `${monthLabelsTr[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
  const selectedDate = new Date(selectedYmd);

  return (
    <section className="min-w-0 max-w-full rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Rezervasyon takvimi</h2>
          <p className="text-xs text-zinc-500">
            Kaynak: bu panel ve veritabanı — harici takvim servisi yok. Randevular yalnızca bu projede saklanır; onay ve
            düzenleme alttaki tablodan yapılır.
          </p>
        </div>
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
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 max-w-full rounded-lg border border-zinc-200 p-1.5 sm:p-3 dark:border-zinc-700">
          {/*
            flex üstünde min-w-0 şart; ayrıca Safari grid + minmax(0,1fr) ve gerekirse yatay kaydırma.
          */}
          <p className="mb-1.5 text-[10px] text-zinc-500 md:hidden">
            Tüm günleri görmek için takvimi yana kaydırabilirsiniz.
          </p>
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
              const isToday = sameLocalDay(d, new Date());
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
              {selectedDate.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
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
