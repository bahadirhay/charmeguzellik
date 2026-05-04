/** Yerleşim şablonu + widget yönergeleri — ziyaretçi arayüzünde gösterilmez. */
export const TESTIMONIAL_LAYOUT_ADMIN_HINT =
  "Bu alan yerleşim şablonudur. Google / Trustindex gibi üçüncü parti widget'ları Ayarlar → özel HTML veya blok notları ile ekleyebilirsiniz.";

const LEGACY_PUBLIC_HIDDEN = [
  TESTIMONIAL_LAYOUT_ADMIN_HINT,
  "Yorumlar örnektir. Gerçek widget veya Google yorumları için kendi entegrasyonunuzu kullanın.",
  "Örnek içerik — Google yorumları için ayrı entegrasyon kullanılabilir.",
] as const;

function norm(s: string) {
  return s
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\s+/g, " ");
}

/** Bu metinler yalnızca admin önizlemesinde / düzenleyicide kullanılır; canlı sitede basılmaz. */
export function isTestimonialAdminOnlyFootnote(footnote: string | null | undefined): boolean {
  if (footnote == null || !footnote.trim()) return false;
  const n = norm(footnote);
  return LEGACY_PUBLIC_HIDDEN.some((h) => norm(h) === n);
}
