/** Instagram vitrin kartı — sunucu ve istemci ortak yardımcılar */

export type InstagramFeedPostDTO = {
  id: string;
  permalink: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
};

export function cardImageSrc(p: {
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}): string | null {
  const t = p.thumbnailUrl?.trim();
  const m = p.mediaUrl?.trim();
  if (p.mediaType === "VIDEO") {
    if (t) return t;
    if (m && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(m)) return m;
    return null;
  }
  if (m && !/\.mp4(\?|$)/i.test(m)) return m;
  if (t) return t;
  if (m) return m;
  return null;
}

export function hasCardAssets(p: {
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}) {
  return Boolean(cardImageSrc(p));
}
