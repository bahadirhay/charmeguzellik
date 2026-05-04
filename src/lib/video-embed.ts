/** YouTube / Vimeo sayfa bağlantısını iframe embed adresine çevirir. */
export function toVideoIframeSrc(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(normalized);
    const h = u.hostname.replace(/^www\./, "");

    if (h === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (h === "youtube.com" || h === "m.youtube.com" || h === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed?.[1]) return `https://www.youtube.com/embed/${embed[1]}`;
    }
    if (h.endsWith("vimeo.com")) {
      const m = u.pathname.match(/\/(?:video\/)?(\d+)/);
      if (m?.[1]) return `https://player.vimeo.com/video/${m[1]}`;
    }
    if (raw.includes("youtube.com/embed") || raw.includes("player.vimeo.com/video")) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
