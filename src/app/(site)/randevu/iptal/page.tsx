"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppointmentCancelPage() {
  const sp = useSearchParams();
  const tokenFromUrl = sp.get("t") ?? "";
  const [token, setToken] = useState(tokenFromUrl);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    setWaUrl(null);
    try {
      const res = await fetch("/api/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        whatsappUrl?: string | null;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "İptal işlemi başarısız.");
        return;
      }
      setMsg("Randevunuz iptal edildi.");
      setWaUrl(j.whatsappUrl ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Randevu iptal doğrulama</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Onay mesajınızdaki <strong>iptal kodunu</strong> girin. E-posta veya WhatsApp’taki bağlantıya tıkladıysanız güvenlik
        anahtarı otomatik dolmuştur.
      </p>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <label className="grid gap-1 text-sm">
          Güvenlik anahtarı
          <input
            required
            readOnly={Boolean(tokenFromUrl)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900 read-only:bg-zinc-50 dark:read-only:bg-zinc-900/80"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bağlantıdan gelmediyse e-postadaki uzun değeri buraya yapıştırın"
          />
        </label>
        <label className="grid gap-1 text-sm">
          İptal kodu
          <input
            required
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Örn. 123456"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "İşleniyor…" : "Randevumu iptal et"}
        </button>
      </form>
      {err ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {msg ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{msg}</p> : null}
      {waUrl ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          WhatsApp ile iptal onayı gönder
        </a>
      ) : null}
    </section>
  );
}
