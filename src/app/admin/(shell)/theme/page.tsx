import { ThemeCustomizerForm } from "@/components/admin/ThemeCustomizerForm";
import { requirePagePermission } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";

export default async function AdminThemePage() {
  await requirePagePermission(["site.theme", "site.settings"]);
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tema özelleştirici</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Renkler, font yığınları ve içerik genişliği — canlı siteye CSS değişkeni olarak uygulanır.
        </p>
      </div>
      <ThemeCustomizerForm
        initialJson={settings.themeTokensJson}
        activeThemeId={settings.activeThemeId}
      />
    </div>
  );
}
