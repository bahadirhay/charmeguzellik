"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SiteInstagramPost } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

async function reorderAll(orderedIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/instagram/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: data.error ?? `Sıralama başarısız (${res.status})` };
  return { ok: true };
}

function SortablePostRow({
  post: p,
  onTogglePublished,
  onRemove,
  reorderDisabled,
}: {
  post: SiteInstagramPost;
  onTogglePublished: (post: SiteInstagramPost, published: boolean) => void;
  onRemove: (id: string) => void;
  reorderDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
    disabled: reorderDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 gap-2 sm:items-start">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="mt-0.5 flex h-9 w-9 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          aria-label="Sürükleyerek sırayı değiştir"
          title="Tutup sürükleyin"
          disabled={reorderDisabled}
          {...attributes}
          {...listeners}
        >
          <span className="select-none text-base leading-none" aria-hidden>
            ⋮⋮
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <a
            href={p.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-rose-600 hover:underline"
          >
            {p.permalink}
          </a>
          {p.caption ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.caption}</p> : null}
          <p className="mt-1 text-[10px] uppercase text-zinc-400">
            Kaynak: {p.source} {p.instagramId ? `· ${p.instagramId}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.published}
            onChange={(e) => onTogglePublished(p, e.target.checked)}
          />
          Yayında
        </label>
        <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => onRemove(p.id)}>
          Sil
        </button>
      </div>
    </li>
  );
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
  const [listErr, setListErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => posts.map((p) => p.id), [posts]);

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

  const persistOrder = useCallback(
    async (next: SiteInstagramPost[]) => {
      setOrderSaving(true);
      setListErr(null);
      const r = await reorderAll(next.map((x) => x.id));
      setOrderSaving(false);
      if (!r.ok) {
        setListErr(r.error ?? "Sıralama kaydedilemedi");
        refresh();
        return;
      }
      refresh();
    },
    [refresh],
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = posts.findIndex((x) => x.id === active.id);
    const newIndex = posts.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(posts, oldIndex, newIndex);
    setPosts(next);
    await persistOrder(next);
  }

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
      {listErr ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {listErr}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 font-medium">Yayında olacakları seçin</h2>
        <p className="mb-2 text-sm text-zinc-500">
          Sitede yalnızca <strong>yayında</strong> işaretli gönderiler görünür. Sayfaya{" "}
          <strong>Instagram vitrinı</strong> bloğu eklemeyi unutmayın.
        </p>
        <p className="mb-4 text-xs text-zinc-500">
          <strong>Sıra:</strong> soldaki <span className="font-mono">⋮⋮</span> tutamacından tutup sürükleyin (klavye:
          odak tutamacı üzerindeyken ok tuşları). Kayıt otomatik kaydedilir.
          {orderSaving ? <span className="ml-2 text-rose-600">Kaydediliyor…</span> : null}
        </p>
        {posts.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-3">
                {posts.map((p) => (
                  <SortablePostRow
                    key={p.id}
                    post={p}
                    onTogglePublished={togglePublished}
                    onRemove={removePost}
                    reorderDisabled={orderSaving}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-sm text-zinc-500">Henüz gönderi yok. Yukarıdan ekleyin veya API ile içe aktarın.</p>
        )}
      </section>
    </div>
  );
}
