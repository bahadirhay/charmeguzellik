import { WhatsappAdminClient } from "@/components/admin/WhatsappAdminClient";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminWhatsappPage() {
  await requirePagePermission("site.settings");
  let row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.siteSettings.create({ data: { id: 1 } });
  }
  return <WhatsappAdminClient initial={row} />;
}
