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
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";

import type { PublishedAppointmentFormRef } from "@/lib/published-appointment-schedule";

type Props = {
  serviceOptions?: string[];
  /** Yayınlanmış sitedeki ilk randevu formunun takvimi; yoksa site varsayılanı */
  schedule?: PublishedAppointmentSchedule | null;
  serviceStaffMap?: Record<string, string[]>;
  /** Müşteri formu ile aynı blok (personel müsait saat API’si) */
  appointmentFormRef?: PublishedAppointmentFormRef | null;
  /** Uygulayıcı rolü: yalnızca bu ada randevu eklenir */
  lockedStaffName?: string | null;
};

export function AppointmentForm({
  serviceOptions = [],
  schedule = null,
  serviceStaffMap = {},
  appointmentFormRef = null,
  lockedStaffName = null,
}: Props) {
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [serviceNameValue, setServiceNameValue] = useState("");
  const [staffNameValue, setStaffNameValue] = useState("");

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
  const eligibleStaff = useMemo(() => {
    const key = serviceNameValue.trim().toLocaleLowerCase("tr-TR");
    return serviceStaffMap[key] ?? [];
  }, [serviceNameValue, serviceStaffMap]);

  const locked = lockedStaffName?.trim() ?? "";

  useEffect(() => {
    if (locked) setStaffNameValue(locked);
  }, [locked]);

  const staffForSlots = locked || staffNameValue.trim();

  const [staffSlots, setStaffSlots] = useState<string[] | null>(null);
  const [staffSlotsLoading, setStaffSlotsLoading] = useState(false);

  useEffect(() => {
    if (!staffForSlots || !appointmentFormRef) {
      setStaffSlots(null);
      setStaffSlotsLoading(false);
      return;
    }
    if (!apptDate) {
      setStaffSlots(null);
      setStaffSlotsLoading(false);
      return;
    }
    let cancelled = false;
    setStaffSlotsLoading(true);
    const params = new URLSearchParams({
      date: apptDate,
      staff: staffForSlots,
      blockId: appointmentFormRef.blockId,
      formContext: appointmentFormRef.formContext,
    });
    if (appointmentFormRef.pageSlug) params.set("pageSlug", appointmentFormRef.pageSlug);
    fetch(`/api/appointments/availability?${params}`)
      .then((r) => r.json())
      .then((j: { ok?: boolean; slots?: string[] }) => {
        if (cancelled) return;
        setStaffSlots(Array.isArray(j.slots) ? j.slots : []);
      })
      .catch(() => {
        if (!cancelled) setStaffSlots([]);
      })
      .finally(() => {
        if (!cancelled) setStaffSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apptDate, staffForSlots, appointmentFormRef]);

  const effectiveSlots = useMemo(() => {
    if (!staffForSlots || !appointmentFormRef) return timeSlotLabels;
    return staffSlots ?? [];
  }, [staffForSlots, appointmentFormRef, timeSlotLabels, staffSlots]);

  useEffect(() => {
    if (!effectiveSlots.includes(apptTime)) setApptTime("");
  }, [effectiveSlots, apptTime]);

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
    if (!isValidTurkeyMobileAppointmentPhone(phone)) {
      setFeedback({ text: appointmentPhoneTurkeyHint(), error: true });
      return;
    }
    if (!effectiveSlots.includes(time)) {
      setFeedback({ text: "Seçilen saat bu takvim veya personel müsaitliği için geçerli değil.", error: true });
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
      setServiceNameValue(v);
    } else {
      serviceName = String(fd.get("serviceNameFree") ?? "").trim();
      if (!serviceName) {
        setFeedback({ text: "Hizmet adı girin.", error: true });
        return;
      }
      setServiceNameValue(serviceName);
    }
    const staffName =
      locked ||
      (String(fd.get("staffName") ?? "").trim() || null);

    const end = new Date(start.getTime() + slotDur * 60_000);
    const body = {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      serviceName,
      clientName: name,
      clientEmail: String(fd.get("clientEmail") ?? "").trim() || null,
      clientPhone: phone,
      notes: String(fd.get("notes") ?? "").trim() || null,
      staffName,
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
      setServiceNameValue("");
      setStaffNameValue("");
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
            value={serviceNameValue}
            onChange={(e) => {
              setServiceNameValue(e.target.value);
              setStaffNameValue("");
            }}
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
            value={serviceNameValue}
            onChange={(e) => {
              setServiceNameValue(e.target.value);
              setStaffNameValue("");
            }}
            placeholder="Örn. Cilt bakımı"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      )}
      {eligibleStaff.length > 0 ? (
        locked ? (
          <>
            <input type="hidden" name="staffName" value={locked} />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Personel: <span className="font-medium text-zinc-900 dark:text-zinc-100">{locked}</span> (hesabınız)
            </p>
          </>
        ) : (
          <label className="text-sm text-zinc-700 dark:text-zinc-300">
            Personel
            <select
              name="staffName"
              value={staffNameValue}
              onChange={(e) => setStaffNameValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Müsait personel otomatik ata</option>
              {eligibleStaff.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )
      ) : locked ? (
        <>
          <input type="hidden" name="staffName" value={locked} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Personel: <span className="font-medium text-zinc-900 dark:text-zinc-100">{locked}</span> (hesabınız)
          </p>
        </>
      ) : null}

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
            {staffSlotsLoading && staffForSlots && appointmentFormRef ? (
              <option value="" disabled>
                Saatler yükleniyor…
              </option>
            ) : null}
            {effectiveSlots.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {apptDate && effectiveSlots.length === 0 && !staffSlotsLoading ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Bu tarihte salon kapalı, uygun slot yok veya seçili personel için müsait saat kalmadı.
        </p>
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
          inputMode="tel"
          autoComplete="tel"
          maxLength={APPOINTMENT_PHONE_INPUT_MAX_LENGTH}
          placeholder="Örn. 05325717714"
          onInvalid={(e) => {
            const el = e.currentTarget;
            el.setCustomValidity(
              el.validity.valueMissing ? "Telefon boş bırakılamaz." : appointmentPhoneTurkeyHint(),
            );
          }}
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
