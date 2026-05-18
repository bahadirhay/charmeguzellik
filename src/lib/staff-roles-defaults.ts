import type { PrismaClient } from "@prisma/client";
import { allStaffPermissions, editorStaffPermissions } from "@/lib/staff-permissions";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

/**
 * Veritabanında rol satırı yoksa (seed atlanmış vb.) varsayılan rolleri upsert eder.
 * Personel sayfası ve staff API’leri açılışta çağırır.
 */
export async function ensureDefaultStaffRoles(
  prisma: PrismaClient,
  tenantId: string = BOOTSTRAP_TENANT_ID,
) {
  const roleSpecs: { slug: string; label: string; permissions: string[] }[] = [
    { slug: "admin", label: "Yönetici", permissions: [...allStaffPermissions()] },
    {
      slug: "editor",
      label: "Editör",
      permissions: [...editorStaffPermissions()],
    },
    {
      slug: "scheduler",
      label: "Randevu operatörü",
      permissions: ["crm.appointments"],
    },
    {
      slug: "commerce",
      label: "Ticaret (kasa, paket, cari)",
      permissions: ["commerce.manage"],
    },
    {
      slug: "practitioner",
      label: "Uygulayıcı (yalnızca kendi randevuları)",
      permissions: ["crm.appointments.self"],
    },
    {
      slug: "demo",
      label: "Demo (satış)",
      permissions: ["crm.leads", "crm.appointments", "commerce.manage", "users.manage"],
    },
  ];
  for (const r of roleSpecs) {
    await prisma.staffRole.upsert({
      where: { tenantId_slug: { tenantId, slug: r.slug } },
      create: {
        tenantId,
        slug: r.slug,
        label: r.label,
        permissionsJson: JSON.stringify(r.permissions),
      },
      update: { label: r.label, permissionsJson: JSON.stringify(r.permissions) },
    });
  }
}
