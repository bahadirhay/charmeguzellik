"use client";

import { useEffect, useState } from "react";

type Mode = "all" | "pages" | "contents" | "database" | "files";

export function BackupCenter() {
  const [items, setItems] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("all");
  const [restoreFrom, setRestoreFrom] = useState("");
  const [applyRestore, setApplyRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/backups", { cache: "no-store" });
    const j = (await res.json()) as { ok?: boolean; items?: string[] };
    if (j.ok && Array.isArray(j.items)) {
      setItems(j.items);
      if (!restoreFrom && j.items[0]) setRestoreFrom(j.items[0]);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBackup() {
    setBusy(true);
    setLog("");
    try {
      const res = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", mode }),
      });
      const j = (await res.json()) as { stdout?: string; stderr?: string; error?: string; items?: string[] };
      if (!res.ok) {
        setLog(j.error ?? "Yedekleme başarısız.");
        return;
      }
      setLog([j.stdout, j.stderr].filter(Boolean).join("\n"));
      if (Array.isArray(j.items)) setItems(j.items);
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup() {
    if (!restoreFrom) return;
    setBusy(true);
    setLog("");
    try {
      const res = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          mode,
          from: restoreFrom,
          apply: applyRestore,
        }),
      });
      const j = (await res.json()) as { stdout?: string; stderr?: string; error?: string };
      if (!res.ok) {
        setLog(j.error ?? "Geri yükleme başarısız.");
        return;
      }
      setLog([j.stdout, j.stderr].filter(Boolean).join("\n"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Yedekleme Merkezi</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Seçenekli yedek ve geri yükleme. <strong>all</strong> seçimi sayfalar + içerikler + veritabanı + dosyaları kapsar.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Mod
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="all">all (tam yedek)</option>
              <option value="pages">pages</option>
              <option value="contents">contents</option>
              <option value="database">database</option>
              <option value="files">files</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createBackup()}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "..." : "Yedek oluştur"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            Listeyi yenile
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Geri yükleme</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm min-w-64">
            Yedek klasörü
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={restoreFrom}
              onChange={(e) => setRestoreFrom(e.target.value)}
            >
              <option value="">Seçin...</option>
              {items.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={applyRestore} onChange={(e) => setApplyRestore(e.target.checked)} />
            Uygula (işaretli değilse dry-run)
          </label>
          <button
            type="button"
            disabled={busy || !restoreFrom}
            onClick={() => void restoreBackup()}
            className="rounded-full border border-amber-400 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
          >
            {busy ? "..." : "Geri yükle"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold">Log</h3>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
          {log || "Henüz işlem yok."}
        </pre>
      </div>
    </div>
  );
}
