"use client";

import { nanoid } from "nanoid";
import type { PageBlock } from "@/lib/blocks/schema";

type Mf = Extract<PageBlock, { type: "marketingFooter" }>;

export function MarketingFooterBlockFields({
  block,
  onChange,
}: {
  block: Mf;
  onChange: (b: PageBlock) => void;
}) {
  const p = block.props;
  const setProps = (patch: Partial<Mf["props"]>) => {
    onChange({ ...block, props: { ...p, ...patch } } as PageBlock);
  };

  const patchCtas = (next: NonNullable<Mf["props"]["ctas"]>) => {
    setProps({ ctas: next.slice(0, 3) });
  };
  const patchCols = (next: Mf["props"]["columns"]) => {
    const c = next.slice(0, 4);
    if (c.length < 1) return;
    setProps({ columns: c });
  };
  const patchInfo = (next: NonNullable<Mf["props"]["infoCards"]>) => {
    setProps({ infoCards: next.slice(0, 8) });
  };

  const ctas = p.ctas ?? [];
  const info = p.infoCards ?? [];

  return (
    <div className="mt-3 max-h-[min(70vh,560px)] space-y-6 overflow-y-auto pr-1 text-sm">
      <p className="rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2 text-[11px] leading-relaxed text-zinc-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-zinc-200">
        <strong>Önizleme ile eşleşme:</strong> <em>Üst sıra</em> = marka yazısı + butonlar · <em>Sütunlar</em> = dört
        sütundaki başlık, metin ve mavi link listeleri · <em>Kartlar</em> = adres, telefon, e-posta, çalışma saati
        kutuları · <em>Alt &amp; sabit</em> = telif satırı; sabit WhatsApp balonu ve yukarı çık buradan.
      </p>
      <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-semibold text-zinc-500">Üst sıra</legend>
        <label className="grid gap-1">
          Marka yazısı
          <input
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={p.brandLabel}
            onChange={(e) => setProps({ brandLabel: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.externalLinksOpenInNewTab !== false}
              onChange={(e) =>
                setProps({
                  externalLinksOpenInNewTab: e.target.checked ? true : false,
                })
              }
            />
            Harici bağlantıları yeni sekmede aç (https, WhatsApp; sabit balon dahil)
          </span>
          <span className="pl-6 text-[11px] text-zinc-500">
            Site içi (<code className="rounded bg-zinc-100 px-0.5 dark:bg-zinc-800">/sayfa</code>) ve{" "}
            <code className="rounded bg-zinc-100 px-0.5 dark:bg-zinc-800">tel:</code> aynı sekmede kalır.
          </span>
        </label>
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Butonlar (en fazla 3)</p>
          {ctas.map((c, idx) => (
            <div key={c.id} className="grid gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-700">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:underline"
                  disabled={idx === 0}
                  onClick={() => {
                    const n = [...ctas];
                    [n[idx - 1], n[idx]] = [n[idx]!, n[idx - 1]!];
                    patchCtas(n);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:underline"
                  disabled={idx === ctas.length - 1}
                  onClick={() => {
                    const n = [...ctas];
                    [n[idx], n[idx + 1]] = [n[idx + 1]!, n[idx]!];
                    patchCtas(n);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ml-auto text-[10px] text-red-600 hover:underline"
                  onClick={() => patchCtas(ctas.filter((x) => x.id !== c.id))}
                >
                  Kaldır
                </button>
              </div>
              <label className="grid gap-1">
                Etiket
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={c.label}
                  onChange={(e) =>
                    patchCtas(ctas.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))
                  }
                />
              </label>
              <label className="grid gap-1">
                Bağlantı (tel:, https://…)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={c.href}
                  onChange={(e) =>
                    patchCtas(ctas.map((x) => (x.id === c.id ? { ...x, href: e.target.value } : x)))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                Görünüm
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={c.variant ?? "outline"}
                  onChange={(e) =>
                    patchCtas(
                      ctas.map((x) =>
                        x.id === c.id ? { ...x, variant: e.target.value as "outline" | "solid" } : x,
                      ),
                    )
                  }
                >
                  <option value="outline">Çerçeve (Hemen Ara)</option>
                  <option value="solid">Dolu (WhatsApp)</option>
                </select>
              </label>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded border border-dashed border-zinc-400 py-1.5 text-xs"
            disabled={ctas.length >= 3}
            onClick={() =>
              patchCtas([...ctas, { id: nanoid(), label: "Yeni", href: "#", variant: "outline" }])
            }
          >
            + Buton
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-semibold text-zinc-500">Sütunlar (1–4)</legend>
        {p.columns.map((col, cidx) => (
          <div key={col.id} className="space-y-2 rounded border border-zinc-200 p-2 dark:border-zinc-700">
            <div className="flex flex-wrap gap-2 text-[10px]">
              <button
                type="button"
                className="text-zinc-500 hover:underline"
                disabled={cidx === 0}
                onClick={() => {
                  const n = [...p.columns];
                  [n[cidx - 1], n[cidx]] = [n[cidx]!, n[cidx - 1]!];
                  patchCols(n);
                }}
              >
                Sütun ↑
              </button>
              <button
                type="button"
                className="text-zinc-500 hover:underline"
                disabled={cidx === p.columns.length - 1}
                onClick={() => {
                  const n = [...p.columns];
                  [n[cidx], n[cidx + 1]] = [n[cidx + 1]!, n[cidx]!];
                  patchCols(n);
                }}
              >
                Sütun ↓
              </button>
              <button
                type="button"
                className="ml-auto text-red-600 hover:underline"
                disabled={p.columns.length <= 1}
                onClick={() => patchCols(p.columns.filter((x) => x.id !== col.id))}
              >
                Sütunu sil
              </button>
            </div>
            <label className="grid gap-1">
              Başlık
              <input
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={col.title}
                onChange={(e) =>
                  patchCols(p.columns.map((x) => (x.id === col.id ? { ...x, title: e.target.value } : x)))
                }
              />
            </label>
            <label className="grid gap-1">
              Metin (opsiyonel — kampanya kutusu gibi)
              <textarea
                rows={3}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                value={col.body ?? ""}
                onChange={(e) =>
                  patchCols(
                    p.columns.map((x) => (x.id === col.id ? { ...x, body: e.target.value || undefined } : x)),
                  )
                }
              />
            </label>
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-500">Bağlantı listesi</p>
              {(col.links ?? []).map((l, li) => (
                <div key={`${col.id}-l-${li}`} className="flex gap-1">
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    placeholder="Etiket"
                    value={l.label}
                    onChange={(e) => {
                      const links = [...(col.links ?? [])];
                      links[li] = { ...l, label: e.target.value };
                      patchCols(p.columns.map((x) => (x.id === col.id ? { ...x, links } : x)));
                    }}
                  />
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-300 px-1 py-0.5 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-950"
                    placeholder="/yol"
                    value={l.href}
                    onChange={(e) => {
                      const links = [...(col.links ?? [])];
                      links[li] = { ...l, href: e.target.value };
                      patchCols(p.columns.map((x) => (x.id === col.id ? { ...x, links } : x)));
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-[10px] text-red-600"
                    onClick={() => {
                      const links = (col.links ?? []).filter((_, j) => j !== li);
                      patchCols(
                        p.columns.map((x) =>
                          x.id === col.id ? { ...x, links: links.length ? links : undefined } : x,
                        ),
                      );
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-[10px] text-rose-600 hover:underline"
                onClick={() => {
                  const links = [...(col.links ?? []), { label: "Yeni", href: "/" }];
                  patchCols(p.columns.map((x) => (x.id === col.id ? { ...x, links } : x)));
                }}
              >
                + Bağlantı
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="w-full rounded border border-dashed py-1.5 text-xs"
          disabled={p.columns.length >= 4}
          onClick={() =>
            patchCols([
              ...p.columns,
              { id: nanoid(), title: "Yeni sütun", body: undefined, links: [{ label: "Ana sayfa", href: "/" }] },
            ])
          }
        >
          + Sütun
        </button>
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-semibold text-zinc-500">Kartlar (telefon, e-posta, saat…)</legend>
        {info.map((card, idx) => (
          <div key={card.id} className="space-y-2 rounded border border-zinc-200 p-2 dark:border-zinc-700">
            <div className="flex gap-2 text-[10px]">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => {
                  const n = [...info];
                  [n[idx - 1], n[idx]] = [n[idx]!, n[idx - 1]!];
                  patchInfo(n);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === info.length - 1}
                onClick={() => {
                  const n = [...info];
                  [n[idx], n[idx + 1]] = [n[idx + 1]!, n[idx]!];
                  patchInfo(n);
                }}
              >
                ↓
              </button>
              <button type="button" className="ml-auto text-red-600" onClick={() => patchInfo(info.filter((x) => x.id !== card.id))}>
                Sil
              </button>
            </div>
            <label className="grid gap-1 text-xs">
              İkon
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={card.icon}
                onChange={(e) =>
                  patchInfo(
                    info.map((x) =>
                      x.id === card.id ? { ...x, icon: e.target.value as typeof card.icon } : x,
                    ),
                  )
                }
              >
                <option value="info">Bilgi</option>
                <option value="phone">Telefon</option>
                <option value="email">E-posta</option>
                <option value="clock">Saat</option>
                <option value="map">Harita</option>
              </select>
            </label>
            <label className="grid gap-1">
              Başlık
              <input
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={card.title}
                onChange={(e) =>
                  patchInfo(info.map((x) => (x.id === card.id ? { ...x, title: e.target.value } : x)))
                }
              />
            </label>
            {card.lines.map((line, li) => (
              <div key={li} className="flex gap-1">
                <input
                  className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={line}
                  onChange={(e) => {
                    const lines = [...card.lines];
                    lines[li] = e.target.value;
                    patchInfo(info.map((x) => (x.id === card.id ? { ...x, lines } : x)));
                  }}
                />
                <button
                  type="button"
                  className="text-red-600"
                  disabled={card.lines.length <= 1}
                  onClick={() => {
                    const lines = card.lines.filter((_, j) => j !== li);
                    if (lines.length < 1) return;
                    patchInfo(info.map((x) => (x.id === card.id ? { ...x, lines } : x)));
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-[10px] text-rose-600 hover:underline"
              disabled={card.lines.length >= 6}
              onClick={() =>
                patchInfo(info.map((x) => (x.id === card.id ? { ...x, lines: [...x.lines, ""] } : x)))
              }
            >
              + Satır
            </button>
          </div>
        ))}
        <button
          type="button"
          className="w-full rounded border border-dashed py-1.5 text-xs"
          disabled={info.length >= 8}
          onClick={() =>
            patchInfo([
              ...info,
              { id: nanoid(), icon: "info", title: "Yeni kart", lines: ["Metin"] },
            ])
          }
        >
          + Kart
        </button>
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <legend className="px-1 text-xs font-semibold text-zinc-500">Alt & sabit düğmeler</legend>
        <label className="grid gap-1">
          Telif metni
          <input
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={p.copyrightLine ?? ""}
            onChange={(e) => setProps({ copyrightLine: e.target.value || undefined })}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Telif bağlantısı (isteğe bağlı)
          <input
            className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
            value={p.copyrightHref ?? ""}
            onChange={(e) => setProps({ copyrightHref: e.target.value || undefined })}
            placeholder="https://… veya /sayfa"
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={p.copyrightOpenInNewTab === true}
            onChange={(e) => setProps({ copyrightOpenInNewTab: e.target.checked })}
          />
          Bağlantıyı yeni sekmede aç
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={p.showFloatingWhatsapp === true}
            onChange={(e) => setProps({ showFloatingWhatsapp: e.target.checked })}
          />
          Sabit WhatsApp balonu
        </label>
        <label className="grid gap-1 text-xs">
          Sabit balon — yedek numara (isteğe bağlı)
          <input
            className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
            value={p.whatsappPhone ?? ""}
            onChange={(e) => setProps({ whatsappPhone: e.target.value || undefined })}
            placeholder="Boş bırakın: Admin → WhatsApp numarası kullanılır"
          />
        </label>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Öncelik: <a className="text-rose-600 underline" href="/admin/whatsapp">Admin → WhatsApp</a>.{" "}
          <code className="rounded bg-zinc-100 px-0.5 dark:bg-zinc-800">wa.me</code> bağlantılı üst düğmeler ve
          sütun linkleri de bu numaraya yönlendirilir.
        </p>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={p.showBackToTop === true}
            onChange={(e) => setProps({ showBackToTop: e.target.checked })}
          />
          Yukarı çık düğmesi
        </label>
      </fieldset>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Renkler ve alt bilgi arka planı için{" "}
        <a href="/admin/theme" className="text-rose-600 underline">
          Tema özelleştirici
        </a>{" "}
        → Alt bilgi renkleri.
      </p>
    </div>
  );
}
