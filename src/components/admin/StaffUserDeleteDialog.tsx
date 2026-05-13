"use client";

import { useEffect, useState } from "react";

type Impact = {
  appointmentNotes: number;
  themeServiceEntries: number;
  commissionAccruals: number;
  cashReceipts: number;
  cashDayCloses: number;
};

type Preview = {
  user: { id: string; username: string; displayName: string | null; active: boolean };
  fromLabel: string;
  impact: Impact;
  totalReferences: number;
  requiresTransferTarget: boolean;
};

type Candidate = { id: string; username: string; displayName: string | null };

export function StaffUserDeleteDialog({
  open,
  userId,
  candidates,
  onClose,
  onDone,
}: {
  open: boolean;
  userId: string | null;
  candidates: Candidate[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      setPreview(null);
      setLoadErr(null);
      setTargetId("");
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoadErr(null);
    setPreview(null);
    setTargetId("");
    void (async () => {
      const res = await fetch(`/api/admin/staff/users/${userId}/transfer-impact`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<Preview>;
      if (cancelled) return;
      if (!res.ok) {
        setLoadErr(typeof j.error === "string" ? j.error : `Yükleme hatası (${res.status})`);
        return;
      }
      if (j.user && j.impact && typeof j.totalReferences === "number") {
        setPreview(j as Preview);
      } else {
        setLoadErr("Özet alınamadı.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  async function submit() {
    if (!userId || !preview) return;
    setBusy(true);
    setErr(null);
    try {
      const body: { transferToStaffUserId?: string | null } = {};
      if (preview.requiresTransferTarget) {
        if (!targetId.trim()) {
          setErr("Hedef personel seçin.");
          setBusy(false);
          return;
        }
        body.transferToStaffUserId = targetId.trim();
      }
      const res = await fetch(`/api/admin/staff/users/${userId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Silinemedi");
        return;
      }
      onClose();
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Personeli kalıcı sil</h3>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Randevu notlarındaki <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">[[STAFF:…]]</code> ataması,
          personel planlama (tema) listeleri, kasa/prim kayıtlarındaki personel bağlantısı hedefe taşınır; ardından
          kullanıcı kaydı silinir. İşlem geri alınamaz.
        </p>

        {loadErr ? <p className="mt-3 text-xs text-red-600">{loadErr}</p> : null}

        {preview ? (
          <div className="mt-3 space-y-3 text-xs">
            <p className="rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-950">
              <span className="font-mono font-medium">{preview.user.username}</span>
              {preview.user.displayName ? (
                <span className="text-zinc-600 dark:text-zinc-400"> — {preview.user.displayName}</span>
              ) : null}
            </p>
            <ul className="list-inside list-disc space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>Randevu ataması (not): {preview.impact.appointmentNotes}</li>
              <li>Personel planlama (tema) girdisi: {preview.impact.themeServiceEntries}</li>
              <li>Prim tahakkuku: {preview.impact.commissionAccruals}</li>
              <li>Kasa tahsilatı (kaydeden): {preview.impact.cashReceipts}</li>
              <li>Gün sonu (personel): {preview.impact.cashDayCloses}</li>
            </ul>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              Toplam bağlantı: {preview.totalReferences}
              {preview.requiresTransferTarget ? " — hedef personel zorunlu." : " — doğrudan silinebilir."}
            </p>

            {preview.requiresTransferTarget ? (
              <label className="grid gap-1">
                <span className="text-zinc-700 dark:text-zinc-300">Verileri aktar</span>
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">— Hedef seçin —</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                      {c.displayName ? ` (${c.displayName})` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-zinc-500">
                  Hedefte «Görünen ad» tanımlı olmalı; randevu atamaları bu adla güncellenir.
                </span>
              </label>
            ) : null}
          </div>
        ) : !loadErr ? (
          <p className="mt-3 text-xs text-zinc-500">Özet yükleniyor…</p>
        ) : null}

        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy || !!loadErr || !preview}
            onClick={() => void submit()}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "İşleniyor…" : preview?.requiresTransferTarget ? "Aktar ve sil" : "Kalıcı sil"}
          </button>
        </div>
      </div>
    </div>
  );
}
