"use client";

import type { NavItem } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function menuOf(i: NavItem) {
  return i.menuSlug ?? "header";
}

function siblingsOf(items: NavItem[], parentId: string | null, slug: string) {
  return items
    .filter((i) => menuOf(i) === slug && (i.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

async function reorder(parentId: string | null, orderedIds: string[]) {
  await fetch("/api/admin/nav/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId, orderedIds }),
  });
}

function NavRow({
  item,
  depth,
  items,
  refresh,
}: {
  item: NavItem;
  depth: number;
  items: NavItem[];
  refresh: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href);
  const [published, setPublished] = useState(item.published);
  const [openInNewTab, setOpenInNewTab] = useState(item.openInNewTab);
  const [saving, setSaving] = useState(false);

  const slug = menuOf(item);
  const sibs = siblingsOf(items, item.parentId ?? null, slug);
  const idx = sibs.findIndex((s) => s.id === item.id);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/admin/nav/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        href,
        published,
        openInNewTab,
      }),
    });
    setSaving(false);
    refresh();
  }, [item.id, label, href, published, openInNewTab, refresh]);

  const move = async (dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sibs.length) return;
    const next = [...sibs];
    const t = next[idx]!;
    next[idx] = next[j]!;
    next[j] = t;
    await reorder(item.parentId ?? null, next.map((x) => x.id));
    refresh();
  };

  const addChild = async () => {
    await fetch("/api/admin/nav", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: item.id,
        label: "Alt menü",
        href: "/",
        published: true,
        menuSlug: slug,
      }),
    });
    refresh();
  };

  const remove = async () => {
    if (!confirm("Bu öğe ve tüm alt menüler silinsin mi?")) return;
    await fetch(`/api/admin/nav/${item.id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-[140px] flex-1 gap-1 text-xs">
            Etiket
            <input
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={save}
            />
          </label>
          <label className="grid min-w-[160px] flex-1 gap-1 text-xs">
            Bağlantı (/, /slug, https://…)
            <input
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              onBlur={save}
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={published}
              onChange={async (e) => {
                setPublished(e.target.checked);
                await fetch(`/api/admin/nav/${item.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ published: e.target.checked }),
                });
                refresh();
              }}
            />
            Yayında
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={async (e) => {
                setOpenInNewTab(e.target.checked);
                await fetch(`/api/admin/nav/${item.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ openInNewTab: e.target.checked }),
                });
                refresh();
              }}
            />
            Yeni sekme
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
            onClick={() => move(-1)}
            disabled={idx <= 0}
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded-lg bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
            onClick={() => move(1)}
            disabled={idx >= sibs.length - 1}
          >
            ↓
          </button>
          <button
            type="button"
            className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            onClick={addChild}
          >
            + Alt kategori
          </button>
          <button type="button" className="rounded-lg px-2 py-1 text-xs text-red-600" onClick={remove}>
            Sil
          </button>
          {saving ? <span className="text-xs text-zinc-400">Kaydediliyor…</span> : null}
        </div>
      </div>
      {siblingsOf(items, item.id, slug).map((ch) => (
        <NavRow key={ch.id} item={ch} depth={depth + 1} items={items} refresh={refresh} />
      ))}
    </div>
  );
}

export function NavEditor({ initialItems }: { initialItems: NavItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [menuSlug, setMenuSlug] = useState<"header" | "footer">("header");

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const roots = siblingsOf(items, null, menuSlug);

  const addRoot = async () => {
    await fetch("/api/admin/nav", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: null,
        label: menuSlug === "header" ? "Yeni üst menü" : "Yeni alt bilgi linki",
        href: "/",
        published: true,
        menuSlug,
      }),
    });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMenuSlug("header")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            menuSlug === "header"
              ? "bg-rose-600 text-white shadow"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Üst menü (header)
        </button>
        <button
          type="button"
          onClick={() => setMenuSlug("footer")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            menuSlug === "footer"
              ? "bg-rose-600 text-white shadow"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Alt bilgi menüsü (footer)
        </button>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <strong>Üst menü</strong> sabit başlıktaki linklerdir. <strong>Alt bilgi menüsü</strong> ayrıdır;{" "}
        <strong>Site düzeni → Alt bilgi</strong> içine <em>Site menüsü (Admin)</em> widget’ı ekleyip buradaki
        listeyi gösterebilirsiniz. Sayfa widget’larında da aynı blok kullanılabilir.
      </p>

      <div className="rounded-2xl border-2 border-dashed border-rose-400 bg-gradient-to-br from-rose-50 to-amber-50 p-6 dark:border-rose-700 dark:from-rose-950/40 dark:to-amber-950/20">
        <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-100">
          {menuSlug === "header" ? "Üst menüye öğe ekle" : "Alt bilgi menüsüne öğe ekle"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-700 dark:text-zinc-300">
          Aşağıdaki butonla bu menü grubuna kök satır ekleyin. Alt seviye için satırdaki{" "}
          <strong>«+ Alt kategori»</strong>.
        </p>
        <button
          type="button"
          onClick={addRoot}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-rose-700"
        >
          + {menuSlug === "header" ? "Üst menüye" : "Alt bilgi menüsüne"} yeni link / kategori ekle
        </button>
      </div>

      {roots.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Bu menü grubunda henüz öğe yok. Yukarıdaki pembe butonla ilk satırı ekleyin (ör.{" "}
          <strong>ANASAYFA</strong> → <strong>/</strong>).
        </p>
      ) : null}

      <div className="space-y-3">
        {roots.map((r) => (
          <NavRow key={r.id} item={r} depth={0} items={items} refresh={refresh} />
        ))}
      </div>
    </div>
  );
}
