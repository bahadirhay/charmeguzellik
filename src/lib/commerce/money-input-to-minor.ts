/**
 * Panel ₺ girişi → kuruş. Türkçe binlik (2.500), ondalık (2.500,50 veya 2500,5) desteklenir.
 */
export function moneyInputToMinor(v: string): number {
  const raw = v.trim().replace(/\s/g, "");
  if (!raw) return 0;
  let s = raw;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}
