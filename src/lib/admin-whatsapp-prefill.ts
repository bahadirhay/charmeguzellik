/** Randevu satırından wa.me ön metni (Admin randevular + müşteri sütunu). */
export function waPrefillForAppointment(clientName: string, startAtIso: string, serviceName: string | null): string {
  const parts = [
    `Merhaba ${clientName.trim() || "Merhaba"},`,
    new Date(startAtIso).toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    serviceName?.trim() ? `«${serviceName.trim()}»` : null,
    "randevusu hakkında yazıyorum.",
  ].filter(Boolean);
  return parts.join(" ");
}
