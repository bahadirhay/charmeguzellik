import type { Prisma } from "@prisma/client";

/** Paket tahsilatı cari `payment` satırıyla birlikte kasa defterine yansır (gün sonu toplamları). */
export async function recordCashReceiptForPackagePayment(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    crmContactId: string;
    amountMinor: number;
    method: string;
    memo: string | null;
    paidAt: Date;
    ledgerEntryId: string;
    staffUserId: string | null;
  },
): Promise<void> {
  await tx.commerceCashReceipt.create({
    data: {
      tenantId: input.tenantId,
      occurredAt: input.paidAt,
      amountMinor: Math.abs(input.amountMinor),
      method: input.method,
      memo: input.memo?.trim() || null,
      sourceKind: "package_payment",
      crmContactId: input.crmContactId,
      staffUserId: input.staffUserId,
      ledgerEntryId: input.ledgerEntryId,
    },
  });
}
