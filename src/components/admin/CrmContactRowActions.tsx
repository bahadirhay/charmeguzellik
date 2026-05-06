"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CrmContactRowActions(props: {
  id: string;
  name: string;
  email: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(props.name);
  const [email, setEmail] = useState(props.email ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/crm-contacts/${props.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFeedback(j.error ?? "Kayıt güncellenemedi.");
        return;
      }
      setEditing(false);
      setFeedback("Güncellendi.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Bu müşteri kaydını silmek istediğinize emin misiniz?")) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/crm-contacts/${props.id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFeedback(j.error ?? "Kayıt silinemedi.");
        return;
      }
      setFeedback("Silindi.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing((x) => !x)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {editing ? "Kapat" : "Düzenle"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Sil
        </button>
      </div>
      {editing ? (
        <div className="max-w-xs space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <input
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad"
          />
          <input
            type="email"
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta (opsiyonel)"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Kaydet
          </button>
        </div>
      ) : null}
      {feedback ? <p className="text-[11px] text-zinc-500">{feedback}</p> : null}
    </div>
  );
}
