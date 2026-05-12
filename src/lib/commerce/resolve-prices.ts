import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeServiceKey } from "@/lib/commerce/service-key";

type CommercePriceDb = Pick<
  PrismaClient | Prisma.TransactionClient,
  "commerceServicePrice" | "commerceCustomerPriceOverride"
>;

export type ResolvedServicePrice = {
  label: string;
  serviceKey: string;
  priceMinor: number | null;
  source: "override" | "catalog" | null;
};

export async function resolvePricesForLabels(
  prisma: CommercePriceDb,
  tenantId: string,
  labels: string[],
  crmContactId: string | null,
): Promise<ResolvedServicePrice[]> {
  const uniqueLabels = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  if (uniqueLabels.length === 0) return [];

  const keys = [...new Set(uniqueLabels.map(normalizeServiceKey))];
  const catalog = await prisma.commerceServicePrice.findMany({
    where: { tenantId, active: true, serviceKey: { in: keys } },
  });
  const catByKey = new Map(catalog.map((c) => [c.serviceKey, c]));

  let ovByKey = new Map<string, { priceMinor: number }>();
  if (crmContactId) {
    const ovs = await prisma.commerceCustomerPriceOverride.findMany({
      where: { tenantId, crmContactId, serviceKey: { in: keys } },
    });
    ovByKey = new Map(ovs.map((o) => [o.serviceKey, { priceMinor: o.priceMinor }]));
  }

  return uniqueLabels.map((label) => {
    const serviceKey = normalizeServiceKey(label);
    const ov = ovByKey.get(serviceKey);
    if (ov) return { label, serviceKey, priceMinor: ov.priceMinor, source: "override" as const };
    const c = catByKey.get(serviceKey);
    if (c) return { label, serviceKey, priceMinor: c.priceMinor, source: "catalog" as const };
    return { label, serviceKey, priceMinor: null, source: null };
  });
}

export async function resolveQuotedPriceForAppointment(
  prisma: CommercePriceDb,
  tenantId: string,
  serviceName: string | null | undefined,
  crmContactId: string | null,
): Promise<{ quotedPriceMinor: number | null; priceSource: string | null }> {
  const label = serviceName?.trim();
  if (!label) return { quotedPriceMinor: null, priceSource: null };
  const [row] = await resolvePricesForLabels(prisma, tenantId, [label], crmContactId);
  if (row.priceMinor == null) return { quotedPriceMinor: null, priceSource: "none" };
  return {
    quotedPriceMinor: row.priceMinor,
    priceSource: row.source === "override" ? "override" : "catalog",
  };
}
