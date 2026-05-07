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

export default async function AppointmentsPage() {
  await requirePagePermission("crm.appointments");
  const [rows, headerNav, footerNav, appointmentSchedule] = await Promise.all([
    prisma.appointment.findMany({ orderBy: { startAt: "desc" } }),
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
  const activeRows = rows.filter((r) => r.status === "pending" || r.status === "approved");
  const cancelRequestRows = rows.filter((r) => r.status === "cancel_request");
  const archivedRows = rows.filter((r) => r.status === "rejected" || r.status === "cancelled");
  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Randevular</h1>
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
                  {new Date(r.startAt).toLocaleString("tr-TR")}
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
              {cancelRequestRows.map((r) => (
                <tr key={r.id} className="border-b border-amber-100/70 dark:border-amber-900/20">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.startAt).toLocaleString("tr-TR")}</td>
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
              {cancelRequestRows.length === 0 ? (
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
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.startAt).toLocaleString("tr-TR")}</td>
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
