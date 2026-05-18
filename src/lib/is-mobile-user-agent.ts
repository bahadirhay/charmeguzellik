/** Sunucu tarafında mobil cihaz tespiti (özet ekranı düzeni için). */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua?.trim()) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}
