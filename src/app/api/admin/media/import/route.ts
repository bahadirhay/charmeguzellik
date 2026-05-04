import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_IMAGE_URL_PRESET, downloadUrlsToPublicUploads } from "@/lib/admin/media-import";
import { normalizeUploadSlug } from "@/lib/upload-slug";
import { HERO_SLIDER_MAX_SLIDES } from "@/lib/blocks/schema";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { normalizeThemeId } from "@/themes/registry";

const bodySchema = z
  .object({
    slug: z.string().min(1).max(80),
    /** Birlikte seçilirse önce paket sonra ek liste (toplamları kesilir). */
    presetThemeId: z.string().optional(),
    urls: z.array(z.string()).max(HERO_SLIDER_MAX_SLIDES).optional(),
  })
  .refine((d) => d.presetThemeId || (d.urls && d.urls.length > 0), {
    message: "presetThemeId veya urls gerekli",
  });

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slug = normalizeUploadSlug(parsed.data.slug);
  const themeId = parsed.data.presetThemeId ? normalizeThemeId(parsed.data.presetThemeId) : null;
  const presetUrls = themeId ? DEMO_IMAGE_URL_PRESET[themeId] : [];
  const extra = (parsed.data.urls ?? []).filter((u) => typeof u === "string" && u.trim());
  const merged = [...presetUrls, ...extra.map((u) => u.trim())].slice(0, HERO_SLIDER_MAX_SLIDES);

  if (!merged.length) {
    return NextResponse.json({ error: "İndirilecek URL yok" }, { status: 400 });
  }

  const results = await downloadUrlsToPublicUploads(slug, merged);
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    slug,
    downloaded: okCount,
    total: merged.length,
    results,
    hintFirst: `/uploads/${slug}/${slug}-slayt-01.jpg`,
  });
}
