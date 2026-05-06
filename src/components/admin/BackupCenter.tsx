"use client";

import { useEffect, useState } from "react";

type Mode = "all" | "pages" | "contents" | "database" | "files";

async function parseBackupJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Sunucu yanıtı boş (HTTP ${res.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.length > 400 ? `${text.slice(0, 400)}…` : text,
    );
  }
}

export function BackupCenter() {
  const [items, setItems] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("all");
  const [restoreFrom, setRestoreFrom] = useState("");
  const [applyRestore, setApplyRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [restoreAllowed, setRestoreAllowed] = useState(true);
  /** null = ilk yükleme öncesi */
  const [diskBackupAvailable, setDiskBackupAvailable] = useState<boolean | null>(null);

  function triggerDownload(payload: unknown, filename: string) {
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* no-op — log zaten metin olarak dolacak */
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/admin/backups", { cache: "no-store" });
      const j = await parseBackupJson<{
        ok?: boolean;
        items?: string[];
        restoreAllowed?: boolean;
        diskBackupAvailable?: boolean;
        error?: string;
      }>(res);
      if (typeof j.restoreAllowed === "boolean") setRestoreAllowed(j.restoreAllowed);
      if (typeof j.diskBackupAvailable === "boolean") setDiskBackupAvailable(j.diskBackupAvailable);
      if (!res.ok || !j.ok) {
        setLog(j.error ?? `Liste alınamadı (HTTP ${res.status}).`);
        return;
      }
      if (Array.isArray(j.items)) {
        setItems(j.items);
        setRestoreFrom((prev) => (prev ? prev : j.items![0] ?? ""));
      }
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
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
      type CreateJson = {
        ok?: boolean;
        stdout?: string;
        stderr?: string;
        error?: string;
        items?: string[];
        download?: unknown;
        downloadFilename?: string;
        serverlessExport?: boolean;
      };
      const j = await parseBackupJson<CreateJson>(res);
      if (!res.ok || !j.ok) {
        setLog(j.error ?? "Yedekleme başarısız.");
        return;
      }
      setLog([j.stdout, j.stderr].filter(Boolean).join("\n"));
      if (Array.isArray(j.items)) setItems(j.items);
      if (
        j.serverlessExport &&
        j.download != null &&
        typeof j.downloadFilename === "string" &&
        j.downloadFilename.length > 0
      ) {
        triggerDownload(j.download, j.downloadFilename);
        setLog((prev) => `${prev}\n\nİndirme başlatıldı: ${j.downloadFilename}`);
      }
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup() {
    if (!restoreFrom || !restoreAllowed) return;
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
      type RestoreJson = { ok?: boolean; stdout?: string; stderr?: string; error?: string };
      const j = await parseBackupJson<RestoreJson>(res);
      if (!res.ok || !j.ok) {
        setLog(j.error ?? "Geri yükleme başarısız.");
        return;
      }
      setLog([j.stdout, j.stderr].filter(Boolean).join("\n"));
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
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
        {diskBackupAvailable === false ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
            Sunucuya kalıcı <code className="rounded bg-amber-100 px-1 dark:bg-amber-950/90">backups/</code> yazılamıyor
            (ör. Vercel). Veritabanı yedeği oluşturulunca tarayıcıya <strong>JSON</strong> inecek; tam klasör yedeği için
            yerelde <code className="rounded bg-amber-100 px-1 dark:bg-amber-950/90">npm run backup:create</code>.
          </p>
        ) : null}
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
        {!restoreAllowed ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50">
            Canlı ortamda (ör. Vercel) klasöre yazan geri yükleme güvenilir olmadığı için kapalıdır. Yerel bilgisayar veya SSH
            erişiminiz varsa <code className="rounded bg-white/80 px-1 dark:bg-black/30">npm run backup:restore</code> kullanın.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm min-w-64">
            Yedek klasörü
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              disabled={!restoreAllowed}
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
            <input
              type="checkbox"
              disabled={!restoreAllowed}
              checked={applyRestore}
              onChange={(e) => setApplyRestore(e.target.checked)}
            />
            Uygula (işaretli değilse dry-run)
          </label>
          <button
            type="button"
            disabled={busy || !restoreFrom || !restoreAllowed}
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
