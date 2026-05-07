/**
 * Açık VAPID anahtarı — tarayıcı subscribe ile sunucu gönderimi aynı değeri kullanmalı.
 * vapid-public API ve appointment-push-notify buradan türetilir.
 */
export function getVapidPublicKey(): string | undefined {
  const a = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const b = process.env.VAPID_PUBLIC_KEY?.trim();
  return a || b || undefined;
}

export function isVapidSendConfigured(): boolean {
  const pub = getVapidPublicKey();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  return Boolean(pub && priv);
}
