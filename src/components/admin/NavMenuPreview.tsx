"use client";

import { useEffect, useState } from "react";
import type { NavNode } from "@/lib/navigation";
import type { SiteMenuVariant } from "@/components/site/PublicSiteMenu";
import { PublicSiteMenu } from "@/components/site/PublicSiteMenu";

type Slug = "header" | "footer";

export function NavMenuPreview({
  menuSlug,
  style,
}: {
  menuSlug: Slug;
  style: SiteMenuVariant;
}) {
  const [nodes, setNodes] = useState<NavNode[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/api/nav/${menuSlug}`, { cache: "no-store" });
        const j = (await res.json()) as { nodes?: NavNode[]; error?: string };
        if (!res.ok) {
          if (!cancelled) setErr(j.error ?? `HTTP ${res.status}`);
          return;
        }
        if (!cancelled) setNodes(j.nodes ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Yükleme hatası");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuSlug]);

  if (err) {
    return <p className="text-xs text-red-600 dark:text-red-400">{err}</p>;
  }
  if (nodes === null) {
    return <p className="text-xs text-zinc-500">Menü yükleniyor…</p>;
  }
  return <PublicSiteMenu nodes={nodes} variant={style} />;
}
