"use client";

import { phoneDigitsForWaMe } from "@/lib/customer-phone";

type Props = {
  /** Ham telefon (+90, 05xx, 532…); wa.me rakamlarına çevrilir */
  phone: string | null | undefined;
  /** İsteğe bağlı ön doldurulmuş mesaj */
  prefilledMessage?: string;
  /** Varsayılan: kısa etiket */
  label?: string;
  className?: string;
};

/**
 * Yönetici panelinde müşteriye WhatsApp ile yazmak için `wa.me` bağlantısı (yeni sekme).
 * Geçerli numara yoksa hiçbir şey render etmez.
 */
export function AdminWhatsAppButton({
  phone,
  prefilledMessage,
  label = "WhatsApp",
  className,
}: Props) {
  const digits = phoneDigitsForWaMe(phone ?? "");
  if (!digits) return null;
  const msg = prefilledMessage?.trim();
  const href = msg
    ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/${digits}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="WhatsApp Web veya uygulama ile mesaj (yeni sekme)"
      className={
        className ??
        "inline-flex shrink-0 items-center rounded-full border-2 border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50 dark:hover:bg-emerald-900/80"
      }
    >
      {label}
    </a>
  );
}
