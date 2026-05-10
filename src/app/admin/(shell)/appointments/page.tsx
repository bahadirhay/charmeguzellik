import Link from "next/link";
import { AdminAppointmentPushBanner } from "@/components/admin/AdminAppointmentPushBanner";
import { AdminWhatsAppButton } from "@/components/admin/AdminWhatsAppButton";
import { AppointmentForm } from "@/components/admin/AppointmentForm";
import { AppointmentRowActions } from "@/components/admin/AppointmentRowActions";
import { ReservationWeekCalendar } from "@/components/admin/ReservationWeekCalendar";
import { filterAppointmentsForSelfScope, resolveAppointmentPanelScope } from "@/lib/appointment-panel-access";
import { waPrefillForAppointment } from "@/lib/admin-whatsapp-prefill";
import { parseAssignedStaffFromNotes, resolveServiceStaffMap } from "@/lib/appointment-staffing";
import { requirePagePermission } from "@/lib/auth";
import { buildNavTree, collectServiceLabelsFromNav } from "@/lib/navigation";
import { getFirstPublishedAppointmentFormRef, getFirstPublishedAppointmentSchedule } from "@/lib/published-appointment-schedule";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsForTenant } from "@/lib/site-settings";
import { requireAppointmentModulePage } from "@/lib/require-appointment-module-page";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AppointmentsPageProps = {
  searchParams?: Promise<{ view?: string }>;
};

const CUSTOMER_RESCHEDULE_NOTE_PREFIX = "Müşteri takvim güncelledi (bağlantı):";
const CUSTOMER_CANCEL_REQUEST_NOTE_PREFIX = "Müşteri iptal etti (bağlantı):";
const PANEL_CANCEL_NOTE_PREFIX = "Panel iptal onayı:";
const REMINDER_NOTE_PREFIX = "Teyit hatırlatması gönderildi:";
const APPOINTMENT_TZ = "Europe/Istanbul";

function formatAppointmentDateTime(d: Date): string {
  return new Date(d).toLocaleString("tr-TR", { timeZone: APPOINTMENT_TZ });
}

function appointmentStaffCell(notes: string | null | undefined): string {
  return parseAssignedStaffFromNotes(notes)?.trim() || "—";
}

function parseCancelledByFromNotes(notes: string | null | undefined): string | null {
  const raw = notes?.trim() ?? "";
  if (!raw) return null;
  const line = raw
    .split("\n")
    .map((x) => x.trim())
    .find((x) => x.startsWith(PANEL_CANCEL_NOTE_PREFIX));
  if (!line) return null;
  const value = line.slice(PANEL_CANCEL_NOTE_PREFIX.length).trim();
  const actor = value.split(" (")[0]?.trim();
  return actor || null;
}

function parseLastReminderInfo(notes: string | null | undefined): string | null {
  const raw = notes?.trim() ?? "";
  if (!raw) return null;
  const lines = raw
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(REMINDER_NOTE_PREFIX));
  const last = lines.length > 0 ? lines[lines.length - 1] : null;
  if (!last) return null;
  const value = last.slice(REMINDER_NOTE_PREFIX.length).trim();
  return value || null;
}

function hasStaffAccessToService(
  serviceName: string,
  serviceStaffMap: Record<string, string[]>,
  staffLabel: string | null | undefined,
): boolean {
  const normalizedStaff = staffLabel?.trim().toLocaleLowerCase("tr-TR");
  if (!normalizedStaff) return false;
  const staffList = serviceStaffMap[serviceName.trim().toLocaleLowerCase("tr-TR")] ?? [];
  return staffList.some((s) => s.trim().toLocaleLowerCase("tr-TR") === normalizedStaff);
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const access = await requirePagePermission(["crm.appointments", "crm.appointments.self"]);
  await requireAppointmentModulePage();
  const tenantId = await getTenantIdForRequest();
  const { scope: appointmentScope, selfStaffLabel } = resolveAppointmentPanelScope(access);

  let effectiveSelfLabel = selfStaffLabel;
  if (appointmentScope === "self" && access.staffUserId) {
    const su = await prisma.staffUser.findFirst({
      where: { id: access.staffUserId, tenantId },
      select: { displayName: true },
    });
    effectiveSelfLabel = su?.displayName?.trim() ?? null;
  }

  const params = (await searchParams) ?? {};
  const view =
    params.view === "rescheduled" || params.view === "cancel_link"
      ? params.view
      : "all";
  const reminderWindowStart = new Date(Date.now() + 23 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    allRows,
    headerNav,
    footerNav,
    appointmentSchedule,
    settings,
    appointmentFormRef,
    reminderSentLast24h,
    reminderFailedLast24h,
    upcomingReminderEligibleCount,
    lastReminderCronEvent,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId },
      orderBy: { startAt: "asc" },
    }),
    prisma.navItem.findMany({
      where: { tenantId, published: true, menuSlug: "header" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.navItem.findMany({
      where: { tenantId, published: true, menuSlug: "footer" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    getFirstPublishedAppointmentSchedule(tenantId),
    getSiteSettingsForTenant(tenantId).then((s) => ({ themeTokensJson: s.themeTokensJson })),
    getFirstPublishedAppointmentFormRef(tenantId),
    prisma.appointmentEvent.count({
      where: {
        tenantId,
        eventType: "reminder_sent",
        outcome: "success",
        channel: "email",
        createdAt: { gte: last24h },
      },
    }),
    prisma.appointmentEvent.count({
      where: {
        tenantId,
        eventType: "reminder_sent",
        outcome: "failed",
        channel: "email",
        createdAt: { gte: last24h },
      },
    }),
    prisma.appointment.count({
      where: {
        tenantId,
        status: "approved",
        startAt: { gte: reminderWindowStart, lte: reminderWindowEnd },
      },
    }),
    prisma.appointmentEvent.findFirst({
      where: {
        tenantId,
        eventType: "reminder_sent",
        createdAt: { gte: last24h },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, actor: true, outcome: true, channel: true },
    }),
  ]);
  const rows =
    appointmentScope === "self" ? filterAppointmentsForSelfScope(allRows, effectiveSelfLabel) : allRows;
  const serviceStaffMap = await resolveServiceStaffMap(prisma, settings.themeTokensJson, tenantId);
  const fromHeader = collectServiceLabelsFromNav(buildNavTree(headerNav));
  const fromFooter = collectServiceLabelsFromNav(buildNavTree(footerNav));
  const baseServiceOptions =
    fromHeader.length > 0
      ? fromHeader
      : fromFooter.length > 0
        ? fromFooter
        : [];
  const serviceOptions =
    appointmentScope === "self"
      ? baseServiceOptions.filter((svc) => hasStaffAccessToService(svc, serviceStaffMap, effectiveSelfLabel))
      : baseServiceOptions;
  const activeRowsBase = rows
    .filter((r) => r.status === "pending" || r.status === "approved" || r.status === "confirmed")
    .sort((a, b) => {
      const statusRank = (s: string) => {
        if (s === "pending") return 0;
        if (s === "confirmed") return 1;
        return 2;
      };
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
  const cancelPanelCount = Math.max(0, cancelRequestRows.length - cancelLinkCount);
  const activeRows =
    view === "rescheduled" ? activeRowsBase.filter((r) => isCustomerRescheduled(r.notes)) : activeRowsBase;
  const visibleCancelRequestRows =
    view === "cancel_link" ? cancelRequestRows.filter((r) => isCancelRequestFromLink(r.notes)) : cancelRequestRows;
  const cancelledRows = rows.filter((r) => r.status === "cancelled");
  const cancelledByStaffRows = cancelledRows.filter((r) => Boolean(parseCancelledByFromNotes(r.notes)));
  const completedRows = rows.filter((r) => r.status === "checked_in" || r.status === "no_show");
  const archivedRows = rows.filter(
    (r) => r.status === "rejected" || (r.status === "cancelled" && !parseCancelledByFromNotes(r.notes)),
  );
  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Randevular</h1>
        {appointmentScope === "self" ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            Yalnızca size atanan randevuları görüyorsunuz. Randevu ataması{" "}
            <strong>Görünen ad</strong> ile yapılır; bu ad yalnızca Personel & roller hesabınızda tanımlıdır ve
            Personel Planlama’da aynı hesap seçildiğinde eşleşir.
            {!effectiveSelfLabel?.trim()
              ? " Şu anda görünen ad boş — yönetici Personel ekranından tanımlamalı."
              : null}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          Calisma saatleri ve slot araligi icin{" "}
          <Link href="/admin/pages" className="text-rose-600 hover:underline">
            Sayfalar duzenleyici
          </Link>{" "}
          icindeki randevu formu blok ayarlarini guncelleyin.
          {appointmentScope === "full" ? (
            <>
              {" "}
              Personel-hizmet atama icin{" "}
              <Link href="/admin/appointments/personel-planlama" className="text-rose-600 hover:underline">
                Personel Planlama
              </Link>{" "}
              ekranini kullanin.
            </>
          ) : null}
        </p>
      </header>
      <AdminAppointmentPushBanner />
      <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Hatırlatma Merkezi (son 24 saat)</h2>
        <div className="mt-2 grid gap-2 text-xs text-blue-900 dark:text-blue-200 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/40">
            <div className="text-[11px] text-blue-700 dark:text-blue-300">E-posta başarılı</div>
            <div className="text-lg font-semibold">{reminderSentLast24h}</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/40">
            <div className="text-[11px] text-blue-700 dark:text-blue-300">E-posta hatalı</div>
            <div className="text-lg font-semibold">{reminderFailedLast24h}</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/40">
            <div className="text-[11px] text-blue-700 dark:text-blue-300">24 saat içinde hatırlatma adayı</div>
            <div className="text-lg font-semibold">{upcomingReminderEligibleCount}</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/40">
            <div className="text-[11px] text-blue-700 dark:text-blue-300">Son olay</div>
            <div className="text-[12px] font-medium">
              {lastReminderCronEvent
                ? `${new Date(lastReminderCronEvent.createdAt).toLocaleString("tr-TR")} · ${lastReminderCronEvent.channel ?? "?"} · ${
                    lastReminderCronEvent.outcome === "success" ? "ok" : "hata"
                  }`
                : "Kayıt yok"}
            </div>
          </div>
        </div>
      </section>
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
          <AppointmentForm
            serviceOptions={serviceOptions}
            schedule={appointmentSchedule}
            serviceStaffMap={serviceStaffMap}
            appointmentFormRef={appointmentFormRef}
            lockedStaffName={appointmentScope === "self" ? effectiveSelfLabel : null}
          />
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
              <th className="px-3 py-2">Personel</th>
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
                <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                  {appointmentStaffCell(r.notes)}
                </td>
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
                  {parseLastReminderInfo(r.notes) ? (
                    <div className="mb-2 text-[11px] text-blue-700 dark:text-blue-300">
                      Son teyit mesajı: {parseLastReminderInfo(r.notes)}
                    </div>
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
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                  Aktif randevu yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <details className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <summary className="cursor-pointer text-sm font-semibold text-amber-900 dark:text-amber-100">
          Eski/manuel iptal talepleri ({cancelRequestRows.length})
        </summary>
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
          Müşteri linkten gelen talepler: {cancelLinkCount} · Panelden başlatılanlar: {cancelPanelCount}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-amber-200 bg-amber-100/50 dark:border-amber-900/40 dark:bg-amber-950/30">
              <tr>
                <th className="px-3 py-2">Başlangıç</th>
                <th className="px-3 py-2">Hizmet</th>
                <th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Durum / işlem</th>
              </tr>
            </thead>
            <tbody>
              {visibleCancelRequestRows.map((r) => (
                <tr key={r.id} className="border-b border-amber-100/70 dark:border-amber-900/20">
                  <td className="px-3 py-2 whitespace-nowrap">{formatAppointmentDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.serviceName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                    {appointmentStaffCell(r.notes)}
                  </td>
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
                    <span className="mb-2 inline-block rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {isCancelRequestFromLink(r.notes)
                        ? "Müşteri linkten iptal talebi gönderdi"
                        : "Panelden iptal talebi başlatıldı"}
                    </span>
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
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Bekleyen müşteri iptal talebi yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
      <details className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
        <summary className="cursor-pointer text-sm font-semibold text-rose-900 dark:text-rose-100">
          İptal ettiklerim ({cancelledByStaffRows.length})
        </summary>
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          Panelden iptali onaylanan kayıtlar. İptal eden kullanıcı ayrıca gösterilir.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-rose-200 bg-rose-100/50 dark:border-rose-900/40 dark:bg-rose-950/30">
              <tr>
                <th className="px-3 py-2">Başlangıç</th>
                <th className="px-3 py-2">Hizmet</th>
                <th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Durum / işlem</th>
                <th className="px-3 py-2">İptal eden</th>
              </tr>
            </thead>
            <tbody>
              {cancelledByStaffRows.map((r) => (
                <tr key={r.id} className="border-b border-rose-100/70 dark:border-rose-900/20">
                  <td className="px-3 py-2 whitespace-nowrap">{formatAppointmentDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.serviceName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">{appointmentStaffCell(r.notes)}</td>
                  <td className="px-3 py-2">
                    {r.clientName}
                    <div className="text-xs text-zinc-500">{r.clientPhone}</div>
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
                  <td className="px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                    {parseCancelledByFromNotes(r.notes) ?? "—"}
                  </td>
                </tr>
              ))}
              {cancelledByStaffRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Henüz panelden onaylanmış iptal yok.
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
                <th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {archivedRows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 whitespace-nowrap">{formatAppointmentDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.serviceName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                    {appointmentStaffCell(r.notes)}
                  </td>
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
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Henüz iptal veya red kaydı yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
      <details className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          Operasyon geçmişi — geldi / gelmedi ({completedRows.length})
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-emerald-200 bg-emerald-100/50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <tr>
                <th className="px-3 py-2">Başlangıç</th>
                <th className="px-3 py-2">Hizmet</th>
                <th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2">Müşteri</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {completedRows.map((r) => (
                <tr key={r.id} className="border-b border-emerald-100/70 dark:border-emerald-900/20">
                  <td className="px-3 py-2 whitespace-nowrap">{formatAppointmentDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.serviceName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">{appointmentStaffCell(r.notes)}</td>
                  <td className="px-3 py-2">
                    {r.clientName}
                    <div className="text-xs text-zinc-500">{r.clientPhone}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.status === "checked_in" ? (
                      <span className="text-emerald-700 dark:text-emerald-300">Geldi</span>
                    ) : (
                      <span className="text-zinc-700 dark:text-zinc-300">Gelmedi</span>
                    )}
                  </td>
                </tr>
              ))}
              {completedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                    Henüz geldi / gelmedi kaydı yok.
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
