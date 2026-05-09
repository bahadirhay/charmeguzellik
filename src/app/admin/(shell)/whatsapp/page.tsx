import { WhatsappAdminClient } from "@/components/admin/WhatsappAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { getSiteSettingsForTenant } from "@/lib/site-settings";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export default async function AdminWhatsappPage() {
  await requirePagePermission("site.settings");
  const tenantId = await getTenantIdForRequest();
  const row = await getSiteSettingsForTenant(tenantId);
  return <WhatsappAdminClient initial={row} />;
}
