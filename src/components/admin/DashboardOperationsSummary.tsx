import Link from "next/link";

export type DashboardWeekAppointmentRow = {
  id: string;
  timeLabel: string;
  title: string;
};

export type DashboardWeekDayColumn = {
  ymd: string;
  heading: string;
  isToday: boolean;
  appointments: DashboardWeekAppointmentRow[];
  moreCount: number;
};

export type DashboardCommercePeriod = { receiptCount: number; sumMinor: number };

export type DashboardStaffPeriod = {
  total: number;
  /** Randevuda atanan personele göre geldi/gelmedi (checked_in / no_show) kayıtları */
  operations: number;
  cashEntries: number;
};

export type DashboardStaffWorkRow = {
  staffUserId: string;
  displayLabel: string;
  username: string;
  today: DashboardStaffPeriod;
  week: DashboardStaffPeriod;
  month: DashboardStaffPeriod;
};

export type DashboardOperationsSummaryProps = {
  appointments:
    | null
    | {
        pending: number;
        today: number;
        todayLabel: string;
        toRemind: number;
        toRemindItems: Array<{ id: string; label: string }>;
        completedToday: number;
        completedThisWeek: number;
        weekStrip: {
          rangeHint: string;
          days: DashboardWeekDayColumn[];
        };
      };
  commerce:
    | null
    | {
        activePackages: number;
        today: DashboardCommercePeriod;
        week: DashboardCommercePeriod;
        month: DashboardCommercePeriod;
      };
  staffWork:
    | null
    | {
        totals: {
          today: DashboardStaffPeriod;
          week: DashboardStaffPeriod;
          month: DashboardStaffPeriod;
        };
        byStaff: DashboardStaffWorkRow[];
      };
  /** Rapor sayfasına gidebilecek yetkiler (ör. randevu + kasa yöneticileri) */
  showReportsLink?: boolean;
};

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-950/30">
      <p className="text-xs font-medium uppercase tracking-wide text-white/80 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white dark:text-zinc-50">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-white/70 dark:text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function formatTryMinor(minor: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(
    minor / 100,
  );
}

function StaffStatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-indigo-200/40 bg-white/10 px-4 py-3 backdrop-blur-sm dark:border-indigo-900/50 dark:bg-zinc-950/30">
      <p className="text-xs font-medium uppercase tracking-wide text-indigo-100/90 dark:text-indigo-300/90">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white dark:text-zinc-50">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-indigo-100/75 dark:text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function StaffPeriodMini({
  label,
  period,
}: {
  label: string;
  period: DashboardStaffPeriod;
}) {
  return (
    <div className="rounded-lg border border-indigo-200/25 bg-white/5 px-2 py-2 dark:border-indigo-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-100/85 dark:text-indigo-300/85">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-white dark:text-zinc-50">{period.total}</p>
      <p className="text-[10px] text-indigo-100/75 dark:text-zinc-500">
        Operasyon {period.operations} · Kasa {period.cashEntries}
      </p>
    </div>
  );
}

export function DashboardOperationsSummary({
  appointments,
  commerce,
  staffWork,
  showReportsLink = false,
}: DashboardOperationsSummaryProps) {
  const showSecondary = Boolean(commerce || staffWork);

  return (
    <div className="space-y-4">
      {appointments ? (
        <section className="overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 shadow-lg dark:border-rose-900/40 dark:from-rose-950 dark:via-rose-950 dark:to-zinc-950">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Randevular</h2>
              <p className="mt-1 text-sm text-rose-100/90">İşlem özeti — önce randevu</p>
            </div>
            <Link
              href="/admin/appointments"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 transition hover:bg-white/25"
            >
              Takvime git →
            </Link>
          </div>
          <div className="grid gap-3 border-t border-white/15 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Bekleyen onay" value={appointments.pending} />
            <StatTile label="Bugün" value={appointments.today} hint={appointments.todayLabel} />
            <StatTile
              label="Gerçekleşen bugün"
              value={appointments.completedToday}
              hint="Check-in (bugünkü saat)"
            />
            <StatTile
              label="Gerçekleşen bu hafta"
              value={appointments.completedThisWeek}
              hint="Check-in (Pzt–Paz, İstanbul)"
            />
          </div>
          <div className="border-t border-white/15 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">
              Hatırlatılacak ({appointments.toRemind})
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">Teyit bekleyen onaylı randevular — satıra gitmek için tıklayın.</p>
            {appointments.toRemindItems.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {appointments.toRemindItems.map((item) => (
                  <li key={item.id} className="min-w-0 sm:max-w-[20rem]">
                    <Link
                      href={`/admin/appointments?appt=${encodeURIComponent(item.id)}`}
                      className="block truncate rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-left text-sm text-white ring-1 ring-white/10 transition hover:bg-white/20 hover:ring-white/25"
                      title={item.label}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-white/55">Teyit bekleyen onaylı randevu yok.</p>
            )}
          </div>
          <div className="border-t border-white/15 px-5 pb-5 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">Bu hafta — onaylı &amp; teyitli</p>
            <p className="mt-0.5 text-xs text-white/65">{appointments.weekStrip.rangeHint}</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {appointments.weekStrip.days.map((d) => (
                <div
                  key={d.ymd}
                  className={`min-w-[7.75rem] shrink-0 rounded-lg border px-2 py-2 ${
                    d.isToday ? "border-white/50 bg-white/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  <p className="text-[11px] font-semibold leading-tight text-white">{d.heading}</p>
                  <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                    {d.appointments.map((a) => (
                      <li key={a.id} className="text-[11px] leading-snug text-white/90">
                        <span className="tabular-nums text-white/70">{a.timeLabel}</span>
                        <span className="block truncate" title={a.title}>
                          {a.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {d.appointments.length === 0 ? <p className="mt-1 text-[10px] text-white/45">—</p> : null}
                  {d.moreCount > 0 ? (
                    <p className="mt-1 text-[10px] font-medium text-amber-200/90">+{d.moreCount} daha</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showSecondary ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {commerce ? (
            <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-600 to-teal-900 p-5 shadow-md dark:border-emerald-900/40 dark:from-emerald-950 dark:to-zinc-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Ticaret</h2>
                  <p className="mt-1 text-sm text-emerald-100/85">Kasa tahsilatları (İstanbul takvimi)</p>
                </div>
                <Link
                  href="/admin/commerce"
                  className="text-sm font-medium text-emerald-50 underline-offset-2 hover:underline"
                >
                  Panele git →
                </Link>
              </div>
              <div className="mt-3 max-w-xs rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-white/80">Aktif paket</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">{commerce.activePackages}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Bugün kasa"
                  value={commerce.today.receiptCount}
                  hint={formatTryMinor(commerce.today.sumMinor)}
                />
                <StatTile
                  label="Bu hafta kasa"
                  value={commerce.week.receiptCount}
                  hint={formatTryMinor(commerce.week.sumMinor)}
                />
                <StatTile
                  label="Bu ay kasa"
                  value={commerce.month.receiptCount}
                  hint={formatTryMinor(commerce.month.sumMinor)}
                />
              </div>
              <p className="mt-2 text-[11px] text-emerald-100/70">Tahsilat satırı sayısı; alt satır toplam tutar.</p>
            </section>
          ) : null}

          {staffWork ? (
            <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-600 to-violet-950 p-5 shadow-md dark:border-indigo-900/40 dark:from-indigo-950 dark:to-zinc-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Kullanıcıların yaptığı işler</h2>
                  <p className="mt-1 text-sm text-indigo-100/85">
                    Operasyon özeti — randevuda atanan personel (geldi / gelmedi) ve kasa (İstanbul takvimi)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
                  <Link
                    href="/admin/appointments"
                    className="text-indigo-50 underline-offset-2 hover:underline"
                  >
                    Randevular →
                  </Link>
                  {showReportsLink ? (
                    <Link href="/admin/rapor" className="text-indigo-50 underline-offset-2 hover:underline">
                      Rapor →
                    </Link>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-indigo-100/90">Toplam</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <StaffStatTile
                  label="Bugün"
                  value={staffWork.totals.today.total}
                  hint={`Operasyon ${staffWork.totals.today.operations} · Kasa ${staffWork.totals.today.cashEntries}`}
                />
                <StaffStatTile
                  label="Bu hafta"
                  value={staffWork.totals.week.total}
                  hint={`Operasyon ${staffWork.totals.week.operations} · Kasa ${staffWork.totals.week.cashEntries}`}
                />
                <StaffStatTile
                  label="Bu ay"
                  value={staffWork.totals.month.total}
                  hint={`Operasyon ${staffWork.totals.month.operations} · Kasa ${staffWork.totals.month.cashEntries}`}
                />
              </div>
              {staffWork.byStaff.length > 0 ? (
                <div className="mt-5 border-t border-white/15 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-indigo-100/90">Personel</p>
                  <p className="mt-0.5 text-[11px] text-indigo-100/70">
                    Her satırda aynı personelin bugün / bu hafta / bu ay operasyon (geldi veya gelmedi) ve kasa kaydı
                    sayıları.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {staffWork.byStaff.map((s) => (
                      <li
                        key={s.staffUserId}
                        className="rounded-xl border border-white/15 bg-white/5 p-3 dark:border-indigo-900/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white" title={s.displayLabel}>
                            {s.displayLabel}
                          </p>
                          <p className="text-[11px] text-indigo-100/70">@{s.username}</p>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <StaffPeriodMini label="Bugün" period={s.today} />
                          <StaffPeriodMini label="Bu hafta" period={s.week} />
                          <StaffPeriodMini label="Bu ay" period={s.month} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
