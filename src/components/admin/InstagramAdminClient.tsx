"use client";

import type { SiteInstagramPost } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

async function reorderAll(orderedIds: string[]) {
  await fetch("/api/admin/instagram/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
}

export function InstagramAdminClient({
  initialPosts,
  graphUserId: initialUserId,
  graphToken: initialToken,
}: {
  initialPosts: SiteInstagramPost[];
  graphUserId: string;
  graphToken: string;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [graphUserId, setGraphUserId] = useState(initialUserId);
  const [graphToken, setGraphToken] = useState(initialToken);
  const [permalink, setPermalink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    setGraphUserId(initialUserId);
    setGraphToken(initialToken);
  }, [initialUserId, initialToken]);

  async function saveGraphSettings() {
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instagramGraphUserId: graphUserId || null,
        instagramAccessToken: graphToken || null,
      }),
    });
    setMsg(res.ok ? "API bilgileri kaydedildi" : "Kayıt başarısız");
    if (res.ok) refresh();
  }

  async function runSync() {
    setSyncing(true);
    setMsg(null);
    const res = await fetch("/api/admin/instagram/sync", { method: "POST" });
    const data = (await res.json()) as { message?: string; error?: string };
    setSyncing(false);
    if (res.ok) setMsg(data.message ?? "Tamam");
    else setMsg(data.error ?? "Senkron hatası");
    refresh();
  }

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/instagram/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permalink }),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) {
      setPermalink("");
      setMsg("Eklendi — yayın kutusunu işaretleyin");
      refresh();
    } else setMsg(data.error ?? "Eklenemedi");
  }

  async function togglePublished(p: SiteInstagramPost, published: boolean) {
    await fetch(`/api/admin/instagram/posts/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    refresh();
  }

  async function removePost(id: string) {
    if (!confirm("Bu gönderiyi listeden kaldırılsın mı?")) return;
    await fetch(`/api/admin/instagram/posts/${id}`, { method: "DELETE" });
    refresh();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = posts.findIndex((p) => p.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= posts.length) return;
    const next = [...posts];
    const t = next[idx]!;
    next[idx] = next[j]!;
    next[j] = t;
    await reorderAll(next.map((p) => p.id));
    refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Instagram Graph API (isteğe bağlı)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Meta İşletme hesabı ile{" "}
          <a
            href="https://developers.facebook.com/docs/instagram-api"
            className="text-rose-600 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram Graph API
          </a>{" "}
          üzerinden son gönderileri çekebilirsiniz. Jetonu güvenli tutun; yalnızca yönetici kullanın.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm md:col-span-2">
            Instagram kullanıcı ID (IG User ID)
            <input
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={graphUserId}
              onChange={(e) => setGraphUserId(e.target.value)}
              placeholder="17841400..."
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Erişim jetonu (uzun ömürlü)
            <input
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={graphToken}
              onChange={(e) => setGraphToken(e.target.value)}
              placeholder="EAA..."
              type="password"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveGraphSettings}
            className="rounded-full bg-zinc-200 px-4 py-2 text-sm dark:bg-zinc-800"
          >
            API bilgilerini kaydet
          </button>
          <button
            type="button"
            disabled={syncing || !graphUserId || !graphToken}
            onClick={runSync}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {syncing ? "Çekiliyor…" : "Son gönderileri içe aktar"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Bağlantı ile ekle</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Gönderi veya reel paylaşım sayfasının URL’sini yapıştırın (ör. instagram.com/p/…).
        </p>
        <form onSubmit={addPost} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid min-w-0 flex-1 gap-1 text-sm">
            Permalink
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={permalink}
              onChange={(e) => setPermalink(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Listeye ekle
          </button>
        </form>
      </section>

      {msg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p> : null}

      <section>
        <h2 className="mb-3 font-medium">Yayında olacakları seçin</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Sitede yalnızca <strong>yayında</strong> işaretli gönderiler görünür. Sayfaya{" "}
          <strong>Instagram vitrinı</strong> bloğu eklemeyi unutmayın.
        </p>
        <ul className="space-y-3">
          {posts.map((p, idx) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={p.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-rose-600 hover:underline"
                >
                  {p.permalink}
                </a>
                {p.caption ? (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.caption}</p>
                ) : null}
                <p className="mt-1 text-[10px] uppercase text-zinc-400">
                  Kaynak: {p.source} {p.instagramId ? `· ${p.instagramId}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.published}
                    onChange={(e) => togglePublished(p, e.target.checked)}
                  />
                  Yayında
                </label>
                <button
                  type="button"
                  className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
                  disabled={idx <= 0}
                  onClick={() => move(p.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
                  disabled={idx >= posts.length - 1}
                  onClick={() => move(p.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => removePost(p.id)}
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-500">Henüz gönderi yok. Yukarıdan ekleyin veya API ile içe aktarın.</p>
        ) : null}
      </section>
    </div>
  );
}
