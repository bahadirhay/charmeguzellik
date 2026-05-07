"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";
import { AdminWhatsAppButton } from "@/components/admin/AdminWhatsAppButton";
import { waPrefillForAppointment } from "@/lib/admin-whatsapp-prefill";

function statusLabelTr(status: string): string {
  if (status === "pending") return "Bekliyor";
  if (status === "approved") return "Onaylı";
  if (status === "cancel_request") return "İptal talebi";
  if (status === "rejected") return "Reddedildi";
  if (status === "cancelled") return "İptal";
  return status;
}

type Notify = {
  emailSent?: boolean;
  emailError?: string | null;
  emailSkipped?: boolean;
  whatsappUrl?: string | null;
  mailtoUrl?: string | null;
};

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentRowActions(props: {
  id: string;
  startAtIso: string;
  serviceName: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  notes: string | null;
  status: string;
  serviceOptions: string[];
}) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState(props.status);
  const [busy, setBusy] = useState(false);
  const [busyEdit, setBusyEdit] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notify, setNotify] = useState<Notify | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftStart, setDraftStart] = useState(() => toDatetimeLocalValue(props.startAtIso));
  const [draftName, setDraftName] = useState(props.clientName);
  const [draftEmail, setDraftEmail] = useState(props.clientEmail ?? "");
  const [draftPhone, setDraftPhone] = useState(props.clientPhone ?? "");
  const [draftService, setDraftService] = useState(props.serviceName ?? "");
  const [draftNotes, setDraftNotes] = useState(props.notes ?? "");

  const isPending = localStatus === "pending";
  const hasServiceList = props.serviceOptions.length > 0;

  const phoneForWa = editing ? draftPhone : props.clientPhone ?? "";
  const waPrefillMessage = waPrefillForAppointment(props.clientName, props.startAtIso, props.serviceName);

  useEffect(() => {
    setLocalStatus(props.status);
  }, [props.status]);

  function openEdit() {
    setDraftStart(toDatetimeLocalValue(props.startAtIso));
    setDraftName(props.clientName);
    setDraftEmail(props.clientEmail ?? "");
    setDraftPhone(props.clientPhone ?? "");
    setDraftService(props.serviceName ?? "");
    setDraftNotes(props.notes ?? "");
    setFeedback(null);
    setEditing(true);
  }

  async function decide(status: "approved" | "rejected" | "cancelled" | "cancel_request") {
    setBusy(true);
    setFeedback(null);
    setNotify(null);
    try {
      const res = await fetch(`/api/admin/appointments/${props.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        notifications?: Notify;
      };
      if (!res.ok) {
        setFeedback(j.error ?? "İşlem başarısız");
        return;
      }
      setLocalStatus(status);
      const n = j.notifications;
      setNotify(n ?? null);

      if (n?.emailSent) {
        setFeedback("Müşteriye e-posta gönderildi.");
      } else if (n?.emailError) {
        setFeedback(`E-posta gönderilemedi: ${n.emailError}`);
      } else if (n?.emailSkipped) {
        setFeedback(
          "Müşteri e-postası kayıtta yok veya sunucu e-postası yapılandırılmadı (aşağıdan manuel gönderebilirsiniz).",
        );
      } else {
        setFeedback(null);
      }

      if (n?.whatsappUrl) {
        window.open(n.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusyEdit(true);
    setFeedback(null);
    try {
      const start = new Date(draftStart);
      if (Number.isNaN(start.getTime())) {
        setFeedback("Geçerli bir başlangıç tarihi/saati seçin.");
        return;
      }
      if (!draftName.trim()) {
        setFeedback("Müşteri adı gerekli.");
        return;
      }
      const phone = draftPhone.trim();
      if (!phone) {
        setFeedback("Telefon boş bırakılamaz.");
        return;
      }
      if (!isValidTurkeyMobileAppointmentPhone(phone)) {
        setFeedback(appointmentPhoneTurkeyHint());
        return;
      }
      if (hasServiceList && !draftService.trim()) {
        setFeedback("Hizmet seçin.");
        return;
      }

      const res = await fetch(`/api/admin/appointments/${props.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          startAt: start.toISOString(),
          clientName: draftName.trim(),
          clientEmail: draftEmail.trim() || null,
          clientPhone: phone,
          serviceName: hasServiceList ? draftService.trim() : draftService.trim() || null,
          notes: draftNotes.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setFeedback(j.error ?? "Kayıt güncellenemedi");
        return;
      }
      setEditing(false);
      setFeedback("Güncellendi.");
      router.refresh();
    } finally {
      setBusyEdit(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {statusLabelTr(localStatus)}
        </span>
        {isPending ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("approved")}
              className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "…" : "Onayla"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("rejected")}
              className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Reddet
            </button>
          </>
        ) : null}
        {localStatus === "approved" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide("cancel_request")}
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            İptal talebi başlat
          </button>
        ) : null}
        {localStatus === "cancel_request" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide("cancelled")}
            className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            İptali onayla
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || busyEdit}
          onClick={() => (editing ? setEditing(false) : openEdit())}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {editing ? "Kapat" : "Düzenle"}
        </button>
        <AdminWhatsAppButton phone={phoneForWa} prefilledMessage={waPrefillMessage} label="WhatsApp" />
      </div>

      {editing ? (
        <div className="mt-2 max-w-md space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950/50">
          <label className="grid gap-0.5">
            <span className="text-zinc-600 dark:text-zinc-400">Başlangıç</span>
            <input
              type="datetime-local"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
            />
          </label>
          <label className="grid gap-0.5">
            <span className="text-zinc-600 dark:text-zinc-400">Müşteri</span>
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </label>
          <label className="grid gap-0.5">
            <span className="text-zinc-600 dark:text-zinc-400">Telefon</span>
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              maxLength={APPOINTMENT_PHONE_INPUT_MAX_LENGTH}
              value={draftPhone}
              onChange={(e) => setDraftPhone(e.target.value)}
            />
          </label>
          <label className="grid gap-0.5">
            <span className="text-zinc-600 dark:text-zinc-400">E-posta</span>
            <input
              type="email"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
            />
          </label>
          {hasServiceList ? (
            <label className="grid gap-0.5">
              <span className="text-zinc-600 dark:text-zinc-400">Hizmet</span>
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={draftService}
                onChange={(e) => setDraftService(e.target.value)}
              >
                <option value="">—</option>
                {props.serviceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-0.5">
              <span className="text-zinc-600 dark:text-zinc-400">Hizmet</span>
              <input
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={draftService}
                onChange={(e) => setDraftService(e.target.value)}
                placeholder="İsteğe bağlı"
              />
            </label>
          )}
          <label className="grid gap-0.5">
            <span className="text-zinc-600 dark:text-zinc-400">Notlar</span>
            <textarea
              rows={3}
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busyEdit}
            onClick={() => void saveEdit()}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {busyEdit ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      ) : null}

      {feedback ? <p className="max-w-xs text-[11px] text-zinc-600 dark:text-zinc-400">{feedback}</p> : null}
      {notify && (notify.whatsappUrl || notify.mailtoUrl) ? (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {notify.whatsappUrl ? (
            <a
              href={notify.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              WhatsApp (müşteri)
            </a>
          ) : null}
          {notify.mailtoUrl ? (
            <a href={notify.mailtoUrl} className="font-medium text-rose-700 underline dark:text-rose-400">
              E-posta taslak (mailto)
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
