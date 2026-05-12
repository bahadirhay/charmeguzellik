import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CommercePackagePaymentRow = Prisma.CommercePackagePaymentGetPayload<object>;

/** Prisma istemcisinde `purchase.payments` include’u eksik/bozuk olsa bile tahsilat satırlarını yükler. */
export async function loadPackagePaymentsByPurchaseIds(
  tenantId: string,
  purchaseIds: string[],
): Promise<Map<string, CommercePackagePaymentRow[]>> {
  const byPurchase = new Map<string, CommercePackagePaymentRow[]>();
  if (!purchaseIds.length) return byPurchase;
  const rows = await prisma.commercePackagePayment.findMany({
    where: { tenantId, purchaseId: { in: purchaseIds } },
    orderBy: { paidAt: "desc" },
  });
  for (const row of rows) {
    const list = byPurchase.get(row.purchaseId) ?? [];
    list.push(row);
    byPurchase.set(row.purchaseId, list);
  }
  return byPurchase;
}
