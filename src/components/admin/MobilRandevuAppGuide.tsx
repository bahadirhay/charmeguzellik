"use client";

import { useCallback, useMemo, useState } from "react";

type Props = {
  canonicalOrigin: string;
  adminPath?: string;
};

function copyText(text: string, setMsg: (s: string) => void) {
  void navigator.clipboard.writeText(text).then(
    () => setMsg("Panoya kopyalandı."),
    () => setMsg("Kopyalanamadı; metni elle seçin."),
  );
  setTimeout(() => setMsg(""), 2500);
}

export function MobilRandevuAppGuide({ canonicalOrigin, adminPath = "/admin/appointments" }: Props) {
  const [feedback, setFeedback] = useState("");

  const originClean = canonicalOrigin.replace(/\/$/, "");
  const fullPanelUrl = `${originClean}${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}`;

  const envSnippet = useMemo(
    () =>
      [
        "# Mobil Randevular kabuğu (apps/randevu-panel) — bu panelden üretildi",
        `# Canlı köken: ${originClean}`,
        `EXPO_PUBLIC_SITE_URL=${originClean}`,
        `# İsteğe bağlı (varsayılan /admin/appointments)`,
        `# EXPO_PUBLIC_ADMIN_PATH=${adminPath}`,
      ].join("\n"),
    [originClean, adminPath],
  );

  const appTsSnippet = useMemo(
    () =>
      [
        `const LIVE_SITE_ORIGIN = "${originClean}";`,
        `const LIVE_ADMIN_PATH = "${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}";`,
      ].join("\n"),
    [originClean, adminPath],
  );

  const downloadEnv = useCallback(() => {
    const blob = new Blob([envSnippet], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "randevu-panel.env";
    a.click();
    URL.revokeObjectURL(a.href);
    setFeedback(".env dosyası indirildi.");
    setTimeout(() => setFeedback(""), 2500);
  }, [envSnippet]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Ne işe yarar?</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Depodaki <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">apps/randevu-panel</code> projesi,
          yönetim panelindeki <strong>Randevular</strong> sayfasını tam ekran bir mobil kabukta (Expo / WebView) açar.
          APK veya iPA üretimi bilgisayarda <strong>EAS Build</strong> veya Expo CLI ile yapılır; burada yalnızca{" "}
          <strong>canlı site adresinize göre</strong> metin üretilir — yerel geliştirme sunucusuna bağlanmaz.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Açılış URL&apos;si (önizleme):{" "}
          <a className="font-medium text-rose-600 underline" href={fullPanelUrl} target="_blank" rel="noreferrer">
            {fullPanelUrl}
          </a>
        </p>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
        <p className="text-sm font-medium text-rose-900 dark:text-rose-100">Canlı yapılandırma</p>
        <p className="mt-1 text-sm text-rose-800/90 dark:text-rose-200/90">
          Aşağıdaki metinler bu oturumdaki <strong>canlı kök adres</strong> ile otomatik oluşturulur (
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">{originClean}</code>
          ). Adres yanlışsa genel ayarlarda <code className="rounded bg-white/80 px-1 dark:bg-black/30">
            NEXT_PUBLIC_SITE_URL
          </code>{" "}
          kontrol edin veya panele doğru domain ile girin; sayfayı yenileyin.
        </p>
      </div>

      {feedback ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {feedback}
        </p>
      ) : null}

      <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">1. Expo ortam dosyası (.env)</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(envSnippet, setFeedback)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
                >
                  Kopyala
                </button>
                <button
                  type="button"
                  onClick={() => downloadEnv()}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
                >
                  .env indir
                </button>
              </div>
            </div>
            <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{envSnippet}</pre>
            <p className="text-xs text-zinc-500">
              Dosyayı <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">apps/randevu-panel/.env</code> olarak
              kaydedin; Expo&apos;yu yeniden başlatın.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                2. App.tsx sabitleri (isteğe bağlı)
              </h3>
              <button
                type="button"
                onClick={() => copyText(appTsSnippet, setFeedback)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
              >
                Kopyala
              </button>
            </div>
            <pre className="max-h-36 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{appTsSnippet}</pre>
            <p className="text-xs text-zinc-500">
              <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">apps/randevu-panel/App.tsx</code> içindeki{" "}
              <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">LIVE_SITE_ORIGIN</code> ve{" "}
              <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">LIVE_ADMIN_PATH</code> ile değiştirin
              (mağaza derlemesinde env yoksa bile canlı adres garanti olur).
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">3. Derleme</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Depo kökünde: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">cd apps/randevu-panel</code>
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm install</code> ardından{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npx expo start</code>
              </li>
              <li>
                Mağaza için: Expo hesabı ile <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">eas build</code>{" "}
                (Apple / Google geliştirici üyelikleri gerekir).
              </li>
            </ul>
          </div>
    </div>
  );
}
