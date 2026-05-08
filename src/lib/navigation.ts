import { prisma } from "@/lib/prisma";
import { buildNavTree, type NavNode } from "@/lib/navigation-shared";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export type { NavNode } from "@/lib/navigation-shared";
export {
  normalizeNavHref,
  buildNavTree,
  findNavParentForServicesMenu,
  collectServiceLabelsFromNav,
} from "@/lib/navigation-shared";

/** `menuSlug`: "header" = sabit üst şerit; "footer" = alt bilgi / menü widget */
export async function getPublishedNavTree(menuSlug: string = "header"): Promise<NavNode[]> {
  const items = await prisma.navItem.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID, published: true, menuSlug },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return buildNavTree(items);
}
