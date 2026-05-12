export const PACKAGE_PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;
export type PackagePaymentMethod = (typeof PACKAGE_PAYMENT_METHODS)[number];

export function packagePaymentMethodLabel(m: string): string {
  switch (m) {
    case "cash":
      return "Nakit";
    case "card":
      return "Kredi kartı";
    case "transfer":
      return "Havale / EFT";
    case "other":
      return "Diğer";
    default:
      return m;
  }
}
