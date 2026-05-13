"use client";

import { useEffect, useState } from "react";

type Kind = "commerce" | "appointments";

export function ModuleUnlockDialog({
  open,
  kind,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  kind: Kind;
  onClose: () => void;
  onSubmit: (token: string) => void | Promise<void>;
  busy: boolean;
}) {
  const [token, setToken] = useState("");

  useEffect(() => {
    if (open) setToken("");
  }, [open, kind]);

  if (!open) return null;

  const label = kind === "commerce" ? "Ticaret" : "Randevu";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label} modülünü aç</h3>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Bu site için oluşturulan <strong>güvenlik anahtarını</strong> girin (ör. GitHub Actions / repository secret olarak
          sakladığınız değer). Anahtar sunucuda tutulmaz; yalnızca hash saklanır.
        </p>
        <label className="mt-3 grid gap-1 text-xs">
          Anahtar
          <textarea
            className="min-h-[4rem] rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-[11px] dark:border-zinc-600 dark:bg-zinc-950"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setToken("");
              onClose();
            }}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy || !token.trim()}
            onClick={async () => {
              await onSubmit(token.trim());
            }}
            className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
