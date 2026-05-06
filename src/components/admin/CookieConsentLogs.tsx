"use client";

import { useEffect, useState } from "react";

type ConsentRow = {
  id: string;
  consentKey: string;
  decision: string;
  preferencesJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function formatPreferencesPreview(raw: string | null): string {
  if (!raw?.trim()) return "-";
  try {
    const obj = JSON.parse(raw) as Record<string, boolean>;
    const on = Object.entries(obj)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const off = Object.entries(obj)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    const parts = [
      on.length ? `Açık: ${on.join(", ")}` : null,
      off.length ? `Kapalı: ${off.join(", ")}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Kapalı";
  } catch {
    return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
  }
}

function prettyPreferences(raw: string | null): string {
  if (!raw?.trim()) return "(Kayıt yok)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function DetailModal({ row, onClose }: { row: ConsentRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div className="relative z-[101] flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="min-w-0">
            <h3 id="cookie-detail-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Çerez kaydı — tam detay
            </h3>
            <p className="mt-1 text-xs text-zinc-500">{new Date(row.createdAt).toLocaleString("tr-TR")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
          >
            Kapat
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Karar</dt>
              <dd className="break-words font-mono text-zinc-900 dark:text-zinc-100">{row.decision}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IP adresi</dt>
              <dd className="break-all font-mono text-zinc-900 dark:text-zinc-100">{row.ipAddress || "(Yok)"}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cihaz anahtarı</dt>
              <dd className="break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">{row.consentKey}</dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tam tarayıcı (User-Agent)</p>
            <pre className="mt-1 max-h-[min(280px,40vh)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed dark:border-zinc-600 dark:bg-zinc-950">
              {row.userAgent || "(Yok)"}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tercihler (tam JSON)</p>
            <pre className="mt-1 max-h-[min(320px,45vh)] overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed dark:border-zinc-600 dark:bg-zinc-950">
              {prettyPreferences(row.preferencesJson)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CookieConsentLogs() {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRow, setModalRow] = useState<ConsentRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cookie-consents", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as { rows?: ConsentRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Kayıtlar alınamadı.");
      setRows(data.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıtlar alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openDetail(row: ConsentRow) {
    setModalRow(row);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {modalRow ? <DetailModal row={modalRow} onClose={() => setModalRow(null)} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Çerez Kayıtları</h2>
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
          <p className="max-w-xs text-right text-[11px] text-zinc-500 sm:text-left">
            Herhangi bir satıra veya «Detay» düğmesine tıklayın; tam IP, tarayıcı metni ve JSON burada açılır.
          </p>
          <button type="button" onClick={() => void load()} className="rounded-md border px-3 py-1.5 text-sm">
            Yenile
          </button>
        </div>
      </div>
      {loading ? <p className="text-sm text-zinc-500">Yükleniyor...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !error ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="px-2 py-2">Zaman</th>
                <th className="px-2 py-2">Karar</th>
                <th className="px-2 py-2">IP</th>
                <th className="min-w-[200px] px-2 py-2">Tarayıcı (özet)</th>
                <th className="min-w-[220px] px-2 py-2">Tercihler (özet)</th>
                <th className="px-2 py-2 whitespace-nowrap">Detay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  onClick={() => openDetail(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(row);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Kayıt detayı: ${row.decision}`}
                >
                  <td className="px-2 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString("tr-TR")}</td>
                  <td className="px-2 py-2">{row.decision}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{row.ipAddress || "-"}</td>
                  <td className="max-w-[min(340px,50vw)] truncate px-2 py-2 text-zinc-600 dark:text-zinc-400">
                    {row.userAgent || "-"}
                  </td>
                  <td className="max-w-[min(380px,55vw)] px-2 py-2 text-zinc-700 dark:text-zinc-300">
                    <span className="line-clamp-2">{formatPreferencesPreview(row.preferencesJson)}</span>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(row);
                      }}
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
