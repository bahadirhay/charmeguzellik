/**
 * Çok kiracı / çok domain: mutlak link üretiminde önce HTTP Host.
 * `NEXT_PUBLIC_SITE_URL` — Cron veya Host olmayan bağlam için yedek (sonunda `/` olmasın).
 */

/** Müşteriye giden e-posta/WhatsApp kısa yol (randevu yönetimi linki). */
export const APPOINTMENT_CANCEL_PATH = "/rezervasyonbilgi";
/** Geriye uyumluluk: eski paylaşılan bağlantılar bozulmasın. */
export const APPOINTMENT_CANCEL_LEGACY_PATH = "/rezervasyoniptal";

export function normalizePublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  return raw.replace(/\/+$/, "");
}

function parseHostname(urlLike: string): string | null {
  const s = urlLike.trim();
  if (!s) return null;
  try {
    const u = s.startsWith("http") ? new URL(s) : new URL(`https://${s}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isVercelDeploymentHost(hostname: string): boolean {
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

/**
 * Müşteriye giden tam köken (https://alanadiniz.com).
 * Çok domain tek deploy: istek varsa önce Host (hangi siteden gelindiyse o kök),
 * yoksa veya `*.vercel.app` ise `NEXT_PUBLIC_SITE_URL` yedeği.
 */
export function resolvePublicSiteOrigin(req?: Request): string {
  if (req) {
    const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const first = raw.split(",")[0]?.trim() ?? "";
    const hostname = first.split(":")[0]?.toLowerCase() ?? "";
    if (hostname && !isVercelDeploymentHost(hostname)) {
      const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim() || "https";
      return `${proto}://${hostname}`;
    }
  }
  const envRaw = normalizePublicSiteUrl();
  if (envRaw) {
    const host = parseHostname(envRaw);
    if (host && !isVercelDeploymentHost(host)) {
      return envRaw.startsWith("http") ? envRaw : `https://${envRaw}`;
    }
  }
  if (envRaw) {
    return envRaw.startsWith("http") ? envRaw : `https://${envRaw}`;
  }
  return "";
}

/**
 * Randevu yönetimi derin bağlantısı — token (?t=…).
 */
export function buildAppointmentCancelUrl(token: string, req?: Request): string {
  const base = resolvePublicSiteOrigin(req).replace(/\/+$/, "");
  const pathWithQuery = `${APPOINTMENT_CANCEL_PATH}?t=${encodeURIComponent(token)}`;
  if (!base) return pathWithQuery;
  return `${base}${pathWithQuery}`;
}
