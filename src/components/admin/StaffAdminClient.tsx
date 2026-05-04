"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RoleRow = { id: string; slug: string; label: string; permissionsJson: string };
type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  active: boolean;
  roleId: string;
  roleSlug: string;
  roleLabel: string;
};

export function StaffAdminClient({ roles, users: initialUsers }: { roles: RoleRow[]; users: UserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nu, setNu] = useState({ username: "", password: "", roleId: roles[0]?.id ?? "", displayName: "" });

  async function refresh() {
    const res = await fetch("/api/admin/staff/users", { credentials: "same-origin" });
    if (!res.ok) return;
    const j = (await res.json()) as { users: UserRow[] };
    setUsers(j.users);
    router.refresh();
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/admin/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username: nu.username,
        password: nu.password,
        roleId: nu.roleId,
        displayName: nu.displayName || null,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErr(j.error ?? "Kayıt başarısız");
      return;
    }
    setMsg("Kullanıcı eklendi.");
    setNu({ username: "", password: "", roleId: roles[0]?.id ?? "", displayName: "" });
    await refresh();
  }

  async function patchUser(id: string, patch: { active?: boolean; roleId?: string; password?: string }) {
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/admin/staff/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErr(j.error ?? "Güncellenemedi");
      return;
    }
    setMsg("Güncellendi.");
    await refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Personel & roller</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Kullanıcı adı ve şifre ile giriş. <strong>Yönetici</strong> site ayarları ve entegrasyonları;{" "}
          <strong>Editör</strong> sayfalar, site düzeni ve menü; <strong>Randevu operatörü</strong> yalnızca randevu
          ekranına erişir. Ortam değişkeniyle giriş yapan hesap tam yetkilidir.
        </p>
      </div>

      {msg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-2">Kullanıcı</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Aktif</th>
              <th className="px-3 py-2">Şifre</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <span className="font-mono font-medium">{u.username}</span>
                  {u.displayName ? <div className="text-xs text-zinc-500">{u.displayName}</div> : null}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    value={u.roleId}
                    onChange={(e) => patchUser(u.id, { roleId: e.target.value })}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={u.active}
                      onChange={(e) => patchUser(u.id, { active: e.target.checked })}
                    />
                    Aktif
                  </label>
                </td>
                <td className="px-3 py-2">
                  <UserPasswordReset userId={u.id} onDone={refresh} onError={setErr} onOk={setMsg} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Yeni kullanıcı</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={addUser}>
          <label className="grid gap-1 text-xs">
            Kullanıcı adı
            <input
              required
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
              value={nu.username}
              onChange={(e) => setNu((s) => ({ ...s, username: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Görünen ad (isteğe bağlı)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={nu.displayName}
              onChange={(e) => setNu((s) => ({ ...s, displayName: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Şifre (en az 8)
            <input
              required
              type="password"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={nu.password}
              onChange={(e) => setNu((s) => ({ ...s, password: e.target.value }))}
              autoComplete="new-password"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Rol
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={nu.roleId}
              onChange={(e) => setNu((s) => ({ ...s, roleId: e.target.value }))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Kullanıcı oluştur
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3 text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">Rol yetkileri (özet)</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {roles.map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong> —{" "}
              {(() => {
                try {
                  const arr = JSON.parse(r.permissionsJson) as string[];
                  return Array.isArray(arr) ? arr.join(", ") : r.permissionsJson;
                } catch {
                  return r.permissionsJson;
                }
              })()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UserPasswordReset({
  userId,
  onDone,
  onError,
  onOk,
}: {
  userId: string;
  onDone: () => Promise<void>;
  onError: (s: string | null) => void;
  onOk: (s: string | null) => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (pw.length < 8) {
      onError("Şifre en az 8 karakter");
      return;
    }
    setBusy(true);
    onError(null);
    const res = await fetch(`/api/admin/staff/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: pw }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      onError(j.error ?? "Hata");
      return;
    }
    setPw("");
    onOk("Şifre güncellendi.");
    await onDone();
  }

  return (
    <div className="flex flex-wrap items-end gap-1">
      <input
        type="password"
        placeholder="Yeni şifre"
        className="min-w-[8rem] max-w-[10rem] rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password"
      />
      <button
        type="button"
        disabled={busy || pw.length < 8}
        onClick={save}
        className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950"
      >
        Kaydet
      </button>
    </div>
  );
}
