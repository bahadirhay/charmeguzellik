import Link from "next/link";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/PageEditor";
import { requirePagePermission } from "@/lib/auth";
import { PageMetaForm } from "@/components/admin/PageMetaForm";
import { parseBlocks } from "@/lib/blocks/schema";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { buildThemeOverrideCss, parseThemeTokens } from "@/lib/theme-tokens";
import { normalizeThemeId } from "@/themes/registry";

type Props = { params: Promise<{ id: string }> };

export default async function EditPagePage({ params }: Props) {
  await requirePagePermission("content.pages");
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();

  const desktop = parseBlocks(page.blocks);
  const mobile = page.blocksMobile ? parseBlocks(page.blocksMobile) : null;

  const settings = await getSiteSettings();
  const themeId = normalizeThemeId(settings.activeThemeId);
  const tokens = parseThemeTokens(settings.themeTokensJson);
  const previewThemeCss = buildThemeOverrideCss(themeId, settings.themeTokensJson);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/pages" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Sayfalar
        </Link>
        <h1 className="text-2xl font-semibold">{page.title}</h1>
      </div>
      <PageMetaForm page={page} />
      <PageEditor
        pageId={page.id}
        initialDesktop={desktop}
        initialMobile={mobile}
        separateMobile={!!page.blocksMobile}
        previewThemeId={themeId}
        previewThemeCss={previewThemeCss}
        previewGoogleFontsHref={tokens.googleFontsHref ?? null}
        previewSiteWhatsappNumber={settings.whatsappNumber}
      />
    </div>
  );
}
