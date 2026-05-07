"use client";

import { useState } from "react";

type Props = {
  initialMap: Record<string, string[]>;
};

function normalizeStaffCsv(csv: string): string[] {
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
}

export function AppointmentStaffPlanningForm({ initialMap }: Props) {
  const [map, setMap] = useState<Record<string, string[]>>(initialMap);
  const [serviceName, setServiceName] = useState("");
  const [staffCsv, setStaffCsv] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  function upsert(serviceRaw: string, csv: string) {
    const service = serviceRaw.trim();
    if (!service) {
      setFeedback({ text: "Hizmet adı boş olamaz.", error: true });
      return;
    }
    const names = normalizeStaffCsv(csv);
    if (names.length === 0) {
      setFeedback({ text: "En az bir personel adı girin.", error: true });
      return;
    }
    setMap((prev) => ({ ...prev, [service]: names }));
    setFeedback(null);
  }

  async function saveAll() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/appointments/staffing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ map }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setFeedback({ text: j.error ?? "Kaydedilemedi.", error: true });
        return;
      }
      setFeedback({ text: "Personel planlama kaydedildi.", error: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Hizmete bağlı personel tanımlayın. Müşteri/personel seçmezse sistem o saatte müsait olan personeli otomatik atar.
        </p>
      </div>
      <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {Object.entries(map).map(([svc, names]) => (
          <div key={svc} className="grid gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <label className="grid gap-1 text-sm">
              Hizmet
              <input
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                defaultValue={svc}
                onBlur={(e) => upsert(e.target.value, names.join(", "))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Personeller (virgülle)
              <input
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                defaultValue={names.join(", ")}
                onBlur={(e) => upsert(svc, e.target.value)}
              />
            </label>
            <button
              type="button"
              className="justify-self-start rounded border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
              onClick={() =>
                setMap((prev) => {
                  const next: Record<string, string[]> = {};
                  for (const [k, v] of Object.entries(prev)) if (k !== svc) next[k] = v;
                  return next;
                })
              }
            >
              Sil
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <label className="grid gap-1 text-sm">
          Yeni hizmet
          <input
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="Hydrafacial — Işıltınız"
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Personeller (virgülle)
          <input
            value={staffCsv}
            onChange={(e) => setStaffCsv(e.target.value)}
            placeholder="Ayşe, Elif"
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <button
          type="button"
          className="justify-self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          onClick={() => {
            upsert(serviceName, staffCsv);
            setServiceName("");
            setStaffCsv("");
          }}
        >
          Ekle
        </button>
      </div>
      <button
        type="button"
        onClick={() => void saveAll()}
        disabled={busy}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Kaydediliyor…" : "Personel planlamayı kaydet"}
      </button>
      {feedback ? (
        <p className={`text-sm ${feedback.error ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}

