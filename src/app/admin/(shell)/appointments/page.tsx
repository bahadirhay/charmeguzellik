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
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Randevular</h1>
        <p className="text-sm text-zinc-500">
          Bu ekran <strong>rezervasyon merkeziniz</strong>: tüm kayıtlar bu projede ve veritabanında tutulur; haftalık
          takvim ve tablo ile görüntülenir. Yetkili personel <strong>Düzenle</strong> ile tarih ve müşteri bilgilerini
          güncelleyebilir; <strong>Onayla / Reddet</strong> bekleyen talepler içindir. Müşteriye e-posta için ortamda{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">RESEND_API_KEY</code> ve{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">MAIL_FROM</code>; WhatsApp için numaraya hazır
          mesaj yeni sekmede açılır.
        </p>
      </div>
      <ReservationWeekCalendar
        appointments={rows.map((r) => ({
          id: r.id,
          startAt: r.startAt.toISOString(),
          clientName: r.clientName,
          serviceName: r.serviceName,
          status: r.status,
        }))}
      />
      <AppointmentForm serviceOptions={serviceOptions} schedule={appointmentSchedule} />
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
            {rows.map((r) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
