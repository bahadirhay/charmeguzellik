import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env"), override: true });
config({ path: resolve(root, ".env.local"), override: true });

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    let pageCount = 0;
    let settingsCount = 0;
    let igCount = 0;
    let ttCount = 0;

    const rewrite = (s: string | null | undefined): string => (s ?? "").replace(/\/public\/uploads\//gi, "/uploads/");

    const pages = await prisma.page.findMany({
      select: { id: true, blocks: true, blocksMobile: true },
    });

    for (const p of pages) {
      const nextBlocks = rewrite(p.blocks);
      const nextBlocksMobile = rewrite(p.blocksMobile ?? "");
      if (nextBlocks !== p.blocks || nextBlocksMobile !== (p.blocksMobile ?? "")) {
        await prisma.page.update({
          where: { id: p.id },
          data: {
            blocks: nextBlocks,
            blocksMobile: p.blocksMobile == null ? null : nextBlocksMobile,
          },
        });
        pageCount++;
      }
    }

    const st = await prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { headerBlocks: true, footerBlocks: true, customHeadHtml: true, businessJson: true, themeTokensJson: true },
    });
    if (st) {
      const nextHeader = rewrite(st.headerBlocks);
      const nextFooter = rewrite(st.footerBlocks);
      const nextCustomHeadHtml = rewrite(st.customHeadHtml ?? "");
      const nextBusinessJson = rewrite(st.businessJson ?? "");
      const nextThemeTokensJson = rewrite(st.themeTokensJson ?? "");
      if (
        nextHeader !== st.headerBlocks ||
        nextFooter !== st.footerBlocks ||
        nextCustomHeadHtml !== (st.customHeadHtml ?? "") ||
        nextBusinessJson !== (st.businessJson ?? "") ||
        nextThemeTokensJson !== (st.themeTokensJson ?? "")
      ) {
        await prisma.siteSettings.update({
          where: { id: 1 },
          data: {
            headerBlocks: nextHeader,
            footerBlocks: nextFooter,
            customHeadHtml: st.customHeadHtml == null ? null : nextCustomHeadHtml,
            businessJson: st.businessJson == null ? null : nextBusinessJson,
            themeTokensJson: st.themeTokensJson == null ? null : nextThemeTokensJson,
          },
        });
        settingsCount++;
      }
    }

    const igRows = await prisma.siteInstagramPost.findMany({
      select: { id: true, mediaUrl: true, thumbnailUrl: true },
    });
    for (const row of igRows) {
      const nextMedia = rewrite(row.mediaUrl ?? "");
      const nextThumb = rewrite(row.thumbnailUrl ?? "");
      if (nextMedia !== (row.mediaUrl ?? "") || nextThumb !== (row.thumbnailUrl ?? "")) {
        await prisma.siteInstagramPost.update({
          where: { id: row.id },
          data: {
            mediaUrl: row.mediaUrl == null ? null : nextMedia,
            thumbnailUrl: row.thumbnailUrl == null ? null : nextThumb,
          },
        });
        igCount++;
      }
    }

    const ttRows = await prisma.siteTiktokVideo.findMany({
      select: { id: true, thumbnailUrl: true },
    });
    for (const row of ttRows) {
      const nextThumb = rewrite(row.thumbnailUrl ?? "");
      if (nextThumb !== (row.thumbnailUrl ?? "")) {
        await prisma.siteTiktokVideo.update({
          where: { id: row.id },
          data: { thumbnailUrl: row.thumbnailUrl == null ? null : nextThumb },
        });
        ttCount++;
      }
    }

    console.log(
      `[fix-public-upload-paths] Tamam. Güncellenen page: ${pageCount}, siteSettings: ${settingsCount}, instagram: ${igCount}, tiktok: ${ttCount}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
