/** Müşteri telefonunu wa.me için rakam dizisine (ülke kodu 90) çevirir */
export function phoneDigitsForWaMe(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) {
    const rest = d.slice(2);
    return rest.length >= 10 ? rest : null;
  }
  if (d.startsWith("90") && d.length >= 12) return d;
  if (d.startsWith("0") && d.length >= 11) return `9${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("5")) return `90${d}`;
  return d.length >= 10 ? d : null;
}
