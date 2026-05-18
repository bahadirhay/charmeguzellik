import Link from "next/link";
import { DashboardKpiCard } from "@/components/admin/dashboard/DashboardKpiCard";
import { DashboardOverduePendingPanel } from "@/components/admin/dashboard/DashboardOverduePendingPanel";
import { formatTryMinor, statusLabelTr } from "@/components/admin/dashboard/format-dashboard";
import type {
  DashboardAppointmentsBlock,
  DashboardCommerceBlock,
  DashboardKpiData,
} from "@/components/admin/dashboard/types";

type Props = {
  greetingName: string;
  todayLabel: string;
  kpi: DashboardKpiData | null;
  appointments: DashboardAppointmentsBlock | null;
  commerce: DashboardCommerceBlock | null;
};

export function DashboardMobileSummary({ greetingName, todayLabel, kpi, appointments, commerce }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-zinc-500">Hoş geldiniz{greetingName ? `, ${greetingName}` : ""} 👋</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bugün neler olmuş?</h2>
        <p className="mt-2 inline-flex rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          📅 {todayLabel}
        </p>
      </div>

      {kpi ? (
        <section className="grid grid-cols-2 gap-3">
          <DashboardKpiCard label="Bugün randevu" value={kpi.appointmentsToday} accent="violet" />
          <DashboardKpiCard label="Bekleyen onay" value={kpi.pendingApprovals} accent="amber" />
          <DashboardKpiCard label="Gecikmiş onay" value={kpi.overduePending} accent="rose" />
          <DashboardKpiCard label="Bugün ciro" value={formatTryMinor(kpi.dailyRevenueMinor)} accent="emerald" />
          <div className="col-span-2">
            <DashboardKpiCard label="Bu ay ciro" value={formatTryMinor(kpi.monthRevenueMinor)} accent="sky" />
          </div>
        </section>
      ) : null}

      {appointments && appointments.overduePending.length > 0 ? (
        <DashboardOverduePendingPanel items={appointments.overduePending} />
      ) : null}

      {appointments ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Yaklaşan randevular</h3>
            <Link href="/admin/appointments" className="text-xs font-medium text-violet-700 dark:text-violet-300">
              Tümü
            </Link>
          </div>
          {appointments.upcomingToday.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {appointments.upcomingToday.map((a) => (
                <li key={a.id} className="flex gap-3 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                  <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {a.timeLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/appointments?appt=${encodeURIComponent(a.id)}`}
                      className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      {a.clientName}
                    </Link>
                    <p className="text-xs text-zinc-500">{a.serviceName}</p>
                    <p className="text-[10px] text-zinc-400">{statusLabelTr(a.status)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-center text-xs text-zinc-500">Bugün için randevu yok.</p>
          )}
        </section>
      ) : null}

      {appointments ? (
        <section className="grid grid-cols-2 gap-2">
          <QuickLink href="/admin/appointments" label="Randevular" value={String(appointments.today)} sub="bugün" />
          <QuickLink
            href="/admin/appointments"
            label="Bekleyen"
            value={String(appointments.pendingActionable)}
            sub="aktif"
          />
        </section>
      ) : null}

      {commerce ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Kasa</h3>
            <Link href="/admin/commerce" className="text-xs text-violet-700 dark:text-violet-300">
              Aç →
            </Link>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatTryMinor(commerce.today.sumMinor)}
          </p>
          <p className="text-xs text-zinc-500">{commerce.today.receiptCount} tahsilat bugün</p>
        </section>
      ) : null}
    </div>
  );
}

function QuickLink({
  href,
  label,
  value,
  sub,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-[10px] text-zinc-400">{sub}</p>
    </Link>
  );
}
