"use client";

import { useEffect, useState } from "react";

type ConsentRow = {
  id: string;
  consentKey: string;
  decision: "accepted" | "rejected" | "custom";
  preferencesJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export function CookieConsentLogs() {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-2 py-2">{new Date(row.createdAt).toLocaleString("tr-TR")}</td>
                  <td className="px-2 py-2">{row.decision}</td>
                  <td className="px-2 py-2">{row.ipAddress || "-"}</td>
                  <td className="max-w-[260px] truncate px-2 py-2" title={row.userAgent || ""}>
                    {row.userAgent || "-"}
                  </td>
                  <td className="max-w-[260px] truncate px-2 py-2" title={row.preferencesJson || ""}>
                    {row.preferencesJson || "-"}
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
