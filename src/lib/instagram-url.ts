/** Gönderi / reel permalink’ini kanonik forma çevirir */
export function normalizeInstagramPermalink(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!url.hostname.toLowerCase().includes("instagram.com")) return null;
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "") return null;
    return `https://www.instagram.com${path}`;
  } catch {
    return null;
  }
}

/** iframe embed adresi */
export function instagramPermalinkToEmbedUrl(permalink: string): string {
  const p = permalink.replace(/\/+$/, "");
  const reel = p.match(/\/(reel|reels)\/([^/?#]+)/);
  if (reel) {
    return `https://www.instagram.com/reel/${reel[2]}/embed`;
  }
  const post = p.match(/\/p\/([^/?#]+)/);
  if (post) {
    return `https://www.instagram.com/p/${post[1]}/embed`;
  }
  return `${p}/embed`;
}
