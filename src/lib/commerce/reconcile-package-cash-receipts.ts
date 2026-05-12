import type { PrismaClient } from "@prisma/client";

/**
 * Paket tahsilatı cari satırı (`CommerceLedgerEntry` refType=package_payment) varken
 * eşleşen `CommerceCashReceipt` yoksa oluşturur (eski veri veya hatalı süreç sonrası onarım).
 */
export async function reconcilePackagePaymentCashReceipts(
  db: PrismaClient,
  tenantId: string,
): Promise<{ inserted: number }> {
  const ledgers = await db.commerceLedgerEntry.findMany({
    where: {
      tenantId,
      refType: "package_payment",
      kind: "payment",
      cashReceipt: { is: null },
    },
    take: 3000,
    orderBy: { occurredAt: "asc" },
  });

  let inserted = 0;
  for (const le of ledgers) {
    if (!le.refId) continue;
    const pay = await db.commercePackagePayment.findFirst({
      where: { id: le.refId, tenantId },
      include: { purchase: { select: { crmContactId: true } } },
    });
    if (!pay) continue;
    const amount = Math.abs(le.amountMinor);
    if (amount <= 0) continue;
    try {
      await db.commerceCashReceipt.create({
        data: {
          tenantId,
          occurredAt: pay.paidAt,
          amountMinor: amount,
          method: pay.method,
          memo: pay.memo,
          sourceKind: "package_payment",
          crmContactId: pay.purchase.crmContactId,
          staffUserId: null,
          ledgerEntryId: le.id,
        },
      });
      inserted += 1;
    } catch {
      // Örn. yarışta aynı ledgerEntryId — yoksay
    }
  }
  return { inserted };
}
