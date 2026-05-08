"use client";

import Link from "next/link";
import { useState } from "react";

type StaffEntry = { id: string; displayName: string };

type Props = {
  /** Hizmet etiketi -> panel personel kullanıcı id'leri */
  initialIdMap: Record<string, string[]>;
  /** Üst menü «Hizmetlerimiz» altındaki etiketler */
  serviceOptions: string[];
  /** Personel & roller — görünen adı dolu aktif kullanıcılar (tek kaynak) */
  staffDirectory: StaffEntry[];
};

function rowServiceSelectOptions(svc: string, menu: string[], map: Record<string, string[]>): string[] {
  const reserved = new Set(Object.keys(map).filter((k) => k !== svc));
  const fromMenu = menu.filter((x) => x.trim() && (x === svc || !reserved.has(x)));
  if (svc.trim() && !menu.includes(svc)) {
    return [svc, ...fromMenu];
  }
  return fromMenu;
}

export function AppointmentStaffPlanningForm({ initialIdMap, serviceOptions, staffDirectory }: Props) {
  const [map, setMap] = useState<Record<string, string[]>>(initialIdMap);
  const [newService, setNewService] = useState("");
  const [newStaffSelection, setNewStaffSelection] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const hasMenuServices = serviceOptions.some((s) => s.trim());
  const hasStaffDirectory = staffDirectory.length > 0;

  function toggleStaffForService(svc: string, staffId: string, checked: boolean) {
    setMap((prev) => {
      const cur = new Set(prev[svc] ?? []);
      if (checked) cur.add(staffId);
      else cur.delete(staffId);
      const nextList = [...cur];
      if (nextList.length === 0) {
        const { [svc]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [svc]: nextList };
    });
    setFeedback(null);
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
    const service = newService.trim();
    if (!service) {
      setFeedback({ text: "Bir hizmet seçin.", error: true });
      return;
    }
    const ids = Object.entries(newStaffSelection)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (ids.length === 0) {
      setFeedback({ text: "En az bir personel seçin.", error: true });
      return;
    }
    setMap((prev) => ({ ...prev, [service]: Array.from(new Set([...(prev[service] ?? []), ...ids])) }));
    setNewService("");
    setNewStaffSelection({});
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
          Personel adları yalnızca{" "}
          <Link href="/admin/staff" className="text-rose-600 hover:underline">
            Personel & roller
          </Link>{" "}
          ekranındaki <strong>Görünen ad</strong> alanından gelir (tek kaynak). Burada hizmete hangi hesabın
          atanacağını seçersiniz; müşteri randevu formu bu adları otomatik kullanır.
        </p>
      </div>
      <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {Object.entries(map).map(([svc, ids]) => (
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
            <div className="grid gap-1 text-sm">
              <span>Personeller</span>
              {!hasStaffDirectory ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Listelenecek personel yok. Personel & roller’de kullanıcıya <strong>Görünen ad</strong> yazın.
                </p>
              ) : (
                <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto rounded border border-zinc-200 p-2 dark:border-zinc-700">
                  {staffDirectory.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={ids.includes(s.id)}
                        onChange={(e) => toggleStaffForService(svc, s.id, e.target.checked)}
                        className="rounded"
                      />
                      <span>{s.displayName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
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
        <div className="grid gap-1 text-sm">
          <span>Personel seçimi</span>
          {!hasStaffDirectory ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">Önce Personel & roller’de görünen ad tanımlayın.</p>
          ) : (
            <div className="flex max-h-36 flex-wrap gap-x-4 gap-y-1 overflow-y-auto rounded border border-zinc-300 bg-white p-2 dark:border-zinc-600">
              {staffDirectory.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={!!newStaffSelection[s.id]}
                    onChange={(e) =>
                      setNewStaffSelection((prev) => ({ ...prev, [s.id]: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span>{s.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="justify-self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          disabled={!hasMenuServices || !hasStaffDirectory}
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
