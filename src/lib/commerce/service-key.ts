/** Menü / form hizmet etiketi ile katalog anahtarı (Türkçe küçük harf) */
export function normalizeServiceKey(label: string): string {
  return label.trim().toLocaleLowerCase("tr-TR");
}
