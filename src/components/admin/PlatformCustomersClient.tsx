"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type TenantListRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  isPlatformTenant: boolean;
  appointmentsEnabled: boolean;
  pageCount: number;
  hosts: Array<{ host: string; primary: boolean }>;
};

export function PlatformCustomersClient({
  initialTenants,
  platformTenantId,
}: {
  initialTenants: TenantListRow[];
  platformTenantId: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialTenants);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [cloneContent, setCloneContent] = useState(true);
  const [newTenantAppointments, setNewTenantAppointments] = useState(true);
  const [featureBusyId, setFeatureBusyId] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.slug.localeCompare(b.slug)), [rows]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const body: Record<string, unknown> = {
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        host: host.trim().toLowerCase(),
        cloneContent,
        appointmentsEnabled: newTenantAppointments,
      };
      const p = adminPass.trim();
      if (p.length > 0) {
        body.adminUsername = adminUser.trim().toLowerCase() || "admin";
        body.adminPassword = p;
      }
      const res = await fetch("/api/admin/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        adminBootstrapNote?: string;
      };
      if (!res.ok) {
        setFeedback({ ok: false, text: j.error ?? `Hata (${res.status})` });
        return;
      }
      setFeedback({
        ok: true,
        text: ["Kiracı oluşturuldu.", j.adminBootstrapNote].filter(Boolean).join(" "),
      });
      setSlug("");
      setName("");
      setHost("");
      setAdminPass("");
      router.refresh();
      const listed = await fetch("/api/admin/platform/tenants", { credentials: "same-origin" }).then((r) =>
        r.json().catch(() => null),
      ) as { tenants?: TenantListRow[] } | null;
      if (listed?.tenants) setRows(listed.tenants);
    } finally {
      setBusy(false);
    }
  }

  async function setTenantAppointmentsEnabled(tenantId: string, next: boolean) {
    setFeatureBusyId(tenantId);
    try {
      const res = await fetch(`/api/admin/platform/tenants/${tenantId}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ appointmentsEnabled: next }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFeedback({ ok: false, text: j.error ?? `Özellik güncellenemedi (${res.status})` });
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === tenantId ? { ...r, appointmentsEnabled: next } : r)));
      setFeedback({ ok: true, text: next ? "Randevu modülü açıldı." : "Randevu modülü kapatıldı." });
    } finally {
      setFeatureBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Müşteri siteleri</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Yeni müşteri (kiracı) ve alan adı eşlemesi oluşturun. Charmeguzellik gibi kiracılar burada görünür. Bu panel
          yalnızca platform kontrol kiracınız için açılır (<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">PLATFORM_CONTROL_TENANT_ID</code>).
          {platformTenantId ? (
            <span className="ml-1 font-mono text-xs text-zinc-500">Şu id: {platformTenantId.slice(0, 8)}…</span>
          ) : (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              PLATFORM_CONTROL_TENANT_ID eksik — Vercel’de ayarlayın.
            </span>
          )}
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium">Yeni müşteri oluştur</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Slug (kiracı)</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="ornek-salon"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Görünen ad</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="Örnek Güzellik"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Alan adı (TenantDomain)</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="www.firmaadi.com veya subdomain.site.com"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cloneContent}
            onChange={(e) => setCloneContent(e.target.checked)}
            className="rounded border-zinc-400"
          />
          Varsayılan şablondan sayfa ve menü kopyala (önerilen)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={newTenantAppointments}
            onChange={(e) => setNewTenantAppointments(e.target.checked)}
            className="rounded border-zinc-400"
          />
          Randevu modülünü başlangıçta aç (işareti kaldırırsanız müşteri sitesinde randevu kapalı oluşur)
        </label>
        <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">İlk panel kullanıcısı (isteğe bağlı)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <input
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              placeholder="Kullanıcı adı (varsayılan admin)"
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              type="password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="Şifre (boş = panel kullanıcısı yok)"
              autoComplete="new-password"
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <p className="mt-2">
            Şifre en az <strong className="text-zinc-800 dark:text-zinc-200">8</strong> karakter olmalı. Boş bırakırsanız müşteri
            panel kullanıcısını daha sonra oluşturmak zorunda kalır veya ENV legacy ile ilk giriş tanımlanır.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? "Oluşturuluyor…" : "Kiracıyı oluştur"}
        </button>
        {feedback ? (
          <p className={`text-sm ${feedback.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {feedback.text}
          </p>
        ) : null}
      </form>

      <section>
        <h2 className="mb-3 text-lg font-medium">Kayıtlı kiracılar</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Ad</th>
                <th className="px-3 py-2 font-medium">Alan adları</th>
                <th className="px-3 py-2 font-medium">Randevu</th>
                <th className="px-3 py-2 font-medium">Sayfa</th>
                <th className="px-3 py-2 font-medium">Not</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="max-w-[240px] px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {t.hosts.length ? (
                      <ul className="list-disc pl-4">
                        {t.hosts.map((h) => (
                          <li key={h.host}>
                            {h.host}
                            {h.primary ? (
                              <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                birincil
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.isPlatformTenant ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.appointmentsEnabled}
                          disabled={featureBusyId === t.id}
                          onChange={(e) => void setTenantAppointmentsEnabled(t.id, e.target.checked)}
                          className="rounded border-zinc-400"
                        />
                        <span className="text-zinc-500">{featureBusyId === t.id ? "…" : t.appointmentsEnabled ? "açık" : "kapalı"}</span>
                      </label>
                    )}
                  </td>
                  <td className="px-3 py-2">{t.pageCount}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.isPlatformTenant ? (
                      <span className="text-rose-600 dark:text-rose-400">Platform (siz)</span>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">{t.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
