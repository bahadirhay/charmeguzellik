export function formatTryFromMinor(minor: number | null | undefined): string {
  if (minor == null || Number.isNaN(minor)) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(minor / 100);
}
