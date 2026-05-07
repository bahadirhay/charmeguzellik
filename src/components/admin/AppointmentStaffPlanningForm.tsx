"use client";

import { useState } from "react";

type Props = {
  initialMap: Record<string, string[]>;
  /** Üst menü «Hizmetlerimiz» altındaki etiketler — randevu formu ile aynı kaynak */
  serviceOptions: string[];
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

function rowServiceSelectOptions(svc: string, menu: string[], map: Record<string, string[]>): string[] {
  const reserved = new Set(Object.keys(map).filter((k) => k !== svc));
  const fromMenu = menu.filter((x) => x.trim() && (x === svc || !reserved.has(x)));
  if (svc.trim() && !menu.includes(svc)) {
    return [svc, ...fromMenu];
  }
  return fromMenu;
}

export function AppointmentStaffPlanningForm({ initialMap, serviceOptions }: Props) {
  const [map, setMap] = useState<Record<string, string[]>>(initialMap);
  const [newService, setNewService] = useState("");
  const [staffCsv, setStaffCsv] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const hasMenuServices = serviceOptions.some((s) => s.trim());

  function upsert(serviceRaw: string, csv: string): boolean {
    const service = serviceRaw.trim();
    if (!service) {
      setFeedback({ text: "Bir hizmet seçin.", error: true });
      return false;
    }
    const names = normalizeStaffCsv(csv);
    if (names.length === 0) {
      setFeedback({ text: "En az bir personel adı girin.", error: true });
      return false;
    }
    setMap((prev) => ({ ...prev, [service]: names }));
    setFeedback(null);
    return true;
  }

  function renameServiceKey(previous: string, nextKey: string) {
    const target = nextKey.trim();
    if (!target || target === previous) return;
    setMap((prev) => {
      const staff = prev[previous];
      if (!staff) return prev;
      if (prev[target]) {
        queueMicrotask(() =>
          setFeedback({
            text: `"${target}" için zaten kayıt var. Önce onu silin veya düzenleyin.`,
            error: true,
          }),
        );
        return prev;
      }
      queueMicrotask(() => setFeedback(null));
      const { [previous]: _, ...rest } = prev;
      return { ...rest, [target]: staff };
    });
  }

  function addNewRow() {
    if (!upsert(newService, staffCsv)) return;
    setNewService("");
    setStaffCsv("");
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
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                value={svc}
                onChange={(e) => renameServiceKey(svc, e.target.value)}
              >
                {rowServiceSelectOptions(svc, serviceOptions, map).map((opt) => (
                  <option key={opt} value={opt}>
                    {serviceOptions.includes(opt) ? opt : `${opt} (menüde yok — eski kayıt)`}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Personeller (virgülle)
              <input
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                defaultValue={names.join(", ")}
                onBlur={(e) => {
                  void upsert(svc, e.target.value);
                }}
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
        {!hasMenuServices ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Henüz menüden hizmet listesi bulunamadı. Sayfa düzenleyicide üst menüde «Hizmetlerimiz» altına yayınlı
            hizmet başlıklarını ekleyin; randevu formu ile aynı liste burada kullanılır.
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          Yeni hizmet
          <select
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            disabled={!hasMenuServices}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Hizmet seçin…</option>
            {serviceOptions
              .filter((s) => s.trim() && !(s in map))
              .map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Personeller (virgülle)
          <input
            value={staffCsv}
            onChange={(e) => setStaffCsv(e.target.value)}
            placeholder="Ayşe, Elif"
            disabled={!hasMenuServices}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <button
          type="button"
          className="justify-self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          disabled={!hasMenuServices}
          onClick={() => addNewRow()}
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

