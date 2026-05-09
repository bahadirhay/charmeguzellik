import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = {
  isLoggedIn?: boolean;
  /** legacy: ortam değişkeni e-posta + şifre */
  authKind?: "legacy" | "staff";
  email?: string;
  staffUserId?: string;
  username?: string;
  /** Personel kullanıcısında randevu ataması ile eşleşecek görünen ad (Personel Planlama isimleriyle aynı olmalı) */
  staffDisplayName?: string | null;
  roleSlug?: string;
  tenantId?: string;
  /** JSON.stringify(string[]) — panel yetkileri */
  permissionsJson?: string;
};

const DEV_FALLBACK_PASSWORD = "dev-insecure-secret-min-32-chars!!";

/**
 * iron-session şifresi en az 32 karakter olmalı.
 * Vercel'de boş string atanmış SESSION_SECRET, `??` ile yakalanmaz; trim + uzunluk kontrolü gerekir.
 */
function resolveSessionSecret(): string {
  const raw = process.env.SESSION_SECRET;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length >= 32) return trimmed;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[session] SESSION_SECRET eksik veya 32 karakterden kısa. iron-session bu yüzden 500 verirdi. " +
        "Geçici sabit anahtar kullanılıyor — Vercel’de Production için en az 32 karakterlik güçlü bir SESSION_SECRET tanımlayın.",
    );
    return DEV_FALLBACK_PASSWORD;
  }
  return DEV_FALLBACK_PASSWORD;
}

const sessionCookieBase = {
  cookieName: "site_admin_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  },
};

export function getAdminSessionOptions(): SessionOptions {
  return {
    ...sessionCookieBase,
    password: resolveSessionSecret(),
  };
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSession>(cookieStore, getAdminSessionOptions());
}
