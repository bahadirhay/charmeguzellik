"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageEditor } from "@/components/admin/PageEditor";
import type { PageBlock } from "@/lib/blocks/schema";

type Props = {
  layoutRevision: string;
  initialHeader: PageBlock[];
  initialFooter: PageBlock[];
  previewThemeId: string;
  previewThemeCss: string;
  previewGoogleFontsHref: string | null;
  previewSiteWhatsappNumber?: string | null;
};

export function SiteRegionsEditor({
  layoutRevision,
  initialHeader,
  initialFooter,
  previewThemeId,
  previewThemeCss,
  previewGoogleFontsHref,
  previewSiteWhatsappNumber,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"header" | "footer">("header");
  const onPersisted = () => router.refresh();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setTab("header")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "header"
              ? "bg-rose-600 text-white shadow"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Üst alan (header)
        </button>
        <button
          type="button"
          onClick={() => setTab("footer")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "footer"
              ? "bg-rose-600 text-white shadow"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Alt bilgi (footer)
        </button>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <strong>Üst alan</strong> sabit menünün hemen altında (tüm sayfalar). <strong>Alt bilgi</strong> telif satırının
        üzerinde. Sayfa içeriğinden bağımsızdır; sekme değiştirmeden önce ilgili sekmede <strong>Kaydet</strong>{" "}
        kullanın.
      </p>
      {tab === "header" ? (
        <PageEditor
          key={`site-header-${layoutRevision}`}
          siteRegion="header"
          initialDesktop={initialHeader}
          initialMobile={null}
          separateMobile={false}
          previewThemeId={previewThemeId}
          previewThemeCss={previewThemeCss}
          previewGoogleFontsHref={previewGoogleFontsHref}
          previewSiteWhatsappNumber={previewSiteWhatsappNumber}
          onPersisted={onPersisted}
        />
      ) : (
        <PageEditor
          key={`site-footer-${layoutRevision}`}
          siteRegion="footer"
          initialDesktop={initialFooter}
          initialMobile={null}
          separateMobile={false}
          previewThemeId={previewThemeId}
          previewThemeCss={previewThemeCss}
          previewGoogleFontsHref={previewGoogleFontsHref}
          previewSiteWhatsappNumber={previewSiteWhatsappNumber}
          onPersisted={onPersisted}
        />
      )}
    </div>
  );
}
