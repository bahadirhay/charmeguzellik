import { AppointmentForm } from "@/components/admin/AppointmentForm";
import { AppointmentRowActions } from "@/components/admin/AppointmentRowActions";
import { ReservationWeekCalendar } from "@/components/admin/ReservationWeekCalendar";
import { requirePagePermission } from "@/lib/auth";
import { buildNavTree, collectServiceLabelsFromNav } from "@/lib/navigation";
import { getFirstPublishedAppointmentSchedule } from "@/lib/published-appointment-schedule";
import { prisma } from "@/lib/prisma";

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
  const archivedRows = rows.filter((r) => r.status === "rejected" || r.status === "cancelled");
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Randevular</h1>
        <p className="text-sm text-zinc-500">
          Bu ekran <strong>rezervasyon merkeziniz</strong>: tüm kayıtlar bu projede ve veritabanında tutulur; haftalık
          takvimde yalnızca <strong>aktif</strong> (bekleyen/onaylı) randevular görünür. Red/iptaller otomatik olarak
          ana takvimden düşer ve alttaki ayrı listede tutulur. Yetkili personel <strong>Düzenle</strong> ile tarih ve
          müşteri bilgilerini güncelleyebilir; <strong>Onayla / Reddet</strong> bekleyen talepler içindir. Müşteriye
          e-posta için ortamda{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">RESEND_API_KEY</code> ve{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">MAIL_FROM</code>; WhatsApp için numaraya hazır
          mesaj yeni sekmede açılır.
        </p>
      </div>
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
                  {r.clientName}
                  <div className="text-xs text-zinc-500">{r.clientPhone}</div>
                  {r.clientEmail ? <div className="text-xs text-zinc-500">{r.clientEmail}</div> : null}
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
