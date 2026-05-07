/**
 * Canlı alan adı — üretimde:
 * `NEXT_PUBLIC_SITE_URL=https://charmeguzellik.com` (sonunda `/` yok).
 * Yanlışlıkla `*.vercel.app` yazılmışsa müşteri linkleri kötü görünür; API isteği `Host` ile düzeltilir (aşağı).
 */

/** Müşteriye giden e-posta ve WhatsApp’ta kullanılan kısa yol (rewrite ile `/randevu/iptal` içeriği). */
export const APPOINTMENT_CANCEL_PATH = "/rezervasyoniptal";

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
 * Önce env — ancak env hostname `*.vercel.app` ise yoksayılır ve gelen HTTP isteğindeki Host kullanılır
 * (panel https://charmeguzellik.com üzerinden açıksa linkler bu domain ile üretilir).
 */
export function resolvePublicSiteOrigin(req?: Request): string {
  const envRaw = normalizePublicSiteUrl();
  if (envRaw) {
    const host = parseHostname(envRaw);
    if (host && !isVercelDeploymentHost(host)) {
      return envRaw.startsWith("http") ? envRaw : `https://${envRaw}`;
    }
  }
  if (req) {
    const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const first = raw.split(",")[0]?.trim() ?? "";
    const hostname = first.split(":")[0]?.toLowerCase() ?? "";
    if (hostname && !isVercelDeploymentHost(hostname)) {
      const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim() || "https";
      return `${proto}://${hostname}`;
    }
  }
  if (envRaw) {
    return envRaw.startsWith("http") ? envRaw : `https://${envRaw}`;
  }
  return "";
}

/**
 * Randevu iptal derin bağlantısı — token (?t=…); kod sayfada ayrı sorulur.
 */
export function buildAppointmentCancelUrl(token: string, req?: Request): string {
  const base = resolvePublicSiteOrigin(req).replace(/\/+$/, "");
  const pathWithQuery = `${APPOINTMENT_CANCEL_PATH}?t=${encodeURIComponent(token)}`;
  if (!base) return pathWithQuery;
  return `${base}${pathWithQuery}`;
}
