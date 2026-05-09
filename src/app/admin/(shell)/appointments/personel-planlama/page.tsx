import Link from "next/link";
import { AppointmentStaffPlanningForm } from "@/components/admin/AppointmentStaffPlanningForm";
import { coerceAppointmentStaffMapToIds } from "@/lib/appointment-staffing";
import { requirePagePermission } from "@/lib/auth";
import { buildNavTree, collectServiceLabelsFromNav } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppointmentStaffPlanningPage() {
  await requirePagePermission("crm.appointments");
  const tenantId = await getTenantIdForRequest();
  const [row, headerNav, footerNav, staffDirectory] = await Promise.all([
    prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { themeTokensJson: true },
    }),
    prisma.navItem.findMany({
      where: { tenantId, published: true, menuSlug: "header" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.navItem.findMany({
      where: { tenantId, published: true, menuSlug: "footer" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.staffUser.findMany({
      where: {
        tenantId,
        active: true,
        displayName: { not: null },
      },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: "asc" }],
    }),
  ]);

  const initialIdMap = await coerceAppointmentStaffMapToIds(prisma, row?.themeTokensJson, tenantId);
  const fromHeader = collectServiceLabelsFromNav(buildNavTree(headerNav));
  const fromFooter = collectServiceLabelsFromNav(buildNavTree(footerNav));
  const serviceOptions =
    fromHeader.length > 0 ? fromHeader : fromFooter.length > 0 ? fromFooter : [];

  const staffEntries = staffDirectory
    .map((u) => ({ id: u.id, displayName: (u.displayName ?? "").trim() }))
    .filter((u) => u.displayName.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/admin/appointments" className="text-rose-600 hover:underline">
            Randevular
          </Link>{" "}
          <span className="text-zinc-400">/</span> Personel Planlama
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Personel Planlama</h1>
      </div>
      <AppointmentStaffPlanningForm
        initialIdMap={initialIdMap}
        serviceOptions={serviceOptions}
        staffDirectory={staffEntries}
      />
    </div>
  );
}
