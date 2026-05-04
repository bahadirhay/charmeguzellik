import { SitemapAdminClient } from "@/components/admin/SitemapAdminClient";
import { requirePagePermission } from "@/lib/auth";

export default async function AdminSitemapPage() {
  await requirePagePermission("content.sitemap");
  return <SitemapAdminClient />;
}
