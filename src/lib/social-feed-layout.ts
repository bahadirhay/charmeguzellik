/** Instagram / YouTube / TikTok vitrin ızgarası ve iframe yüksekliği */
export const DEFAULT_SOCIAL_EMBED_HEIGHT_PX = 920;

export const socialFeedColClass: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function clampSocialEmbedHeightPx(embedHeightPx?: number): number {
  return Math.min(1400, Math.max(400, embedHeightPx ?? DEFAULT_SOCIAL_EMBED_HEIGHT_PX));
}
