"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
    >
      Çıkış
    </button>
  );
}
