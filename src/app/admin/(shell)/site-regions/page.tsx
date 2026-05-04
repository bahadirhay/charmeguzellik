import Link from "next/link";
import { SiteRegionsEditor } from "@/components/admin/SiteRegionsEditor";
import { requirePagePermission } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks/schema";
import { getSiteSettings } from "@/lib/site-settings";
import { buildThemeOverrideCss, parseThemeTokens } from "@/lib/theme-tokens";
import { normalizeThemeId } from "@/themes/registry";

export default async function SiteRegionsPage() {
  await requirePagePermission("content.regions");
  const settings = await getSiteSettings();

  const headerBlocks = parseBlocks(settings.headerBlocks);
  const footerBlocks = parseBlocks(settings.footerBlocks);
  const themeId = normalizeThemeId(settings.activeThemeId);
  const tokens = parseThemeTokens(settings.themeTokensJson);
  const previewThemeCss = buildThemeOverrideCss(themeId, settings.themeTokensJson);

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/pages" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Sayfalar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Site düzeni</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Üst ve alt bölgeler <strong>her sayfada</strong> aynı şekilde görünür; tek tek sayfa düzeninden ayrıdır.
            <strong>Klinik tarzı alt bilgi</strong> widget’ı (Widget&apos;lar → <em>Alt bilgi</em>) çok sütunlu kurumsal
            footer içindir. Renkler:{" "}
            <a href="/admin/theme" className="font-medium text-rose-600 hover:underline">
              Tema özelleştirici
            </a>{" "}
            → Alt bilgi renkleri.
          </p>
        </div>
      </div>
      <SiteRegionsEditor
        layoutRevision={String(settings.updatedAt.getTime())}
        initialHeader={headerBlocks}
        initialFooter={footerBlocks}
        previewThemeId={themeId}
        previewThemeCss={previewThemeCss}
        previewGoogleFontsHref={tokens.googleFontsHref ?? null}
        previewSiteWhatsappNumber={settings.whatsappNumber}
      />
    </div>
  );
}
