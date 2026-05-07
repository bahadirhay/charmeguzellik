import Link from "next/link";
import { filterAppointmentsForSelfScope, resolveAppointmentPanelScope } from "@/lib/appointment-panel-access";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/auth";
import { hasStaffPermission } from "@/lib/staff-permissions";

type Props = { searchParams?: Promise<{ forbidden?: string }> };

export default async function AdminDashboardPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const access = await requireStaffPage();
  const p = access.permissions;
  const { scope: apptScope, selfStaffLabel } = resolveAppointmentPanelScope(access);

  const pages = prisma.page.count();
  const leads = prisma.lead.count({ where: { status: "new" } });
  const appointmentsCountPromise =
    apptScope === "self"
      ? prisma.appointment
          .findMany({ where: { status: "pending" }, select: { notes: true } })
          .then((rows) => filterAppointmentsForSelfScope(rows, selfStaffLabel).length)
      : hasStaffPermission(p, "crm.appointments")
        ? prisma.appointment.count({ where: { status: "pending" } })
        : Promise.resolve(0);

  const [pagesCount, leadsCount, appointments] = await Promise.all([pages, leads, appointmentsCountPromise]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Özet</h1>
        <p className="text-sm text-zinc-500">Site, CRM ve randevu durumu.</p>
      </div>
      {sp.forbidden ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Bu bölüme erişim yetkiniz yok. Sol menüden size açık olan sayfaları kullanın.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {hasStaffPermission(p, "content.pages") ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Sayfalar</p>
            <p className="text-2xl font-semibold">{pagesCount}</p>
            <Link href="/admin/pages" className="mt-2 inline-block text-sm text-rose-600">
              Düzenle →
            </Link>
          </div>
        ) : null}
        {hasStaffPermission(p, "content.nav") ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Menü (üst / alt)</p>
            <p className="mt-1 text-xs text-zinc-500">Yeni link: Menü sayfasındaki pembe kutu</p>
            <Link href="/admin/navigation" className="mt-2 inline-block text-sm text-rose-600">
              Menüyü aç →
            </Link>
          </div>
        ) : null}
        {hasStaffPermission(p, "social.instagram") ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Instagram</p>
            <p className="mt-1 text-xs text-zinc-500">Yayınlanacak gönderileri seçin</p>
            <Link href="/admin/instagram" className="mt-2 inline-block text-sm text-rose-600">
              Vitrin →
            </Link>
          </div>
        ) : null}
        {hasStaffPermission(p, "crm.leads") ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Yeni talepler</p>
            <p className="text-2xl font-semibold">{leadsCount}</p>
            <Link href="/admin/crm" className="mt-2 inline-block text-sm text-rose-600">
              CRM →
            </Link>
          </div>
        ) : null}
        {hasStaffPermission(p, "crm.appointments") || hasStaffPermission(p, "crm.appointments.self") ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Bekleyen randevu</p>
            <p className="text-2xl font-semibold">{appointments}</p>
            <Link href="/admin/appointments" className="mt-2 inline-block text-sm text-rose-600">
              Takvim →
            </Link>
          </div>
        ) : null}
      </div>
      {!hasStaffPermission(p, "content.pages") &&
      !hasStaffPermission(p, "content.nav") &&
      !hasStaffPermission(p, "social.instagram") &&
      !hasStaffPermission(p, "crm.leads") &&
      !hasStaffPermission(p, "crm.appointments") &&
      !hasStaffPermission(p, "crm.appointments.self") ? (
        <p className="text-sm text-zinc-500">Bu hesap için özet kutusu tanımlı değil. Sol menüden erişebildiğiniz bölümleri kullanın.</p>
      ) : null}
    </div>
  );
}
