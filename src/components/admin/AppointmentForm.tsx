"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublishedAppointmentSchedule } from "@/lib/published-appointment-schedule.types";
import {
  DEFAULT_APPOINTMENT_TIMEZONE,
  mergeAppointmentDays,
  naiveLocalToAppointmentIso,
  slotStartLabelsForCalendarDate,
  todayYmdInTimeZone,
} from "@/lib/appointment-schedule";

type Props = {
  serviceOptions?: string[];
  /** Yayınlanmış sitedeki ilk randevu formunun takvimi; yoksa site varsayılanı */
  schedule?: PublishedAppointmentSchedule | null;
};

export function AppointmentForm({ serviceOptions = [], schedule = null }: Props) {
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");

  const mergedDays = useMemo(
    () =>
      schedule?.appointmentDays?.length
        ? schedule.appointmentDays
        : mergeAppointmentDays(undefined),
    [schedule],
  );
  const tz = (schedule?.appointmentTimeZone?.trim() || DEFAULT_APPOINTMENT_TIMEZONE) as string;
  const slotDur = schedule?.slotDurationMinutes ?? 60;
  const hasList = serviceOptions.length > 0;

  const minYmd = useMemo(() => todayYmdInTimeZone(tz), [tz]);
  const maxYmd = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + 120);
    return base.toISOString().slice(0, 10);
  }, []);

  const timeSlotLabels = useMemo(
    () =>
      apptDate ? slotStartLabelsForCalendarDate(apptDate, mergedDays, slotDur, tz) : [],
    [apptDate, mergedDays, slotDur, tz],
  );

  useEffect(() => {
    if (!timeSlotLabels.includes(apptTime)) setApptTime("");
  }, [timeSlotLabels, apptTime]);

  const onClientPhoneBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value.trim();
      if (!raw) return;
      try {
        const res = await fetch(`/api/appointments/contact?phone=${encodeURIComponent(raw)}`);
        const j = (await res.json()) as {
          ok?: boolean;
          found?: boolean;
          clientName?: string | null;
          clientEmail?: string | null;
        };
        if (!j.ok || !j.found) return;
        const form = e.currentTarget.form;
        if (!form) return;
        const nameEl = form.elements.namedItem("clientName") as HTMLInputElement | null;
        const emailEl = form.elements.namedItem("clientEmail") as HTMLInputElement | null;
        if (typeof j.clientName === "string" && j.clientName.trim() && nameEl && !nameEl.value.trim()) {
          nameEl.value = j.clientName.trim();
        }
        if (typeof j.clientEmail === "string" && j.clientEmail.trim() && emailEl && !emailEl.value.trim()) {
          emailEl.value = j.clientEmail.trim();
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("clientName") ?? "").trim();
    const phone = String(fd.get("clientPhone") ?? "").trim();
    const date = String(fd.get("apptDate") ?? "").trim();
    const time = String(fd.get("apptTime") ?? "").trim();
    const preferredIso = naiveLocalToAppointmentIso(date, time, tz);
    const start = new Date(preferredIso);
    if (!name || !date || !time || Number.isNaN(start.getTime())) {
      setFeedback({ text: "Tarih ve saat seçin.", error: true });
      return;
    }
    if (!phone) {
      setFeedback({ text: "Telefon boş bırakılamaz.", error: true });
      return;
    }
    if (!timeSlotLabels.includes(time)) {
      setFeedback({ text: "Seçilen saat bu takvim için geçerli değil.", error: true });
      return;
    }

    let serviceName: string;
    if (hasList) {
      const v = String(fd.get("serviceName") ?? "").trim();
      if (!v) {
        setFeedback({ text: "Hizmet seçin.", error: true });
        return;
      }
      serviceName = v;
    } else {
      serviceName = String(fd.get("serviceNameFree") ?? "").trim();
      if (!serviceName) {
        setFeedback({ text: "Hizmet adı girin.", error: true });
        return;
      }
    }

    const end = new Date(start.getTime() + slotDur * 60_000);
    const body = {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      serviceName,
      clientName: name,
      clientEmail: String(fd.get("clientEmail") ?? "").trim() || null,
      clientPhone: phone,
      notes: String(fd.get("notes") ?? "").trim() || null,
    };
    const res = await fetch("/api/admin/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setFeedback({ text: "Randevu eklendi", error: false });
      e.currentTarget.reset();
      setApptDate("");
      setApptTime("");
      return;
    }
    let detail = "Hata";
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) detail = j.error.trim();
      else if (res.status === 409) detail = "Aynı müşteri / hizmet / saat için kayıt zaten var.";
    } catch {
      /* ignore */
    }
    setFeedback({ text: detail, error: true });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Randevu — bilgilerinizi girin</h2>
      <p className="text-xs text-zinc-500">
        Müşteri formu ile aynı alanlar ve (yayındaki ilk randevu bloğundan) aynı çalışma saatleri / slot süresi
        kullanılır.
      </p>

      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        Ad Soyad
        <input
          name="clientName"
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      {hasList ? (
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          İstenen hizmet
          <select
            name="serviceName"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="" disabled>
              Seçin…
            </option>
            {serviceOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          İstenen hizmet
          <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200">
            Menüde «Hizmetlerimiz» bulunamadı; hizmet adını yazın.
          </p>
          <input
            name="serviceNameFree"
            required
            placeholder="Örn. Cilt bakımı"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          Tarih
          <input
            name="apptDate"
            type="date"
            required
            min={minYmd}
            max={maxYmd}
            value={apptDate}
            onChange={(e) => {
              setApptDate(e.target.value);
              setApptTime("");
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="text-sm text-zinc-700 dark:text-zinc-300">
          Saat (çalışma aralığı)
          <select
            name="apptTime"
            required
            value={apptTime}
            onChange={(e) => setApptTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">{apptDate ? "Saat seçin…" : "Önce tarih seçin"}</option>
            {timeSlotLabels.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {apptDate && timeSlotLabels.length === 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">Bu tarihte salon kapalı veya uygun slot yok.</p>
      ) : null}

      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        E-posta
        <input
          name="clientEmail"
          type="email"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>
      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        Telefon
        <input
          name="clientPhone"
          type="tel"
          required
          onInvalid={(e) => e.currentTarget.setCustomValidity("Telefon boş bırakılamaz.")}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          onBlur={onClientPhoneBlur}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <span className="mt-0.5 block text-[11px] text-zinc-500">
          Kayıtlı numarada ad ve e-posta (boşsa) otomatik dolar.
        </span>
      </label>
      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        Not (opsiyonel)
        <textarea
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      <button
        type="submit"
        className="mt-1 self-center rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700"
      >
        Randevu kaydet
      </button>
      {feedback ? (
        <p
          className={`text-sm ${feedback.error ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
        >
          {feedback.text}
        </p>
      ) : null}
    </form>
  );
}
