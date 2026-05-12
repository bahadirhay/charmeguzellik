"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import {
  PACKAGE_PAYMENT_METHODS,
  packagePaymentMethodLabel,
} from "@/lib/commerce/package-payment-method";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { moneyInputToMinor } from "@/lib/commerce/money-input-to-minor";
import { CashRegisterTab } from "@/components/admin/CashRegisterTab";

type Tab = "catalog" | "customer" | "ledger" | "cash" | "products" | "packages" | "purchases" | "commission";

export function CommerceHubClient() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const flash = useCallback((m: string) => {
    setMsg(m);
    setErr(null);
    setTimeout(() => setMsg(null), 3500);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Ticaret</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Liste fiyatları (genel katalog), <strong className="font-medium text-zinc-800 dark:text-zinc-200">CRM özel fiyat</strong>{" "}
          (yalnızca seçtiğiniz müşteriye uygulanan indirim/özel tutar), cari, kasa, ürün/stok, paket şablonları, paket satışı ve
          prim kuralları.
        </p>
      </div>
      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-700">
        {(
          [
            ["catalog", "Liste fiyatları"],
            ["customer", "Müşteri fiyatı"],
            ["ledger", "Cari"],
            ["cash", "Kasa"],
            ["products", "Ürün & stok"],
            ["packages", "Paketler"],
            ["purchases", "Paket satışları"],
            ["commission", "Prim"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              setErr(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === k
                ? "bg-rose-600 text-white"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "catalog" ? <CatalogTab onError={setErr} onOk={flash} /> : null}
      {tab === "customer" ? <CustomerPriceTab onError={setErr} onOk={flash} /> : null}
      {tab === "ledger" ? <LedgerTab onError={setErr} onOk={flash} /> : null}
      {tab === "cash" ? <CashRegisterTab onError={setErr} onOk={flash} /> : null}
      {tab === "products" ? <ProductsTab onError={setErr} onOk={flash} /> : null}
      {tab === "packages" ? <PackagesTab onError={setErr} onOk={flash} /> : null}
      {tab === "purchases" ? <PackagePurchasesTab onError={setErr} onOk={flash} /> : null}
      {tab === "commission" ? <CommissionTab onError={setErr} onOk={flash} /> : null}
    </div>
  );
}

function minorToTryInput(minor: number): string {
  const v = minor / 100;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function menuLabelForServiceKey(menuLabels: string[], serviceKey: string): string {
  const hit = menuLabels.find((l) => normalizeServiceKey(l) === serviceKey);
  return hit ?? serviceKey;
}

/** `Response.json()` boş veya HTML gövdede patlar; tüm ticaret API çağrıları bunu kullanır. */
async function parseResponseJson<T>(r: Response): Promise<{ jsonError: string | null; data: T }> {
  const raw = await r.text();
  if (!raw.trim()) return { jsonError: null, data: {} as T };
  try {
    return { jsonError: null, data: JSON.parse(raw) as T };
  } catch {
    return { jsonError: "Sunucu yanıtı okunamadı (geçerli JSON değil)", data: {} as T };
  }
}

function useMenuServiceLabels(): { menuLabels: string[]; menuLoading: boolean } {
  const [menuLabels, setMenuLabels] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setMenuLoading(true);
    void (async () => {
      const r = await fetch("/api/admin/commerce/menu-services", { cache: "no-store" });
      const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; labels?: string[] }>(r);
      if (!cancelled) {
        setMenuLabels(!jsonError && r.ok && j.ok && Array.isArray(j.labels) ? j.labels : []);
        setMenuLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { menuLabels, menuLoading };
}

const menuSelectClass =
  "min-w-[min(100%,18rem)] rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950";

function CatalogTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const { menuLabels, menuLoading } = useMenuServiceLabels();
  const [rows, setRows] = useState<
    { id: string; label: string; serviceKey: string; priceMinor: number; active: boolean }[]
  >([]);
  const [label, setLabel] = useState("");
  const [tryStr, setTryStr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/commerce/service-prices");
    const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof rows; error?: string }>(r);
    if (jsonError) {
      onError(jsonError);
      return;
    }
    if (!r.ok || !j.ok) {
      onError(j.error ?? "Yüklenemedi");
      return;
    }
    setRows(j.items ?? []);
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4 text-sm">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-xs font-medium text-zinc-500">
          Yeni / güncelle — hizmetler yalnızca{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">üst menüde «Hizmetlerimiz»</strong> altındaki
          yayınlı öğelerden seçilir (randevu formu ile aynı liste). Tabloda{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">Yayınla</strong>, fiyatı randevu panelinde
          göstermek için kaydı aktif eder;{" "}
          <span className="text-zinc-600 dark:text-zinc-400">Ayarlar → Randevu modülü → liste fiyatlarını göster</span>{" "}
          açık olmalıdır.
        </p>
        {!menuLoading && menuLabels.length === 0 ? (
          <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
            Menüde «Hizmetlerimiz» veya altında yayınlı hizmet bulunamadı. Önce{" "}
            <span className="font-medium">Admin → Menü</span> ile yapılandırın.
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-0 flex-1 gap-1 text-xs sm:max-w-md">
            Hizmet (menüden)
            <select
              className={menuSelectClass}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={menuLoading || menuLabels.length === 0}
            >
              <option value="">
                {menuLoading ? "Menü yükleniyor…" : menuLabels.length ? "Seçin…" : "Menüde hizmet yok"}
              </option>
              {menuLabels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Fiyat (₺)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={tryStr}
              onChange={(e) => setTryStr(e.target.value)}
              placeholder="1500"
            />
          </label>
          <button
            type="button"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-medium text-white"
            onClick={async () => {
              const priceMinor = moneyInputToMinor(tryStr);
              if (!label.trim()) {
                onError("Menüden bir hizmet seçin");
                return;
              }
              const body = editingId
                ? { id: editingId, label: label.trim(), priceMinor }
                : { label: label.trim(), priceMinor };
              const r = await fetch("/api/admin/commerce/service-prices", {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
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
              onOk(editingId ? "Güncellendi" : "Kaydedildi");
              setLabel("");
              setTryStr("");
              setEditingId(null);
              void load();
            }}
          >
            {editingId ? "Güncelle" : "Kaydet"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-600"
              onClick={() => {
                setEditingId(null);
                setLabel("");
                setTryStr("");
              }}
            >
              İptal
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900/80">
            <tr>
              <th className="p-2">Hizmet</th>
              <th className="p-2">Fiyat</th>
              <th className="p-2">Aktif</th>
              <th className="p-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2">{x.label}</td>
                <td className="p-2 font-mono">{formatTryFromMinor(x.priceMinor)}</td>
                <td className="p-2">{x.active ? "Evet" : "Hayır"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                    <button
                      type="button"
                      className="text-blue-600 underline dark:text-blue-400"
                      onClick={() => {
                        setEditingId(x.id);
                        setLabel(x.label);
                        setTryStr(minorToTryInput(x.priceMinor));
                      }}
                    >
                      Düzenle
                    </button>
                    <span className="select-none text-zinc-300 dark:text-zinc-600" aria-hidden>
                      /
                    </span>
                    <button
                      type="button"
                      className="text-rose-600 underline"
                      onClick={async () => {
                        const r = await fetch(`/api/admin/commerce/service-prices?id=${encodeURIComponent(x.id)}`, {
                          method: "DELETE",
                        });
                        if (!r.ok) {
                          const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                          if (jsonError) {
                            onError(jsonError);
                            return;
                          }
                          onError(j.error ?? "Silinemedi");
                          return;
                        }
                        if (editingId === x.id) {
                          setEditingId(null);
                          setLabel("");
                          setTryStr("");
                        }
                        onOk("Silindi");
                        void load();
                      }}
                    >
                      Sil
                    </button>
                    <span className="select-none text-zinc-300 dark:text-zinc-600" aria-hidden>
                      /
                    </span>
                    {x.active ? (
                      <button
                        type="button"
                        className="text-zinc-600 underline dark:text-zinc-400"
                        onClick={async () => {
                          const r = await fetch("/api/admin/commerce/service-prices", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: x.id, active: false }),
                          });
                          const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                          if (jsonError) {
                            onError(jsonError);
                            return;
                          }
                          if (!r.ok) {
                            onError(j.error ?? "Güncellenemedi");
                            return;
                          }
                          onOk("Yayından kaldırıldı — randevu panelinde bu fiyat görünmez");
                          void load();
                        }}
                      >
                        Yayından kaldır
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-emerald-700 underline dark:text-emerald-400"
                        onClick={async () => {
                          const r = await fetch("/api/admin/commerce/service-prices", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: x.id, active: true }),
                          });
                          const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                          if (jsonError) {
                            onError(jsonError);
                            return;
                          }
                          if (!r.ok) {
                            onError(j.error ?? "Yayınlanamadı");
                            return;
                          }
                          onOk("Yayında — randevu panelinde liste fiyatı olarak görünür");
                          void load();
                        }}
                      >
                        Yayınla
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerPriceTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const { menuLabels, menuLoading } = useMenuServiceLabels();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; phoneKey: string }[]>([]);
  const [cid, setCid] = useState("");
  const [svc, setSvc] = useState("");
  const [tryStr, setTryStr] = useState("");
  const [items, setItems] = useState<{ id: string; serviceKey: string; priceMinor: number }[]>([]);
  const [editPriceId, setEditPriceId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      const r = await fetch(`/api/admin/commerce/crm-search?q=${encodeURIComponent(q.trim())}`);
      const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof hits }>(r);
      if (jsonError || !r.ok) setHits([]);
      else setHits(Array.isArray(j.items) ? j.items : []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadPrices = useCallback(async () => {
    if (!cid.trim()) return;
    const r = await fetch(`/api/admin/commerce/customer-prices?crmContactId=${encodeURIComponent(cid.trim())}`);
    const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof items; error?: string }>(r);
    if (jsonError) {
      onError(jsonError);
      return;
    }
    if (!r.ok) {
      onError(j.error ?? "Yüklenemedi");
      return;
    }
    setItems(j.items ?? []);
  }, [cid, onError]);

  useEffect(() => {
    if (cid) void loadPrices();
  }, [cid, loadPrices]);

  return (
    <div className="grid gap-4 text-sm">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Bu sekme ne işe yarar?</p>
        <p className="mt-1">
          <strong>Liste fiyatları</strong> tüm müşteriler için geçerli katalog fiyatıdır. Burada ise{" "}
          <strong>tek bir CRM müşterisi</strong> için seçtiğiniz hizmette <strong>özel satış fiyatı</strong> tanımlarsınız
          (ör. anlaşmalı müşteri, kampanya). Randevu ve fiyat çözümlemesinde bu müşteri için özel tutar, varsa liste
          fiyatının önüne geçer.
        </p>
      </div>
      <label className="grid gap-1 text-xs">
        Müşteri ara (ad veya telefon)
        <input
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {hits.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="w-full px-2 py-1 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  setCid(h.id);
                  setQ(h.name);
                  setHits([]);
                }}
              >
                {h.name} — {h.phoneKey}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-zinc-500">Seçili müşteri id: {cid || "—"}</p>
      {!menuLoading && menuLabels.length === 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Menüde hizmet listesi yok — önce Menüden «Hizmetlerimiz» altına öğe ekleyin.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="grid min-w-0 flex-1 gap-1 text-xs sm:max-w-md">
          Hizmet (menüden)
          <select
            className={menuSelectClass}
            value={svc}
            onChange={(e) => setSvc(e.target.value)}
            disabled={menuLoading || menuLabels.length === 0}
          >
            <option value="">
              {menuLoading ? "Menü yükleniyor…" : menuLabels.length ? "Seçin…" : "Menüde hizmet yok"}
            </option>
            {menuLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Fiyat (₺)
          <input
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={tryStr}
            onChange={(e) => setTryStr(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-full bg-rose-600 px-4 py-2 text-xs font-medium text-white"
            onClick={async () => {
            if (!cid || !svc.trim()) {
              onError("Müşteri ve hizmet seçin");
              return;
            }
            const r = await fetch("/api/admin/commerce/customer-prices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                crmContactId: cid,
                serviceLabel: svc.trim(),
                priceMinor: moneyInputToMinor(tryStr),
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
            onOk(editPriceId ? "Özel fiyat güncellendi" : "Özel fiyat kaydedildi");
            setSvc("");
            setTryStr("");
            setEditPriceId(null);
            void loadPrices();
          }}
        >
          {editPriceId ? "Güncelle" : "Kaydet"}
        </button>
        {editPriceId ? (
          <button
            type="button"
            className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium dark:border-zinc-600"
            onClick={() => {
              setEditPriceId(null);
              setSvc("");
              setTryStr("");
            }}
          >
            İptal
          </button>
        ) : null}
      </div>
      {editPriceId ? (
        <p className="text-xs text-blue-700 dark:text-blue-300">Düzenleme: kayıtlı özel fiyatı güncelliyorsunuz.</p>
      ) : null}
      <ul className="text-xs">
        {items.map((i) => (
          <li
            key={i.id}
            className={`flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-2 dark:border-zinc-800 ${
              editPriceId === i.id ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
            }`}
          >
            <span className="min-w-0 font-medium">{menuLabelForServiceKey(menuLabels, i.serviceKey)}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono">{formatTryFromMinor(i.priceMinor)}</span>
              <button
                type="button"
                className="text-blue-600 underline dark:text-blue-400"
                onClick={() => {
                  setEditPriceId(i.id);
                  setSvc(menuLabelForServiceKey(menuLabels, i.serviceKey));
                  setTryStr(minorToTryInput(i.priceMinor));
                }}
              >
                Düzenle
              </button>
              <button
                type="button"
                className="text-rose-600 underline"
                onClick={async () => {
                  await fetch(`/api/admin/commerce/customer-prices?id=${encodeURIComponent(i.id)}`, {
                    method: "DELETE",
                  });
                  if (editPriceId === i.id) {
                    setEditPriceId(null);
                    setSvc("");
                    setTryStr("");
                  }
                  void loadPrices();
                }}
              >
                Sil
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LedgerTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const { menuLabels, menuLoading } = useMenuServiceLabels();
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; phoneKey: string }[]>([]);
  const [cid, setCid] = useState("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ id: string; name: string; phoneKey: string } | null>(
    null,
  );
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<
    { id: string; kind: string; amountMinor: number; memo: string | null; occurredAt: string }[]
  >([]);
  const [kind, setKind] = useState<"charge" | "payment" | "adjustment" | "refund">("charge");
  const [chargeSubtype, setChargeSubtype] = useState<"service" | "product" | "package">("service");
  const [chargeService, setChargeService] = useState("");
  const [amt, setAmt] = useState("");
  const [memo, setMemo] = useState("");
  const [products, setProducts] = useState<
    {
      id: string;
      name: string;
      sku: string;
      salePriceMinor: number;
      trackStock: boolean;
      stockQty: number | null;
      active?: boolean;
    }[]
  >([]);
  const [productId, setProductId] = useState("");
  const [productQty, setProductQty] = useState("1");
  const [packageTemplates, setPackageTemplates] = useState<
    { id: string; name: string; listPriceMinor: number; active?: boolean }[]
  >([]);
  const [packageTemplateId, setPackageTemplateId] = useState("");
  const [packageSaleTry, setPackageSaleTry] = useState("");

  useEffect(() => {
    if (kind !== "charge") {
      setChargeService("");
      return;
    }
    if (chargeSubtype !== "service") setChargeService("");
  }, [kind, chargeSubtype]);

  useEffect(() => {
    if (!cid || kind !== "charge" || chargeSubtype !== "product") {
      setProducts([]);
      return;
    }
    void (async () => {
      const r = await fetch("/api/admin/commerce/products", { cache: "no-store" });
      const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof products }>(r);
      if (!jsonError && r.ok && Array.isArray(j.items)) {
        setProducts(j.items.filter((p) => p.active !== false));
      } else setProducts([]);
    })();
  }, [cid, kind, chargeSubtype]);

  useEffect(() => {
    if (!cid || kind !== "charge" || chargeSubtype !== "package") {
      setPackageTemplates([]);
      return;
    }
    void (async () => {
      const r = await fetch("/api/admin/commerce/package-templates", { cache: "no-store" });
      const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof packageTemplates }>(r);
      if (!jsonError && r.ok && Array.isArray(j.items)) {
        setPackageTemplates(j.items.filter((t) => t.active !== false));
      } else setPackageTemplates([]);
    })();
  }, [cid, kind, chargeSubtype]);

  useEffect(() => {
    if (chargeSubtype !== "product" || !productId) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const q = Math.max(1, parseInt(productQty, 10) || 1);
    setAmt(minorToTryInput(p.salePriceMinor * q));
  }, [chargeSubtype, productId, productQty, products]);

  useEffect(() => {
    if (chargeSubtype !== "package" || !packageTemplateId) return;
    const t = packageTemplates.find((x) => x.id === packageTemplateId);
    if (!t) return;
    setPackageSaleTry(minorToTryInput(t.listPriceMinor));
  }, [chargeSubtype, packageTemplateId, packageTemplates]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      const r = await fetch(`/api/admin/commerce/crm-search?q=${encodeURIComponent(q.trim())}`);
      const { jsonError, data: j } = await parseResponseJson<{ items?: typeof hits }>(r);
      if (jsonError || !r.ok) setHits([]);
      else setHits(Array.isArray(j.items) ? j.items : []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (crmContactIdOverride?: string) => {
      const id = (crmContactIdOverride ?? cid).trim();
      if (!id) return;
      const r = await fetch(`/api/admin/commerce/ledger?crmContactId=${encodeURIComponent(id)}`);
      const { jsonError, data: j } = await parseResponseJson<{
        ok?: boolean;
        balanceMinor?: number;
        entries?: typeof entries;
        error?: string;
      }>(r);
      if (jsonError) {
        onError(jsonError);
        return;
      }
      if (!r.ok) {
        onError(j.error ?? "Yüklenemedi");
        return;
      }
      setBalance(j.balanceMinor ?? 0);
      setEntries(j.entries ?? []);
    },
    [cid, onError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            customerMode === "existing"
              ? "bg-rose-600 text-white"
              : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
          }`}
          onClick={() => {
            setCustomerMode("existing");
            setNewName("");
            setNewPhone("");
            setNewEmail("");
          }}
        >
          Mevcut müşteri
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            customerMode === "new"
              ? "bg-rose-600 text-white"
              : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
          }`}
          onClick={() => {
            setCustomerMode("new");
            setCid("");
            setSelectedSnapshot(null);
            setQ("");
            setHits([]);
          }}
        >
          Yeni müşteri
        </button>
      </div>

      {customerMode === "existing" ? (
        <>
          <label className="grid gap-1 text-xs">
            Müşteri ara
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="İsim veya telefon (en az 2 karakter)"
            />
          </label>
          {hits.length > 0 ? (
            <ul className="max-h-32 overflow-auto rounded border dark:border-zinc-700">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full px-2 py-1 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setCid(h.id);
                      setSelectedSnapshot(h);
                      setQ(h.name);
                      setHits([]);
                    }}
                  >
                    {h.name} — {h.phoneKey}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Telefon CRM&apos;de benzersizdir; aynı numara kayıtlıysa kart güncellenir ve seçilir.
          </p>
          <input
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="Ad soyad *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="Cep telefonu * (örn. 05xx…)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <input
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="E-posta (isteğe bağlı)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button
            type="button"
            disabled={creatingCustomer}
            className="w-fit rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
            onClick={async () => {
              if (!newName.trim() || !newPhone.trim()) {
                onError("Ad ve telefon zorunludur");
                return;
              }
              setCreatingCustomer(true);
              try {
                const cr = await fetch("/api/admin/crm-contacts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: newName.trim(),
                    phone: newPhone.trim(),
                    email: newEmail.trim() || null,
                  }),
                });
                const { jsonError, data: cj } = await parseResponseJson<{
                  ok?: boolean;
                  contact?: { id: string; name: string; phoneKey: string };
                  error?: string;
                }>(cr);
                if (jsonError) {
                  onError(jsonError);
                  return;
                }
                if (!cr.ok || !cj.ok || !cj.contact?.id) {
                  onError(cj.error ?? "Müşteri oluşturulamadı");
                  return;
                }
                const c = cj.contact;
                setCid(c.id);
                setSelectedSnapshot({ id: c.id, name: c.name, phoneKey: c.phoneKey });
                setQ(c.name);
                setNewName("");
                setNewPhone("");
                setNewEmail("");
                setCustomerMode("existing");
                onOk("Müşteri kaydedildi ve seçildi");
                void load(c.id);
              } finally {
                setCreatingCustomer(false);
              }
            }}
          >
            {creatingCustomer ? "Kaydediliyor…" : "Müşteriyi oluştur ve seç"}
          </button>
        </div>
      )}

      {cid && selectedSnapshot ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <span className="text-emerald-950 dark:text-emerald-100">
            <strong>Seçili:</strong> {selectedSnapshot.name} — {selectedSnapshot.phoneKey}
          </span>
          <button
            type="button"
            className="text-[11px] font-medium text-rose-700 underline dark:text-rose-400"
            onClick={() => {
              setCid("");
              setSelectedSnapshot(null);
              setQ("");
              setHits([]);
            }}
          >
            Seçimi temizle
          </button>
        </div>
      ) : null}

      <p className="text-sm font-medium">
        Bakiye (pozitif = müşteri borçlu):{" "}
        <span className="font-mono">{formatTryFromMinor(balance)}</span>
      </p>
      <div className="grid gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
          value={kind}
          onChange={(e) => {
            const v = e.target.value as typeof kind;
            setKind(v);
            if (v !== "charge") {
              setChargeSubtype("service");
              setProductId("");
              setPackageTemplateId("");
            }
          }}
        >
          <option value="charge">Borçlandır</option>
          <option value="payment">Tahsilat</option>
          <option value="adjustment">Düzeltme</option>
          <option value="refund">İade</option>
        </select>
        {kind === "charge" ? (
          <div className="grid gap-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Borç türü
              <select
                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                value={chargeSubtype}
                onChange={(e) => {
                  setChargeSubtype(e.target.value as typeof chargeSubtype);
                  setChargeService("");
                  setProductId("");
                  setProductQty("1");
                  setPackageTemplateId("");
                  setAmt("");
                  setPackageSaleTry("");
                }}
              >
                <option value="service">Hizmet (menü)</option>
                <option value="product">Ürün (stok + cari)</option>
                <option value="package">Paket şablonu</option>
              </select>
            </label>
            {chargeSubtype === "service" ? (
              <div className="grid gap-1">
                {!menuLoading && menuLabels.length === 0 ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Menüde hizmet yok — «Ürün» veya «Paket» seçin ya da açıklamaya kalemi yazıp manuel tutar girin.
                  </p>
                ) : null}
                {menuLabels.length > 0 ? (
                  <label className="grid gap-1 text-xs">
                    Hizmet (menüden)
                    <select
                      className={menuSelectClass}
                      value={chargeService}
                      onChange={(e) => setChargeService(e.target.value)}
                      disabled={menuLoading}
                    >
                      <option value="">{menuLoading ? "Menü yükleniyor…" : "Seçin…"}</option>
                      {menuLabels.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                      <option value="__other__">Diğer (açıklamada belirtin)</option>
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
            {chargeSubtype === "product" ? (
              <div className="grid gap-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Stok takibi açıksa çıkış hareketi da yazılır; tutar cariye borç olarak eklenir.
                </p>
                {!cid ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">Önce müşteri seçin.</p>
                ) : products.length === 0 ? (
                  <p className="text-xs text-zinc-500">Aktif ürün yok — «Ürün ve stok» sekmesinden ekleyin.</p>
                ) : (
                  <>
                    <label className="grid gap-1 text-xs">
                      Ürün
                      <select
                        className={menuSelectClass}
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                      >
                        <option value="">Seçin…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — {formatTryFromMinor(p.salePriceMinor)}
                            {p.trackStock && p.stockQty != null ? ` — stok ${p.stockQty}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      Adet
                      <input
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        value={productQty}
                        onChange={(e) => setProductQty(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
            ) : null}
            {chargeSubtype === "package" ? (
              <div className="grid gap-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Paket satışı ile aynı akış: seans hakları ve paket borcu oluşturulur (Paket satışları sekmesiyle uyumlu).
                </p>
                {!cid ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">Önce müşteri seçin.</p>
                ) : packageTemplates.length === 0 ? (
                  <p className="text-xs text-zinc-500">Aktif paket şablonu yok — Paketler sekmesinden oluşturun.</p>
                ) : (
                  <>
                    <label className="grid gap-1 text-xs">
                      Paket şablonu
                      <select
                        className={menuSelectClass}
                        value={packageTemplateId}
                        onChange={(e) => setPackageTemplateId(e.target.value)}
                      >
                        <option value="">Seçin…</option>
                        {packageTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} — liste {formatTryFromMinor(t.listPriceMinor)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      Anlaşılan bedel (₺)
                      <input
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        value={packageSaleTry}
                        onChange={(e) => setPackageSaleTry(e.target.value)}
                        placeholder="Liste fiyatı"
                      />
                    </label>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
          placeholder={
            kind === "charge" && chargeSubtype === "product"
              ? "Satır tutarı ₺ (boş bırakılırsa fiyat × adet)"
              : kind === "charge" && chargeSubtype === "package"
                ? "Pakette tutar yukarıdaki bedel alanından"
                : "Tutar ₺ (tahsilat için negatif yazın)"
          }
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          disabled={kind === "charge" && chargeSubtype === "package"}
        />
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
          placeholder="Açıklama"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <button
          type="button"
          className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-white dark:bg-zinc-200 dark:text-zinc-900"
          onClick={async () => {
            if (!cid) {
              onError("Müşteri seçin");
              return;
            }

            if (kind === "charge" && chargeSubtype === "product") {
              if (!productId.trim()) {
                onError("Ürün seçin");
                return;
              }
              const q = Math.max(1, parseInt(productQty, 10) || 1);
              const lineOverride = amt.trim() ? moneyInputToMinor(amt) : null;
              const r = await fetch("/api/admin/commerce/customer-product-sale", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  crmContactId: cid,
                  productId: productId.trim(),
                  qty: q,
                  lineTotalMinor: lineOverride && lineOverride > 0 ? lineOverride : null,
                  memo: memo.trim() || null,
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
              onOk("Ürün satışı cariye işlendi");
              setAmt("");
              setMemo("");
              setProductId("");
              setProductQty("1");
              void load();
              return;
            }

            if (kind === "charge" && chargeSubtype === "package") {
              if (!packageTemplateId.trim()) {
                onError("Paket şablonu seçin");
                return;
              }
              const saleMinor = packageSaleTry.trim()
                ? moneyInputToMinor(packageSaleTry)
                : (packageTemplates.find((x) => x.id === packageTemplateId)?.listPriceMinor ?? 0);
              if (saleMinor <= 0) {
                onError("Paket bedeli sıfırdan büyük olmalı");
                return;
              }
              const r = await fetch("/api/admin/commerce/package-purchases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  crmContactId: cid,
                  templateId: packageTemplateId.trim(),
                  salePriceMinor: saleMinor,
                }),
              });
              const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
              if (jsonError) {
                onError(jsonError);
                return;
              }
              if (!r.ok) {
                onError(j.error ?? "Paket satışı kaydedilemedi");
                return;
              }
              onOk("Paket satışı oluşturuldu");
              setMemo("");
              setPackageTemplateId("");
              setPackageSaleTry("");
              setAmt("");
              void load();
              return;
            }

            if (kind === "charge" && chargeSubtype === "service") {
              if (menuLabels.length > 0) {
                if (!chargeService.trim()) {
                  onError("Menüden bir hizmet seçin veya «Diğer» seçin");
                  return;
                }
                if (chargeService === "__other__" && !memo.trim()) {
                  onError("Diğer için açıklama yazın");
                  return;
                }
              } else if (moneyInputToMinor(amt) <= 0) {
                onError("Menü yok — borç tutarını ve açıklamayı girin");
                return;
              }
            }
            let amountMinor = moneyInputToMinor(amt);
            if (kind === "payment" && amountMinor > 0) amountMinor = -amountMinor;
            if (kind === "charge" && amountMinor < 0) amountMinor = -amountMinor;
            const body: Record<string, unknown> = {
              crmContactId: cid,
              kind,
              amountMinor,
              memo: memo.trim() || null,
            };
            if (kind === "charge" && chargeService.trim() && chargeService !== "__other__") {
              body.serviceLabel = chargeService.trim();
            }
            const r = await fetch("/api/admin/commerce/ledger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
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
            onOk("Hareket kaydedildi");
            setAmt("");
            setMemo("");
            setChargeService("");
            void load();
          }}
        >
          Hareket ekle
        </button>
      </div>
      <ul className="max-h-64 overflow-auto text-xs">
        {entries.map((e) => (
          <li key={e.id} className="border-b border-zinc-100 py-1 dark:border-zinc-800">
            {e.occurredAt.slice(0, 10)} — {e.kind} — {formatTryFromMinor(e.amountMinor)}
            {e.memo ? ` — ${e.memo}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductsTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const [rows, setRows] = useState<
    { id: string; sku: string; name: string; salePriceMinor: number; trackStock: boolean; stockQty: number | null }[]
  >([]);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [initialStock, setInitialStock] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/commerce/products");
    const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof rows }>(r);
    if (!jsonError && r.ok && j.items) setRows(j.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4 text-sm">
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong>Kalan stok</strong> stok hareketlerinin toplamıdır.{" "}
        <strong className="text-zinc-800 dark:text-zinc-200">Cari</strong> ekranından yapılan ürün satışı stok takibi
        açık ürünlerde otomatik düşer. Yeni üründe başlangıç stoğu girebilir veya aşağıdan &quot;Stoğa ekle&quot; ile
        artırırsınız.
      </p>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="grid gap-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          SKU
          <input
            placeholder="SKU"
            className="rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </label>
        <label className="grid min-w-[8rem] gap-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          Ad
          <input
            placeholder="Ad"
            className="rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="grid gap-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          Satış ₺
          <input
            placeholder="0"
            className="w-24 rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="grid gap-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          Başlangıç stoku
          <input
            placeholder="0"
            className="w-24 rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={initialStock}
            onChange={(e) => setInitialStock(e.target.value)}
            title="Stok takibi açık ürünlerde depo girişi olarak kaydedilir"
          />
        </label>
        <button
          type="button"
          className="rounded-full bg-rose-600 px-3 py-1.5 text-xs text-white"
          onClick={async () => {
            const initRaw = initialStock.trim() === "" ? 0 : parseInt(initialStock, 10);
            const initialStockQty = Number.isNaN(initRaw) || initRaw < 0 ? 0 : Math.min(initRaw, 100_000_000);
            const r = await fetch("/api/admin/commerce/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sku: sku.trim(),
                name: name.trim(),
                salePriceMinor: moneyInputToMinor(price),
                ...(initialStockQty > 0 ? { initialStockQty } : {}),
              }),
            });
            const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
            if (jsonError) {
              onError(jsonError);
              return;
            }
            if (!r.ok) {
              onError(j.error ?? "Eklenemedi");
              return;
            }
            onOk("Ürün eklendi");
            setSku("");
            setName("");
            setPrice("");
            setInitialStock("");
            void load();
          }}
        >
          Ekle
        </button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="p-1">SKU</th>
            <th className="p-1">Ad</th>
            <th className="p-1">Fiyat</th>
            <th className="p-1">Kalan stok</th>
            <th className="p-1 min-w-[11rem]">Stok girişi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <ProductRow key={p.id} p={p} onReload={load} onError={onError} onOk={onOk} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({
  p,
  onReload,
  onError,
  onOk,
}: {
  p: { id: string; sku: string; name: string; salePriceMinor: number; trackStock: boolean; stockQty: number | null };
  onReload: () => void;
  onError: (s: string) => void;
  onOk: (s: string) => void;
}) {
  const [stockDelta, setStockDelta] = useState("1");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(p.name);
  const [editPrice, setEditPrice] = useState(minorToTryInput(p.salePriceMinor));

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="p-1 font-mono">{p.sku}</td>
      <td className="p-1">
        {editing ? (
          <input
            className="w-full min-w-[8rem] rounded border px-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        ) : (
          p.name
        )}
      </td>
      <td className="p-1">
        {editing ? (
          <input
            className="w-20 rounded border px-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
          />
        ) : (
          formatTryFromMinor(p.salePriceMinor)
        )}
      </td>
      <td className="p-1">{p.trackStock ? p.stockQty ?? 0 : "—"}</td>
      <td className="p-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
          {editing ? (
            <>
              <button
                type="button"
                className="text-xs text-blue-600 underline dark:text-blue-400"
                onClick={async () => {
                  const r = await fetch(`/api/admin/commerce/products/${p.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: editName.trim(),
                      salePriceMinor: moneyInputToMinor(editPrice),
                    }),
                  });
                  const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                  if (jsonError) {
                    onError(jsonError);
                    return;
                  }
                  if (!r.ok) {
                    onError(j.error ?? "Güncellenemedi");
                    return;
                  }
                  onOk("Ürün güncellendi");
                  setEditing(false);
                  onReload();
                }}
              >
                Kaydet
              </button>
              <button
                type="button"
                className="text-xs text-zinc-600 underline dark:text-zinc-400"
                onClick={() => {
                  setEditing(false);
                  setEditName(p.name);
                  setEditPrice(minorToTryInput(p.salePriceMinor));
                }}
              >
                İptal
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-xs text-blue-600 underline dark:text-blue-400"
              onClick={() => {
                setEditName(p.name);
                setEditPrice(minorToTryInput(p.salePriceMinor));
                setEditing(true);
              }}
            >
              Düzenle
            </button>
          )}
          {p.trackStock ? (
            <div className="flex flex-col gap-1">
              <input
                className="w-16 rounded border px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-950"
                inputMode="numeric"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                aria-label="Stok adedi"
              />
              <span className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
                  onClick={async () => {
                    const n = Math.max(0, parseInt(stockDelta, 10) || 0);
                    if (n <= 0) {
                      onError("Stoğa eklenecek adet girin");
                      return;
                    }
                    const r = await fetch(`/api/admin/commerce/products/${p.id}/stock`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        qty: n,
                        reason: "adjustment",
                        memo: "Panel — stoğa ekleme",
                      }),
                    });
                    const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                    if (jsonError) {
                      onError(jsonError);
                      return;
                    }
                    if (!r.ok) {
                      onError(j.error ?? "Hareket eklenemedi");
                      return;
                    }
                    onOk("Stok eklendi");
                    setStockDelta("1");
                    onReload();
                  }}
                >
                  Stoğa ekle
                </button>
                <button
                  type="button"
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                  onClick={async () => {
                    const n = Math.max(0, parseInt(stockDelta, 10) || 0);
                    if (n <= 0) {
                      onError("Düşülecek adet girin");
                      return;
                    }
                    const r = await fetch(`/api/admin/commerce/products/${p.id}/stock`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        qty: -n,
                        reason: "adjustment",
                        memo: "Panel — stoktan düşme",
                      }),
                    });
                    const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                    if (jsonError) {
                      onError(jsonError);
                      return;
                    }
                    if (!r.ok) {
                      onError(j.error ?? "Hareket eklenemedi");
                      return;
                    }
                    onOk("Stok düşürüldü");
                    setStockDelta("1");
                    onReload();
                  }}
                >
                  Stoktan düş
                </button>
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400">Stok takibi kapalı</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function PackagesTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const { menuLabels, menuLoading } = useMenuServiceLabels();
  const [templates, setTemplates] = useState<
    { id: string; name: string; listPriceMinor: number; lines: { serviceKey: string; sessions: number }[] }[]
  >([]);
  const [name, setName] = useState("");
  const [listTry, setListTry] = useState("");
  const [line1Svc, setLine1Svc] = useState("");
  const [line1N, setLine1N] = useState("6");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/commerce/package-templates");
    const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof templates }>(r);
    if (!jsonError && r.ok && j.items) setTemplates(j.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setListTry("");
    setLine1Svc("");
    setLine1N("6");
    setEditingTemplateId(null);
  };

  return (
    <div className="grid gap-4 text-sm">
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-2 text-xs text-zinc-500">
          Basit paket (tek hizmet satırı). Hizmet yalnızca menüdeki «Hizmetlerimiz» altından seçilir. Oluşturduğunuz
          şablonlar <strong className="text-zinc-700 dark:text-zinc-200">Paket satışları</strong> sekmesinde müşteriye
          satılır.
        </p>
        {!menuLoading && menuLabels.length === 0 ? (
          <p className="mb-2 text-xs text-amber-800 dark:text-amber-200">Önce menüde hizmet tanımlayın.</p>
        ) : null}
        {editingTemplateId ? (
          <p className="mb-2 text-xs text-blue-700 dark:text-blue-300">Şablon düzenleniyor — kaydedince güncellenir.</p>
        ) : null}
        <div className="grid gap-2">
          <input
            placeholder="Paket adı"
            className="rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Liste fiyatı ₺"
            className="rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={listTry}
            onChange={(e) => setListTry(e.target.value)}
          />
          <label className="grid gap-1 text-xs">
            Dahil hizmet (menüden)
            <select
              className={menuSelectClass}
              value={line1Svc}
              onChange={(e) => setLine1Svc(e.target.value)}
              disabled={menuLoading || menuLabels.length === 0}
            >
              <option value="">
                {menuLoading ? "Menü yükleniyor…" : menuLabels.length ? "Seçin…" : "Menüde hizmet yok"}
              </option>
              {menuLabels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <input
            placeholder="Seans adedi"
            className="rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={line1N}
            onChange={(e) => setLine1N(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-rose-600 px-4 py-2 text-xs text-white"
              onClick={async () => {
                if (!name.trim()) {
                  onError("Paket adı yazın");
                  return;
                }
                if (!line1Svc.trim()) {
                  onError("Menüden bir hizmet seçin");
                  return;
                }
                const sessions = Math.max(1, parseInt(line1N, 10) || 1);
                const listPriceMinor = moneyInputToMinor(listTry);
                const lines = [{ serviceLabel: line1Svc.trim(), sessions }];
                const r = editingTemplateId
                  ? await fetch(`/api/admin/commerce/package-templates/${editingTemplateId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: name.trim(), listPriceMinor, lines }),
                    })
                  : await fetch("/api/admin/commerce/package-templates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: name.trim(),
                        listPriceMinor,
                        lines,
                      }),
                    });
                const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                if (jsonError) {
                  onError(jsonError);
                  return;
                }
                if (!r.ok) {
                  onError(j.error ?? (editingTemplateId ? "Güncellenemedi" : "Oluşturulamadı"));
                  return;
                }
                onOk(editingTemplateId ? "Şablon güncellendi" : "Paket şablonu oluşturuldu");
                resetForm();
                void load();
              }}
            >
              {editingTemplateId ? "Şablonu kaydet" : "Şablon oluştur"}
            </button>
            {editingTemplateId ? (
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs dark:border-zinc-600"
                onClick={resetForm}
              >
                İptal
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900/80">
            <tr>
              <th className="p-2">Paket</th>
              <th className="p-2">Liste</th>
              <th className="p-2">İçerik</th>
              <th className="p-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2 font-medium">{t.name}</td>
                <td className="p-2 font-mono">{formatTryFromMinor(t.listPriceMinor)}</td>
                <td className="p-2 text-zinc-600 dark:text-zinc-400">
                  {t.lines.map((l) => (
                    <span key={l.serviceKey} className="mr-2 block sm:inline">
                      {menuLabelForServiceKey(menuLabels, l.serviceKey)} × {l.sessions}
                    </span>
                  ))}
                </td>
                <td className="p-2">
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    <button
                      type="button"
                      className="text-blue-600 underline dark:text-blue-400"
                      onClick={() => {
                        const first = t.lines[0];
                        setEditingTemplateId(t.id);
                        setName(t.name);
                        setListTry(minorToTryInput(t.listPriceMinor));
                        setLine1Svc(first ? menuLabelForServiceKey(menuLabels, first.serviceKey) : "");
                        setLine1N(first ? String(first.sessions) : "6");
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 underline"
                      onClick={async () => {
                        if (!confirm("Bu paket şablonunu silmek istediğinize emin misiniz?")) return;
                        const r = await fetch(`/api/admin/commerce/package-templates/${t.id}`, { method: "DELETE" });
                        if (!r.ok) {
                          const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                          if (jsonError) {
                            onError(jsonError);
                            return;
                          }
                          onError(j.error ?? "Silinemedi");
                          return;
                        }
                        if (editingTemplateId === t.id) resetForm();
                        onOk("Silindi");
                        void load();
                      }}
                    >
                      Sil
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 ? <p className="p-4 text-center text-zinc-500">Henüz şablon yok.</p> : null}
      </div>
    </div>
  );
}

type PackagePurchaseRow = {
  id: string;
  purchasedAt: string;
  expiresAt: string | null;
  status: string;
  salePriceMinor: number;
  saleFormatted: string;
  paidAmountMinor: number | null;
  paidFormatted: string | null;
  paidFromPaymentsMinor: number;
  paidFromPaymentsFormatted: string;
  balanceDueMinor: number;
  balanceDueFormatted: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  customer: { id: string; name: string; phoneKey: string } | null;
  template: {
    id: string;
    name: string;
    listPriceMinor: number;
    listFormatted: string;
    lines: { serviceKey: string; sessionsPurchased: number }[];
  };
  lineDetails: { serviceKey: string; sessionsPurchased: number; remaining: number; used: number }[];
  credits: { serviceKey: string; remaining: number }[];
  payments: {
    id: string;
    amountMinor: number;
    formatted: string;
    method: string;
    methodLabel: string;
    memo: string | null;
    paidAt: string;
  }[];
};

type PackageTemplateRow = {
  id: string;
  name: string;
  listPriceMinor: number;
  lines: { serviceKey: string; sessions: number }[];
};

function PackagePurchasesTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const { menuLabels } = useMenuServiceLabels();
  const [rows, setRows] = useState<PackagePurchaseRow[]>([]);
  const [templates, setTemplates] = useState<PackageTemplateRow[]>([]);
  const [saleTemplateId, setSaleTemplateId] = useState("");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; phoneKey: string }[]>([]);
  const [cid, setCid] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saleContractTry, setSaleContractTry] = useState("");
  const [firstPaymentTry, setFirstPaymentTry] = useState("");
  const [firstPaymentMethod, setFirstPaymentMethod] = useState<(typeof PACKAGE_PAYMENT_METHODS)[number]>("cash");
  const [saleBusy, setSaleBusy] = useState(false);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [addPayTry, setAddPayTry] = useState("");
  const [addPayMethod, setAddPayMethod] = useState<(typeof PACKAGE_PAYMENT_METHODS)[number]>("cash");
  const [addPayMemo, setAddPayMemo] = useState("");
  const [consumeLabel, setConsumeLabel] = useState("");
  const [consumeCount, setConsumeCount] = useState("1");

  useEffect(() => {
    setAddPayTry("");
    setAddPayMemo("");
  }, [expandedPurchaseId]);

  const loadPurchases = useCallback(async () => {
    const r = await fetch("/api/admin/commerce/package-purchases", { cache: "no-store" });
    const { jsonError, data: j } = await parseResponseJson<{
      ok?: boolean;
      items?: PackagePurchaseRow[];
      error?: string;
    }>(r);
    if (jsonError) {
      onError(jsonError);
      return;
    }
    if (!r.ok) {
      onError(j.error ?? "Paket satışları yüklenemedi");
      return;
    }
    setRows(Array.isArray(j.items) ? j.items : []);
  }, [onError]);

  const loadTemplates = useCallback(async () => {
    const r = await fetch("/api/admin/commerce/package-templates", { cache: "no-store" });
    const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: PackageTemplateRow[] }>(r);
    if (!jsonError && r.ok && Array.isArray(j.items)) setTemplates(j.items);
  }, []);

  useEffect(() => {
    void loadPurchases();
    void loadTemplates();
  }, [loadPurchases, loadTemplates]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (customerMode !== "existing") {
        setHits([]);
        return;
      }
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      const r = await fetch(`/api/admin/commerce/crm-search?q=${encodeURIComponent(q.trim())}`);
      const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof hits }>(r);
      if (jsonError || !r.ok) setHits([]);
      else setHits(Array.isArray(j.items) ? j.items : []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, customerMode]);

  const selectedTpl = templates.find((x) => x.id === saleTemplateId);

  useEffect(() => {
    const tpl = templates.find((x) => x.id === saleTemplateId);
    if (!tpl) {
      setSaleContractTry("");
      return;
    }
    setSaleContractTry(minorToTryInput(tpl.listPriceMinor));
  }, [saleTemplateId, templates]);

  return (
    <div className="grid gap-4 text-sm">
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        Satışta <strong className="text-zinc-800 dark:text-zinc-200">paket bedeli</strong> cariye borç olarak yazılır;
        aynı anda veya sonra eklediğiniz <strong>tahsilatlar</strong> ödeme olarak düşer. Seans özeti ve kalan borç
        tabloda; satıra genişleterek tahsilat ekleyebilir veya seans kullanımını düşebilirsiniz.
      </p>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Şablonlarınız (satışa hazır)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Bu liste «Paketler» ile aynı kaynaktan gelir. Şablon eklemek/düzenlemek için{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Paketler</span> sekmesini kullanın.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80">
              <tr>
                <th className="p-2">Paket</th>
                <th className="p-2">Liste</th>
                <th className="p-2">İçerik</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-2 font-medium">{tpl.name}</td>
                  <td className="p-2 font-mono">{formatTryFromMinor(tpl.listPriceMinor)}</td>
                  <td className="p-2 text-zinc-600 dark:text-zinc-400">
                    {tpl.lines.map((l) => (
                      <span key={l.serviceKey} className="mr-2">
                        {menuLabelForServiceKey(menuLabels, l.serviceKey)} × {l.sessions}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 ? (
            <p className="p-4 text-center text-zinc-500">Henüz paket şablonu yok — önce «Paketler» sekmesinden oluşturun.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Yeni paket satışı</h2>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-xs">
            Satılacak paket şablonu
            <select
              className={menuSelectClass}
              value={saleTemplateId}
              onChange={(e) => setSaleTemplateId(e.target.value)}
            >
              <option value="">Seçin…</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} — {formatTryFromMinor(tpl.listPriceMinor)}
                </option>
              ))}
            </select>
          </label>
          {selectedTpl ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Şablon liste fiyatı:{" "}
              <span className="font-mono font-medium">{formatTryFromMinor(selectedTpl.listPriceMinor)}</span> — paket
              bedelini aşağıdan değiştirebilirsiniz.
            </p>
          ) : null}
          <label className="grid max-w-xs gap-1 text-xs">
            Paket bedeli — anlaşılan tutar (₺)
            <input
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={saleContractTry}
              onChange={(e) => setSaleContractTry(e.target.value)}
              placeholder={selectedTpl ? minorToTryInput(selectedTpl.listPriceMinor) : ""}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid max-w-[10rem] gap-1 text-xs">
              Satışta tahsil edilen (₺) — boş = peşin yok
              <input
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={firstPaymentTry}
                onChange={(e) => setFirstPaymentTry(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Tahsilat yöntemi
              <select
                className={menuSelectClass}
                value={firstPaymentMethod}
                onChange={(e) =>
                  setFirstPaymentMethod(e.target.value as (typeof PACKAGE_PAYMENT_METHODS)[number])
                }
              >
                {PACKAGE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {packagePaymentMethodLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Müşteri:</span>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="pkg-cust"
                checked={customerMode === "existing"}
                onChange={() => setCustomerMode("existing")}
              />
              Kayıtlı müşteri (ara)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="pkg-cust"
                checked={customerMode === "new"}
                onChange={() => setCustomerMode("new")}
              />
              İlk kez kayıt (yeni müşteri)
            </label>
          </div>

          {customerMode === "existing" ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs">
                Ad veya telefon ile ara
                <input
                  className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              {hits.length > 0 ? (
                <ul className="max-h-36 overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => {
                          setCid(h.id);
                          setQ(h.name);
                          setHits([]);
                        }}
                      >
                        {h.name} — {h.phoneKey}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-zinc-500">Seçili müşteri: {cid ? <strong>{cid}</strong> : "—"}</p>
            </div>
          ) : (
            <div className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Telefon CRM&apos;de benzersizdir; aynı numara varsa mevcut kart güncellenir.
              </p>
              <input
                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Ad soyad *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Cep telefonu * (örn. 05xx…)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <input
                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="E-posta (isteğe bağlı)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            disabled={saleBusy}
            className="w-fit rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
            onClick={async () => {
              if (!saleTemplateId) {
                onError("Paket şablonu seçin");
                return;
              }
              setSaleBusy(true);
              try {
                let crmContactId = cid.trim();
                if (customerMode === "new") {
                  if (!newName.trim() || !newPhone.trim()) {
                    onError("Yeni müşteri için ad ve telefon zorunludur");
                    return;
                  }
                  const cr = await fetch("/api/admin/crm-contacts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newName.trim(),
                      phone: newPhone.trim(),
                      email: newEmail.trim() || null,
                    }),
                  });
                  const { jsonError, data: cj } = await parseResponseJson<{
                    ok?: boolean;
                    contact?: { id: string };
                    error?: string;
                  }>(cr);
                  if (jsonError) {
                    onError(jsonError);
                    return;
                  }
                  if (!cr.ok || !cj.ok || !cj.contact?.id) {
                    onError(cj.error ?? "Müşteri kaydı oluşturulamadı");
                    return;
                  }
                  crmContactId = cj.contact.id;
                }
                if (!crmContactId) {
                  onError("Listeden müşteri seçin");
                  return;
                }
                const tpl = templates.find((x) => x.id === saleTemplateId);
                if (!tpl) {
                  onError("Şablon bulunamadı");
                  return;
                }
                const saleMinor = saleContractTry.trim()
                  ? moneyInputToMinor(saleContractTry)
                  : tpl.listPriceMinor;
                if (saleMinor <= 0) {
                  onError("Paket bedeli sıfırdan büyük olmalı");
                  return;
                }
                const fpMinor = firstPaymentTry.trim() ? moneyInputToMinor(firstPaymentTry) : 0;
                if (fpMinor > saleMinor) {
                  onError("Satıştaki tahsilat paket bedelinden fazla olamaz");
                  return;
                }
                const initialPayments =
                  fpMinor > 0
                    ? [{ amountMinor: fpMinor, method: firstPaymentMethod, memo: null as string | null }]
                    : undefined;
                const pr = await fetch("/api/admin/commerce/package-purchases", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    crmContactId,
                    templateId: saleTemplateId,
                    salePriceMinor: saleMinor,
                    initialPayments,
                  }),
                });
                const { jsonError, data: pj } = await parseResponseJson<{ error?: string }>(pr);
                if (jsonError) {
                  onError(jsonError);
                  return;
                }
                if (!pr.ok) {
                  onError(pj.error ?? "Satış kaydedilemedi");
                  return;
                }
                onOk("Paket satışı kaydedildi");
                setFirstPaymentTry("");
                if (customerMode === "new") {
                  setNewName("");
                  setNewPhone("");
                  setNewEmail("");
                }
                void loadPurchases();
              } finally {
                setSaleBusy(false);
              }
            }}
          >
            {saleBusy ? "Kaydediliyor…" : "Satışı kaydet"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
          onClick={() => {
            void loadPurchases();
            void loadTemplates();
          }}
        >
          Tabloyu yenile
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="p-2">Müşteri</th>
              <th className="p-2">Paket</th>
              <th className="p-2">Seans</th>
              <th className="p-2">Bedel</th>
              <th className="p-2">Tahsil</th>
              <th className="p-2">Kalan</th>
              <th className="p-2">Satın alma</th>
              <th className="p-2">Bitiş</th>
              <th className="p-2 w-24">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-2 align-top">
                    {p.customer ? (
                      <>
                        <div className="font-medium">{p.customer.name}</div>
                        <div className="text-zinc-500">{p.customer.phoneKey}</div>
                        <Link href="/admin/crm" className="mt-1 inline-block text-rose-600 underline">
                          CRM
                        </Link>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <div className="font-medium">{p.template.name}</div>
                    <div className="text-zinc-500">Liste: {p.template.listFormatted}</div>
                    <div className="text-[10px] uppercase text-zinc-400">{p.status}</div>
                  </td>
                  <td className="p-2 align-top font-mono text-[11px]">
                    <div>Top: {p.sessionsTotal}</div>
                    <div>Kull.: {p.sessionsUsed}</div>
                    <div>Kalan: {p.sessionsRemaining}</div>
                  </td>
                  <td className="p-2 align-top font-mono">{p.saleFormatted}</td>
                  <td className="p-2 align-top font-mono">{p.paidFromPaymentsFormatted}</td>
                  <td className="p-2 align-top font-mono">{p.balanceDueFormatted}</td>
                  <td className="p-2 whitespace-nowrap align-top">{p.purchasedAt.slice(0, 10)}</td>
                  <td className="p-2 whitespace-nowrap align-top">{p.expiresAt ? p.expiresAt.slice(0, 10) : "—"}</td>
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      className="text-blue-600 underline dark:text-blue-400"
                      onClick={() => {
                        if (expandedPurchaseId === p.id) {
                          setExpandedPurchaseId(null);
                        } else {
                          setExpandedPurchaseId(p.id);
                          setConsumeCount("1");
                          const first = p.lineDetails[0];
                          setConsumeLabel(
                            first ? menuLabelForServiceKey(menuLabels, first.serviceKey) : "",
                          );
                        }
                      }}
                    >
                      {expandedPurchaseId === p.id ? "Gizle" : "Detay"}
                    </button>
                  </td>
                </tr>
                {expandedPurchaseId === p.id ? (
                  <tr className="border-b border-zinc-100 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <td colSpan={9} className="p-4 align-top">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                            Hizmet / seans
                          </h4>
                          <ul className="space-y-1 text-[11px]">
                            {p.lineDetails.map((l) => (
                              <li key={l.serviceKey} className="rounded border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950">
                                <span className="font-medium">{menuLabelForServiceKey(menuLabels, l.serviceKey)}</span>
                                : toplam {l.sessionsPurchased}, kullanılan {l.used}, kalan{" "}
                                <span className="font-mono">{l.remaining}</span>
                              </li>
                            ))}
                          </ul>
                          <h4 className="mb-2 mt-4 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                            Tahsilat geçmişi
                          </h4>
                          {p.payments.length === 0 ? (
                            <p className="text-[11px] text-zinc-500">Kayıtlı tahsilat yok (eski satışlar tek borç satırı olabilir).</p>
                          ) : (
                            <ul className="space-y-1 text-[11px]">
                              {p.payments.map((pay) => (
                                <li
                                  key={pay.id}
                                  className="flex flex-wrap justify-between gap-2 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                                >
                                  <span>
                                    {pay.paidAt.slice(0, 16).replace("T", " ")} — {pay.methodLabel}
                                    {pay.memo ? ` — ${pay.memo}` : ""}
                                  </span>
                                  <span className="font-mono font-medium">{pay.formatted}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="space-y-5">
                          <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                            <h4 className="mb-2 text-xs font-semibold">Tahsilat ekle</h4>
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="grid gap-1 text-[11px]">
                                Tutar (₺)
                                <input
                                  className="w-24 rounded border px-1 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                                  value={addPayTry}
                                  onChange={(e) => setAddPayTry(e.target.value)}
                                />
                              </label>
                              <label className="grid gap-1 text-[11px]">
                                Yöntem
                                <select
                                  className="rounded border px-1 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
                                  value={addPayMethod}
                                  onChange={(e) =>
                                    setAddPayMethod(e.target.value as (typeof PACKAGE_PAYMENT_METHODS)[number])
                                  }
                                >
                                  {PACKAGE_PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {packagePaymentMethodLabel(m)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <input
                                className="min-w-[8rem] flex-1 rounded border px-1 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
                                placeholder="Not"
                                value={addPayMemo}
                                onChange={(e) => setAddPayMemo(e.target.value)}
                              />
                              <button
                                type="button"
                                className="rounded-full bg-rose-600 px-3 py-1.5 text-[11px] text-white"
                                onClick={async () => {
                                  const amt = moneyInputToMinor(addPayTry);
                                  if (amt <= 0) {
                                    onError("Tutar girin");
                                    return;
                                  }
                                  const r = await fetch(`/api/admin/commerce/package-purchases/${p.id}/payments`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      amountMinor: amt,
                                      method: addPayMethod,
                                      memo: addPayMemo.trim() || null,
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
                                  setAddPayTry("");
                                  setAddPayMemo("");
                                  void loadPurchases();
                                }}
                              >
                                Kaydet
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                            <h4 className="mb-2 text-xs font-semibold">Seans kullanıldı (manuel düş)</h4>
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="grid min-w-0 flex-1 gap-1 text-[11px]">
                                Hizmet
                                <select
                                  className="rounded border px-1 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
                                  value={consumeLabel}
                                  onChange={(e) => setConsumeLabel(e.target.value)}
                                >
                                  {p.lineDetails.map((l) => (
                                    <option
                                      key={l.serviceKey}
                                      value={menuLabelForServiceKey(menuLabels, l.serviceKey)}
                                    >
                                      {menuLabelForServiceKey(menuLabels, l.serviceKey)} (kalan {l.remaining})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-1 text-[11px]">
                                Adet
                                <input
                                  className="w-12 rounded border px-1 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                                  value={consumeCount}
                                  onChange={(e) => setConsumeCount(e.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                className="rounded-full border border-zinc-800 px-3 py-1.5 text-[11px] dark:border-zinc-300"
                                onClick={async () => {
                                  const n = Math.max(1, parseInt(consumeCount, 10) || 1);
                                  const r = await fetch(`/api/admin/commerce/package-purchases/${p.id}/consume-session`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ serviceLabel: consumeLabel, count: n }),
                                  });
                                  const { jsonError, data: j } = await parseResponseJson<{ error?: string }>(r);
                                  if (jsonError) {
                                    onError(jsonError);
                                    return;
                                  }
                                  if (!r.ok) {
                                    onError(j.error ?? "İşlem yapılamadı");
                                    return;
                                  }
                                  onOk("Seans düşüldü");
                                  void loadPurchases();
                                }}
                              >
                                Düş
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-center text-zinc-500">Henüz paket satışı yok.</p> : null}
      </div>
    </div>
  );
}

function CommissionTab({ onError, onOk }: { onError: (s: string) => void; onOk: (s: string) => void }) {
  const { menuLabels, menuLoading } = useMenuServiceLabels();
  const [rows, setRows] = useState<{ id: string; name: string; serviceKey: string | null; percentBps: number | null; fixedMinor: number | null }[]>(
    [],
  );
  const [name, setName] = useState("");
  const [svc, setSvc] = useState("");
  const [pct, setPct] = useState("15");
  const [fix, setFix] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/commerce/commission-rules");
    const { jsonError, data: j } = await parseResponseJson<{ ok?: boolean; items?: typeof rows }>(r);
    if (!jsonError && r.ok && j.items) setRows(j.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4 text-sm">
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-2 text-xs text-zinc-500">
          Yüzde (ör. 15) ve/veya sabit TL. Hizmet seçilmezse kural tüm menü hizmetlerine uygulanır (ilk eşleşen kazanır).
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Kural adı"
            className="rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="grid gap-1 text-xs">
            Hizmet (opsiyonel, menü)
            <select
              className={menuSelectClass}
              value={svc}
              onChange={(e) => setSvc(e.target.value)}
              disabled={menuLoading}
            >
              <option value="">{menuLoading ? "Menü yükleniyor…" : "Tüm hizmetler"}</option>
              {menuLabels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <input
            placeholder="%"
            className="w-16 rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <input
            placeholder="Sabit ₺"
            className="w-20 rounded border px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            value={fix}
            onChange={(e) => setFix(e.target.value)}
          />
          <button
            type="button"
            className="rounded-full bg-rose-600 px-3 py-1.5 text-xs text-white"
            onClick={async () => {
              const percentBps = Math.round((parseFloat(pct.replace(",", ".")) || 0) * 100);
              const fixedMinor = moneyInputToMinor(fix);
              const r = editingId
                ? await fetch("/api/admin/commerce/commission-rules", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: editingId,
                      name: name.trim(),
                      serviceLabel: svc.trim() || null,
                      percentBps: percentBps || null,
                      fixedMinor: fixedMinor || null,
                    }),
                  })
                : await fetch("/api/admin/commerce/commission-rules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: name.trim(),
                      serviceLabel: svc.trim() || null,
                      percentBps: percentBps || null,
                      fixedMinor: fixedMinor || null,
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
              onOk(editingId ? "Kural güncellendi" : "Kural eklendi");
              setName("");
              setSvc("");
              setPct("15");
              setFix("0");
              setEditingId(null);
              void load();
            }}
          >
            {editingId ? "Güncelle" : "Ekle"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
              onClick={() => {
                setEditingId(null);
                setName("");
                setSvc("");
                setPct("15");
                setFix("0");
              }}
            >
              İptal
            </button>
          ) : null}
        </div>
      </div>
      <ul className="text-xs">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-2 dark:border-zinc-800 ${
              editingId === r.id ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
            }`}
          >
            <span>
              {r.name} {r.serviceKey ? `(${menuLabelForServiceKey(menuLabels, r.serviceKey)})` : "(genel)"} — %
              {(r.percentBps ?? 0) / 100} + {formatTryFromMinor(r.fixedMinor ?? 0)}
            </span>
            <span className="flex gap-x-3">
              <button
                type="button"
                className="text-blue-600 underline dark:text-blue-400"
                onClick={() => {
                  setEditingId(r.id);
                  setName(r.name);
                  setSvc(r.serviceKey ? menuLabelForServiceKey(menuLabels, r.serviceKey) : "");
                  setPct(String((r.percentBps ?? 0) / 100));
                  setFix(minorToTryInput(r.fixedMinor ?? 0));
                }}
              >
                Düzenle
              </button>
              <button
                type="button"
                className="text-rose-600 underline"
                onClick={async () => {
                  await fetch(`/api/admin/commerce/commission-rules?id=${encodeURIComponent(r.id)}`, {
                    method: "DELETE",
                  });
                  if (editingId === r.id) {
                    setEditingId(null);
                    setName("");
                    setSvc("");
                    setPct("15");
                    setFix("0");
                  }
                  void load();
                }}
              >
                Sil
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
