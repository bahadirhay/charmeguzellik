/** watch, embed, shorts veya youtu.be bağlantısından 11 karakterlik video kimliği */
export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").replace(/\/$/, "").split("/")[0] ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }

    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;

    const path = u.pathname;
    const embed = path.match(/\/embed\/([\w-]{11})/);
    if (embed) return embed[1] ?? null;

    const shorts = path.match(/\/shorts\/([\w-]{11})/);
    if (shorts) return shorts[1] ?? null;

    const live = path.match(/\/live\/([\w-]{11})/);
    if (live) return live[1] ?? null;

    return null;
  } catch {
    const m = raw.match(/(?:v=|\/)([\w-]{11})(?:\?|&|#|$)/);
    return m?.[1] && /^[\w-]{11}$/.test(m[1]) ? m[1] : null;
  }
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/** Kart modu için küçük resim (harici, güvenilir CDN) */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
