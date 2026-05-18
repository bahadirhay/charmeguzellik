export function formatTryMinor(minor: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(
    minor / 100,
  );
}

export function statusLabelTr(status: string): string {
  if (status === "pending") return "Bekliyor";
  if (status === "approved") return "Onaylı";
  if (status === "confirmed") return "Teyitli";
  if (status === "cancel_request") return "İptal talebi";
  if (status === "rejected") return "Reddedildi";
  if (status === "cancelled") return "İptal";
  if (status === "checked_in") return "Geldi";
  if (status === "no_show") return "Gelmedi";
  return status;
}
