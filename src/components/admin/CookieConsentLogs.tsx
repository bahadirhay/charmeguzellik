"use client";

import { Fragment, useEffect, useState } from "react";

type ConsentRow = {
  id: string;
  consentKey: string;
  decision: "accepted" | "rejected" | "custom";
  preferencesJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function formatPreferencesPreview(raw: string | null): string {
  if (!raw?.trim()) return "-";
  try {
    const obj = JSON.parse(raw) as Record<string, boolean>;
    const parts = Object.entries(obj)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (parts.length === 0) return "Kapalı";
    return parts.join(", ");
  } catch {
    return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  }
}

function prettyPreferences(raw: string | null): string {
  if (!raw?.trim()) return "(Yok)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function CookieConsentLogs() {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cookie-consents", { cache: "no-store" });
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

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Çerez Kayıtları</h2>
        <button type="button" onClick={() => void load()} className="rounded-md border px-3 py-1.5 text-sm">
          Yenile
        </button>
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
                <th className="px-2 py-2">Tarayıcı</th>
                <th className="px-2 py-2">Tercihler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = expandedId === row.id;
                const hasPrefs = !!row.preferencesJson?.trim();
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-2">{row.decision}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{row.ipAddress || "-"}</td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-zinc-600 dark:text-zinc-400">
                        {row.userAgent || "-"}
                      </td>
                      <td className="px-2 py-2">
                        {hasPrefs ? (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isOpen ? null : row.id)}
                            className="max-w-[220px] truncate text-left text-rose-600 underline decoration-rose-300 underline-offset-2 hover:decoration-rose-600 dark:text-rose-400"
                            title="Detayı göster"
                          >
                            {formatPreferencesPreview(row.preferencesJson)}
                          </button>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-t border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Tercihler (tam)
                              </p>
                              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
                                {prettyPreferences(row.preferencesJson)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Tarayıcı (tam)
                              </p>
                              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
                                {row.userAgent || "(Yok)"}
                              </pre>
                              <p className="mt-2 text-xs text-zinc-500">
                                Cihaz anahtarı: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{row.consentKey}</code>
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
