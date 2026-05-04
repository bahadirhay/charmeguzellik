/** TikTok paylaşım URL’sini https://www.tiktok.com/@…/video/… biçimine yaklaştırır */
export function normalizeTiktokPermalink(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!u.hostname.toLowerCase().includes("tiktok.com")) return null;
    u.hash = "";
    u.search = "";
    const path = u.pathname.replace(/\/+$/, "");
    if (!/\/video\/\d+/.test(path)) return null;
    return `https://www.tiktok.com${path}`;
  } catch {
    return null;
  }
}

/** /video/(rakamlar) */
export function extractTiktokVideoIdFromPermalink(permalink: string): string | null {
  const m = permalink.match(/\/video\/(\d+)/);
  return m?.[1] ?? null;
}

export function tiktokEmbedUrl(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}

export type TiktokOembedPayload = {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
};

export async function fetchTiktokOembed(permalink: string): Promise<TiktokOembedPayload | null> {
  const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(permalink)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TiktokOembedPayload;
  } catch {
    return null;
  }
}
