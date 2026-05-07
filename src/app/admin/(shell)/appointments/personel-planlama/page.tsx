import Link from "next/link";
import { AppointmentStaffPlanningForm } from "@/components/admin/AppointmentStaffPlanningForm";
import { getServiceStaffMap } from "@/lib/appointment-staffing";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppointmentStaffPlanningPage() {
  await requirePagePermission("crm.appointments");
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { themeTokensJson: true },
  });
  const initialMap = getServiceStaffMap(row?.themeTokensJson);

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
      <AppointmentStaffPlanningForm initialMap={initialMap} />
    </div>
  );
}

