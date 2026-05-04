"use client";

import { useMemo, useState } from "react";
import { listThemes, normalizeThemeId } from "@/themes/registry";
import { parseThemeTokens, themeTokensToJson, type ThemeTokens } from "@/lib/theme-tokens";

function pickTokens(p: ThemeTokens): ThemeTokens {
  const o: ThemeTokens = {};
  (Object.keys(p) as (keyof ThemeTokens)[]).forEach((k) => {
    if (k === "siteFooterStrip") {
      const s = p.siteFooterStrip;
      if (s != null) o.siteFooterStrip = s;
      return;
    }
    if (k === "siteHeaderBrand") {
      const s = p.siteHeaderBrand;
      if (s != null) o.siteHeaderBrand = s;
      return;
    }
    const v = p[k];
    if (v !== undefined && typeof v === "string" && v.trim() !== "") (o as Record<string, string>)[k] = v;
  });
  return o;
}

export function ThemeCustomizerForm({
  initialJson,
  activeThemeId,
}: {
  initialJson: string | null;
  activeThemeId: string;
}) {
  const themeId = normalizeThemeId(activeThemeId);
  const themeMeta = listThemes().find((t) => t.id === themeId);

  const initial = useMemo(() => parseThemeTokens(initialJson), [initialJson]);
  const [row, setRow] = useState<ThemeTokens>(() => ({ ...initial }));
  const [msg, setMsg] = useState<string | null>(null);

  function field<K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) {
    setRow((r) => ({ ...r, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const payload = pickTokens(row);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        themeTokensJson: Object.keys(payload).length ? JSON.stringify(payload) : null,
      }),
    });
    setMsg(res.ok ? "Kaydedildi. Önizleme ve canlı site birkaç saniye içinde güncellenir." : "Hata");
  }

  function resetToEmpty() {
    setRow({});
    setMsg(null);
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Aktif tema paketi: <strong>{themeMeta?.label ?? themeId}</strong> — paketi değiştirmek için{" "}
          <a href="/admin/settings" className="text-rose-600 hover:underline">
            Ayarlar & SEO
          </a>
          .
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Bu ekran WordPress <em>Tema özelleştiricisi</em> gibi renk ve tipografi değişkenlerini
          yönetir. Sayfa düzeni için{" "}
          <a href="/admin/pages" className="text-rose-600 hover:underline">
            Sayfalar
          </a>{" "}
          düzenleyicisini kullanın (Elementor tarzı widget + canlı önizleme).
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Renkler</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ColorField label="Marka (birincil)" value={row.brand} onChange={(v) => field("brand", v)} />
          <ColorField
            label="Marka (hover)"
            value={row.brandHover}
            onChange={(v) => field("brandHover", v)}
          />
          <ColorField label="Arka plan" value={row.siteBg} onChange={(v) => field("siteBg", v)} />
          <ColorField label="Metin rengi" value={row.siteFg} onChange={(v) => field("siteFg", v)} />
          <ColorField label="İkincil metin" value={row.siteMuted} onChange={(v) => field("siteMuted", v)} />
          <ColorField label="Üst şerit arka plan" value={row.topbarBg} onChange={(v) => field("topbarBg", v)} />
          <ColorField label="Üst şerit yazı" value={row.topbarFg} onChange={(v) => field("topbarFg", v)} />
          <ColorField label="Üst menü arka plan" value={row.headerBg} onChange={(v) => field("headerBg", v)} />
          <ColorField label="Alt bilgi arka plan" value={row.footerBg} onChange={(v) => field("footerBg", v)} />
          <ColorField label="Alt bilgi ana metin" value={row.footerFg} onChange={(v) => field("footerFg", v)} />
          <ColorField label="Alt bilgi ikincil metin" value={row.footerMuted} onChange={(v) => field("footerMuted", v)} />
          <ColorField label="Alt bilgi bağlantı" value={row.footerLink} onChange={(v) => field("footerLink", v)} />
          <ColorField label="Alt bilgi bağlantı (hover)" value={row.footerLinkHover} onChange={(v) => field("footerLinkHover", v)} />
          <ColorField label="Alt bilgi vurgu (ikon dairesi)" value={row.footerAccent} onChange={(v) => field("footerAccent", v)} />
          <ColorField label="Alt bilgi çizgi / kenar" value={row.footerBorder} onChange={(v) => field("footerBorder", v)} />
          <ColorField label="Menü hover" value={row.navHover} onChange={(v) => field("navHover", v)} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Tipografi & yerleşim</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            Başlık font yığını (CSS)
            <input
              className="rounded border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={row.fontHeading ?? ""}
              onChange={(e) => field("fontHeading", e.target.value || undefined)}
              placeholder='"Poppins", sans-serif'
            />
          </label>
          <label className="grid gap-1 text-sm">
            Gövde font yığını (CSS)
            <input
              className="rounded border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={row.fontBody ?? ""}
              onChange={(e) => field("fontBody", e.target.value || undefined)}
              placeholder='"Inter", sans-serif'
            />
          </label>
          <label className="grid gap-1 text-sm">
            Google Fonts stylesheet URL (opsiyonel)
            <input
              className="rounded border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={row.googleFontsHref ?? ""}
              onChange={(e) => field("googleFontsHref", e.target.value || undefined)}
              placeholder="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap"
            />
          </label>
          <label className="grid gap-1 text-sm">
            İçerik max genişlik (CSS)
            <input
              className="rounded border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={row.contentMaxWidth ?? ""}
              onChange={(e) => field("contentMaxWidth", e.target.value || undefined)}
              placeholder="72rem"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Köşe yarıçapı (orta)
            <input
              className="rounded border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={row.radiusMd ?? ""}
              onChange={(e) => field("radiusMd", e.target.value || undefined)}
              placeholder="0.75rem"
            />
          </label>
        </div>
      </section>

      <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <summary className="cursor-pointer text-sm font-medium">Gelişmiş: ham JSON</summary>
        <pre className="mt-3 overflow-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
          {themeTokensToJson(pickTokens(row))}
        </pre>
      </details>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Tema jetonlarını kaydet
        </button>
        <button
          type="button"
          className="rounded-full border border-zinc-300 px-6 py-2 text-sm dark:border-zinc-600"
          onClick={resetToEmpty}
        >
          Özelleştirmeyi sıfırla (tema varsayılanları)
        </button>
      </div>
      {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}
    </form>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const v = value ?? "";
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <div className="flex gap-2">
        <input
          type="color"
          className="h-10 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
          value={v.startsWith("#") && v.length >= 4 ? v.slice(0, 7) : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
          value={v}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="#rrggbb veya rgba(...)"
        />
      </div>
    </label>
  );
}
