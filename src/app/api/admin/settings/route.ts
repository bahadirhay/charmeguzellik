import { NextResponse } from "next/server";
import { blocksArraySchema, type PageBlock } from "@/lib/blocks/schema";
import { prisma } from "@/lib/prisma";
import { requireStaffApi, staffPermDenied, type StaffAccess } from "@/lib/staff-auth";
import { hasAnyStaffPermission, hasStaffPermission } from "@/lib/staff-permissions";
import { getSiteSettingsForTenant, sanitizeSiteSettingsForAdminClient } from "@/lib/site-settings";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { normalizeThemeId } from "@/themes/registry";

const SETTINGS_PUT_KEYS = [
  "siteName",
  "activeThemeId",
  "mediaUploadSlug",
  "headerPromoLine",
  "socialInstagramUrl",
  "socialFacebookUrl",
  "instagramGraphUserId",
  "instagramAccessToken",
  "defaultMetaTitle",
  "defaultMetaDescription",
  "businessJson",
  "googleAnalyticsId",
  "googleTagManagerId",
  "facebookPixelId",
  "customHeadHtml",
  "whatsappNumber",
  "seoKeywords",
  "themeTokensJson",
  "smtpHost",
  "smtpUser",
  "transactionalMailFrom",
  "cookieConsentJson",
  "appointmentNotifyAdminEmails",
  "appointmentNotifyOperatorEmails",
] as const;

function collectSettingsPutKeys(body: Record<string, unknown>): string[] {
  const keys: string[] = [];
  if ("showHeaderTopBar" in body) keys.push("showHeaderTopBar");
  if ("headerBlocks" in body) keys.push("headerBlocks");
  if ("footerBlocks" in body) keys.push("footerBlocks");
  if ("smtpPort" in body) keys.push("smtpPort");
  if ("smtpSecure" in body) keys.push("smtpSecure");
  if ("smtpPass" in body) keys.push("smtpPass");
  for (const k of SETTINGS_PUT_KEYS) {
    if (k in body) keys.push(k);
  }
  return keys;
}

function canPutSettings(auth: StaffAccess, keys: string[]): boolean {
  if (keys.length === 0) return false;
  const onlyRegions = keys.every((k) => k === "headerBlocks" || k === "footerBlocks");
  if (onlyRegions) return hasStaffPermission(auth.permissions, "content.regions");
  const onlyIg = keys.every((k) => k === "instagramGraphUserId" || k === "instagramAccessToken");
  if (onlyIg) return hasStaffPermission(auth.permissions, "social.instagram");
  const onlyTheme = keys.every((k) => k === "themeTokensJson");
  if (onlyTheme) {
    return (
      hasStaffPermission(auth.permissions, "site.theme") ||
      hasStaffPermission(auth.permissions, "site.settings")
    );
  }
  return hasStaffPermission(auth.permissions, "site.settings");
}

/** Formdan gelen tam `SiteSettings` satırında bloklar JSON string olabilir; düzenleyici ise dizi gönderir */
function parseBlocksField(
  value: unknown,
  label: string,
): { ok: true; data: PageBlock[] } | { ok: false; response: NextResponse } {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value.trim() || "[]");
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: `${label}: geçersiz JSON` }, { status: 400 }),
      };
    }
  }
  const parsed = blocksArraySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: label, details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

function normalizeNullableString(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

export async function GET(req: Request) {
  const auth = await requireStaffApi();
  if (auth instanceof NextResponse) return auth;
  if (
    !hasAnyStaffPermission(auth.permissions, [
      "site.settings",
      "social.instagram",
      "social.youtube",
      "social.tiktok",
    ])
  ) {
    return staffPermDenied();
  }
  const tenantId = await getTenantIdForRequest(req);
  const row = await getSiteSettingsForTenant(tenantId);
  return NextResponse.json(sanitizeSiteSettingsForAdminClient(row));
}

export async function PUT(req: Request) {
  const auth = await requireStaffApi();
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json()) as Record<string, unknown>;
  const putKeys = collectSettingsPutKeys(body);
  if (!canPutSettings(auth, putKeys)) {
    return staffPermDenied();
  }
  const data: Record<string, string | boolean | number | null | undefined> = {};

  if ("showHeaderTopBar" in body) {
    const v = body.showHeaderTopBar;
    data.showHeaderTopBar = v === true || v === "true";
  }

  if ("headerBlocks" in body) {
    const parsed = parseBlocksField(body.headerBlocks, "Geçersiz üst alan blokları");
    if (!parsed.ok) return parsed.response;
    data.headerBlocks = JSON.stringify(parsed.data);
  }
  if ("footerBlocks" in body) {
    const parsed = parseBlocksField(body.footerBlocks, "Geçersiz alt bilgi blokları");
    if (!parsed.ok) return parsed.response;
    data.footerBlocks = JSON.stringify(parsed.data);
  }

  for (const key of SETTINGS_PUT_KEYS) {
    if (key in body) {
      const v = body[key];
      if (key === "activeThemeId") {
        data.activeThemeId = normalizeThemeId(v == null ? undefined : String(v));
      } else if (key === "siteName") {
        const s = String(v ?? "").trim();
        data.siteName = s || "Güzellik Merkezi";
      } else {
        data[key] = normalizeNullableString(v);
      }
    }
  }

  if ("smtpPort" in body) {
    const v = body.smtpPort;
    if (v == null || v === "") {
      data.smtpPort = null;
    } else {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      data.smtpPort = Number.isFinite(n) ? n : null;
    }
  }
  if ("smtpSecure" in body) {
    const v = body.smtpSecure;
    data.smtpSecure = v === true || v === "true";
  }
  if ("smtpPass" in body) {
    const raw = body.smtpPass;
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s) data.smtpPass = s;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  try {
    const tenantId = await getTenantIdForRequest(req);
    const base = await getSiteSettingsForTenant(tenantId);
    const row = await prisma.siteSettings.update({
      where: { id: base.id },
      data,
    });
    return NextResponse.json(sanitizeSiteSettingsForAdminClient(row));
  } catch (e) {
    console.error("settings PUT", e);
    const msg = e instanceof Error ? e.message : "Veritabanı hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
