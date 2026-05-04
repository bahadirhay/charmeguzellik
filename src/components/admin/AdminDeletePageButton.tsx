"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDeletePageButton({
  pageId,
  slug,
  title,
}: {
  pageId: string;
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (slug === "home") return null;

  async function onDelete() {
    const ok = window.confirm(
      `«${title}» sayfasını kalıcı olarak silmek istiyor musunuz? Menüde bu adrese giden linkler çalışmayabilir.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(typeof j.error === "string" && j.error.trim() ? j.error : "Silinemedi.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onDelete}
      className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {busy ? "…" : "Sil"}
    </button>
  );
}
