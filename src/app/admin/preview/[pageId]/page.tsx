import { notFound } from "next/navigation";
import { PublicBlocks } from "@/components/site/PublicBlocks";
import { requirePagePermission } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks/schema";
import { prisma } from "@/lib/prisma";
import { buildThemeOverrideCss, parseThemeTokens } from "@/lib/theme-tokens";
import { getSiteSettings } from "@/lib/site-settings";
import { normalizeThemeId } from "@/themes/registry";

type Props = {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ mobile?: string; v?: string }>;
};

export default async function AdminPagePreviewPage({ params, searchParams }: Props) {
  await requirePagePermission("content.pages");
  const { pageId } = await params;
  const { mobile } = await searchParams;

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) notFound();

  const hasMobile = !!page.blocksMobile?.trim() && page.blocksMobile !== "[]";
  const useMobile = mobile === "1" && hasMobile;
  const raw = useMobile ? page.blocksMobile! : page.blocks;
  const blocks = parseBlocks(raw);
  if (!blocks.length) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500">
        Bu görünümde blok yok. Düzenleyicide içerik ekleyin.
      </div>
    );
  }

  const settings = await getSiteSettings();
  const themeId = normalizeThemeId(settings.activeThemeId);
  const tokens = parseThemeTokens(settings.themeTokensJson);
  const overrideCss = buildThemeOverrideCss(themeId, settings.themeTokensJson);

  return (
    <>
      {tokens.googleFontsHref ? (
        <link rel="stylesheet" href={tokens.googleFontsHref} crossOrigin="anonymous" />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: overrideCss }} />
      <div
        data-site-theme={themeId}
        className="site-main-wrap min-h-screen"
        style={{
          backgroundColor: "var(--site-bg)",
          color: "var(--site-fg)",
          fontFamily: "var(--site-font-body, ui-sans-serif, system-ui, sans-serif)",
        }}
      >
        <div className="mx-auto w-full max-w-[var(--site-content-max,72rem)] px-4 py-8">
          <PublicBlocks blocks={blocks} pageSlug={page.slug} formRegion="page" />
        </div>
      </div>
    </>
  );
}
