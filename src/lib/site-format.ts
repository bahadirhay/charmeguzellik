/** DB veya formlardan gelen "null" / "undefined" yazısını gizle */
export function cleanDisplayString(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined") return null;
  return t;
}

export function formatBusinessAddressLine(
  business: { address?: Record<string, string | undefined> } | null,
): string | null {
  if (!business?.address) return null;
  const a = business.address;
  const line1 = cleanDisplayString(a.streetAddress);
  const pc = cleanDisplayString(a.postalCode);
  const loc = cleanDisplayString(a.addressLocality);
  const line2 = [pc, loc].filter(Boolean).join(" ");
  const country = cleanDisplayString(a.addressCountry);
  const parts = [line1, line2 || null, country].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : null;
}
