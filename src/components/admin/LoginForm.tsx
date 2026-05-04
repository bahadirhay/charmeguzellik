"use client";

import { useState } from "react";

export function LoginForm() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.trim(), password }),
    });
    if (res.ok) window.location.href = "/admin/dashboard";
    else setErr(true);
  }

  return (
    <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        Kullanıcı adı veya admin e-postası
        <input
          type="text"
          required
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
        />
      </label>
      <label className="text-sm text-zinc-700 dark:text-zinc-300">
        Şifre
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
        />
      </label>
      {err ? <p className="text-sm text-red-600">Giriş başarısız</p> : null}
      <button
        type="submit"
        className="mt-2 rounded-full bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-700"
      >
        Giriş
      </button>
    </form>
  );
}
