import type { PrismaClient } from "@prisma/client";
import { allStaffPermissions } from "@/lib/staff-permissions";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

/**
 * Veritabanında rol satırı yoksa (seed atlanmış vb.) varsayılan üç rolü upsert eder.
 * Personel sayfası ve staff API’leri açılışta çağırır.
 */
export async function ensureDefaultStaffRoles(prisma: PrismaClient) {
  const roleSpecs: { slug: string; label: string; permissions: string[] }[] = [
    { slug: "admin", label: "Yönetici", permissions: [...allStaffPermissions()] },
    {
      slug: "editor",
      label: "Editör",
      permissions: ["content.pages", "content.regions", "content.nav"],
    },
    {
      slug: "scheduler",
      label: "Randevu operatörü",
      permissions: ["crm.appointments"],
    },
    {
      slug: "practitioner",
      label: "Uygulayıcı (yalnızca kendi randevuları)",
      permissions: ["crm.appointments.self"],
    },
  ];
  for (const r of roleSpecs) {
    await prisma.staffRole.upsert({
      where: { tenantId_slug: { tenantId: BOOTSTRAP_TENANT_ID, slug: r.slug } },
      create: {
        tenantId: BOOTSTRAP_TENANT_ID,
        slug: r.slug,
        label: r.label,
        permissionsJson: JSON.stringify(r.permissions),
      },
      update: { label: r.label, permissionsJson: JSON.stringify(r.permissions) },
    });
  }
}
