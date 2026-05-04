import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = {
  isLoggedIn?: boolean;
  /** legacy: ortam değişkeni e-posta + şifre */
  authKind?: "legacy" | "staff";
  email?: string;
  staffUserId?: string;
  username?: string;
  roleSlug?: string;
  /** JSON.stringify(string[]) — panel yetkileri */
  permissionsJson?: string;
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-insecure-secret-min-32-chars!!",
  cookieName: "site_admin_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  },
};

export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSession>(cookieStore, sessionOptions);
}

export { sessionOptions };
