"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewPageForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug.trim() || undefined,
        published,
      }),
    });
    const data = (await res.json()) as { id?: string; error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Oluşturulamadı");
      return;
    }
    if (data.id) router.push(`/admin/pages/${data.id}/edit`);
    else router.push("/admin/pages");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="grid gap-1 text-sm">
        Sayfa başlığı
        <input
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Slug (boş bırakılırsa başlıktan üretilir)
        <input
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ornek-hizmet"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Hemen yayınla
      </label>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button
        type="submit"
        className="rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700"
      >
        Oluştur ve blokları düzenle
      </button>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Düzenleyicide sol panelde <strong className="text-zinc-600 dark:text-zinc-300">Sayfa boş mu? Hazır set</strong>{" "}
        ile vitrin, Instagram veya galeri paketlerini tek tıkla ekleyebilirsiniz; tüm metin ve görselleri blok
        özelliklerinden yönetirsiniz.
      </p>
    </form>
  );
}
