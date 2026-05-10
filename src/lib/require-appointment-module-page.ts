import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAppointmentsModuleEnabled } from "@/lib/tenant-features";
import { getTenantIdForRequest } from "@/lib/tenant-db";

/** Randevu ekranları: modül kapalıysa özet sayfasına. */
export async function requireAppointmentModulePage() {
  const tenantId = await getTenantIdForRequest();
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } });
  if (!isAppointmentsModuleEnabled(t?.featuresJson)) {
    redirect("/admin/dashboard?forbidden=appointment_module");
  }
}
