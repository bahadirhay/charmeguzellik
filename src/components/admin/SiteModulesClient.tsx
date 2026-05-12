"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Feedback = { text: string; error: boolean };

export function SiteModulesClient({
  appointmentsEnabled: appointmentsInitial,
  commerceEnabled: commerceInitial,
}: {
  appointmentsEnabled: boolean;
  commerceEnabled: boolean;
}) {
  const router = useRouter();
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(appointmentsInitial);
  const [commerceEnabled, setCommerceEnabled] = useState(commerceInitial);
  const [apptBusy, setApptBusy] = useState(false);
  const [commerceBusy, setCommerceBusy] = useState(false);
  const [apptFb, setApptFb] = useState<Feedback | null>(null);
  const [commerceFb, setCommerceFb] = useState<Feedback | null>(null);

  async function patch(body: Record<string, boolean>) {
    const res = await fetch("/api/admin/tenant-features", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `Kayıt başarısız (${res.status})`;
      try {
        const j = (await res.json()) as { error?: unknown };
        if (typeof j.error === "string" && j.error.trim()) msg = j.error;
      } catch {
        /* ignore */
      }
      return { ok: false as const, msg };
    }
    return { ok: true as const };
  }

  async function setAppointments(next: boolean) {
    setApptBusy(true);
    setApptFb(null);
    try {
      const r = await patch({ appointmentsEnabled: next });
      if (!r.ok) {
        setApptFb({ text: r.msg, error: true });
        return;
      }
      setAppointmentsEnabled(next);
      setApptFb({
        text: next ? "Randevu modülü açıldı." : "Randevu modülü kapatıldı.",
        error: false,
      });
      router.refresh();
    } finally {
      setApptBusy(false);
    }
  }

  async function setCommerce(next: boolean) {
    setCommerceBusy(true);
    setCommerceFb(null);
    try {
      const r = await patch({ commerceEnabled: next });
      if (!r.ok) {
        setCommerceFb({ text: r.msg, error: true });
        return;
      }
      setCommerceEnabled(next);
      setCommerceFb({
        text: next ? "Ticaret modülü açıldı." : "Ticaret modülü kapatıldı.",
        error: false,
      });
      router.refresh();
    } finally {
      setCommerceBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site modülleri</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Bu ekran yalnızca <strong>yönetici</strong> yetkisine sahip hesaplara açıktır. Her alan adı (kiracı) için{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">Tenant.featuresJson</code> güncellenir. Randevu
          varsayılan açık; ticaret <strong>yalnızca burada veya</strong> <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">commerce: true</code>{" "}
          ile açılır. Çok kiracılı projede <strong>Müşteri siteleri</strong> üzerinden de yönetebilirsiniz.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="space-y-4">
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={appointmentsEnabled}
                disabled={apptBusy}
                onChange={(e) => void setAppointments(e.target.checked)}
                className="rounded border-zinc-400"
              />
              <span className="font-medium">Randevu özellikleri aktif</span>
            </label>
            <p className="mt-1 pl-6 text-xs text-zinc-500">
              Kapalıyken sitede randevu formu / API ve panelde Randevular menüsü kullanılamaz.
            </p>
          </div>
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commerceEnabled}
                disabled={commerceBusy}
                onChange={(e) => void setCommerce(e.target.checked)}
                className="rounded border-zinc-400"
              />
              <span className="font-medium">Ticaret modülü aktif</span>
            </label>
            <p className="mt-1 pl-6 text-xs text-zinc-500">
              Yalnızca açıkken Ticaret menüsü ve{" "}
              <code className="rounded bg-zinc-100 px-0.5 dark:bg-zinc-800">/api/admin/commerce</code> kullanılır; kapalıyken
              panel ve API ticareti göstermez.
            </p>
          </div>
        </div>
        {apptFb ? (
          <p
            className={`mt-3 text-xs ${apptFb.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {apptFb.text}
          </p>
        ) : null}
        {commerceFb ? (
          <p
            className={`mt-3 text-xs ${commerceFb.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {commerceFb.text}
          </p>
        ) : null}
      </section>
    </div>
  );
}
