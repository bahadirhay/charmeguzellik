"use client";

import type { SiteSettings } from "@prisma/client";
import { useState } from "react";

type Feedback = { text: string; error: boolean };

function strForInput(v: string | null | undefined) {
  if (v == null) return "";
  const t = v.trim();
  if (t === "null" || t === "undefined") return "";
  return t;
}

export function WhatsappAdminClient({ initial }: { initial: SiteSettings }) {
  const [row, setRow] = useState(initial);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappNumber: row.whatsappNumber || null }),
    });
    if (!res.ok) {
      let detail = `Kayıt başarısız (${res.status})`;
      try {
        const j = (await res.json()) as { error?: unknown };
        if (typeof j.error === "string" && j.error.trim()) detail = j.error;
      } catch {
        /* ignore */
      }
      setFeedback({ text: detail, error: true });
      setSaving(false);
      return;
    }
    const next = (await res.json()) as SiteSettings;
    setRow(next);
    setFeedback({ text: "Kaydedildi. Sitedeki tüm WhatsApp bağlantıları bu numarayı kullanır.", error: false });
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Buraya girdiğiniz numara sitede kullanılan tüm <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">wa.me</code>{" "}
          adreslerine uygulanır: WhatsApp blokları, klinik alt bilgi düğmeleri / linkleri ve sabit yeşil balon (blokta
          yedek numara yoksa).
        </p>
      </div>

      {feedback ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            feedback.error
              ? "border border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <form onSubmit={save} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="grid gap-1 text-sm">
          Numara (ülke kodu ile, sadece rakam örn. 905551112233)
          <input
            className="rounded border border-zinc-300 px-2 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-950"
            value={strForInput(row.whatsappNumber)}
            onChange={(e) =>
              setRow((r) => ({ ...r, whatsappNumber: e.target.value.trim() || null }))
            }
            placeholder="905551112233"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>

      <p className="text-xs text-zinc-500">
        Aynı alan <strong>Ayarlar & SEO → İletişim & takvim</strong> bölümünde de düzenlenebilir; tek veritabanı
        alanıdır.
      </p>
    </div>
  );
}
