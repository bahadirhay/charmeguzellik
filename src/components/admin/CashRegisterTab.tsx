"use client";

import { useCallback, useEffect, useState } from "react";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { formatYmdIstanbul } from "@/lib/commerce/istanbul-day-bounds";
import {
  PACKAGE_PAYMENT_METHODS,
  packagePaymentMethodLabel,
} from "@/lib/commerce/package-payment-method";
import { moneyInputToMinor } from "@/lib/commerce/money-input-to-minor";

async function parseResponseJson<T>(r: Response): Promise<{ jsonError: string | null; data: T }> {
  const raw = await r.text();
  if (!raw.trim()) return { jsonError: null, data: {} as T };
  try {
    return { jsonError: null, data: JSON.parse(raw) as T };
  } catch {
    return { jsonError: "Sunucu yanıtı okunamadı (geçerli JSON değil)", data: {} as T };
  }
}

function toDatetimeLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocalToIso(local: string): string | null {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Randevu satırı — İstanbul saati, okunaklı. */
function formatApptWhenTr(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

function formatCashWhenTr(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

function appointmentStatusTr(status: string): string {
  switch (status) {
    case "pending":
      return "Bekliyor";
    case "confirmed":
      return "Onaylı";
    case "cancelled":
      return "İptal";
    case "completed":
      return "Tamamlandı";
    default:
      return status;
  }
}

type ApptHint = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  startAt: string;
  serviceName: string | null;
  quotedPriceMinor: number | null;
  status: string;
  crmContactId: string | null;
};

type ReportRow = {
  id: string;
  occurredAt: string;
  amountMinor: number;
  amountFormatted: string;
  method: string;
  methodLabel: string;
  memo: string | null;
  sourceKind: string;
  sourceKindLabel: string;
  appointment: { id: string; clientName: string; startAt: string } | null;
  crmContact: { id: string; name: string } | null;
  recordedBy: string | null;
};

type DayCloseRow = {
  id: string;
  businessDate: string;
  closedAt: string;
  expectedTotalMinor: number | null;
  expectedTotalFormatted: string | null;
  countedTotalMinor: number | null;
  countedTotalFormatted: string | null;
  varianceMinor: number | null;
  notes: string | null;
  staff: string | null;
};

export function CashRegisterTab({
  onError,
  onOk,
}: {
  onError: (s: string) => void;
  onOk: (s: string) => void;
}) {
  const todayYmd = formatYmdIstanbul(new Date());
  const weekAgo = formatYmdIstanbul(new Date(Date.now() - 7 * 86400000));
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(todayYmd);

  const [grandTotalFormatted, setGrandTotalFormatted] = useState("");
  const [totalsByMethod, setTotalsByMethod] = useState<Record<string, { formatted: string; label: string }>>({});
  const [byDay, setByDay] = useState<{ date: string; totalFormatted: string }[]>([]);
  const [receipts, setReceipts] = useState<ReportRow[]>([]);
  const [dayCloses, setDayCloses] = useState<DayCloseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [amtTry, setAmtTry] = useState("");
  const [method, setMethod] = useState<(typeof PACKAGE_PAYMENT_METHODS)[number]>("cash");
  const [memo, setMemo] = useState("");
  const [syncLedger, setSyncLedger] = useState(true);
  const [sourceKind, setSourceKind] = useState<"appointment" | "walk_in" | "manual">("manual");
  const [appointmentId, setAppointmentId] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<ApptHint | null>(null);
  const [occurredAtLocal, setOccurredAtLocal] = useState(() => toDatetimeLocalInputValue(new Date()));
  const [crmQ, setCrmQ] = useState("");
  const [crmHits, setCrmHits] = useState<{ id: string; name: string; phoneKey: string }[]>([]);
  const [crmContactId, setCrmContactId] = useState("");
  const [apptQ, setApptQ] = useState("");
  const [apptHits, setApptHits] = useState<ApptHint[]>([]);
  const [saving, setSaving] = useState(false);

  const [closeYmd, setCloseYmd] = useState(todayYmd);
  const [closeCountedTry, setCloseCountedTry] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/commerce/cash/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" },
      );
      const { jsonError, data: j } = await parseResponseJson<{
        ok?: boolean;
        error?: string;
        grandTotalFormatted?: string;
        totalsByMethod?: Record<string, { formatted: string; label: string }>;
        byDay?: { date: string; totalFormatted: string }[];
        receipts?: ReportRow[];
        dayCloses?: DayCloseRow[];
      }>(r);
      if (jsonError) {
        onError(jsonError);
        return;
      }
      if (!r.ok) {
        onError(j.error ?? "Rapor yüklenemedi");
        return;
      }
      setGrandTotalFormatted(j.grandTotalFormatted ?? "");
      setTotalsByMethod(j.totalsByMethod ?? {});
      setByDay(j.byDay ?? []);
      setReceipts(Array.isArray(j.receipts) ? j.receipts : []);
      setDayCloses(Array.isArray(j.dayCloses) ? j.dayCloses : []);
    } finally {
      setLoading(false);
    }
  }, [from, to, onError]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (crmQ.trim().length < 2) {
        setCrmHits([]);
        return;
      }
      const r = await fetch(`/api/admin/commerce/crm-search?q=${encodeURIComponent(crmQ.trim())}`);
      const { jsonError, data: j } = await parseResponseJson<{ items?: typeof crmHits }>(r);
      if (jsonError || !r.ok) setCrmHits([]);
      else setCrmHits(Array.isArray(j.items) ? j.items : []);
    }, 300);
    return () => clearTimeout(t);
  }, [crmQ]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (apptQ.trim().length < 2) {
        setApptHits([]);
        return;
      }
      const r = await fetch(`/api/admin/commerce/cash/appointment-hints?q=${encodeURIComponent(apptQ.trim())}`);
      const { jsonError, data: j } = await parseResponseJson<{ items?: ApptHint[] }>(r);
      if (jsonError || !r.ok) setApptHits([]);
      else setApptHits(Array.isArray(j.items) ? j.items : []);
    }, 300);
    return () => clearTimeout(t);
  }, [apptQ]);

  const downloadCsv = async () => {
    const r = await fetch(
      `/api/admin/commerce/cash/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { credentials: "same-origin" },
    );
    if (!r.ok) {
      const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
      onError(jsonError ?? j.error ?? "Dışa aktarma başarısız");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kasa-${from}_${to}.csv`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
    onOk("Excel (CSV) indirildi");
  };

  return (
    <div className="grid gap-6 text-sm">
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong>Kasa</strong> tahsilatın <strong>tarih/saat</strong>ini (paraın fiilen alındığı an) kaydeder; varsayılan
        şu andır — dün veya başka gün için aşağıdaki alanı değiştirmeniz yeterli. Rapor ve gün sonu bu tarihe göre
        gruplanır. Randevu satırında müşteri, saat (İstanbul), hizmet ve durum gösterilir; yanlış seçimi önlemek için
        kutudaki özeti kontrol edin. Müşteri seçiliyken isteğe bağlı olarak aynı tutar{" "}
        <strong className="text-zinc-800 dark:text-zinc-200">cariye tahsilat</strong> da yazılır. Dışa aktarım UTF-8
        CSV — Excel ile açılır.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="grid gap-1 text-xs">
          Başlangıç
          <input
            type="date"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Bitiş
          <input
            type="date"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-white dark:bg-zinc-200 dark:text-zinc-900"
          onClick={() => void loadReport()}
          disabled={loading}
        >
          {loading ? "Yükleniyor…" : "Raporu yenile"}
        </button>
        <button
          type="button"
          className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-600"
          onClick={() => void downloadCsv()}
        >
          Excel (CSV) indir
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Özet</h2>
        <p className="text-lg font-semibold text-rose-700 dark:text-rose-400">{grandTotalFormatted || "—"}</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(totalsByMethod).map(([k, v]) => (
            <span key={k} className="rounded-full border border-zinc-200 px-2 py-1 dark:border-zinc-700">
              {v.label}: {v.formatted}
            </span>
          ))}
        </div>
        {byDay.length ? (
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Günlük: </span>
            {byDay.map((d) => (
              <span key={d.date} className="mr-3 inline-block">
                {d.date}: {d.totalFormatted}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tahsilat gir</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            Tutar (₺)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={amtTry}
              onChange={(e) => setAmtTry(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Ödeme şekli
            <select
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof PACKAGE_PAYMENT_METHODS)[number])}
            >
              {PACKAGE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {packagePaymentMethodLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Kaynak
            <select
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={sourceKind}
              onChange={(e) => setSourceKind(e.target.value as typeof sourceKind)}
            >
              <option value="manual">Manuel</option>
              <option value="walk_in">Gel-al</option>
              <option value="appointment">Randevu</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Tahsilat tarihi / saati (İstanbul yerel)
            <input
              type="datetime-local"
              className="max-w-xs rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={occurredAtLocal}
              onChange={(e) => setOccurredAtLocal(e.target.value)}
            />
            <span className="text-[11px] text-zinc-500">
              Raporlarda bu zaman kullanılır; randevu tarihinden farklı olabilir (ör. ön gün ödeme).
            </span>
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Randevu ara (ad / id / tel)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={apptQ}
              onChange={(e) => setApptQ(e.target.value)}
              placeholder="En az 2 karakter — listeden seçin"
            />
            {apptHits.length ? (
              <ul className="max-h-56 overflow-auto rounded border border-zinc-200 text-xs dark:border-zinc-700">
                {apptHits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 border-b border-zinc-100 px-2 py-2 text-left last:border-b-0 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setAppointmentId(h.id);
                        setSelectedAppt(h);
                        setApptQ(`${h.clientName} — ${formatApptWhenTr(h.startAt)}`);
                        setApptHits([]);
                        if (h.crmContactId) setCrmContactId(h.crmContactId);
                        setSourceKind("appointment");
                      }}
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{h.clientName}</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{formatApptWhenTr(h.startAt)}</span>
                      <span className="text-[11px] text-zinc-500">
                        {h.serviceName ? `${h.serviceName} · ` : ""}
                        {appointmentStatusTr(h.status)}
                        {h.quotedPriceMinor != null ? ` · Liste: ${formatTryFromMinor(h.quotedPriceMinor)}` : ""}
                        {h.clientPhone ? ` · ${h.clientPhone}` : ""}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400" title={h.id}>
                        Kimlik: {h.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedAppt && appointmentId ? (
              <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">Seçilen randevu (kontrol)</p>
                <ul className="grid gap-1 text-emerald-900/90 dark:text-emerald-100/90">
                  <li>
                    <span className="text-zinc-500 dark:text-emerald-200/70">Müşteri: </span>
                    {selectedAppt.clientName}
                  </li>
                  <li>
                    <span className="text-zinc-500 dark:text-emerald-200/70">Tarih / saat: </span>
                    {formatApptWhenTr(selectedAppt.startAt)}
                  </li>
                  <li>
                    <span className="text-zinc-500 dark:text-emerald-200/70">Hizmet: </span>
                    {selectedAppt.serviceName ?? "—"}
                  </li>
                  <li>
                    <span className="text-zinc-500 dark:text-emerald-200/70">Durum: </span>
                    {appointmentStatusTr(selectedAppt.status)}
                  </li>
                  <li>
                    <span className="text-zinc-500 dark:text-emerald-200/70">Form fiyatı: </span>
                    {selectedAppt.quotedPriceMinor != null ? formatTryFromMinor(selectedAppt.quotedPriceMinor) : "—"}
                  </li>
                  {selectedAppt.clientPhone ? (
                    <li>
                      <span className="text-zinc-500 dark:text-emerald-200/70">Telefon: </span>
                      {selectedAppt.clientPhone}
                    </li>
                  ) : null}
                  <li className="break-all font-mono text-[11px] text-zinc-600 dark:text-emerald-200/80">
                    Randevu id: {selectedAppt.id}
                  </li>
                </ul>
                <button
                  type="button"
                  className="text-[11px] font-medium text-rose-700 underline dark:text-rose-400"
                  onClick={() => {
                    setAppointmentId("");
                    setSelectedAppt(null);
                    setApptQ("");
                  }}
                >
                  Randevu seçimini temizle
                </button>
              </div>
            ) : null}
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            CRM müşteri (cariye yazmak için)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={crmQ}
              onChange={(e) => {
                setCrmQ(e.target.value);
                if (!e.target.value.trim()) setCrmContactId("");
              }}
              placeholder="İsim veya telefon"
            />
            {crmHits.length ? (
              <ul className="max-h-28 overflow-auto rounded border border-zinc-100 text-xs dark:border-zinc-800">
                {crmHits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setCrmContactId(h.id);
                        setCrmQ(h.name);
                        setCrmHits([]);
                      }}
                    >
                      {h.name} — {h.phoneKey}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input type="checkbox" checked={syncLedger} onChange={(e) => setSyncLedger(e.target.checked)} />
            Cariye tahsilat satırı ekle (müşteri seçiliyse)
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Not
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          className="w-fit rounded-full bg-rose-600 px-5 py-2 text-xs font-medium text-white disabled:opacity-50"
          onClick={async () => {
            const minor = moneyInputToMinor(amtTry);
            if (minor <= 0) {
              onError("Tutar girin");
              return;
            }
            if (syncLedger && !crmContactId.trim()) {
              onError("Cariye yazmak için CRM müşterisi seçin veya kutuyu kapatın");
              return;
            }
            const occurredIso = parseDatetimeLocalToIso(occurredAtLocal);
            if (!occurredIso) {
              onError("Tahsilat tarihi / saati geçersiz");
              return;
            }
            setSaving(true);
            try {
              const r = await fetch("/api/admin/commerce/cash/receipts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amountMinor: minor,
                  method,
                  memo: memo.trim() || null,
                  occurredAt: occurredIso,
                  sourceKind,
                  appointmentId: appointmentId.trim() || null,
                  crmContactId: crmContactId.trim() || null,
                  syncLedger,
                }),
              });
              const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
              if (jsonError) {
                onError(jsonError);
                return;
              }
              if (!r.ok) {
                onError(j.error ?? "Kaydedilemedi");
                return;
              }
              onOk("Tahsilat kaydedildi");
              setAmtTry("");
              setMemo("");
              setOccurredAtLocal(toDatetimeLocalInputValue(new Date()));
              void loadReport();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Gün sonu kasa</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Seçilen iş günü için sistemdeki tahsilat toplamı <strong>beklenen</strong> tutara yazılır; saydığınız kasayı
          girerek farkı takip edebilirsiniz.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs">
            İş günü
            <input
              type="date"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={closeYmd}
              onChange={(e) => setCloseYmd(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Sayılan kasa (₺) — isteğe bağlı
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={closeCountedTry}
              onChange={(e) => setCloseCountedTry(e.target.value)}
              placeholder="Boş bırakılabilir"
            />
          </label>
          <label className="grid min-w-[12rem] flex-1 gap-1 text-xs">
            Not
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={closeBusy}
            className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-white dark:bg-zinc-200 dark:text-zinc-900 disabled:opacity-50"
            onClick={async () => {
              setCloseBusy(true);
              try {
                const counted =
                  closeCountedTry.trim() === "" ? null : moneyInputToMinor(closeCountedTry);
                const r = await fetch("/api/admin/commerce/cash/day-close", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    businessDate: closeYmd,
                    countedTotalMinor: counted != null && counted >= 0 ? counted : null,
                    notes: closeNotes.trim() || null,
                  }),
                });
                const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                if (jsonError) {
                  onError(jsonError);
                  return;
                }
                if (!r.ok) {
                  onError(j.error ?? "Kaydedilemedi");
                  return;
                }
                onOk("Gün sonu kaydedildi");
                void loadReport();
              } finally {
                setCloseBusy(false);
              }
            }}
          >
            {closeBusy ? "…" : "Gün sonunu kaydet"}
          </button>
        </div>
        {dayCloses.length ? (
          <ul className="space-y-2 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
            {dayCloses.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-2 text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{c.businessDate}</span>
                <span>Beklenen: {c.expectedTotalFormatted ?? "—"}</span>
                <span>Sayılan: {c.countedTotalFormatted ?? "—"}</span>
                {c.varianceMinor != null ? (
                  <span className={c.varianceMinor === 0 ? "text-emerald-600" : "text-amber-700"}>
                    Fark: {formatTryFromMinor(c.varianceMinor)}
                  </span>
                ) : null}
                {c.staff ? <span className="text-zinc-500">({c.staff})</span> : null}
                {c.notes ? <span className="w-full text-zinc-500">{c.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">Bu aralıkta gün sonu kaydı yok.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900/80">
            <tr>
              <th className="p-2">Tahsilat zamanı</th>
              <th className="p-2">Tutar</th>
              <th className="p-2">Şekil</th>
              <th className="p-2">Kaynak</th>
              <th className="p-2">Randevu / Müşteri</th>
              <th className="p-2">Kaydeden</th>
              <th className="p-2">Not</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2 whitespace-nowrap">{formatCashWhenTr(row.occurredAt)}</td>
                <td className="p-2 font-medium">{row.amountFormatted}</td>
                <td className="p-2">{row.methodLabel}</td>
                <td className="p-2">{row.sourceKindLabel}</td>
                <td className="p-2">
                  {row.appointment ? (
                    <span>
                      <span className="font-medium">{row.appointment.clientName}</span>
                      <span className="mt-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">
                        Randevu: {formatApptWhenTr(row.appointment.startAt)}
                      </span>
                      <span className="break-all font-mono text-[10px] text-zinc-400" title={row.appointment.id}>
                        {row.appointment.id}
                      </span>
                    </span>
                  ) : row.crmContact ? (
                    row.crmContact.name
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">{row.recordedBy ?? "—"}</td>
                <td className="p-2 text-zinc-600 dark:text-zinc-400">{row.memo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!receipts.length && !loading ? (
          <p className="p-4 text-center text-xs text-zinc-500">Bu aralıkta tahsilat yok.</p>
        ) : null}
      </div>
    </div>
  );
}
