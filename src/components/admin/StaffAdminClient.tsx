"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StaffUserDeleteDialog } from "@/components/admin/StaffUserDeleteDialog";

type RoleRow = { id: string; slug: string; label: string; permissionsJson: string };
type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  active: boolean;
  roleIds: string[];
  rolesSummary: string;
};

function defaultRoleIdsForNewUser(roles: RoleRow[]): string[] {
  const admin = roles.find((r) => r.slug === "admin");
  if (admin) return [admin.id];
  return roles[0]?.id ? [roles[0].id] : [];
}

export function StaffAdminClient({ roles, users: initialUsers }: { roles: RoleRow[]; users: UserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [personelTab, setPersonelTab] = useState<"active" | "passive">("active");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const activeUsers = useMemo(() => users.filter((u) => u.active), [users]);
  const passiveUsers = useMemo(() => users.filter((u) => !u.active), [users]);
  const transferCandidates = useMemo(
    () =>
      users
        .filter((u) => u.active && u.id !== deleteUserId)
        .map((u) => ({ id: u.id, username: u.username, displayName: u.displayName })),
    [users, deleteUserId],
  );

  const initialPick = useMemo(() => defaultRoleIdsForNewUser(roles), [roles]);
  const [nu, setNu] = useState({
    username: "",
    password: "",
    displayName: "",
    roleIds: initialPick,
  });

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
    if (nu.roleIds.length === 0) {
      setErr("En az bir rol seçin.");
      return;
    }
    const res = await fetch("/api/admin/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username: nu.username,
        password: nu.password,
        roleIds: nu.roleIds,
        displayName: nu.displayName || null,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErr(j.error ?? "Kayıt başarısız");
      return;
    }
    setMsg("Kullanıcı eklendi.");
    setNu({ username: "", password: "", displayName: "", roleIds: defaultRoleIdsForNewUser(roles) });
    await refresh();
  }

  async function patchUser(
    id: string,
    patch: { active?: boolean; roleIds?: string[]; password?: string },
  ) {
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

  function toggleUserRole(userId: string, currentIds: string[], roleId: string, checked: boolean) {
    const next = checked
      ? [...new Set([...currentIds, roleId])]
      : currentIds.filter((id) => id !== roleId);
    if (next.length === 0) {
      setErr("En az bir rol kalmalı.");
      return;
    }
    void patchUser(userId, { roleIds: next });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Personel & roller</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Her kullanıcıya <strong>birden fazla rol</strong> atanabilir; yetkiler rollerin birleşimidir.{" "}
          <strong>Yönetici</strong> tam yetki; <strong>Editör</strong> genel ayarlar ve tema hariç panel;{" "}
          <strong>Ticaret</strong> kasa/cari/paket; <strong>Randevu operatörü</strong> randevu ekranı. Ortam
          değişkeniyle giriş tam yetkilidir.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          İşten ayrılan için <strong>Aktif</strong> kutusunu kapatın: giriş yapamaz, randevu{" "}
          <strong>Personel planlama</strong> listesinde görünmez. Pasif personel ayrı sekmede listelenir. Kaydı tamamen
          kaldırmak için <strong>Pasif personel</strong> sekmesinden <strong>Kalıcı sil</strong>: randevu ataması, tema
          personel eşlemesi ve kasa/prim bağlantıları önce seçtiğiniz aktif personele aktarılır (özet diyalogda
          görülür); bağlantı yoksa doğrudan silinir.
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Kiracı <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">Tenant.featuresJson</code>: randevu
          varsayılan açık; <strong>ticaret yalnızca</strong>{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">commerce: true</code> ile açılır (panel: Site
          modülleri). Neon örnek:{" "}
          <code className="break-all rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            {`UPDATE "Tenant" SET "featuresJson" = COALESCE("featuresJson", '{}'::jsonb) || '{"commerce":true}'::jsonb WHERE "slug" = '…';`}
          </code>{" "}
          Rol yetkileri: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">StaffRole.permissionsJson</code>{" "}
          (string içinde JSON dizi).
        </p>
      </div>

      {msg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setPersonelTab("active")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            personelTab === "active"
              ? "bg-rose-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Aktif personel ({activeUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setPersonelTab("passive")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            personelTab === "passive"
              ? "bg-rose-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Pasif personel ({passiveUsers.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-2">Kullanıcı</th>
              <th className="min-w-[200px] px-3 py-2">Roller</th>
              <th className="px-3 py-2">Aktif</th>
              <th className="px-3 py-2">Şifre</th>
              {personelTab === "passive" ? <th className="px-3 py-2">İşlem</th> : null}
            </tr>
          </thead>
          <tbody>
            {(personelTab === "active" ? activeUsers : passiveUsers).length === 0 ? (
              <tr>
                <td
                  colSpan={personelTab === "passive" ? 5 : 4}
                  className="px-3 py-8 text-center text-sm text-zinc-500"
                >
                  {personelTab === "active"
                    ? "Aktif personel kaydı yok."
                    : "Pasif personel yok. İşten çıkan için «Aktif» kutusunu kaldırın."}
                </td>
              </tr>
            ) : (
              (personelTab === "active" ? activeUsers : passiveUsers).map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 align-top">
                  <span className="font-mono font-medium">{u.username}</span>
                  {u.displayName ? <div className="text-xs text-zinc-500">{u.displayName}</div> : null}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex max-w-xs flex-col gap-1.5 text-xs">
                    {roles.map((r) => (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-400"
                          checked={u.roleIds.includes(r.id)}
                          onChange={(e) => toggleUserRole(u.id, u.roleIds, r.id, e.target.checked)}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                  {u.rolesSummary ? (
                    <p className="mt-2 text-[10px] text-zinc-500">Özet: {u.rolesSummary}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={u.active}
                      onChange={(e) => void patchUser(u.id, { active: e.target.checked })}
                    />
                    Aktif
                  </label>
                </td>
                <td className="px-3 py-2 align-top">
                  <UserPasswordReset userId={u.id} onDone={refresh} onError={setErr} onOk={setMsg} />
                </td>
                {personelTab === "passive" ? (
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => {
                        setErr(null);
                        setDeleteUserId(u.id);
                      }}
                      className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      Kalıcı sil…
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
      {personelTab === "active" && passiveUsers.length > 0 ? (
        <p className="text-xs text-zinc-500">
          {passiveUsers.length} pasif kayıt — <button type="button" className="text-rose-600 underline" onClick={() => setPersonelTab("passive")}>Pasif personel</button> sekmesinden yönetin.
        </p>
      ) : null}

      <StaffUserDeleteDialog
        open={deleteUserId !== null}
        userId={deleteUserId}
        candidates={transferCandidates}
        onClose={() => setDeleteUserId(null)}
        onDone={async () => {
          setMsg("Kullanıcı silindi.");
          await refresh();
        }}
      />

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
          <div className="grid gap-2 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Roller (birden fazla işaretlenebilir)
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-400"
                    checked={nu.roleIds.includes(r.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setNu((s) => ({
                        ...s,
                        roleIds: on
                          ? [...new Set([...s.roleIds, r.id])]
                          : s.roleIds.filter((id) => id !== r.id),
                      }));
                    }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
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
