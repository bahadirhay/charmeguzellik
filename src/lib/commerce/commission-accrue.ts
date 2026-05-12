import type { PrismaClient } from "@prisma/client";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { parseAssignedStaffFromNotes } from "@/lib/appointment-staffing";

/**
 * Randevu oluşunca: eşleşen aktif prim kuralı varsa bekleyen prim satırı yazar (tutar = yüzde + sabit).
 */
export async function accrueCommissionForNewAppointment(
  prisma: PrismaClient,
  tenantId: string,
  appointmentId: string,
  serviceName: string | null | undefined,
  notes: string | null | undefined,
  quotedPriceMinor: number | null | undefined,
): Promise<void> {
  const dup = await prisma.commerceCommissionAccrual.findFirst({
    where: { tenantId, appointmentId },
    select: { id: true },
  });
  if (dup) return;

  const price = quotedPriceMinor ?? 0;
  if (price <= 0) return;

  const svcKey = serviceName?.trim() ? normalizeServiceKey(serviceName) : "";
  const rules = await prisma.commerceCommissionRule.findMany({
    where: { tenantId, active: true },
    orderBy: { updatedAt: "desc" },
  });
  const match =
    rules.find((r) => r.serviceKey && normalizeServiceKey(r.serviceKey) === svcKey) ??
    rules.find((r) => !r.serviceKey?.trim());
  if (!match) return;

  let amount = 0;
  if (match.fixedMinor != null) amount += match.fixedMinor;
  if (match.percentBps != null) amount += Math.floor((price * match.percentBps) / 10_000);
  if (amount <= 0) return;

  const staffName = parseAssignedStaffFromNotes(notes);
  let staffUserId: string | null = null;
  if (staffName) {
    const all = await prisma.staffUser.findMany({
      where: { tenantId, active: true },
      select: { id: true, displayName: true },
    });
    const hit = all.find(
      (x) =>
        x.displayName?.trim() &&
        x.displayName.trim().toLocaleLowerCase("tr-TR") === staffName.toLocaleLowerCase("tr-TR"),
    );
    staffUserId = hit?.id ?? null;
  }

  await prisma.commerceCommissionAccrual.create({
    data: {
      tenantId,
      appointmentId,
      staffUserId,
      staffNameSnapshot: staffName,
      ruleId: match.id,
      amountMinor: amount,
      status: "pending",
      memo: `Otomatik: ${match.name}`,
    },
  });
}
