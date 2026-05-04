/** public/uploads/{slug}/ için güvenli klasör adı */
export function normalizeUploadSlug(raw: string): string {
  const s = raw
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return s || "site";
}
