import Link from "next/link";
import { DashboardKpiCard } from "@/components/admin/dashboard/DashboardKpiCard";
import { DashboardOverduePendingPanel } from "@/components/admin/dashboard/DashboardOverduePendingPanel";
import { formatTryMinor, statusLabelTr } from "@/components/admin/dashboard/format-dashboard";
import type {
  DashboardAppointmentsBlock,
  DashboardCommerceBlock,
  DashboardKpiData,
  DashboardStaffWorkBlock,
} from "@/components/admin/dashboard/types";

type Props = {
  greetingName: string;
  todayLabel: string;
  kpi: DashboardKpiData | null;
  appointments: DashboardAppointmentsBlock | null;
  commerce: DashboardCommerceBlock | null;
  staffWork: DashboardStaffWorkBlock | null;
  showReportsLink?: boolean;
};

export function DashboardDesktopSummary({
  greetingName,
  todayLabel,
  kpi,
  appointments,
  commerce,
  staffWork,
  showReportsLink = false,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Ana Sayfa</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Hoş geldiniz{greetingName ? `, ${greetingName}` : ""} — bugün neler olmuş birlikte bakalım.
          </p>
        </div>
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          📅 {todayLabel}
        </p>
      </div>

      {kpi ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <DashboardKpiCard
            label="Bugünkü randevular"
            value={kpi.appointmentsToday}
            sub={
              appointments
                ? `${appointments.todayPending} bekleyen · ${appointments.todayCancelRequests} iptal talebi (ayrı liste)`
                : "Takvimle aynı: bekleyen, onaylı, teyitli"
            }
            accent="violet"
          />
          <DashboardKpiCard
            label="Bekleyen onaylar"
            value={kpi.pendingApprovals}
            sub="Tüm tarihler — henüz saati geçmemiş"
            accent="amber"
          />
          <DashboardKpiCard
            label="Gecikmiş onay"
            value={kpi.overduePending}
            sub="Tarihi geçmiş, hâlâ bekliyor"
            accent="rose"
          />
          <DashboardKpiCard label="Bugünkü ciro" value={formatTryMinor(kpi.dailyRevenueMinor)} accent="emerald" />
          <DashboardKpiCard label="Bu ayın cirosu" value={formatTryMinor(kpi.monthRevenueMinor)} accent="sky" />
        </section>
      ) : null}

      {appointments && appointments.overduePending.length > 0 ? (
        <DashboardOverduePendingPanel items={appointments.overduePending} />
      ) : null}

      {appointments ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <section className="xl:col-span-2 space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Bugünkü randevu takvimi</h3>
                <p className="text-xs text-zinc-500">{appointments.todayLabel}</p>
              </div>
              <Link
                href="/admin/appointments"
                className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
              >
                Takvime git →
              </Link>
            </div>
            {appointments.upcomingToday.length > 0 ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {appointments.upcomingToday.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                      {a.timeLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/appointments?appt=${encodeURIComponent(a.id)}`}
                        className="font-medium text-zinc-900 hover:text-rose-600 dark:text-zinc-100"
                      >
                        {a.clientName}
                      </Link>
                      <p className="truncate text-xs text-zinc-500">{a.serviceName}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {statusLabelTr(a.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500">Bugün için planlı randevu yok.</p>
            )}
            <div className="grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-4 dark:border-zinc-800">
              <MiniStat label="Bekleyen (aktif)" value={appointments.pendingActionable} />
              <MiniStat label="Bugün toplam" value={appointments.today} />
              <MiniStat label="Geldi bugün" value={appointments.completedToday} />
              <MiniStat label="Geldi bu hafta" value={appointments.completedThisWeek} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Yaklaşan / hatırlatma</h3>
            <p className="text-xs text-zinc-500">Teyit bekleyen onaylı randevular</p>
            {appointments.toRemindItems.length > 0 ? (
              <ul className="space-y-2">
                {appointments.toRemindItems.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/admin/appointments?appt=${encodeURIComponent(item.id)}`}
                      className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-700 dark:hover:border-violet-800 dark:hover:bg-violet-950/20"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Teyit bekleyen kayıt yok.</p>
            )}
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500">Bu hafta — onaylı &amp; teyitli</p>
              <p className="text-[11px] text-zinc-400">{appointments.weekStrip.rangeHint}</p>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {appointments.weekStrip.days.map((d) => (
                  <div
                    key={d.ymd}
                    className={`min-w-[4.5rem] shrink-0 rounded-lg border px-2 py-1.5 text-center text-[10px] ${
                      d.isToday
                        ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40"
                        : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/50"
                    }`}
                  >
                    <p className="font-semibold text-zinc-700 dark:text-zinc-200">{d.heading}</p>
                    <p className="mt-0.5 tabular-nums text-zinc-500">
                      {d.appointments.length}
                      {d.moreCount > 0 ? `+${d.moreCount}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {(commerce || staffWork) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {commerce ? (
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Kasa özeti</h3>
                <Link href="/admin/commerce" className="text-sm text-violet-700 hover:underline dark:text-violet-300">
                  Ticaret →
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Bugün" value={commerce.today.receiptCount} hint={formatTryMinor(commerce.today.sumMinor)} />
                <MiniStat label="Bu hafta" value={commerce.week.receiptCount} hint={formatTryMinor(commerce.week.sumMinor)} />
                <MiniStat label="Bu ay" value={commerce.month.receiptCount} hint={formatTryMinor(commerce.month.sumMinor)} />
              </div>
              <p className="mt-2 text-xs text-zinc-500">Aktif paket: {commerce.activePackages}</p>
            </section>
          ) : null}
          {staffWork ? (
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Personel iş özeti</h3>
                {showReportsLink ? (
                  <Link href="/admin/rapor" className="text-sm text-violet-700 hover:underline dark:text-violet-300">
                    Rapor →
                  </Link>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Bugün" value={staffWork.totals.today.total} hint={`Op ${staffWork.totals.today.operations}`} />
                <MiniStat label="Hafta" value={staffWork.totals.week.total} />
                <MiniStat label="Ay" value={staffWork.totals.month.total} />
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/50">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      {hint ? <p className="text-[10px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}
