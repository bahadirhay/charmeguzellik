import fs from "fs";
import path from "path";
import { HERO_SLIDER_MAX_SLIDES } from "@/lib/blocks/schema";
import type { ThemeId } from "@/themes/types";

const MAX_BYTES = 12 * 1024 * 1024;

/** Telif içermeyen örnek URL’ler (Unsplash — yalnızca demo / panel “indir” paketi). */
export const DEMO_IMAGE_URL_PRESET: Record<ThemeId, string[]> = {
  cherry: [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80",
    "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1600&q=80",
    "https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1600&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80",
  ],
};

function extFromUrl(u: string, contentType: string | null) {
  try {
    const pathname = new URL(u).pathname;
    const m = pathname.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i);
    if (m) return "." + m[1]!.toLowerCase().replace("jpeg", "jpg");
  } catch {
    /* ignore */
  }
  const ct = contentType ?? "";
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("jpeg")) return ".jpg";
  return ".jpg";
}

export type ImportOneResult = { url: string; file?: string; ok: boolean; error?: string };

export async function downloadUrlsToPublicUploads(
  slug: string,
  urls: string[],
): Promise<ImportOneResult[]> {
  const capped = urls.slice(0, HERO_SLIDER_MAX_SLIDES);
  const outDir = path.join(process.cwd(), "public", "uploads", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const results: ImportOneResult[] = [];
  let i = 0;
  for (const urlRaw of capped) {
    const url = urlRaw.trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) {
      results.push({ url, ok: false, error: "Yalnızca http/https" });
      continue;
    }
    i++;
    const padded = String(i).padStart(2, "0");
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(45000) });
      if (!res.ok) {
        results.push({ url, ok: false, error: `HTTP ${res.status}` });
        continue;
      }
      const len = res.headers.get("content-length");
      if (len && Number(len) > MAX_BYTES) {
        results.push({ url, ok: false, error: "Dosya çok büyük" });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        results.push({ url, ok: false, error: "Dosya çok büyük" });
        continue;
      }
      const ext = extFromUrl(res.url ?? url, res.headers.get("content-type"));
      const filename = `${slug}-slayt-${padded}${ext}`;
      const dest = path.join(outDir, filename);
      fs.writeFileSync(dest, buf);
      results.push({ url, ok: true, file: `/uploads/${slug}/${filename}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "İndirilemedi";
      results.push({ url, ok: false, error: msg });
    }
  }
  return results;
}
