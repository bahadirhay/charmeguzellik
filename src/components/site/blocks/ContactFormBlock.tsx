"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { findNavParentForServicesMenu, type NavNode } from "@/lib/navigation-shared";
import {
  DEFAULT_APPOINTMENT_TIMEZONE,
  mergeAppointmentDays,
  naiveLocalToAppointmentIso,
  slotStartLabelsForCalendarDate,
  todayYmdInTimeZone,
  type AppointmentDaySchedule,
} from "@/lib/appointment-schedule";
import type { ContactFormContext } from "@/lib/contact-form-resolve";
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";
import { formatTryFromMinor } from "@/lib/commerce/format-money";

const DEFAULT_APPOINTMENT_PRIVACY_HREF = "https://charmeguzellik.com/gizlilik-sozlesmesi";

type ServiceOption = { id: string; label: string };
type ConsentItem = {
  id: string;
  label: string;
  href?: string;
  openInNewTab?: boolean;
  required?: boolean;
  checkedByDefault?: boolean;
};

type Props = {
  title?: string;
  successMessage?: string;
  mode?: "contact" | "appointment";
  serviceOptions?: ServiceOption[];
  serviceNavMenuSlug?: "header" | "footer";
  /** false: yalnızca serviceNavParentId; aksi (varsayılan): «Hizmetlerimiz» alt linkleri otomatik */
  serviceNavUseAuto?: boolean;
  serviceNavParentId?: string;
  slotDurationMinutes?: number;
  submitLabel?: string;
  appointmentShowService?: boolean;
  appointmentShowEmail?: boolean;
  appointmentShowPhone?: boolean;
  appointmentShowMessage?: boolean;
  contactShowEmail?: boolean;
  contactShowPhone?: boolean;
  contactShowMessage?: boolean;
  appointmentConsentItems?: ConsentItem[];
  /** Boşsa varsayılan canlı gizlilik sayfası */
  appointmentPrivacyPolicyHref?: string;
  contactConsentItems?: ConsentItem[];
  appointmentTimeZone?: string;
  appointmentDays?: AppointmentDaySchedule[];
  blockId?: string;
  pageSlug?: string | null;
  formContext?: ContactFormContext;
  /** Editör canlı önizlemesinde gönderim kapalı */
  previewDisabled?: boolean;
  /** Yalnızca admin önizlemesi: menü/hizmet kaynağı yapılandırma uyarıları */
  showConfigHints?: boolean;
  /** Randevu: hizmet seçiminde fiyat göster (liste + kayıtlı telefonda özel fiyat). Açıkça `false` değilse varsayılan açıktır. */
  appointmentShowServicePrices?: boolean;
};

function on(prop: boolean | undefined): boolean {
  return prop !== false;
}

function findNavNode(nodes: NavNode[], id: string): NavNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inner = findNavNode(n.children, id);
    if (inner) return inner;
  }
  return null;
}

export function ContactFormBlock({
  title,
  successMessage,
  mode = "contact",
  serviceOptions = [],
  serviceNavMenuSlug = "header",
  serviceNavUseAuto,
  serviceNavParentId,
  slotDurationMinutes = 60,
  submitLabel,
  appointmentShowService,
  appointmentShowEmail,
  appointmentShowPhone,
  appointmentShowMessage,
  contactShowEmail,
  contactShowPhone,
  contactShowMessage,
  appointmentConsentItems = [],
  appointmentPrivacyPolicyHref,
  contactConsentItems = [],
  appointmentTimeZone,
  appointmentDays,
  blockId,
  pageSlug,
  formContext = "page",
  previewDisabled,
  showConfigHints,
  appointmentShowServicePrices,
}: Props) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [navTree, setNavTree] = useState<NavNode[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [serviceStaffMap, setServiceStaffMap] = useState<Record<string, string[]>>({});
  const [phoneForPricing, setPhoneForPricing] = useState("");
  const [servicePriceLabels, setServicePriceLabels] = useState<Record<string, string>>({});
  const clearAppointmentSubmitFeedback = useCallback(() => {
    setSubmitError(null);
    setStatus("idle");
  }, []);

  const isAppointment = mode === "appointment";
  const showApptService = isAppointment && on(appointmentShowService);
  /** Eski sayfalarda alan yoktu; açıkça kapatılmadıysa randevu formunda fiyat gösterilir. */
  const showApptServicePrices = isAppointment && showApptService && appointmentShowServicePrices !== false;
  const showApptEmail = isAppointment && on(appointmentShowEmail);
  // Randevu talebinde telefon zorunlu: alan her zaman görünür.
  const showApptPhone = isAppointment;
  const showApptMessage = isAppointment && on(appointmentShowMessage);
  const showContactEmail = !isAppointment && on(contactShowEmail);
  const showContactPhone = !isAppointment && on(contactShowPhone);
  const showContactMessage = !isAppointment && on(contactShowMessage);
  const currentConsentItems = isAppointment ? appointmentConsentItems : contactConsentItems;
  const appointmentPrivacyHref = (appointmentPrivacyPolicyHref?.trim() || DEFAULT_APPOINTMENT_PRIVACY_HREF).trim();

  const useAutoNav = serviceNavUseAuto !== false;

  /** Sunucu doğrulaması için slug — PublicBlocks bazen pageSlug iletmez; URL’den yedek */
  const resolvedPageSlug =
    formContext === "page"
      ? (pageSlug?.trim() || pathname?.split("/").filter(Boolean)[0] || "")
      : "";

  const mergedDays = useMemo(() => mergeAppointmentDays(appointmentDays), [appointmentDays]);
  const tz = (appointmentTimeZone?.trim() || DEFAULT_APPOINTMENT_TIMEZONE) as string;
  const minYmd = useMemo(() => todayYmdInTimeZone(tz), [tz]);
  const maxYmd = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + 120);
    return base.toISOString().slice(0, 10);
  }, []);

  const timeSlotLabels = useMemo(
    () =>
      apptDate
        ? slotStartLabelsForCalendarDate(apptDate, mergedDays, slotDurationMinutes, tz)
        : [],
    [apptDate, mergedDays, slotDurationMinutes, tz],
  );

  const staffForSlots = selectedStaff.trim();

  const [staffSlots, setStaffSlots] = useState<string[] | null>(null);
  const [staffSlotsLoading, setStaffSlotsLoading] = useState(false);

  useEffect(() => {
    if (!isAppointment || !staffForSlots || !blockId?.trim()) {
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
      blockId: blockId ?? "",
      formContext,
    });
    if (resolvedPageSlug) params.set("pageSlug", resolvedPageSlug);
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
  }, [isAppointment, apptDate, staffForSlots, blockId, formContext, resolvedPageSlug]);

  const hasStaffSlotFilter =
    isAppointment && Boolean(staffForSlots) && Boolean(blockId?.trim());

  const isStaffSlotUnavailable = useCallback(
    (slot: string) => {
      if (!hasStaffSlotFilter) return false;
      if (!staffSlots) return false;
      return !staffSlots.includes(slot);
    },
    [hasStaffSlotFilter, staffSlots],
  );

  /** Takvimdeki tüm slotlar — personel seçiliyken dolular da listelenir, seçilemez. */
  const visibleTimeSlots = timeSlotLabels;

  /** Gönderim / seçim doğrulaması: personel seçiliyse yalnızca API’nin döndürdüğü boş saatler. */
  const selectableSlots = useMemo(() => {
    if (!hasStaffSlotFilter) return timeSlotLabels;
    return staffSlots ?? [];
  }, [hasStaffSlotFilter, timeSlotLabels, staffSlots]);

  useEffect(() => {
    if (!selectableSlots.includes(apptTime)) setApptTime("");
  }, [selectableSlots, apptTime]);

  useEffect(() => {
    if (!isAppointment || !showApptService) {
      setNavTree([]);
      return;
    }
    let cancelled = false;
    setNavLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/nav/${serviceNavMenuSlug}`, { cache: "no-store" });
        const j = (await res.json()) as { nodes?: NavNode[]; error?: string };
        if (!cancelled) setNavTree(res.ok && j.nodes ? j.nodes : []);
      } catch {
        if (!cancelled) setNavTree([]);
      } finally {
        if (!cancelled) setNavLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAppointment, showApptService, serviceNavMenuSlug]);
  useEffect(() => {
    if (!isAppointment) return;
    let cancelled = false;
    fetch("/api/appointments/staffing", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((j: { ok?: boolean; map?: Record<string, string[]> }) => {
        if (!cancelled && j.ok && j.map && typeof j.map === "object") setServiceStaffMap(j.map);
      })
      .catch(() => {
        if (!cancelled) setServiceStaffMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [isAppointment]);

  const navParent = useMemo(() => {
    if (!navTree.length) return null;
    if (serviceNavParentId) {
      const ex = findNavNode(navTree, serviceNavParentId);
      if (ex && ex.children.length > 0) return ex;
    }
    return useAutoNav ? findNavParentForServicesMenu(navTree) : null;
  }, [navTree, serviceNavParentId, useAutoNav]);

  const navServiceOptions: ServiceOption[] = useMemo(
    () => (navParent?.children ?? []).map((c) => ({ id: `nav:${c.id}`, label: c.label })),
    [navParent],
  );

  const manualServiceOptions = useMemo(
    () => serviceOptions.filter((s) => s.label.trim()),
    [serviceOptions],
  );

  const selectOptions: ServiceOption[] = useMemo(
    () => [...navServiceOptions, ...manualServiceOptions],
    [navServiceOptions, manualServiceOptions],
  );
  const selectedServiceLabel = useMemo(
    () => selectOptions.find((s) => s.id === selectedServiceId)?.label?.trim() ?? "",
    [selectOptions, selectedServiceId],
  );
  const eligibleStaff = useMemo(() => {
    const key = selectedServiceLabel.toLocaleLowerCase("tr-TR");
    return serviceStaffMap[key] ?? [];
  }, [selectedServiceLabel, serviceStaffMap]);

  useEffect(() => {
    if (selectedStaff && !eligibleStaff.includes(selectedStaff)) {
      setSelectedStaff("");
    }
  }, [eligibleStaff, selectedStaff]);

  const showNavLoading = isAppointment && showApptService && navLoading;

  const onClientPhoneBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      if (!showApptPhone || previewDisabled) return;
      const raw = e.currentTarget.value.trim();
      setPhoneForPricing(raw);
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
    [showApptPhone, previewDisabled],
  );

  const serviceLabelsKey = useMemo(
    () => selectOptions.map((o) => `${o.id}:${o.label}`).join("|"),
    [selectOptions],
  );

  useEffect(() => {
    if (!showApptServicePrices || previewDisabled || selectOptions.length === 0) {
      setServicePriceLabels({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/appointments/service-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labels: selectOptions.map((o) => o.label),
            phone: phoneForPricing.trim() || null,
          }),
        });
        const j = (await res.json()) as {
          ok?: boolean;
          prices?: { label: string; priceMinor: number | null; source: string | null }[];
        };
        if (cancelled || !res.ok || !j.prices) return;
        const m: Record<string, string> = {};
        for (const p of j.prices) {
          if (p.priceMinor == null) continue;
          const tag = p.source === "override" ? " (size özel)" : "";
          m[p.label] = ` — ${formatTryFromMinor(p.priceMinor)}${tag}`;
        }
        setServicePriceLabels(m);
      } catch {
        if (!cancelled) setServicePriceLabels({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showApptServicePrices, previewDisabled, serviceLabelsKey, phoneForPricing]);

  async function onSubmitContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: String(fd.get("name") ?? ""),
      email: showContactEmail ? String(fd.get("email") ?? "") : "",
      phone: showContactPhone ? String(fd.get("phone") ?? "") : "",
      message: showContactMessage ? String(fd.get("message") ?? "") : "",
      consentAccepted: fd.getAll("consentAccepted").map((x) => String(x)),
    };
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setStatus(res.ok ? "ok" : "err");
    if (res.ok) form.reset();
  }

  async function onSubmitAppointment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSubmitError(null);
    const fd = new FormData(form);
    const name = String(fd.get("clientName") ?? "").trim();
    const phoneInput = form.elements.namedItem("clientPhone") as HTMLInputElement | null;
    const phone = String(fd.get("clientPhone") ?? "").trim();
    const date = String(fd.get("apptDate") ?? "").trim();
    const time = String(fd.get("apptTime") ?? "").trim();
    if (phoneInput && !phone) {
      phoneInput.setCustomValidity("Telefon boş bırakılamaz.");
      phoneInput.reportValidity();
      return;
    }
    if (phoneInput && phone && !isValidTurkeyMobileAppointmentPhone(phone)) {
      phoneInput.setCustomValidity(appointmentPhoneTurkeyHint());
      phoneInput.reportValidity();
      return;
    }
    if (phoneInput) {
      phoneInput.setCustomValidity("");
    }
    if (fd.get("privacyPolicyAccepted") !== "yes") {
      setSubmitError("Randevu talebi göndermek için gizlilik sözleşmesini okuyup kabul etmelisiniz.");
      setStatus("err");
      return;
    }
    const preferredIso = naiveLocalToAppointmentIso(date, time, tz);
    const consentAccepted = fd.getAll("consentAccepted").map((x) => String(x));
    const acceptedLabels = [
      ...currentConsentItems
        .filter((c) => consentAccepted.includes(c.id))
        .map((c) => c.label.trim())
        .filter(Boolean),
      "Gizlilik sözleşmesi kabul edildi",
    ];
    const start = new Date(preferredIso);
    if (!name || !phone || !date || !time || Number.isNaN(start.getTime())) {
      setStatus("err");
      return;
    }
    if (!timeSlotLabels.includes(time)) {
      setStatus("err");
      return;
    }
    if (hasStaffSlotFilter) {
      if (!staffSlots) {
        setSubmitError("Personel müsaitliği yükleniyor veya alınamadı; birkaç saniye sonra yeniden deneyin.");
        setStatus("err");
        return;
      }
      if (!staffSlots.includes(time)) {
        setSubmitError("Bu saat seçili personel için dolu.");
        setStatus("err");
        return;
      }
    }

    let serviceId: string | null = null;
    let serviceLabel: string | null = null;

    if (showApptService) {
      const sid = String(fd.get("serviceId") ?? "").trim();
      if (!sid) {
        setStatus("err");
        return;
      }
      const opt = selectOptions.find((s) => s.id === sid);
      if (!opt) {
        setStatus("err");
        return;
      }
      serviceId = sid;
      serviceLabel = opt.label.trim();
    } else {
      serviceId = null;
      serviceLabel = "Belirtilmedi";
    }

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: name,
        clientEmail: showApptEmail ? String(fd.get("clientEmail") ?? "").trim() || null : null,
        clientPhone: String(fd.get("clientPhone") ?? "").trim() || null,
        serviceId,
        serviceLabel,
        preferredStart: start.toISOString(),
        message: showApptMessage ? String(fd.get("message") ?? "").trim() || null : null,
        consentAccepted: acceptedLabels,
        durationMinutes: slotDurationMinutes,
        website: String(fd.get("website") ?? ""),
        formContext,
        pageSlug: resolvedPageSlug,
        blockId: blockId ?? "",
        staffName: String(fd.get("staffName") ?? "").trim() || null,
      }),
    });
    let j: { ok?: boolean; error?: string } = {};
    try {
      j = (await res.json()) as typeof j;
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      const fromServer = typeof j.error === "string" && j.error.trim() ? j.error.trim() : "";
      setSubmitError(
        fromServer ||
          (res.status === 409
            ? "Bu bilgilerle aynı hizmet ve saatte zaten talep var."
            : "Gönderilemedi. Tarih/saat veya bağlantıyı kontrol edin; sayfayı yenileyip tekrar deneyin."),
      );
      setStatus("err");
      return;
    }
    setStatus("ok");
    form.reset();
    setApptDate("");
    setApptTime("");
    setSelectedServiceId("");
    setSelectedStaff("");
    setPhoneForPricing("");
  }

  if (previewDisabled) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
        {title ? <h2 className="mb-2 font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2> : null}
        <p>
          {isAppointment
            ? "Randevu formu önizlemesi — gönderim yalnızca yayında çalışır. Çalışma saatleri ve alanları soldan ayarlayın."
            : "İletişim formu önizlemesi — gönderim yalnızca yayında çalışır."}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {title ? (
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      ) : null}
      {status === "ok" ? (
        <div className="space-y-2">
          <p className="text-emerald-600 dark:text-emerald-400">
            {successMessage ??
              (isAppointment
                ? "Randevu talebiniz alındı. Onay için sizinle iletişime geçeceğiz."
                : "Mesajınız alındı. En kısa sürede dönüş yapacağız.")}
          </p>
        </div>
      ) : isAppointment ? (
        <form className="flex flex-col gap-3 text-left" onSubmit={onSubmitAppointment}>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <label className="text-sm text-zinc-700 dark:text-zinc-300">
            Ad Soyad
            <input
              name="clientName"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          {showNavLoading ? <p className="text-xs text-zinc-500">Hizmet listesi yükleniyor…</p> : null}
          {showApptService ? (
            <>
              <label className="text-sm text-zinc-700 dark:text-zinc-300">
                İstenen hizmet
                <select
                  name="serviceId"
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  value={selectedServiceId}
                  onChange={(e) => {
                    clearAppointmentSubmitFeedback();
                    setSelectedServiceId(e.target.value);
                    setSelectedStaff("");
                  }}
                >
                  <option value="" disabled>
                    Seçin…
                  </option>
                  {navServiceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {servicePriceLabels[s.label] ?? ""}
                    </option>
                  ))}
                  {manualServiceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {servicePriceLabels[s.label] ?? ""}
                    </option>
                  ))}
                </select>
                {selectedServiceLabel && showApptServicePrices && servicePriceLabels[selectedServiceLabel] ? (
                  <p className="mt-1.5 text-sm text-zinc-800 dark:text-zinc-200" aria-live="polite">
                    <span className="font-medium">Fiyat</span>
                    {servicePriceLabels[selectedServiceLabel]}
                  </p>
                ) : selectedServiceLabel &&
                  showApptServicePrices &&
                  !servicePriceLabels[selectedServiceLabel] &&
                  showConfigHints ? (
                  <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-200">
                    Bu hizmet için yayınlanmış liste fiyatı yok. Ticaret → Liste fiyatlarından ekleyip «Yayınla» ile
                    aktifleştirin.
                  </p>
                ) : null}
              </label>
              {showConfigHints && !navLoading && navParent && navServiceOptions.length === 0 ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  «{navParent.label}» altında yayınlı alt link yok. Menüye alt öğe ekleyin veya blokta{" "}
                  <strong>Manuel ek hizmetler</strong> listesine satır ekleyin.
                </p>
              ) : null}
              {showConfigHints && !navLoading && !navParent && useAutoNav ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  Üst menüde «Hizmetlerimiz» başlıklı bir öğe bulunamadı. Admin’de menüyü düzenleyin veya blokta{" "}
                  <strong>Manuel</strong> kaynak seçin.
                </p>
              ) : null}
              {showApptServicePrices && showConfigHints ? (
                <p className="text-[11px] text-zinc-500">
                  Fiyatlar yönetim panelindeki liste ve müşteri özel fiyatından gelir. Kayıtlı numaranız varsa telefonu
                  girip alandan çıkınca size özel tutarlar güncellenir.
                </p>
              ) : null}
              {eligibleStaff.length > 0 ? (
                <label className="text-sm text-zinc-700 dark:text-zinc-300">
                  Uygun personel
                  <select
                    name="staffName"
                    value={selectedStaff}
                    onChange={(e) => {
                      clearAppointmentSubmitFeedback();
                      setSelectedStaff(e.target.value);
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    <option value="">Müsait personele otomatik ata</option>
                    {eligibleStaff.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
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
                  clearAppointmentSubmitFeedback();
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
                disabled={Boolean(apptDate && hasStaffSlotFilter && staffSlotsLoading)}
                value={apptTime}
                onChange={(e) => {
                  clearAppointmentSubmitFeedback();
                  setApptTime(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">{apptDate ? "Saat seçin…" : "Önce tarih seçin"}</option>
                {staffSlotsLoading && hasStaffSlotFilter ? (
                  <option value="" disabled>
                    Saatler yükleniyor…
                  </option>
                ) : null}
                {visibleTimeSlots.map((t) => (
                  <option key={t} value={t} disabled={isStaffSlotUnavailable(t)}>
                    {isStaffSlotUnavailable(t) ? `${t} (dolu)` : t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {apptDate && visibleTimeSlots.length === 0 ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Bu tarihte salon kapalı veya tanımlı çalışma aralığında slot yok.
            </p>
          ) : null}
          {apptDate &&
          hasStaffSlotFilter &&
          staffSlots &&
          staffSlots.length === 0 &&
          visibleTimeSlots.length > 0 ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Seçilen personelin bu tarihte müsait saati kalmadı; dolu saatler listede pasif olarak gösterilir.
            </p>
          ) : null}
          {showApptEmail ? (
            <label className="text-sm text-zinc-700 dark:text-zinc-300">
              E-posta
              <input
                name="clientEmail"
                type="email"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          ) : null}
          {showApptPhone ? (
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
          ) : null}
          {showApptMessage ? (
            <label className="text-sm text-zinc-700 dark:text-zinc-300">
              Not (opsiyonel)
              <textarea
                name="message"
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          ) : null}
          {currentConsentItems.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
              {currentConsentItems.map((c) => (
                <label key={c.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="consentAccepted"
                    value={c.id}
                    required={c.required === true}
                    defaultChecked={c.checkedByDefault !== false}
                    className="mt-0.5"
                  />
                  <span>
                    {c.label}
                    {c.href ? (
                      <>
                        {" "}
                        <a
                          href={c.href}
                          className="text-rose-600 underline"
                          {...(c.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          bağlantı
                        </a>
                      </>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left text-xs dark:border-zinc-700 dark:bg-zinc-900">
            <p>
              <a
                href={appointmentPrivacyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-rose-600 underline decoration-rose-400 underline-offset-2 hover:text-rose-700"
              >
                Gizlilik sözleşmesi
              </a>
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                name="privacyPolicyAccepted"
                value="yes"
                defaultChecked
                className="mt-0.5 shrink-0"
              />
              <span>Yukarıdaki gizlilik sözleşmesini okudum ve kabul ediyorum.</span>
            </label>
          </div>
          {status === "err" ? (
            <div className="space-y-1 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              <p className="font-medium">Gönderilemedi</p>
              {submitError ? <p className="text-xs leading-relaxed">{submitError}</p> : null}
              <p className="text-xs text-red-700/90 dark:text-red-200/90">
                Tarih ve saatin çalışma saatlerinde olduğundan emin olun; gerekirse sayfayı yenileyin.
              </p>
            </div>
          ) : null}
          <button
            type="submit"
            className="mt-2 self-center rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            {submitLabel ?? "Randevu talep et"}
          </button>
        </form>
      ) : (
        <form className="flex flex-col gap-3 text-left" onSubmit={onSubmitContact}>
          <label className="text-sm text-zinc-700 dark:text-zinc-300">
            Ad Soyad
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          {showContactEmail ? (
            <label className="text-sm text-zinc-700 dark:text-zinc-300">
              E-posta
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          ) : null}
          {showContactPhone ? (
            <label className="text-sm text-zinc-700 dark:text-zinc-300">
              Telefon
              <input
                name="phone"
                type="tel"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          ) : null}
          {showContactMessage ? (
            <label className="text-sm text-zinc-700 dark:text-zinc-300">
              Mesaj
              <textarea
                name="message"
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          ) : null}
          {currentConsentItems.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
              {currentConsentItems.map((c) => (
                <label key={c.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="consentAccepted"
                    value={c.id}
                    required={c.required === true}
                    defaultChecked={c.checkedByDefault !== false}
                    className="mt-0.5"
                  />
                  <span>
                    {c.label}
                    {c.href ? (
                      <>
                        {" "}
                        <a
                          href={c.href}
                          className="text-rose-600 underline"
                          {...(c.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          bağlantı
                        </a>
                      </>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          {status === "err" ? (
            <p className="text-sm text-red-600">Gönderilemedi. Lütfen tekrar deneyin.</p>
          ) : null}
          <button
            type="submit"
            className="mt-2 self-center rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            {submitLabel ?? "Gönder"}
          </button>
        </form>
      )}
    </section>
  );
}
