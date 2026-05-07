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
type GoogleReviewsHealth = {
  ok: boolean;
  configured: boolean;
  message: string;
  totalFromGoogle: number;
  publishedAfterFilter: number;
};
type MailTestDetail = {
  accepted?: string[];
  rejected?: string[];
  pending?: string[];
  response?: string | null;
  messageId?: string | null;
  note?: string;
};
type AppointmentNotifyTestDetail = {
  recipients: number;
  sent: number;
  failed: Array<{ to: string; ok: boolean; error: string | null }>;
};

type SettingsRow = SiteSettingsAdminClient;

export function SettingsForm({ initial }: { initial: SettingsRow }) {
  const [row, setRow] = useState<SettingsRow>(initial);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [testMailTo, setTestMailTo] = useState("");
  const [testMailBusy, setTestMailBusy] = useState(false);
  const [testMailFeedback, setTestMailFeedback] = useState<Feedback | null>(null);
  const [testMailDetail, setTestMailDetail] = useState<MailTestDetail | null>(null);
  const [notifyTestBusy, setNotifyTestBusy] = useState(false);
  const [notifyTestFeedback, setNotifyTestFeedback] = useState<Feedback | null>(null);
  const [notifyTestDetail, setNotifyTestDetail] = useState<AppointmentNotifyTestDetail | null>(null);
  const [googleHealthBusy, setGoogleHealthBusy] = useState(false);
  const [googleHealth, setGoogleHealth] = useState<GoogleReviewsHealth | null>(null);
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

  async function sendTestMail() {
    const to = testMailTo.trim();
    if (!to) {
      setTestMailFeedback({ text: "Test e-posta için alıcı adresi girin.", error: true });
      setTestMailDetail(null);
      return;
    }
    setTestMailBusy(true);
    setTestMailFeedback(null);
    setTestMailDetail(null);
    try {
      const res = await fetch("/api/admin/settings/test-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        via?: string;
        detail?: MailTestDetail;
      };
      if (!res.ok || !j.ok) {
        setTestMailFeedback({ text: j.error ?? "Test e-postası gönderilemedi.", error: true });
        setTestMailDetail(j.detail ?? null);
        return;
      }
      const via = j.via ? ` (${j.via})` : "";
      setTestMailFeedback({ text: `Test e-postası gönderildi${via}: ${to}`, error: false });
      setTestMailDetail(j.detail ?? null);
    } finally {
      setTestMailBusy(false);
    }
  }

  async function checkGoogleReviewsHealth() {
    setGoogleHealthBusy(true);
    try {
      const res = await fetch("/api/admin/settings/google-reviews-health", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as GoogleReviewsHealth & { error?: string };
      if (!res.ok) {
        setGoogleHealth({
          ok: false,
          configured: false,
          message: j.error ?? "Google yorum testi başarısız.",
          totalFromGoogle: 0,
          publishedAfterFilter: 0,
        });
        return;
      }
      setGoogleHealth(j);
    } finally {
      setGoogleHealthBusy(false);
    }
  }

  async function sendAppointmentNotifyTest() {
    setNotifyTestBusy(true);
    setNotifyTestFeedback(null);
    setNotifyTestDetail(null);
    try {
      const res = await fetch("/api/admin/settings/test-appointment-notify", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: AppointmentNotifyTestDetail;
      };
      if (!res.ok || !j.ok) {
        setNotifyTestFeedback({ text: j.error ?? "Test bildirimi gönderilemedi.", error: true });
        setNotifyTestDetail(j.detail ?? null);
        return;
      }
      setNotifyTestFeedback({ text: "Randevu bildirimi test e-postası gönderildi.", error: false });
      setNotifyTestDetail(j.detail ?? null);
    } finally {
      setNotifyTestBusy(false);
    }
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

  function patchThemeTokens(patch: Partial<ThemeTokens>) {
    const t = parseThemeTokens(row.themeTokensJson);
    field("themeTokensJson", themeTokensToJson({ ...t, ...patch }));
  }

  const parsedThemeTokens = parseThemeTokens(row.themeTokensJson);
  const headerBrand = parsedThemeTokens.siteHeaderBrand ?? {};
  const socialPreviewLogoUrl = strForInput(parsedThemeTokens.socialPreviewLogoUrl ?? undefined);
  const siteFaviconUrl = strForInput(parsedThemeTokens.siteFaviconUrl ?? undefined);

  const themeList = listThemes();
  const activeMeta = themeList.find((t) => t.id === row.activeThemeId) ?? themeList[0];
  const settingsSections = [
    { id: "appearance", label: "Görünüm & tema" },
    { id: "seo", label: "Genel & SEO" },
    { id: "footer", label: "Alt bilgi şeridi" },
    { id: "analytics", label: "Ölçümleme" },
    { id: "smtp", label: "SMTP" },
    { id: "contact", label: "İletişim" },
  ] as const;

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <nav className="sticky top-2 z-20 rounded-xl border border-zinc-200 bg-white/90 p-2 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
        <div className="flex flex-wrap gap-2">
          {settingsSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <section id="appearance" className="scroll-mt-16 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
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
                demo paketi; Charmen 4, Default 2 görsel).
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
              <strong>Üst bilgi şeridini göster</strong> (Charmen: kampanya, adres, sosyal, telefon —
              kapatırsanız yalnız beyaz menü çubuğu kalır)
            </span>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Üst şerit kampanya metni (Charmen teması — örn. fiyat)
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

      <section id="seo" className="scroll-mt-16 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
          <label className="grid gap-1 text-sm md:col-span-2">
            WhatsApp/link önizleme logo URL
            <input
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={socialPreviewLogoUrl}
              onChange={(e) => patchThemeTokens({ socialPreviewLogoUrl: e.target.value || null })}
              placeholder="/uploads/charme-guzellik-logo.png veya https://..."
            />
            <span className="text-xs text-zinc-500">
              Randevu onay/iptal bağlantılarının WhatsApp kart görseli. Boşsa sistem varsayılan logoyu dener.
            </span>
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Site favicon / app icon URL
            <input
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={siteFaviconUrl}
              onChange={(e) => patchThemeTokens({ siteFaviconUrl: e.target.value || null })}
              placeholder="/uploads/charme-guzellik-logo.png veya https://..."
            />
            <span className="text-xs text-zinc-500">
              Tarayıcı sekmesindeki ikon ve bazı sosyal önizleme kartlarında kullanılan favicon.
            </span>
          </label>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50 md:col-span-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Google yorum entegrasyonu</p>
            <p className="mt-1 text-xs text-zinc-500">
              Canlı sitede yorumlar Google Places API’den çekilir. Kötü yorumları filtrelemek için Vercel env:
              <code className="ml-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">GOOGLE_REVIEWS_MIN_RATING</code>{" "}
              (öneri: 4) ve isteğe bağlı
              <code className="ml-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">GOOGLE_REVIEWS_BLOCK_TERMS</code>{" "}
              (virgülle anahtar kelime) kullanın.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void checkGoogleReviewsHealth()}
                disabled={googleHealthBusy}
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-600 disabled:opacity-50"
              >
                {googleHealthBusy ? "Kontrol ediliyor…" : "Google yorumlarını test et"}
              </button>
              {googleHealth ? (
                <span
                  className={`text-xs ${
                    googleHealth.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {googleHealth.message} (Google: {googleHealth.totalFromGoogle}, Yayınlanacak:{" "}
                  {googleHealth.publishedAfterFilter})
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section id="footer" className="scroll-mt-16 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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

      <section id="analytics" className="scroll-mt-16 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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

      <section id="smtp" className="scroll-mt-16 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50 md:col-span-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">SMTP test e-postası</p>
            <p className="mt-1 text-xs text-zinc-500">
              Ayarları kaydettikten sonra bu alandan test e-postası gönderip teslimatı doğrulayabilirsiniz.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="grid min-w-[260px] flex-1 gap-1 text-sm">
                Alıcı e-posta
                <input
                  type="email"
                  className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={testMailTo}
                  onChange={(e) => setTestMailTo(e.target.value)}
                  placeholder="ornek@alanadiniz.com"
                />
              </label>
              <button
                type="button"
                onClick={() => void sendTestMail()}
                disabled={testMailBusy}
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-600 disabled:opacity-50"
              >
                {testMailBusy ? "Gönderiliyor…" : "Test mail gönder"}
              </button>
            </div>
            {testMailFeedback ? (
              <p
                className={`mt-2 text-xs ${
                  testMailFeedback.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {testMailFeedback.text}
              </p>
            ) : null}
            {testMailDetail ? (
              <div className="mt-2 rounded border border-zinc-200 bg-white p-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {testMailDetail.note ? <p>{testMailDetail.note}</p> : null}
                {testMailDetail.response ? <p>Sunucu cevabı: {testMailDetail.response}</p> : null}
                {testMailDetail.messageId ? <p>Message-ID: {testMailDetail.messageId}</p> : null}
                {testMailDetail.accepted?.length ? <p>Kabul edilen: {testMailDetail.accepted.join(", ")}</p> : null}
                {testMailDetail.rejected?.length ? <p>Reddedilen: {testMailDetail.rejected.join(", ")}</p> : null}
                {testMailDetail.pending?.length ? <p>Bekleyen: {testMailDetail.pending.join(", ")}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-16 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">İletişim</h2>
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
            Randevu bildirimi — admin e-postaları (virgül veya satır ile çoklu)
            <span className="text-xs text-zinc-500">
              Yeni randevu talebi geldiğinde buradaki adreslere posta gider. Ortam değişkeni{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">APPOINTMENT_NOTIFY_TO</code> ile birleşir (
              tekrar gönderilmez). Boşsa sistem <strong>SMTP kullanıcı adresini</strong> yedek alıcı olarak kullanır.
            </span>
            <textarea
              rows={3}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              placeholder={"admin@orneksalon.com, yardim@orneksalon.com"}
              value={strForInput(row.appointmentNotifyAdminEmails)}
              onChange={(e) => field("appointmentNotifyAdminEmails", e.target.value || null)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Randevu bildirimi — operatör e-postaları (virgül veya satır ile çoklu)
            <span className="text-xs text-zinc-500">
              Ortam değişkeni{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">APPOINTMENT_OPERATOR_NOTIFY_TO</code> ile birleşir.
              Gönderen adres <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">MAIL_FROM</code> veya SMTP
              gönderenidir; alıcı listesine eklemeyin.
            </span>
            <textarea
              rows={3}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              placeholder={"oper@orneksalon.com"}
              value={strForInput(row.appointmentNotifyOperatorEmails)}
              onChange={(e) => field("appointmentNotifyOperatorEmails", e.target.value || null)}
            />
          </label>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Randevu bildirimi testi</p>
            <p className="mt-1 text-xs text-zinc-500">
              Yeni randevu gelmiş gibi tanımlı alıcılara test e-postası yollar. Bu, canlı bildirim akışının en sade ve
              güvenilir doğrulamasıdır.
            </p>
            <button
              type="button"
              onClick={() => void sendAppointmentNotifyTest()}
              disabled={notifyTestBusy}
              className="mt-2 rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-600 disabled:opacity-50"
            >
              {notifyTestBusy ? "Gönderiliyor…" : "Randevu bildirimi testini gönder"}
            </button>
            {notifyTestFeedback ? (
              <p
                className={`mt-2 text-xs ${
                  notifyTestFeedback.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {notifyTestFeedback.text}
              </p>
            ) : null}
            {notifyTestDetail ? (
              <div className="mt-2 rounded border border-zinc-200 bg-white p-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                <p>
                  Alıcı: {notifyTestDetail.recipients} | Gönderilen: {notifyTestDetail.sent} | Hata:{" "}
                  {notifyTestDetail.failed.length}
                </p>
                {notifyTestDetail.failed.length ? (
                  <ul className="mt-1 list-disc pl-4">
                    {notifyTestDetail.failed.map((f) => (
                      <li key={f.to}>
                        {f.to}: {f.error ?? "Bilinmeyen hata"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <label className="grid gap-1 text-sm">
            Çerez bilgilendirme JSON (opsiyonel)
            <span className="text-xs text-zinc-500">
              Başlık, metin, kategori özeti/detayı (`summary` / `detail`), kişisel veri listesi
              (`personalDataNoticeTitle`, `personalDataNoticeItems`) ve butonlar buradan yönetilir.
              Kayıtları{" "}
              <a href="/admin/cookie-consents" className="underline">
                Çerez Kayıtları
              </a>{" "}
              ekranında görebilirsiniz.
            </span>
            <textarea
              rows={10}
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={strForInput(row.cookieConsentJson)}
              onChange={(e) => field("cookieConsentJson", e.target.value || null)}
              placeholder={`{"enabled":true,"title":"Çerez Bildirimi","personalDataNoticeTitle":"Çerezler aracılığıyla...","personalDataNoticeItems":["IP Adresi: ..."],"categories":[{"id":"functional","label":"Fonksiyonel","summary":"Her zaman aktif.","detail":"Uzun açıklama...","required":true},{"id":"analytics","label":"İstatistik","summary":"Anonim analiz.","detail":"Detay...","defaultEnabled":true},{"id":"marketing","label":"Pazarlama","summary":"Reklam çerezleri.","detail":"Detay...","defaultEnabled":true}]}`}
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
