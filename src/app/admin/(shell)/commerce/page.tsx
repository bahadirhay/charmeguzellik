import { CommerceHubClient } from "@/components/admin/CommerceHubClient";
import { requirePagePermission } from "@/lib/staff-auth";
import { prisma, withPrismaEngine } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { isCommerceModuleEnabled } from "@/lib/tenant-features";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  await requirePagePermission("commerce.manage");
  const tenantId = await getTenantIdForRequest();
  const tenantRow = await withPrismaEngine(() =>
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } }),
  );
  if (!isCommerceModuleEnabled(tenantRow?.featuresJson)) {
    redirect("/admin/dashboard");
  }
  return <CommerceHubClient />;
}
