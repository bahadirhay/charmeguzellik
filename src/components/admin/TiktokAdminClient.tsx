"use client";

import type { SiteTiktokVideo } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

async function reorderAll(orderedIds: string[]) {
  await fetch("/api/admin/tiktok/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
}

export function TiktokAdminClient({ initialVideos }: { initialVideos: SiteTiktokVideo[] }) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [permalink, setPermalink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/tiktok/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permalink }),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) {
      setPermalink("");
      setMsg("Eklendi — küçük resim TikTok oEmbed ile alınır; yayınlamayı işaretleyin");
      refresh();
    } else setMsg(data.error ?? "Eklenemedi");
  }

  async function togglePublished(v: SiteTiktokVideo, published: boolean) {
    await fetch(`/api/admin/tiktok/videos/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    refresh();
  }

  async function removeVideo(id: string) {
    if (!confirm("Bu videoyu listeden kaldırılsın mı?")) return;
    await fetch(`/api/admin/tiktok/videos/${id}`, { method: "DELETE" });
    refresh();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = videos.findIndex((p) => p.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= videos.length) return;
    const next = [...videos];
    const t = next[idx]!;
    next[idx] = next[j]!;
    next[j] = t;
    await reorderAll(next.map((p) => p.id));
    refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Paylaşım bağlantısı ile ekle</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Uygulamadan <strong>Paylaş → Bağlantıyı kopyala</strong>;{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">tiktok.com/@…/video/…</code> biçimi
          gerekir.
        </p>
        <form onSubmit={addVideo} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid min-w-0 flex-1 gap-1 text-sm">
            TikTok URL
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={permalink}
              onChange={(e) => setPermalink(e.target.value)}
              placeholder="https://www.tiktok.com/@kullanici/video/7123…"
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
          Sitede yalnız <strong>yayında</strong> işaretli içerikler görünür. Sayfaya{" "}
          <strong>TikTok vitrinı</strong> bloğu ekleyin.
        </p>
        <ul className="space-y-3">
          {videos.map((v, idx) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={v.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#fe2c55] hover:underline"
                >
                  {v.permalink}
                </a>
                {v.title ? (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{v.title}</p>
                ) : null}
                {!v.thumbnailUrl ? (
                  <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                    Küçük resim alınamadı — sitede kart modu yerine embed kullanılabilir
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={v.published}
                    onChange={(e) => togglePublished(v, e.target.checked)}
                  />
                  Yayında
                </label>
                <button
                  type="button"
                  className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
                  disabled={idx <= 0}
                  onClick={() => move(v.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
                  disabled={idx >= videos.length - 1}
                  onClick={() => move(v.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => removeVideo(v.id)}
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
        {videos.length === 0 ? (
          <p className="text-sm text-zinc-500">Henüz video yok. Yukarıdan ekleyin.</p>
        ) : null}
      </section>
    </div>
  );
}
