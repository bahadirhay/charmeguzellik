"use client";

import { useEffect, useMemo, useState } from "react";
import type { NavItem } from "@prisma/client";
import { buildNavTree, type NavNode } from "@/lib/navigation-shared";

function walkParentsWithChildren(
  nodes: NavNode[],
  depth: number,
  out: { id: string; label: string; depth: number }[],
) {
  for (const n of nodes) {
    if (n.children.length > 0) {
      out.push({ id: n.id, label: n.label, depth });
      walkParentsWithChildren(n.children, depth + 1, out);
    }
  }
}

export function ContactFormNavSourceFields({
  useAuto,
  menuSlug,
  parentId,
  onChange,
}: {
  useAuto: boolean;
  menuSlug: "header" | "footer";
  parentId: string | undefined;
  onChange: (next: {
    serviceNavUseAuto: boolean;
    serviceNavMenuSlug: "header" | "footer";
    serviceNavParentId: string | undefined;
  }) => void;
}) {
  const [items, setItems] = useState<NavItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/nav", { credentials: "same-origin" });
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as { items?: NavItem[] };
      if (!cancelled && Array.isArray(j.items)) setItems(j.items);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const parentChoices = useMemo(() => {
    const filtered = items.filter((i) => (i.menuSlug ?? "header") === menuSlug);
    const tree = buildNavTree(filtered);
    const out: { id: string; label: string; depth: number }[] = [];
    walkParentsWithChildren(tree, 0, out);
    return out;
  }, [items, menuSlug]);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
      <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Hizmet listesi kaynağı</p>
      <label className="flex cursor-pointer items-start gap-2 text-xs">
        <input
          type="radio"
          className="mt-0.5"
          checked={useAuto}
          onChange={() =>
            onChange({
              serviceNavUseAuto: true,
              serviceNavMenuSlug: menuSlug,
              serviceNavParentId: undefined,
            })
          }
        />
        <span>
          <strong>Otomatik</strong> — üst menüde «Hizmetlerimiz» başlıklı öğenin <em>alt linkleri</em> (kırmızıyla
          işaretlediğiniz liste)
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-xs">
        <input
          type="radio"
          className="mt-0.5"
          checked={!useAuto}
          onChange={() =>
            onChange({
              serviceNavUseAuto: false,
              serviceNavMenuSlug: menuSlug,
              serviceNavParentId: parentId,
            })
          }
        />
        <span>
          <strong>Manuel</strong> — başka bir menü grubunun alt linklerini kullan
        </span>
      </label>

      <label className="grid gap-1 text-xs">
        Hangi menü
        <select
          className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={menuSlug}
          onChange={(e) =>
            onChange({
              serviceNavUseAuto: useAuto,
              serviceNavMenuSlug: e.target.value === "footer" ? "footer" : "header",
              serviceNavParentId: undefined,
            })
          }
        >
          <option value="header">Üst menü (header)</option>
          <option value="footer">Alt bilgi menüsü (footer)</option>
        </select>
      </label>

      {!useAuto ? (
        <label className="grid gap-1 text-xs">
          Alt linkleri alınacak üst öğe
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={parentId ?? ""}
            onChange={(e) =>
              onChange({
                serviceNavUseAuto: false,
                serviceNavMenuSlug: menuSlug,
                serviceNavParentId: e.target.value.trim() || undefined,
              })
            }
          >
            <option value="">— Seçin —</option>
            {parentChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.depth ? `${"  ".repeat(p.depth)}↳ ` : ""}
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[10px] leading-relaxed text-zinc-500">
          Menüde «Hizmetlerimiz» yazmıyorsa otomatik eşleşmez — o zaman <strong>Manuel</strong> ile doğru üst öğeyi
          seçin veya menü etiketini düzenleyin.
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-500">
        Menüde olmayan ek hizmetler için aşağıdaki <strong>Manuel ek hizmetler</strong> listesine satır ekleyin.
      </p>
    </div>
  );
}
