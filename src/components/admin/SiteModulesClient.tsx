"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ModuleUnlockDialog } from "@/components/admin/ModuleUnlockDialog";

type Feedback = { text: string; error: boolean };

type UnlockKind = "commerce" | "appointments";

export function SiteModulesClient({
  appointmentsEnabled: appointmentsInitial,
  commerceEnabled: commerceInitial,
  appointmentsKeyProvisioned: apptKeysInitial,
  commerceKeyProvisioned: commerceKeysInitial,
}: {
  appointmentsEnabled: boolean;
  commerceEnabled: boolean;
  appointmentsKeyProvisioned: boolean;
  commerceKeyProvisioned: boolean;
}) {
  const router = useRouter();
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(appointmentsInitial);
  const [commerceEnabled, setCommerceEnabled] = useState(commerceInitial);
  const [appointmentsKeyProvisioned, setAppointmentsKeyProvisioned] = useState(apptKeysInitial);
  const [commerceKeyProvisioned, setCommerceKeyProvisioned] = useState(commerceKeysInitial);

  const [apptBusy, setApptBusy] = useState(false);
  const [commerceBusy, setCommerceBusy] = useState(false);
  const [ensureBusy, setEnsureBusy] = useState(false);
  const [apptFb, setApptFb] = useState<Feedback | null>(null);
  const [commerceFb, setCommerceFb] = useState<Feedback | null>(null);
  const [ensureFb, setEnsureFb] = useState<Feedback | null>(null);
  const [newTokensBanner, setNewTokensBanner] = useState<string | null>(null);

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockKind, setUnlockKind] = useState<UnlockKind>("commerce");
  const [unlockBusy, setUnlockBusy] = useState(false);

  useEffect(() => {
    setAppointmentsEnabled(appointmentsInitial);
    setCommerceEnabled(commerceInitial);
    setAppointmentsKeyProvisioned(apptKeysInitial);
    setCommerceKeyProvisioned(commerceKeysInitial);
  }, [appointmentsInitial, commerceInitial, apptKeysInitial, commerceKeysInitial]);

  async function patchFeatures(body: Record<string, unknown>) {
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

  async function ensureKeys() {
    setEnsureBusy(true);
    setEnsureFb(null);
    setNewTokensBanner(null);
    try {
      const res = await fetch("/api/admin/tenant-features/ensure-keys", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        newTokens?: Partial<Record<UnlockKind, string>>;
      };
      if (!res.ok) {
        setEnsureFb({ text: j.error ?? `İstek başarısız (${res.status})`, error: true });
        return;
      }
      if (j.message) {
        setEnsureFb({ text: j.message, error: false });
      }
      const nt = j.newTokens ?? {};
      if (nt.commerce || nt.appointments) {
        setCommerceKeyProvisioned((p) => p || Boolean(nt.commerce));
        setAppointmentsKeyProvisioned((p) => p || Boolean(nt.appointments));
        setNewTokensBanner(
          [
            "Yeni anahtarlar (bir kez gösterilir; GitHub Secret olarak kaydedin):",
            nt.commerce ? `commerce: ${nt.commerce}` : null,
            nt.appointments ? `appointments: ${nt.appointments}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
      router.refresh();
    } finally {
      setEnsureBusy(false);
    }
  }

  async function setAppointments(next: boolean) {
    setApptBusy(true);
    setApptFb(null);
    try {
      const r = await patchFeatures({ appointmentsEnabled: next });
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
      const r = await patchFeatures({ commerceEnabled: next });
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

  function beginEnable(kind: UnlockKind) {
    const provisioned = kind === "commerce" ? commerceKeyProvisioned : appointmentsKeyProvisioned;
    if (!provisioned) {
      const msg =
        "Bu modül için henüz güvenlik anahtarı yok. Önce «Güvenlik anahtarları oluştur» ile üretin; anahtarı GitHub Secret olarak saklayın.";
      if (kind === "commerce") setCommerceFb({ text: msg, error: true });
      else setApptFb({ text: msg, error: true });
      return;
    }
    setUnlockKind(kind);
    setUnlockOpen(true);
  }

  async function submitUnlock(token: string) {
    setUnlockBusy(true);
    try {
      const body =
        unlockKind === "commerce"
          ? { commerceEnabled: true, commerceUnlockToken: token }
          : { appointmentsEnabled: true, appointmentsUnlockToken: token };
      const r = await patchFeatures(body);
      if (!r.ok) {
        if (unlockKind === "commerce") setCommerceFb({ text: r.msg, error: true });
        else setApptFb({ text: r.msg, error: true });
        return;
      }
      if (unlockKind === "commerce") {
        setCommerceEnabled(true);
        setCommerceFb({ text: "Ticaret modülü açıldı.", error: false });
      } else {
        setAppointmentsEnabled(true);
        setApptFb({ text: "Randevu modülü açıldı.", error: false });
      }
      setUnlockOpen(false);
      router.refresh();
    } finally {
      setUnlockBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site modülleri</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Bu ekran yalnızca <strong>yönetici</strong> yetkisine sahip hesaplara açıktır. Her alan adı (kiracı) için{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">Tenant.featuresJson</code> güncellenir. Modülü{" "}
          <strong>açmak</strong> için veritabanında saklı bcrypt hash ile eşleşen bir güvenlik anahtarı gerekir; anahtarı
          siz (ör. GitHub repository veya Actions secret) saklarsınız. Randevu varsayılan açık; yine de kapatıp tekrar
          açarken anahtar istenir. Ticaret <strong>yalnızca burada veya</strong>{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">commerce: true</code> ile açılır. Çok kiracılı
          projede <strong>Müşteri siteleri</strong> üzerinden de yönetebilirsiniz.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={ensureBusy}
            onClick={() => void ensureKeys()}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {ensureBusy ? "Oluşturuluyor…" : "Güvenlik anahtarları oluştur (eksikler)"}
          </button>
          <span className="text-xs text-zinc-500">
            Önerilen secret adları: <code className="font-mono">TENANT_COMMERCE_UNLOCK</code>,{" "}
            <code className="font-mono">TENANT_APPOINTMENTS_UNLOCK</code>
          </span>
        </div>
        {ensureFb ? (
          <p
            className={`mt-2 text-xs ${ensureFb.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {ensureFb.text}
          </p>
        ) : null}
        {newTokensBanner ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {newTokensBanner}
          </pre>
        ) : null}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="space-y-4">
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={appointmentsEnabled}
                disabled={apptBusy}
                onChange={(e) => {
                  const on = e.target.checked;
                  if (!on) void setAppointments(false);
                  else beginEnable("appointments");
                }}
                className="rounded border-zinc-400"
              />
              <span className="font-medium">Randevu özellikleri aktif</span>
            </label>
            <p className="mt-1 pl-6 text-xs text-zinc-500">
              Kapalıyken sitede randevu formu / API ve panelde Randevular menüsü kullanılamaz. Tekrar açmak için güvenlik
              anahtarı gerekir. Anahtar tanımı: {appointmentsKeyProvisioned ? "var" : "yok"}.
            </p>
          </div>
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commerceEnabled}
                disabled={commerceBusy}
                onChange={(e) => {
                  const on = e.target.checked;
                  if (!on) void setCommerce(false);
                  else beginEnable("commerce");
                }}
                className="rounded border-zinc-400"
              />
              <span className="font-medium">Ticaret modülü aktif</span>
            </label>
            <p className="mt-1 pl-6 text-xs text-zinc-500">
              Yalnızca açıkken Ticaret menüsü ve{" "}
              <code className="rounded bg-zinc-100 px-0.5 dark:bg-zinc-800">/api/admin/commerce</code> kullanılır. Anahtar
              tanımı: {commerceKeyProvisioned ? "var" : "yok"}.
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

      <ModuleUnlockDialog
        open={unlockOpen}
        kind={unlockKind}
        busy={unlockBusy}
        onClose={() => setUnlockOpen(false)}
        onSubmit={(t) => submitUnlock(t)}
      />
    </div>
  );
}
