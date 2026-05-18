"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DashboardOverduePendingItem } from "@/components/admin/dashboard/types";

export function DashboardOverduePendingPanel({ items }: { items: DashboardOverduePendingItem[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function resolve(id: string, status: "rejected" | "approved") {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Lütfen neden onaylanmadığını veya alınan kararı kısaca yazın.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status, overdueReviewNote: trimmed }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "İşlem başarısız");
        return;
      }
      setOpenId(null);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-5 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
            Gecikmiş onay bekleyen randevular
          </h2>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
            Randevu saati geçmiş; panelden henüz onaylanmamış {items.length} kayıt. Karar verirken not zorunludur
            (raporlarda görünür).
          </p>
        </div>
        <Link
          href="/admin/rapor"
          className="hidden text-sm font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200 sm:inline"
        >
          Rapor →
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-amber-200/90 bg-white p-4 dark:border-amber-900/50 dark:bg-zinc-900/80"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/appointments?appt=${encodeURIComponent(item.id)}`}
                  className="text-sm font-medium text-zinc-900 hover:text-rose-600 dark:text-zinc-100"
                >
                  {item.label}
                </Link>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300/90">
                  {item.daysOverdue} gündür onay bekliyor (tarih geçti)
                </p>
                {item.reviewNote ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Son not: {item.reviewNote}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenId(openId === item.id ? null : item.id);
                  setNote(item.reviewNote ?? "");
                  setError(null);
                }}
                className="shrink-0 rounded-lg border border-amber-300 bg-amber-100/80 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
              >
                {openId === item.id ? "Kapat" : "Karar ver"}
              </button>
            </div>
            {openId === item.id ? (
              <div className="mt-3 space-y-2 border-t border-amber-100 pt-3 dark:border-amber-900/40">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Neden onaylanmadı / alınan karar
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Örn: Müşteriye ulaşılamadı, slot iptal edildi…"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
                {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resolve(item.id, "rejected")}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resolve(item.id, "approved")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    Onayla (geç kayıt)
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
