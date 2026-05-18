export function DashboardKpiCard({
  label,
  value,
  sub,
  accent = "violet",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "violet" | "amber" | "rose" | "emerald" | "sky";
}) {
  const ring = {
    violet: "ring-violet-200 dark:ring-violet-900/50",
    amber: "ring-amber-200 dark:ring-amber-900/50",
    rose: "ring-rose-200 dark:ring-rose-900/50",
    emerald: "ring-emerald-200 dark:ring-emerald-900/50",
    sky: "ring-sky-200 dark:ring-sky-900/50",
  }[accent];
  return (
    <div
      className={`rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm ring-1 ring-inset ${ring} dark:border-zinc-800 dark:bg-zinc-900`}
    >
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}
