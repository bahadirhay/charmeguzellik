/** Kasa tahsilatı `sourceKind` → panel etiketi */
export function cashReceiptSourceLabel(sourceKind: string | null | undefined): string {
  const k = (sourceKind ?? "").trim().toLowerCase();
  if (k === "package_payment") return "Paket satışı";
  if (k === "appointment") return "Randevu";
  if (k === "walk_in") return "Yerinde";
  if (k === "manual") return "Manuel";
  return sourceKind?.trim() || "Diğer";
}
