"use client";

import { useMemo, useState } from "react";

export type ReservationWeekItem = {
  id: string;
  startAt: string;
  clientName: string;
  serviceName: string | null;
  status: string;
};

function startOfMondayLocal(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const dayLabelsTr = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ReservationWeekCalendar({ appointments }: { appointments: ReservationWeekItem[] }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { monday, weekKeys, byDay } = useMemo(() => {
    const mon = startOfMondayLocal(new Date());
    const shifted = addDaysLocal(mon, weekOffset * 7);
    const keys = Array.from({ length: 7 }, (_, i) => addDaysLocal(shifted, i));

    const map = new Map<number, ReservationWeekItem[]>();
    for (let i = 0; i < 7; i += 1) map.set(i, []);

    for (const a of appointments) {
      const t = new Date(a.startAt);
      for (let i = 0; i < 7; i += 1) {
        if (sameLocalDay(t, keys[i]!)) {
          map.get(i)!.push(a);
          break;
        }
      }
    }
    for (let i = 0; i < 7; i += 1) {
      map.get(i)!.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime());
    }

    return { monday: shifted, weekKeys: keys, byDay: map };
  }, [appointments, weekOffset]);

  const rangeLabel = `${monday.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} – ${addDaysLocal(
    monday,
    6,
  ).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`;

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
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            ← Önceki hafta
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{rangeLabel}</span>
          <button
            type="button"
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            Sonraki hafta →
          </button>
          <button
            type="button"
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
            onClick={() => setWeekOffset(0)}
          >
            Bu hafta
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const dayDate = weekKeys[i]!;
          const list = byDay.get(i) ?? [];
          const isToday = sameLocalDay(new Date(), dayDate);
          return (
            <div
              key={i}
              className={`flex min-h-[140px] flex-col rounded-lg border p-2 text-xs ${
                isToday
                  ? "border-rose-400 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/30"
                  : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-950/40"
              }`}
            >
              <div className="mb-2 font-semibold text-zinc-800 dark:text-zinc-100">
                {dayLabelsTr[i]}{" "}
                <span className="font-normal text-zinc-500">
                  {dayDate.toLocaleDateString("tr-TR", { day: "numeric", month: "numeric" })}
                </span>
              </div>
              <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                {list.length === 0 ? (
                  <span className="text-zinc-400">—</span>
                ) : (
                  list.map((a) => (
                    <div
                      key={a.id}
                      className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-[11px] leading-snug dark:border-zinc-600 dark:bg-zinc-900"
                    >
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {new Date(a.startAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="truncate text-zinc-800 dark:text-zinc-200">{a.clientName}</div>
                      {a.serviceName ? (
                        <div className="truncate text-zinc-500">{a.serviceName}</div>
                      ) : null}
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        <span
                          className={
                            a.status === "approved"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : a.status === "rejected"
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-700 dark:text-amber-300"
                          }
                        >
                          {a.status === "approved" ? "Onaylı" : a.status === "rejected" ? "Red" : "Bekliyor"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
