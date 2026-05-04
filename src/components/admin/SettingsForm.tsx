"use client";

import { useState } from "react";
import type { SiteSettingsAdminClient } from "@/lib/site-settings";
import { normalizeUploadSlug } from "@/lib/upload-slug";
import { listThemes } from "@/themes/registry";
import {
  parseThemeTokens,
  themeTokensToJson,
  type SiteHeaderBrand,
  type ThemeTokens,
} from "@/lib/theme-tokens";

/** DB'de yanlışlıkla "null" string olarak saklanmış alanları boş göster */
function strForInput(v: string | null | undefined) {
  if (v == null) return "";
  const t = v.trim();
  if (t === "null" || t === "undefined") return "";
  return v;
}

type Feedback = { text: string; error: boolean };

type SettingsRow = SiteSettingsAdminClient;

export function SettingsForm({ initial }: { initial: SettingsRow }) {
  const [row, setRow] = useState<SettingsRow>(initial);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [importPresetImages, setImportPresetImages] = useState(false);
  const [importCustomUrls, setImportCustomUrls] = useState(false);
  const [customUrlsJson, setCustomUrlsJson] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      let detail = `Kayıt başarısız (${res.status})`;
      try {
        const j = (await res.json()) as { error?: unknown };
        if (typeof j.error === "string" && j.error.trim()) detail = j.error;
      } catch {
        /* ignore */
      }
      setFeedback({ text: detail, error: true });
      return;
    }
    const next = (await res.json()) as SettingsRow;
    setRow(next);

    const wantPreset = importPresetImages;
    let urls: string[] | undefined;
    if (importCustomUrls && customUrlsJson.trim()) {
      try {
        const p = JSON.parse(customUrlsJson) as unknown;
        urls = Array.isArray(p)
          ? p.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((u) => u.trim())
          : [];
      } catch {
        setFeedback({
          text: "Kaydedildi ancak ek URL JSON’u geçersiz — özelleştirilmiş indirme yapılmadı.",
          error: true,
        });
        return;
      }
    }
    const hasCustomUrls = urls && urls.length > 0;
    if (!wantPreset && !hasCustomUrls) {
      setFeedback({ text: "Kaydedildi", error: false });
      return;
    }
    const slugRaw = strForInput(next.mediaUploadSlug) || next.siteName || "site";
    const slug = normalizeUploadSlug(slugRaw);

    const ir = await fetch("/api/admin/media/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        ...(wantPreset ? { presetThemeId: next.activeThemeId ?? "default" } : {}),
        ...(hasCustomUrls ? { urls } : {}),
      }),
    });
    const data = (await ir.json()) as {
      error?: unknown;
      downloaded?: number;
      total?: number;
      hintFirst?: string;
    };
    if (!ir.ok) {
      setFeedback({
        text: "Ayarlar kaydedildi; görsel indirme başarısız (sunucu hatası).",
        error: true,
      });
      return;
    }
    const n = data.downloaded ?? 0;
    setImportPresetImages(false);
    setImportCustomUrls(false);
    setCustomUrlsJson("");
    setFeedback({
      text: `Kaydedildi. ${n} görsel indirildi (${data.total ?? n} deneme). Örnek yol: ${data.hintFirst ?? `/uploads/${slug}/…`}`,
      error: false,
    });
  }

  function field<K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) {
    setRow((r) => ({ ...r, [key]: value }));
  }

  function patchFooterStrip(patch: Partial<NonNullable<ThemeTokens["siteFooterStrip"]>>) {
    const t = parseThemeTokens(row.themeTokensJson);
    const next: ThemeTokens = {
      ...t,
      siteFooterStrip: { ...(t.siteFooterStrip ?? {}), ...patch },
    };
    field("themeTokensJson", themeTokensToJson(next));
  }

  const footerStrip = parseThemeTokens(row.themeTokensJson).siteFooterStrip ?? {};

  function patchHeaderBrand(patch: Partial<NonNullable<ThemeTokens["siteHeaderBrand"]>>) {
    const t = parseThemeTokens(row.themeTokensJson);
    const next: ThemeTokens = {
      ...t,
      siteHeaderBrand: { ...(t.siteHeaderBrand ?? {}), ...patch },
    };
    field("themeTokensJson", themeTokensToJson(next));
  }

  const headerBrand = parseThemeTokens(row.themeTokensJson).siteHeaderBrand ?? {};

  const themeList = listThemes();
  const activeMeta = themeList.find((t) => t.id === row.activeThemeId) ?? themeList[0];

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
        <h2 className="font-medium">Görünüm & tema</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Her tema ayrı klasör: <code className="rounded bg-white px-1 dark:bg-zinc-900">src/themes/default</code>,{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-900">src/themes/cherry</code>. Yeni tema için{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-900">types.ts</code> (THEME_IDS),{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-900">registry.ts</code> ve{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-900">entry.css</code> güncelleyin.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm md:col-span-2">
            Aktif tema
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              value={row.activeThemeId ?? "default"}
              onChange={(e) => field("activeThemeId", e.target.value)}
            >
              {themeList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-zinc-500 md:col-span-2">{activeMeta?.description}</p>
          <p className="text-xs text-zinc-600 md:col-span-2 dark:text-zinc-400">
            <a href="/admin/instagram" className="font-medium text-rose-600 hover:underline">
              Instagram vitrinı →
            </a>{" "}
            Hangi gönderilerin sitede görüneceğini seçin; bağlantı yapıştırma veya Graph API ile içe
            aktarma.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 md:col-span-2">
            <p className="font-medium text-amber-900 dark:text-amber-50">
              Başka bir web sitesinin tamamını (tüm yazılar, görseller, tasarım birebir) otomatik
              kopyalamıyoruz — telif ve kullanım hakkı nedeniyle yasal değil. Tasarım{" "}
              <strong>seçtiğiniz tema</strong> ile gelir; metinler{" "}
              <a href="/admin/pages" className="underline">
                Sayfalar
              </a>{" "}
              düzenleyicide; slayta kendi görsellerinizi veya aşağıdaki indirme seçeneklerini
              kullanın.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/25 md:col-span-2">
            <h3 className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
              Kayıt sırasında görsel indirme (isteğe bağlı)
            </h3>
            <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/85">
              <strong>Tüm ayarları kaydet</strong> dediğinizde, işaretlediğiniz kutulara göre sunucu{" "}
              <code className="rounded bg-white/90 px-1 dark:bg-zinc-900">public/uploads/</code>{" "}
              altına dosya yazar. İstemezseniz hiçbir kutuyu işaretlemeyin.
            </p>
            <label className="mt-3 grid gap-1 text-sm text-zinc-800 dark:text-zinc-200">
              Görsel klasör adı (küçük harf, tire; boşsa site adından türetilir)
              <input
                className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                value={strForInput(row.mediaUploadSlug)}
                onChange={(e) => field("mediaUploadSlug", e.target.value || null)}
                placeholder="ornek-lumen-guzellik"
              />
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={importPresetImages}
                onChange={(e) => setImportPresetImages(e.target.checked)}
              />
              <span>
                <strong>Aktif temaya uygun dahili örnek slayt görsellerini indir</strong> (Unsplash
                demo paketi; Cherry 4, Default 2 görsel).
              </span>
            </label>
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={importCustomUrls}
                onChange={(e) => setImportCustomUrls(e.target.checked)}
              />
              <span>
                <strong>Kendi URL listemi</strong> de indir (aşağıdaki JSON; yalnızca kullanım
                hakkınız olan adresler)
              </span>
            </label>
            {importCustomUrls ? (
              <textarea
                className="mt-2 w-full rounded border border-zinc-300 bg-white px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                rows={4}
                placeholder={`["https://.../1.jpg","https://.../2.jpg"]`}
                value={customUrlsJson}
                onChange={(e) => setCustomUrlsJson(e.target.value)}
              />
            ) : null}
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Geliştirici alternatifi: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run images:import -- --slug …</code> ve{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">scripts/image-urls.json</code>.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={row.showHeaderTopBar !== false}
              onChange={(e) => field("showHeaderTopBar", e.target.checked)}
            />
            <span>
              <strong>Üst bilgi şeridini göster</strong> (Cherry: kampanya, adres, sosyal, telefon —
              kapatırsanız yalnız beyaz menü çubuğu kalır)
            </span>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Üst şerit kampanya metni (Cherry teması — örn. fiyat)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.headerPromoLine)}
              onChange={(e) => field("headerPromoLine", e.target.value || null)}
              placeholder="750₺"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Instagram URL
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.socialInstagramUrl)}
              onChange={(e) => field("socialInstagramUrl", e.target.value || null)}
              placeholder="https://instagram.com/..."
            />
          </label>
          <label className="grid gap-1 text-sm">
            Facebook URL
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.socialFacebookUrl)}
              onChange={(e) => field("socialFacebookUrl", e.target.value || null)}
              placeholder="https://facebook.com/..."
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Genel & SEO</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm md:col-span-2">
            Site adı
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={row.siteName}
              onChange={(e) => field("siteName", e.target.value)}
            />
          </label>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50 md:col-span-2">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Üst menü markası (sol köşe)</h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Geniş başlıkta logo veya site adı; sayfa aşağı kaydırılınca yapışkan menüde her zaman{" "}
              <strong>site adı</strong> gösterilir. Ayarlar tema JSON’unda saklanır.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Masaüstü (geniş menü)
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  value={headerBrand.desktopDisplay === "logo" ? "logo" : "text"}
                  onChange={(e) =>
                    patchHeaderBrand({
                      desktopDisplay: e.target.value === "logo" ? "logo" : "text",
                    })
                  }
                >
                  <option value="text">Site adı (yazı)</option>
                  <option value="logo">Logo (görsel URL)</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Masaüstü menü konumu
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  value={headerBrand.desktopNavAlign ?? "end"}
                  onChange={(e) =>
                    patchHeaderBrand({
                      desktopNavAlign: e.target.value as NonNullable<
                        SiteHeaderBrand["desktopNavAlign"]
                      >,
                    })
                  }
                >
                  <option value="start">Sol (logonun yanı)</option>
                  <option value="center">Orta</option>
                  <option value="end">Sağ (varsayılan)</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Masaüstü logo URL (png, svg, jpg…)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={strForInput(headerBrand.desktopLogoUrl ?? undefined)}
                  onChange={(e) => patchHeaderBrand({ desktopLogoUrl: e.target.value || null })}
                  placeholder="https://… veya /uploads/…/logo.png"
                  disabled={headerBrand.desktopDisplay !== "logo"}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Masaüstü logo yüksekliği (px)
                <input
                  type="number"
                  min={24}
                  max={120}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={headerBrand.desktopLogoMaxHeightPx ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      patchHeaderBrand({ desktopLogoMaxHeightPx: undefined });
                      return;
                    }
                    const n = Math.round(Number(raw));
                    patchHeaderBrand({
                      desktopLogoMaxHeightPx: Number.isFinite(n)
                        ? Math.min(120, Math.max(24, n))
                        : undefined,
                    });
                  }}
                  placeholder="48"
                  disabled={headerBrand.desktopDisplay !== "logo"}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Mobil logo yüksekliği (px)
                <input
                  type="number"
                  min={24}
                  max={100}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={headerBrand.mobileLogoMaxHeightPx ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      patchHeaderBrand({ mobileLogoMaxHeightPx: undefined });
                      return;
                    }
                    const n = Math.round(Number(raw));
                    patchHeaderBrand({
                      mobileLogoMaxHeightPx: Number.isFinite(n)
                        ? Math.min(100, Math.max(24, n))
                        : undefined,
                    });
                  }}
                  placeholder="Boş = masaüstü yüksekliği (mobilde en fazla 100)"
                  disabled={(headerBrand.mobileDisplay ?? "same") === "text"}
                />
              </label>
              <p className="text-xs text-zinc-500 sm:col-span-2">
                Mobil yükseklik boş bırakılırsa masaüstü değeri kullanılır (mobilde en fazla 100 px). Logo
                gösterilmiyorsa alanlar devre dışıdır.
              </p>
              <label className="grid gap-1 text-sm">
                Mobil (geniş menü, hamburger üstü)
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  value={headerBrand.mobileDisplay ?? "same"}
                  onChange={(e) =>
                    patchHeaderBrand({
                      mobileDisplay: e.target.value as SiteHeaderBrand["mobileDisplay"],
                    })
                  }
                >
                  <option value="same">Masaüstüyle aynı</option>
                  <option value="text">Her zaman site adı</option>
                  <option value="logo">Logo (URL aşağıda)</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Mobil logo URL (boşsa masaüstü URL’si kullanılır)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={strForInput(headerBrand.mobileLogoUrl ?? undefined)}
                  onChange={(e) => patchHeaderBrand({ mobileLogoUrl: e.target.value || null })}
                  placeholder="İsteğe bağlı — dar ekran için daha küçük logo"
                  disabled={(headerBrand.mobileDisplay ?? "same") !== "logo"}
                />
              </label>
            </div>
          </div>
          <label className="grid gap-1 text-sm md:col-span-2">
            Varsayılan meta başlık
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={row.defaultMetaTitle ?? ""}
              onChange={(e) => field("defaultMetaTitle", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Varsayılan meta açıklama
            <textarea
              rows={2}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.defaultMetaDescription)}
              onChange={(e) => field("defaultMetaDescription", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Anahtar kelimeler (virgülle)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.seoKeywords)}
              onChange={(e) => field("seoKeywords", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            İşletme JSON-LD (JSON)
            <textarea
              rows={6}
              className="font-mono text-xs rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.businessJson)}
              onChange={(e) => field("businessJson", e.target.value || null)}
              placeholder='{"name":"...","telephone":"+90...","address":{...}}'
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Alt bilgi şeridi (telif + yönetim)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Bloklarla dolu pazarlama alt bilgisinin altında görünen ince şerit. İkisini de kapatırsanız bu alan
          sitede gösterilmez. Ayarlar <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">themeTokensJson</code>{" "}
          içinde saklanır (Tema özelleştirici ile uyumludur).
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={footerStrip.legalLineEnabled !== false}
              onChange={(e) => patchFooterStrip({ legalLineEnabled: e.target.checked })}
            />
            <span>
              <strong>Telif / tüm hakları satırını göster</strong> (© yıl ve site adı veya aşağıdaki özel metin)
            </span>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Özel telif metni (isteğe bağlı)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(footerStrip.legalLine ?? undefined)}
              onChange={(e) => patchFooterStrip({ legalLine: e.target.value || null })}
              placeholder={`Boş bırakın: otomatik "© ${new Date().getFullYear()} ${row.siteName}"`}
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Telif satırı bağlantısı (isteğe bağlı)
            <input
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(footerStrip.legalLinkHref ?? undefined)}
              onChange={(e) => patchFooterStrip({ legalLinkHref: e.target.value || null })}
              placeholder="https://tecHizmet.com veya /hakkimizda"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={footerStrip.legalLinkOpenInNewTab === true}
              onChange={(e) => patchFooterStrip({ legalLinkOpenInNewTab: e.target.checked })}
            />
            <span>
              Telif bağlantısını <strong>yeni sekmede</strong> aç (kapalı: aynı sekme)
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={footerStrip.adminLinkEnabled !== false}
              onChange={(e) => patchFooterStrip({ adminLinkEnabled: e.target.checked })}
            />
            <span>
              <strong>Yönetim paneli bağlantısını göster</strong> (hedef: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/admin</code>)
            </span>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Panel bağlantısı metni
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(footerStrip.adminLinkLabel ?? undefined)}
              onChange={(e) => patchFooterStrip({ adminLinkLabel: e.target.value || null })}
              placeholder="Yönetim paneli"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Ölçümleme</h2>
        <p className="mt-1 text-xs text-zinc-500">
          GTM kullanıyorsanız GA ID alanını boş bırakın; yalnızca GTM yüklenir.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Google Analytics (G-...)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleAnalyticsId)}
              onChange={(e) => field("googleAnalyticsId", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Google Tag Manager (GTM-...)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleTagManagerId)}
              onChange={(e) => field("googleTagManagerId", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Facebook Pixel ID
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.facebookPixelId)}
              onChange={(e) => field("facebookPixelId", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Ek head HTML (dikkat: güvenilir kod)
            <textarea
              rows={3}
              className="font-mono text-xs rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.customHeadHtml)}
              onChange={(e) => field("customHeadHtml", e.target.value || null)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Giden e-posta (SMTP)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Doldurulduğunda randevu onay/red e-postaları bu sunucudan gider. Alan adınızda SPF ve DKIM kayıtlarını
          sağlayın. Boş bırakırsanız{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">RESEND_API_KEY</code> /{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">MAIL_FROM</code> kullanılır.
        </p>
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
          SMTP şifresi veritabanında saklanır; mümkünse uygulama özelinde kısıtlı bir posta kutusu kullanın.
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm md:col-span-2">
            SMTP sunucusu (host)
            <input
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.smtpHost)}
              onChange={(e) => field("smtpHost", e.target.value || null)}
              placeholder="mail.alanadiniz.com"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Port (boş: 465 SSL ise, aksi halde 587)
            <input
              type="number"
              min={1}
              max={65535}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={row.smtpPort != null ? row.smtpPort : ""}
              onChange={(e) => {
                const t = e.target.value.trim();
                field("smtpPort", t === "" ? null : parseInt(t, 10) || null);
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-1 md:self-end">
            <input
              type="checkbox"
              checked={row.smtpSecure}
              onChange={(e) => field("smtpSecure", e.target.checked)}
            />
            SSL/TLS (genelde port 465)
          </label>
          <label className="grid gap-1 text-sm">
            SMTP kullanıcı adı
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.smtpUser)}
              onChange={(e) => field("smtpUser", e.target.value || null)}
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            SMTP şifresi
            <input
              type="password"
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.smtpPass)}
              onChange={(e) => field("smtpPass", e.target.value || null)}
              placeholder={row.smtpPassConfigured ? "Değiştirmek için yeni şifre yazın" : ""}
              autoComplete="new-password"
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Gönderen (From)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.transactionalMailFrom)}
              onChange={(e) => field("transactionalMailFrom", e.target.value || null)}
              placeholder={'Salon Adı <randevu@alanadiniz.com>'}
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">İletişim & takvim</h2>
        <p className="mt-1 text-xs text-zinc-500">
          WhatsApp numarası site genelinde kullanılır; ayrıca{" "}
          <a className="font-medium text-rose-600 underline" href="/admin/whatsapp">
            WhatsApp
          </a>{" "}
          sayfasından da kaydedebilirsiniz.
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            WhatsApp (ülke kodu ile, örn. 90555...)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.whatsappNumber)}
              onChange={(e) => field("whatsappNumber", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Google Takvim embed URL
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleCalendarEmbedUrl)}
              onChange={(e) => field("googleCalendarEmbedUrl", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Takvim ICS abonelik bağlantısı (opsiyonel)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleCalendarIcsUrl)}
              onChange={(e) => field("googleCalendarIcsUrl", e.target.value || null)}
            />
          </label>
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
            <p className="font-medium">Randevu formu → Google Takvim (isteğe bağlı)</p>
            <p className="mt-1 leading-relaxed opacity-90">
              Google Cloud Console’da Calendar API açın; OAuth masaüstü uygulaması ile refresh token alıp aşağıya
              yapıştırın. Doldurulduğunda siteden gelen randevu talepleri <code className="rounded bg-white/80 px-1 dark:bg-black/30">
                primary
              </code>{" "}
              takviminize etkinlik olarak eklenir.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed opacity-95">
              <li>
                <strong>Client ID</strong> — Cloud Console’da «İstemci kimliği»; genelde{" "}
                <code className="rounded bg-white/80 px-1 dark:bg-black/30">…apps.googleusercontent.com</code> ile biter.
                Yalnızca üstteki alana yazın.
              </li>
              <li>
                <strong>Client Secret</strong> — «İstemci gizli anahtarı»; Refresh token alanına değil, ortadaki şifre
                alanına yapıştırın.
              </li>
              <li>
                <strong>Refresh token</strong> — OAuth akışıyla (ör. masaüstü uygulaması + yetkilendirme) üretilen
                ayrı uzun metin. Client ID ile aynı şey değildir;{" "}
                <code className="rounded bg-white/80 px-1 dark:bg-black/30">.googleusercontent.com</code> içeren satırı
                buraya koymayın.
              </li>
            </ul>
          </div>
          <label className="grid gap-1 text-sm font-mono text-[11px]">
            Google OAuth Client ID
            <input
              className="rounded border border-zinc-300 px-2 py-1 text-sm font-sans dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleCalendarClientId)}
              onChange={(e) => field("googleCalendarClientId", e.target.value || null)}
              autoComplete="off"
              placeholder="…apps.googleusercontent.com"
            />
          </label>
          <label className="grid gap-1 text-sm font-mono text-[11px]">
            Google OAuth Client Secret
            <input
              type="password"
              className="rounded border border-zinc-300 px-2 py-1 text-sm font-sans dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleCalendarSecret)}
              onChange={(e) => field("googleCalendarSecret", e.target.value || null)}
              autoComplete="new-password"
              placeholder="Gizli anahtar (Refresh token değil)"
            />
          </label>
          <label className="grid gap-1 text-sm font-mono text-[11px] md:col-span-2">
            Refresh token (Calendar erişimi)
            <input
              className="rounded border border-zinc-300 px-2 py-1 text-sm font-sans dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.googleRefreshToken)}
              onChange={(e) => field("googleRefreshToken", e.target.value || null)}
              autoComplete="off"
              placeholder="OAuth ile alınan token (Client ID satırı değil)"
            />
          </label>
        </div>
      </section>

      <button
        type="submit"
        className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Tüm ayarları kaydet
      </button>
      {feedback ? (
        <p
          className={`text-sm ${feedback.error ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
        >
          {feedback.text}
        </p>
      ) : null}
    </form>
  );
}
