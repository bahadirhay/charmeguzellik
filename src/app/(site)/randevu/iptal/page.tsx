"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { mergeAppointmentDays, slotStartLabelsForCalendarDate } from "@/lib/appointment-schedule";

type CancelGetResponse = {
  ok?: boolean;
  error?: string;
  appointment?: {
    clientName: string;
    serviceName: string | null;
    startAt: string;
    canUpdate: boolean;
  };
  schedule?: {
    appointmentDays?: Array<{ day: number; start: string; end: string }>;
    slotDurationMinutes?: number;
    appointmentTimeZone?: string;
  };
};

export default function AppointmentCancelPage() {
  const sp = useSearchParams();
  const tokenFromUrl = sp.get("t") ?? "";
  const [token, setToken] = useState(tokenFromUrl);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [apptInfo, setApptInfo] = useState<CancelGetResponse["appointment"] | null>(null);
  const [schedule, setSchedule] = useState<CancelGetResponse["schedule"] | null>(null);
  const [dateYmd, setDateYmd] = useState("");
  const [timeHm, setTimeHm] = useState("");

  const slotDur = schedule?.slotDurationMinutes ?? 60;
  const tz = schedule?.appointmentTimeZone?.trim() || "Europe/Istanbul";
  const days = useMemo(() => mergeAppointmentDays(schedule?.appointmentDays), [schedule?.appointmentDays]);
  const timeOptions = useMemo(
    () => (dateYmd ? slotStartLabelsForCalendarDate(dateYmd, days, slotDur, tz) : []),
    [dateYmd, days, slotDur, tz],
  );

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
        body: JSON.stringify({ token, action: "cancel" }),
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

  async function submitConfirm() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setWaUrl(null);
    try {
      const res = await fetch("/api/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "confirm" }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Teyit işlemi başarısız.");
        return;
      }
      setMsg(j.message ?? "Randevunuz teyit edildi.");
      if (apptInfo) setApptInfo({ ...apptInfo });
    } finally {
      setBusy(false);
    }
  }

  async function submitReschedule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    setWaUrl(null);
    try {
      const res = await fetch("/api/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "reschedule", dateYmd, timeHm }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        updatedStartAt?: string;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Takvim güncelleme başarısız.");
        return;
      }
      setMsg("Randevu saatiniz güncellendi.");
      if (j.updatedStartAt && apptInfo) {
        setApptInfo({ ...apptInfo, startAt: j.updatedStartAt });
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token?.trim()) return;
    let cancelled = false;
    setLoadingInfo(true);
    fetch(`/api/appointments/cancel?t=${encodeURIComponent(token)}`)
      .then((r) => r.json().catch(() => ({})))
      .then((j: CancelGetResponse) => {
        if (cancelled) return;
        if (!j.ok || !j.appointment) {
          setErr(j.error ?? "Bağlantı doğrulanamadı.");
          return;
        }
        setApptInfo(j.appointment);
        setSchedule(j.schedule ?? null);
      })
      .catch(() => {
        if (!cancelled) setErr("Bağlantı bilgileri yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setLoadingInfo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Randevu yönetimi</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Bu linkten randevunuzu teyit edebilir, iptal edebilir veya uygun bir gün/saat seçip güncelleyebilirsiniz.
      </p>
      {loadingInfo ? <p className="mt-2 text-sm text-zinc-500">Randevu bilgileri yükleniyor...</p> : null}
      {apptInfo ? (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/70">
          <p className="font-medium text-zinc-800 dark:text-zinc-100">{apptInfo.clientName}</p>
          <p className="text-zinc-600 dark:text-zinc-300">
            {apptInfo.serviceName ?? "Hizmet"} -{" "}
            {new Date(apptInfo.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
          </p>
        </div>
      ) : null}
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
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "İşleniyor…" : "Randevumu iptal et"}
          </button>
          <button
            type="button"
            onClick={() => void submitConfirm()}
            disabled={busy}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "İşleniyor…" : "Teyit ediyorum"}
          </button>
        </div>
      </form>
      <form className="mt-5 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700" onSubmit={submitReschedule}>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Takvim güncelle</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Yeni gün
            <input
              required
              type="date"
              value={dateYmd}
              onChange={(e) => {
                setDateYmd(e.target.value);
                setTimeHm("");
              }}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Yeni saat
            <select
              required
              value={timeHm}
              onChange={(e) => setTimeHm(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="">Saat seçin</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!apptInfo?.canUpdate ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Randevuya 1 saatten az kaldığı için takvim güncellemesi kapalıdır.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !apptInfo?.canUpdate}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "İşleniyor…" : "Takvimi güncelle"}
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
          WhatsApp ile bilgilendir
        </a>
      ) : null}
    </section>
  );
}
