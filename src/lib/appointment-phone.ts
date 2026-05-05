/**
 * Randevu formları: Türkiye GSM (ülke kodu 90 ile 12 haneli beklenir: 90 + 5XXXXXXXXX).
 * Örnek kabul edilen yazımlar: `05325717714`, `5325717714`, `905325717714`.
 */

/** Form alanı için üst uzun sınır (boşluk, parantez vb. dahil yazılmış numaraya izin verir). */
export const APPOINTMENT_PHONE_INPUT_MAX_LENGTH = 30;

const INTL_REGEX = /^90[5]\d{9}$/;

function digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalize edilmiş uluslararası rakamlar (`90532…` toplam 12 hane) veya başarısızda `null`.
 */
export function normalizedTurkeyMobileAppointmentDigits(raw: string): string | null {
  let d = digits(raw);
  if (!d.length) return null;

  /* 0090… */
  if (d.startsWith("0090")) {
    d = d.slice(2);
  }

  let intl: string;
  if (d.startsWith("90")) {
    if (d.length < 12) return null;
    intl = d.slice(0, 12);
  } else if (d.length === 11 && d.startsWith("05")) {
    intl = `90${d.slice(1)}`;
  } else if (d.length === 10 && d.startsWith("5")) {
    intl = `90${d}`;
  } else {
    return null;
  }

  return INTL_REGEX.test(intl) ? intl : null;
}

export function isValidTurkeyMobileAppointmentPhone(raw: string): boolean {
  return normalizedTurkeyMobileAppointmentDigits(raw) !== null;
}

export function appointmentPhoneTurkeyHint(): string {
  return "Türkiye cep numarası girin (örn. 05325717714 veya 5325717714).";
}
