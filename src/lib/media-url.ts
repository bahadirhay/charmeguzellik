/**
 * Public klasörü URL kökünde servis edilir; /public/... ile başlayan kayıtları
 * tarayıcıda çalışan doğru yola (/...) normalize eder.
 */
export function normalizePublicMediaUrl(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (/^\/public\//i.test(t)) return t.replace(/^\/public\//i, "/");
  if (/^public\//i.test(t)) return `/${t.replace(/^public\//i, "")}`;
  return t;
}
