import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ADMIN_REPORT_PERMISSION_KEYS } from "@/lib/admin-reports-gate";
import { notesAssignedStaffMatchesLabel, resolveAppointmentPanelScope } from "@/lib/appointment-panel-access";
import { denyIfAppointmentsDisabled } from "@/lib/appointments-module-guard";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { addCalendarDaysYmd, getIstanbulTodayYmd, istanbulDayUtcRange } from "@/lib/istanbul-day-bounds";
import { prisma, withPrismaEngine } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/auth";
import { hasStaffPermission } from "@/lib/staff-permissions";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

function ymdOr(v: string | undefined, fallback: string): string {
  const t = v?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : fallback;
}

const reportEventInclude = {
  appointment: { select: { id: true, clientName: true, notes: true, startAt: true } },
} as const satisfies Prisma.AppointmentEventInclude;

type ReportEventRow = Prisma.AppointmentEventGetPayload<{ include: typeof reportEventInclude }>;

const reportCashInclude = {
  staffUser: { select: { username: true, displayName: true } },
  appointment: { select: { clientName: true } },
} as const satisfies Prisma.CommerceCashReceiptInclude;

type ReportCashRow = Prisma.CommerceCashReceiptGetPayload<{ include: typeof reportCashInclude }>;

function exportHref(fromYmd: string, toYmd: string, type: string): string {
  const p = new URLSearchParams({ from: fromYmd, to: toYmd, type });
  return `/api/admin/reports/export?${p.toString()}`;
}

function CsvDownloadCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      </div>
      <a
        href={href}
        className="mt-3 inline-flex w-fit shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        CSV indir
      </a>
    </div>
  );
}

export default async function AdminReportPage({ searchParams }: Props) {
  const access = await requirePagePermission([...ADMIN_REPORT_PERMISSION_KEYS]);
  const p = access.permissions;
  const qp = (await searchParams) ?? {};
  const todayYmd = getIstanbulTodayYmd();
  const fromYmd = ymdOr(qp.from, addCalendarDaysYmd(todayYmd, -30));
  const toYmd = ymdOr(qp.to, todayYmd);
  const { startUtc: fromUtc } = istanbulDayUtcRange(fromYmd);
  const { endUtc: toDayEnd } = istanbulDayUtcRange(toYmd);
  const toExclusive = new Date(toDayEnd.getTime());

  const tenantId = await getTenantIdForRequest();
  const { scope: apptScope, selfStaffLabel } = resolveAppointmentPanelScope(access);

  const canEvents = hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self");
  const canCash = hasStaffPermission(p, "commerce.manage");
  const canLeads = hasStaffPermission(p, "crm.leads");
  const canUsers = hasStaffPermission(p, "users.manage");

  const apptForbidden = canEvents ? await denyIfAppointmentsDisabled() : null;
  const commerceForbidden = canCash ? await denyIfCommerceModuleDisabled() : null;

  const { eventsPreview, cashPreview } = await withPrismaEngine(async () => {
    let ev: ReportEventRow[] = [];
    if (canEvents && !apptForbidden) {
      const raw = await prisma.appointmentEvent.findMany({
        where: { tenantId, createdAt: { gte: fromUtc, lt: toExclusive } },
        include: reportEventInclude,
        orderBy: { createdAt: "desc" },
        take: 150,
      });
      ev =
        apptScope === "self" && selfStaffLabel?.trim()
          ? raw.filter(
              (r) =>
                r.appointment &&
                notesAssignedStaffMatchesLabel(r.appointment.notes, selfStaffLabel),
            )
          : raw;
    }
    let cash: ReportCashRow[] = [];
    if (canCash && !commerceForbidden) {
      cash = await prisma.commerceCashReceipt.findMany({
        where: { tenantId, occurredAt: { gte: fromUtc, lt: toExclusive } },
        include: reportCashInclude,
        orderBy: { occurredAt: "desc" },
        take: 150,
      });
    }
    return { eventsPreview: ev, cashPreview: cash };
  });

  const h = (type: string) => exportHref(fromYmd, toYmd, type);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Rapor</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tarih aralığı İstanbul takvimine göre uygulanır. Aşağıdaki CSV dosyaları UTF-8 (BOM) olarak indirilir; her
          rapor türü için yetki ayrıdır.
        </p>
      </div>

      <form
        method="get"
        action="/admin/rapor"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Başlangıç (YYYY-MM-DD)</span>
          <input
            type="text"
            name="from"
            defaultValue={fromYmd}
            pattern="\d{4}-\d{2}-\d{2}"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Bitiş (YYYY-MM-DD)</span>
          <input
            type="text"
            name="to"
            defaultValue={toYmd}
            pattern="\d{4}-\d{2}-\d{2}"
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Uygula
        </button>
      </form>

      {canEvents && apptForbidden ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">Randevu modülü kapalı; randevu raporları kullanılamaz.</p>
      ) : null}
      {canCash && commerceForbidden ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">Ticaret modülü kapalı; kasa ve cari raporları kullanılamaz.</p>
      ) : null}

      {canEvents && !apptForbidden ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Randevu ve operasyon</h2>
          <p className="text-xs text-zinc-500">
            Randevu satırları <span className="font-medium">başlangıç zamanına</span> göre; olaylar{" "}
            <span className="font-medium">oluşturulma zamanına</span> göre filtrelenir. Onaylı, teyitli, iptal vb. tüm
            durumlar randevu CSV&apos;sinde <span className="font-medium">status</span> sütununda yer alır.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CsvDownloadCard
              title="Randevu olayları"
              description="Panel / e-posta / hatırlatma vb. tüm randevu olay kayıtları (actor, sonuç, detay)."
              href={h("events")}
            />
            <CsvDownloadCard
              title="Randevular (tüm durumlar)"
              description="Seçilen aralıkta başlayan randevular: pending, approved, confirmed, iptal, geldi/gelmedi…"
              href={h("appointments")}
            />
            <CsvDownloadCard
              title="Yapılan hizmetler (geldi / gelmedi)"
              description="Operasyon geçmişi ile aynı: checked_in ve no_show; atanmış personel etiketi dahil."
              href={h("operations")}
            />
          </div>
        </section>
      ) : null}

      {canCash && !commerceForbidden ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Kasa, cari ve paket</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CsvDownloadCard
              title="Kasa tahsilatları"
              description="Tahsilat satırları: yöntem, personel, randevu / CRM bağlantısı."
              href={h("cash")}
            />
            <CsvDownloadCard
              title="Cari hareketler"
              description="Cari defter satırları (charge / payment); dönem içinde hareket tarihine göre."
              href={h("ledger")}
            />
            <CsvDownloadCard
              title="CRM cari bakiyeleri"
              description="Her müşteri kartı için güncel toplam bakiye (tüm hareketlerden hesaplanır)."
              href={h("crm_balances")}
            />
            <CsvDownloadCard
              title="Paket ödemeleri"
              description="Paket satışına yapılan tahsilatlar; ödeme zamanına göre."
              href={h("package_payments")}
            />
            <CsvDownloadCard
              title="Paket satışları"
              description="Satın alınan paketler; satın alma zamanına göre."
              href={h("package_purchases")}
            />
            <CsvDownloadCard
              title="Kasa gün sonu"
              description="İş günü bazlı gün sonu kayıtları; işletme tarihine göre."
              href={h("cash_day_closes")}
            />
            <CsvDownloadCard
              title="Prim tahakkukları"
              description="Komisyon tahakkuk kayıtları; oluşturulma zamanına göre."
              href={h("commission_accruals")}
            />
          </div>
        </section>
      ) : null}

      {canLeads ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">CRM formları</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CsvDownloadCard
              title="Leadler"
              description="Web formu / manuel lead kayıtları; oluşturulma zamanına göre."
              href={h("leads")}
            />
          </div>
        </section>
      ) : null}

      {canUsers ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Personel hesapları</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CsvDownloadCard
              title="Panel kullanıcıları (personel)"
              description="Aktif personel listesi ve temel alanlar (tarih aralığı dosya adı için kullanılır)."
              href={h("staff_users")}
            />
          </div>
        </section>
      ) : null}

      {canEvents && !apptForbidden ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Önizleme — randevu olayları</h2>
            <a
              href={h("events")}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Tam CSV
            </a>
          </div>
          <p className="text-xs text-zinc-500">Son {eventsPreview.length} kayıt.</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="px-2 py-2">Zaman</th>
                  <th className="px-2 py-2">Olay</th>
                  <th className="px-2 py-2">Kanal</th>
                  <th className="px-2 py-2">Sonuç</th>
                  <th className="px-2 py-2">İşlem yapan</th>
                  <th className="px-2 py-2">Randevu</th>
                </tr>
              </thead>
              <tbody>
                {eventsPreview.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 dark:text-zinc-400">
                      {r.createdAt.toLocaleString("tr-TR")}
                    </td>
                    <td className="px-2 py-1.5">{r.eventType}</td>
                    <td className="px-2 py-1.5">{r.channel ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.outcome}</td>
                    <td className="px-2 py-1.5">{r.actor ?? "—"}</td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5" title={r.appointment?.clientName ?? ""}>
                      {r.appointment?.clientName ?? r.appointmentId}
                    </td>
                  </tr>
                ))}
                {eventsPreview.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-zinc-500">
                      Kayıt yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canCash && !commerceForbidden ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Önizleme — kasa tahsilatları</h2>
            <a
              href={h("cash")}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Tam CSV
            </a>
          </div>
          <p className="text-xs text-zinc-500">Son {cashPreview.length} kayıt.</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="px-2 py-2">Zaman</th>
                  <th className="px-2 py-2">Tutar</th>
                  <th className="px-2 py-2">Yöntem</th>
                  <th className="px-2 py-2">Personel</th>
                  <th className="px-2 py-2">Not</th>
                  <th className="px-2 py-2">Randevu</th>
                </tr>
              </thead>
              <tbody>
                {cashPreview.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-600 dark:text-zinc-400">
                      {r.occurredAt.toLocaleString("tr-TR")}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{formatTryFromMinor(r.amountMinor)}</td>
                    <td className="px-2 py-1.5">{r.method}</td>
                    <td className="px-2 py-1.5">
                      {r.staffUser?.displayName?.trim() || r.staffUser?.username || "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-2 py-1.5" title={r.memo ?? ""}>
                      {r.memo ?? "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-2 py-1.5">{r.appointment?.clientName ?? "—"}</td>
                  </tr>
                ))}
                {cashPreview.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-zinc-500">
                      Kayıt yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p className="text-xs text-zinc-500">
        CSV başına en fazla 50.000 satır. Personel (self) randevu yetkisinde dışa aktarmalar yalnızca size atanmış
        randevularla sınırlıdır; kasa ve cari raporları tam kiracı kapsamındadır.{" "}
        <Link href="/admin/dashboard" className="text-rose-600 hover:underline">
          Özete dön
        </Link>
      </p>
    </div>
  );
}
