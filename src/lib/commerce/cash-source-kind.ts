export const CASH_RECEIPT_SOURCE_KINDS = ["appointment", "walk_in", "manual", "package_payment"] as const;
export type CashReceiptSourceKind = (typeof CASH_RECEIPT_SOURCE_KINDS)[number];

export function cashSourceKindLabel(k: string): string {
  switch (k) {
    case "appointment":
      return "Randevu";
    case "walk_in":
      return "Gel-al";
    case "manual":
      return "Manuel";
    case "package_payment":
      return "Paket tahsilatı";
    default:
      return k;
  }
}
