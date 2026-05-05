export type ParsedGoogleCalendarCreds = {
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
};

function pickStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function nestedClientPair(v: unknown): { id: string | null; secret: string | null } {
  if (!v || typeof v !== "object") return { id: null, secret: null };
  const x = v as Record<string, unknown>;
  return {
    id: pickStr(x.client_id) ?? pickStr(x.clientId),
    secret: pickStr(x.client_secret) ?? pickStr(x.clientSecret),
  };
}

/**
 * Tek bir JSON dosyasından Google Takvim OAuth alanlarını çıkarır.
 * Desteklenen şekiller:
 * - { client_id, client_secret, refresh_token }
 * - { clientId, clientSecret, refreshToken }
 * - Cloud Console indirmesi: { installed: {...} } veya { web: {...} }
 * - İsteğe bağlı: refresh yalnız kökte, client bilgisi nested içinde
 */
export function parseGoogleCalendarCredentialsJson(
  raw: string,
): ParsedGoogleCalendarCreds | { error: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(raw.trim());
  } catch {
    return { error: "Geçersiz JSON dosyası." };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { error: "JSON kökü bir nesne (object) olmalı." };
  }
  const o = obj as Record<string, unknown>;

  let clientId =
    pickStr(o.client_id) ??
    pickStr(o.clientId) ??
    pickStr(o.googleCalendarClientId);
  let clientSecret =
    pickStr(o.client_secret) ??
    pickStr(o.clientSecret) ??
    pickStr(o.googleCalendarSecret);
  let refreshToken =
    pickStr(o.refresh_token) ??
    pickStr(o.refreshToken) ??
    pickStr(o.googleRefreshToken);

  for (const key of ["installed", "web", "desktop_app", "credentials"]) {
    const nest = o[key];
    const { id, secret } = nestedClientPair(nest);
    if (!clientId && id) clientId = id;
    if (!clientSecret && secret) clientSecret = secret;
  }

  const tokenLike = o.token_response ?? o.tokens;
  if (!refreshToken && tokenLike && typeof tokenLike === "object" && !Array.isArray(tokenLike)) {
    const t = tokenLike as Record<string, unknown>;
    refreshToken = pickStr(t.refresh_token) ?? pickStr(t.refreshToken);
  }

  if (!clientId && !clientSecret && !refreshToken) {
    return {
      error:
        "JSON içinde tanınan alan yok. En az biri gerekli: client_id + client_secret ve/veya refresh_token.",
    };
  }

  if (clientId && !clientId.includes("googleusercontent.com")) {
    return {
      error:
        "client_id tam görünmüyor veya hatalı: genelde …apps.googleusercontent.com ile biter. Dosyayı tekrar indirip yapıştırın.",
    };
  }

  return { clientId, clientSecret, refreshToken };
}
