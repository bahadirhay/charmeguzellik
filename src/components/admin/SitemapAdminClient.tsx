"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseSitemapExtrasJson,
  sitemapChangeFrequencyValues,
  type SitemapChangeFrequency,
  type SitemapExtraEntry,
} from "@/lib/sitemap-config";

type PageRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  noIndex: boolean;
  includeInSitemap: boolean;
  sitemapPriority: number | null;
  sitemapChangeFrequency: string | null;
  updatedAt: string;
};

type LoadPayload = {
  siteUrl: string;
  sitemapHomePriority: number;
  sitemapPagePriority: number;
  sitemapExtrasJson: string;
  pages: PageRow[];
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function SitemapAdminClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [homePriority, setHomePriority] = useState(1);
  const [pagePriority, setPagePriority] = useState(0.7);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [extras, setExtras] = useState<SitemapExtraEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/sitemap", { cache: "no-store" });
    if (!res.ok) {
      setError("Veri yüklenemedi");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as LoadPayload;
    setSiteUrl(String(data.siteUrl ?? "").replace(/\/$/, "") || "http://localhost:3000");
    setHomePriority(data.sitemapHomePriority ?? 1);
    setPagePriority(data.sitemapPagePriority ?? 0.7);
    setPages(data.pages ?? []);
    setExtras(parseSitemapExtrasJson(data.sitemapExtrasJson));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patchPage(id: string, patch: Partial<PageRow>) {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addExtra() {
    setExtras((prev) => [...prev, { path: "/" }]);
  }

  function patchExtra(i: number, patch: Partial<SitemapExtraEntry>) {
    setExtras((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }

  function removeExtra(i: number) {
    setExtras((prev) => prev.filter((_, j) => j !== i));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    const pageUpdates = pages.map((p) => ({
      id: p.id,
      includeInSitemap: p.includeInSitemap,
      sitemapPriority: p.sitemapPriority,
      sitemapChangeFrequency: p.sitemapChangeFrequency,
    }));
    const cleanedExtras = extras
      .map((e) => ({ ...e, path: e.path.trim() }))
      .filter((e) => e.path.length > 0);

    const res = await fetch("/api/admin/sitemap", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sitemapHomePriority: homePriority,
        sitemapPagePriority: pagePriority,
        sitemapExtras: cleanedExtras,
        pageUpdates,
      }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof raw.error === "string" ? raw.error : "Kayıt başarısız");
      setSaving(false);
      return;
    }
    const data = raw as LoadPayload;
    setPages(data.pages ?? []);
    setHomePriority(data.sitemapHomePriority ?? 1);
    setPagePriority(data.sitemapPagePriority ?? 0.7);
    setExtras(parseSitemapExtrasJson(data.sitemapExtrasJson));
    setOk("Kaydedildi");
    setSaving(false);
  }

  const sitemapHref = `${siteUrl}/sitemap.xml`;
  const robotsHref = `${siteUrl}/robots.txt`;

  if (loading) {
    return <p className="text-sm text-zinc-500">Yükleniyor…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Site haritası (SEO)</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Arama motorları{" "}
          <a className="text-rose-600 underline" href={sitemapHref} target="_blank" rel="noreferrer">
            sitemap.xml
          </a>{" "}
          dosyasını kullanır.{" "}
          <a className="text-rose-600 underline" href={robotsHref} target="_blank" rel="noreferrer">
            robots.txt
          </a>{" "}
          bu adresi işaret eder. Üretimde kök URL için{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">NEXT_PUBLIC_SITE_URL</code>{" "}
          ayarlayın.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {ok}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Genel öncelikler</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Sayfa başına özel öncelik boş bırakılırsa ana sayfa için soldaki değer, diğer sayfalar için sağdaki
          değer kullanılır (0–1).
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="grid gap-1 text-sm">
            Ana sayfa varsayılan önceliği
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={homePriority}
              onChange={(e) => setHomePriority(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            İç sayfa varsayılan önceliği
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={pagePriority}
              onChange={(e) => setPagePriority(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sayfalar</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Yalnızca <strong>yayında</strong> ve <strong>endeks açık</strong> (noindex kapalı) sayfalar canlı
          sitemap’e girer. Taslak veya noindex sayfalar burada yine yönetilebilir; yayına alındığında ayarlarınız
          geçerli olur.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-700">
                <th className="py-2 pr-2">Sayfa</th>
                <th className="py-2 pr-2">Durum</th>
                <th className="py-2 pr-2">Sitemap’e dahil</th>
                <th className="py-2 pr-2">Öncelik (0–1, boş=varsayılan)</th>
                <th className="py-2 pr-2">Güncelleme sıklığı</th>
                <th className="py-2">Son güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const live = p.published && !p.noIndex;
                return (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-2 align-top">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.title}</div>
                      <code className="text-xs text-zinc-500">/{p.slug === "home" ? "" : p.slug}</code>
                    </td>
                    <td className="py-2 pr-2 align-top text-xs">
                      {!p.published ? (
                        <span className="text-amber-700 dark:text-amber-400">Taslak</span>
                      ) : p.noIndex ? (
                        <span className="text-amber-700 dark:text-amber-400">noindex</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">Yayında</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="checkbox"
                        checked={p.includeInSitemap}
                        disabled={!live}
                        title={!live ? "Yayında ve endekslenirken sitemap’e eklenebilir" : undefined}
                        onChange={(e) => patchPage(p.id, { includeInSitemap: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        disabled={!live}
                        placeholder={p.slug === "home" ? String(homePriority) : String(pagePriority)}
                        className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        value={p.sitemapPriority ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") patchPage(p.id, { sitemapPriority: null });
                          else {
                            const n = Number(v);
                            if (Number.isFinite(n)) patchPage(p.id, { sitemapPriority: n });
                          }
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <select
                        className="max-w-[160px] rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        disabled={!live}
                        value={p.sitemapChangeFrequency ?? ""}
                        onChange={(e) =>
                          patchPage(p.id, {
                            sitemapChangeFrequency: e.target.value === "" ? null : e.target.value,
                          })
                        }
                      >
                        <option value="">Varsayılan ({p.slug === "home" ? "weekly" : "monthly"})</option>
                        {sitemapChangeFrequencyValues.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 align-top text-xs text-zinc-500">{fmtDate(p.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ek URL’ler</h2>
            <p className="mt-1 text-xs text-zinc-500">
              CMS dışındaki yollar (ör. statik dosya veya özel route). Aynı site kökü; tam URL yalnızca bu
              alan adıyla aynı origin ise kabul edilir.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            onClick={addExtra}
          >
            Satır ekle
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {extras.length === 0 ? (
            <p className="text-sm text-zinc-500">Ek yol yok.</p>
          ) : (
            extras.map((ex, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
                <label className="grid min-w-[200px] flex-1 gap-1 text-xs">
                  Path veya URL
                  <input
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    value={ex.path}
                    onChange={(e) => patchExtra(i, { path: e.target.value })}
                    placeholder="/kampanya"
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Öncelik
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                    value={ex.priority ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") patchExtra(i, { priority: undefined });
                      else {
                        const n = Number(v);
                        if (Number.isFinite(n)) patchExtra(i, { priority: n });
                      }
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Sıklık
                  <select
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    value={ex.changeFrequency ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      patchExtra(i, {
                        changeFrequency: v === "" ? undefined : (v as SitemapChangeFrequency),
                      });
                    }}
                  >
                    <option value="">monthly (varsayılan)</option>
                    {sitemapChangeFrequencyValues.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => removeExtra(i)}
                >
                  Sil
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Tümünü kaydet"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          onClick={() => void load()}
        >
          Yenile
        </button>
      </div>
    </div>
  );
}
