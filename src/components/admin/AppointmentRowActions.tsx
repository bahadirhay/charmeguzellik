"use client";

import { useState } from "react";

function statusLabelTr(status: string): string {
  if (status === "pending") return "Bekliyor";
  if (status === "approved") return "Onaylı";
  if (status === "rejected") return "Reddedildi";
  return status;
}

type Notify = {
  emailSent?: boolean;
  emailError?: string | null;
  emailSkipped?: boolean;
  whatsappUrl?: string | null;
  mailtoUrl?: string | null;
};

export function AppointmentRowActions(props: {
  id: string;
  serviceName: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  status: string;
}) {
  const [localStatus, setLocalStatus] = useState(props.status);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notify, setNotify] = useState<Notify | null>(null);

  const isPending = localStatus === "pending";

  async function decide(status: "approved" | "rejected") {
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
        setFeedback("Müşteri e-postası kayıtta yok veya sunucu e-postası yapılandırılmadı (aşağıdan manuel gönderebilirsiniz).");
      } else {
        setFeedback(null);
      }

      if (n?.whatsappUrl) {
        window.open(n.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
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
      </div>
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
