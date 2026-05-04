/** Sadece rakamlar (ülke kodu dahil, örn. 905551112233) */
export function waDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Önce site ayarı, yoksa blok yedeği */
export function resolveWaDigits(
  siteWhatsapp: string | null | undefined,
  blockFallback?: string | null | undefined,
): string {
  const s = waDigits(siteWhatsapp);
  if (s) return s;
  return waDigits(blockFallback ?? "");
}

/** wa.me / WhatsApp send bağlantılarını site numarasına çevir (sorgu korunur) */
export function rewriteWhatsappHref(href: string, siteDigits: string): string {
  if (!siteDigits || !href.trim()) return href;
  const h = href.trim();
  if (!/\bwa\.me\//i.test(h) && !/api\.whatsapp\.com\/send/i.test(h)) return h;
  const q = h.includes("?") ? h.slice(h.indexOf("?")) : "";
  return `https://wa.me/${siteDigits}${q}`;
}
