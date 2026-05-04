"use client";

import type { Page } from "@prisma/client";
import { useState } from "react";

export function PageMetaForm({ page }: { page: Page }) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [metaTitle, setMetaTitle] = useState(page.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(page.metaDescription ?? "");
  const [canonicalPath, setCanonicalPath] = useState(page.canonicalPath ?? "");
  const [published, setPublished] = useState(page.published);
  const [noIndex, setNoIndex] = useState(page.noIndex);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/pages/${page.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        canonicalPath: canonicalPath || null,
        published,
        noIndex,
      }),
    });
    setMsg(res.ok ? "Sayfa bilgileri kaydedildi" : "Kayıt hatası");
  }

  return (
    <form
      onSubmit={saveMeta}
      className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-2"
    >
      <label className="grid gap-1 text-sm">
        Başlık
        <input
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Slug (home sabit)
        <input
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={slug === "home"}
        />
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        SEO başlık
        <input
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        SEO açıklama
        <textarea
          rows={2}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        Canonical URL yolu (opsiyonel)
        <input
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={canonicalPath}
          onChange={(e) => setCanonicalPath(e.target.value)}
          placeholder="/hizmetler"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Yayında
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} />
        Arama motorlarında gösterme (noindex)
      </label>
      <div className="md:col-span-2 flex items-center gap-4">
        <button
          type="submit"
          className="rounded-full bg-zinc-200 px-4 py-2 text-sm dark:bg-zinc-800"
        >
          Sayfa bilgilerini kaydet
        </button>
        {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
      </div>
    </form>
  );
}
