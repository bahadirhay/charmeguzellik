"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoRevertBanner({
  pendingCount,
  isDemoActor,
}: {
  pendingCount: number;
  isDemoActor: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (isDemoActor) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
        <strong>Demo hesabı (randevu.techizmet.com)</strong> — Randevu, kasa ve sınırlı personel ekleyebilirsiniz;
        yönetici rolü atayamazsınız. Site yapısını değiştiremezsiniz. İşlemleriniz yönetici tarafından geri alınabilir.
      </div>
    );
  }

  if (pendingCount <= 0) return null;

  async function revertAll() {
    if (!confirm(`${pendingCount} demo işlemini geri almak istediğinize emin misiniz?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/demo/revert", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reverted?: number;
        errors?: Array<{ auditId: string; message: string }>;
        error?: string;
      };
      if (!res.ok) {
        setMsg(j.error ?? "Geri alma başarısız");
        return;
      }
      const errN = j.errors?.length ?? 0;
      setMsg(
        errN > 0
          ? `${j.reverted ?? 0} işlem geri alındı; ${errN} kayıt hata verdi.`
          : `${j.reverted ?? 0} demo işlemi geri alındı.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300/90 bg-amber-50/95 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/35">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-950 dark:text-amber-100">
          <strong>{pendingCount}</strong> demo kullanıcı işlemi geri alınmayı bekliyor (randevu onay/red, yeni
          randevu, kasa tahsilatı).
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={revertAll}
          className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200"
        >
          {busy ? "Geri alınıyor…" : "Demo işlemlerini geri al"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-200/90">{msg}</p> : null}
    </div>
  );
}
