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
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Rezervasyon takvimi</h2>
          <p className="text-xs text-zinc-500">
            Kaynak: bu panel ve veritabanı — harici takvim servisi yok. Randevular yalnızca bu projede saklanır; onay ve
            düzenleme alttaki tablodan yapılır.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setMonthOffset((m) => m - 1)}
          >
            ← Önceki ay
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{rangeLabel}</span>
          <button
            type="button"
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setMonthOffset((m) => m + 1)}
          >
            Sonraki ay →
          </button>
          <button
            type="button"
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
            onClick={() => {
              setMonthOffset(0);
              setSelectedYmd(ymdKey(new Date()));
            }}
          >
            Bu ay
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-500">
            {dayLabelsTr.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                  className={`min-h-[68px] rounded-md border p-1.5 text-left transition ${
                    isSelected
                      ? "border-rose-500 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"
                      : isToday
                        ? "border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/20"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  } ${inCurrentMonth ? "" : "opacity-45"}`}
                >
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{d.getDate()}</div>
                  {list.length > 0 ? (
                    <div className="mt-1 space-y-0.5 text-[10px]">
                      {pendingCount > 0 ? <div className="text-amber-700 dark:text-amber-300">{pendingCount} bek.</div> : null}
                      {approvedCount > 0 ? <div className="text-emerald-600 dark:text-emerald-400">{approvedCount} onay</div> : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
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
