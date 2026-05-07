import Link from "next/link";
import { AdminAppointmentPushBanner } from "@/components/admin/AdminAppointmentPushBanner";
import { AdminWhatsAppButton } from "@/components/admin/AdminWhatsAppButton";
import { AppointmentForm } from "@/components/admin/AppointmentForm";
import { AppointmentRowActions } from "@/components/admin/AppointmentRowActions";
import { ReservationWeekCalendar } from "@/components/admin/ReservationWeekCalendar";
import { waPrefillForAppointment } from "@/lib/admin-whatsapp-prefill";
import { requirePagePermission } from "@/lib/auth";
import { buildNavTree, collectServiceLabelsFromNav } from "@/lib/navigation";
import { getFirstPublishedAppointmentSchedule } from "@/lib/published-appointment-schedule";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AppointmentsPageProps = {
  searchParams?: Promise<{ view?: string }>;
};

const CUSTOMER_RESCHEDULE_NOTE_PREFIX = "Müşteri takvim güncelledi (bağlantı):";
const CUSTOMER_CANCEL_REQUEST_NOTE_PREFIX = "Müşteri iptal talebi (bağlantı):";
const APPOINTMENT_TZ = "Europe/Istanbul";

function formatAppointmentDateTime(d: Date): string {
  return new Date(d).toLocaleString("tr-TR", { timeZone: APPOINTMENT_TZ });
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  await requirePagePermission("crm.appointments");
  const params = (await searchParams) ?? {};
  const view =
    params.view === "rescheduled" || params.view === "cancel_link"
      ? params.view
      : "all";
  const [rows, headerNav, footerNav, appointmentSchedule] = await Promise.all([
    prisma.appointment.findMany({ orderBy: { startAt: "asc" } }),
    prisma.navItem.findMany({
      where: { published: true, menuSlug: "header" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.navItem.findMany({
      where: { published: true, menuSlug: "footer" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    getFirstPublishedAppointmentSchedule(),
  ]);
  const fromHeader = collectServiceLabelsFromNav(buildNavTree(headerNav));
  const fromFooter = collectServiceLabelsFromNav(buildNavTree(footerNav));
  const serviceOptions =
    fromHeader.length > 0
      ? fromHeader
      : fromFooter.length > 0
        ? fromFooter
        : [];
  const activeRowsBase = rows
    .filter((r) => r.status === "pending" || r.status === "approved")
    .sort((a, b) => {
      const statusRank = (s: string) => (s === "pending" ? 0 : 1);
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return a.startAt.getTime() - b.startAt.getTime();
    });
  const isCustomerRescheduled = (notes: string | null | undefined) =>
    Boolean(notes?.includes(CUSTOMER_RESCHEDULE_NOTE_PREFIX));
  const isCancelRequestFromLink = (notes: string | null | undefined) =>
    Boolean(notes?.includes(CUSTOMER_CANCEL_REQUEST_NOTE_PREFIX));
  const cancelRequestRows = rows.filter((r) => r.status === "cancel_request");
  const rescheduledCount = activeRowsBase.filter((r) => isCustomerRescheduled(r.notes)).length;
  const cancelLinkCount = cancelRequestRows.filter((r) => isCancelRequestFromLink(r.notes)).length;
  const activeRows =
    view === "rescheduled" ? activeRowsBase.filter((r) => isCustomerRescheduled(r.notes)) : activeRowsBase;
  const visibleCancelRequestRows =
    view === "cancel_link" ? cancelRequestRows.filter((r) => isCancelRequestFromLink(r.notes)) : cancelRequestRows;
  const archivedRows = rows.filter((r) => r.status === "rejected" || r.status === "cancelled");
  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Randevular</h1>
        <p className="mt-2 text-xs text-zinc-500">
          Calisma saatleri ve slot araligi icin{" "}
          <Link href="/admin/pages" className="text-rose-600 hover:underline">
            Sayfalar duzenleyici
          </Link>{" "}
          icindeki randevu formu blok ayarlarini guncelleyin.
        </p>
      </header>
      <AdminAppointmentPushBanner />
      <ReservationWeekCalendar
        appointments={activeRows.map((r) => ({
          id: r.id,
          startAt: r.startAt.toISOString(),
          clientName: r.clientName,
          serviceName: r.serviceName,
          status: r.status,
        }))}
      />
      <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer list-none">
          <span className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Randevu ekle
          </span>
        </summary>
        <div className="mt-4">
          <AppointmentForm serviceOptions={serviceOptions} schedule={appointmentSchedule} />
        </div>
      </details>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Sıralama: <strong>Bekleyenler önce</strong>, ardından onaylılar; her grupta <strong>en yakın tarih üstte</strong>.
        </div>
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
          <Link
            href="/admin/appointments"
            className={`rounded-full px-3 py-1 ${view === "all" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}
          >
            Tümü ({activeRowsBase.length})
          </Link>
          <Link
            href="/admin/appointments?view=rescheduled"
            className={`rounded-full px-3 py-1 ${view === "rescheduled" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}
          >
            Müşteri güncelledi ({rescheduledCount})
          </Link>
          <Link
            href="/admin/appointments?view=cancel_link"
            className={`rounded-full px-3 py-1 ${view === "cancel_link" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}`}
          >
            Linkten iptal talebi ({cancelLinkCount})
          </Link>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-2">Başlangıç</th>
              <th className="px-3 py-2">Hizmet</th>
              <th className="px-3 py-2">Müşteri</th>
              <th className="px-3 py-2">Durum / işlem</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatAppointmentDateTime(r.startAt)}
                </td>
                <td className="px-3 py-2">{r.serviceName}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.clientName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{r.clientPhone}</span>
                    <AdminWhatsAppButton
                      phone={r.clientPhone}
                      prefilledMessage={waPrefillForAppointment(r.clientName, r.startAt.toISOString(), r.serviceName)}
                      label="WhatsApp"
                    />
                  </div>
                  {r.clientEmail ? <div className="mt-0.5 text-xs text-zinc-500">{r.clientEmail}</div> : null}
                </td>
                <td className="px-3 py-2 align-top">
                  {isCustomerRescheduled(r.notes) ? (
                    <span className="mb-2 inline-block rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Müşteri linkten takvim güncelledi
                    </span>
                  ) : null}
                  <AppointmentRowActions
                    id={r.id}
                    startAtIso={r.startAt.toISOString()}
                    serviceName={r.serviceName}
                    clientName={r.clientName}
                    clientEmail={r.clientEmail}
                    clientPhone={r.clientPhone}
                    notes={r.notes}
                    status={r.status}
                    serviceOptions={serviceOptions}
                  />
                </td>
              </tr>
            ))}
            {activeRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                  Aktif randevu yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <details className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <summary className="cursor-pointer text-sm font-semibold text-amber-900 dark:text-amber-100">
          Müşteri iptal talepleri ({cancelRequestRows.length})
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-amber-200 bg-amber-100/50 dark:border-amber-900/40 dark:bg-amber-950/30">
              <tr>
                <th className="px-3 py-2">Başlangıç</th>
                <th className="px-3 py-2">Hizmet</th>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Durum / işlem</th>
              </tr>
            </thead>
            <tbody>
              {visibleCancelRequestRows.map((r) => (
                <tr key={r.id} className="border-b border-amber-100/70 dark:border-amber-900/20">
                  <td className="px-3 py-2 whitespace-nowrap">{formatAppointmentDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.serviceName}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.clientName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <span>{r.clientPhone}</span>
                      <AdminWhatsAppButton
                        phone={r.clientPhone}
                        prefilledMessage={waPrefillForAppointment(r.clientName, r.startAt.toISOString(), r.serviceName)}
                        label="WhatsApp"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {isCancelRequestFromLink(r.notes) ? (
                      <span className="mb-2 inline-block rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        Müşteri linkten iptal talebi gönderdi
                      </span>
                    ) : null}
                    <AppointmentRowActions
                      id={r.id}
                      startAtIso={r.startAt.toISOString()}
                      serviceName={r.serviceName}
                      clientName={r.clientName}
                      clientEmail={r.clientEmail}
                      clientPhone={r.clientPhone}
                      notes={r.notes}
                      status={r.status}
                      serviceOptions={serviceOptions}
                    />
                  </td>
                </tr>
              ))}
              {visibleCancelRequestRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Bekleyen müşteri iptal talebi yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
      <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          İptal / red geçmişi ({archivedRows.length})
        </summary>
        <p className="mt-2 text-xs text-zinc-500">
          Bu kayıtlar slotu tekrar müsaite düşürdüğü için ana takvimde gösterilmez.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
              <tr>
                <th className="px-3 py-2">Başlangıç</th>
                <th className="px-3 py-2">Hizmet</th>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {archivedRows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 whitespace-nowrap">{formatAppointmentDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.serviceName}</td>
                  <td className="px-3 py-2">
                    {r.clientName}
                    <div className="text-xs text-zinc-500">{r.clientPhone}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.status === "cancelled" ? (
                      <span className="text-amber-700 dark:text-amber-300">İptal</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Reddedildi</span>
                    )}
                  </td>
                </tr>
              ))}
              {archivedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Henüz iptal veya red kaydı yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
