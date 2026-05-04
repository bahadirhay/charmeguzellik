import type { PageBlock } from "@/lib/blocks/schema";
import { parseBlocks } from "@/lib/blocks/schema";
import { getSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";

export type ContactFormContext = "page" | "header" | "footer";

export async function resolvePublishedContactFormBlock(
  ctx: ContactFormContext,
  pageSlug: string | null | undefined,
  blockId: string,
): Promise<Extract<PageBlock, { type: "contactForm" }> | null> {
  if (!blockId.trim()) return null;
  if (ctx === "page") {
    const slug = pageSlug?.trim();
    if (!slug) return null;
    const page = await prisma.page.findFirst({
      where: { slug, published: true },
      select: { blocks: true, blocksMobile: true },
    });
    if (!page) return null;
    for (const raw of [page.blocks, page.blocksMobile]) {
      if (!raw?.trim()) continue;
      const blocks = parseBlocks(raw);
      const hit = blocks.find((b) => b.id === blockId && b.type === "contactForm");
      if (hit && hit.type === "contactForm") return hit;
    }
    return null;
  }
  const settings = await getSiteSettings();
  const raw = ctx === "header" ? settings.headerBlocks : settings.footerBlocks;
  if (!raw?.trim()) return null;
  const blocks = parseBlocks(raw);
  const hit = blocks.find((b) => b.id === blockId && b.type === "contactForm");
  return hit && hit.type === "contactForm" ? hit : null;
}
