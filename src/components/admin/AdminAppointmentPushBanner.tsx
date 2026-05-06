"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type BannerState = "loading" | "unsupported" | "need_config" | "ready" | "subscribed" | "denied" | "error";

export function AdminAppointmentPushBanner() {
  const [state, setState] = useState<BannerState>("loading");
  const [hint, setHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const res = await fetch("/api/admin/push/vapid-public", { cache: "no-store" });
    if (!res.ok) {
      setState("need_config");
      return;
    }
    setState("ready");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.pushManager) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) setState("subscribed");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") setState("denied");
  }, []);

  async function enablePush() {
    setHint(null);
    try {
      const res = await fetch("/api/admin/push/vapid-public", { cache: "no-store" });
      const j = (await res.json()) as { publicKey?: string; error?: string };
      if (!res.ok || !j.publicKey) {
        setState("need_config");
        setHint(j.error ?? null);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setHint("Bildirim izni verilmedi.");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

      const key = urlBase64ToUint8Array(j.publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
      const save = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(sub.toJSON()),
      });
      if (!save.ok) {
        const err = (await save.json().catch(() => ({}))) as { error?: string };
        setState("error");
        setHint(err.error ?? "Kayıt başarısız.");
        return;
      }
      setState("subscribed");
      setHint(null);
    } catch (e) {
      setState("error");
      setHint(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  }

  async function disablePush() {
    setHint(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await fetch(`/api/admin/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        await sub.unsubscribe();
      }
      setState("ready");
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Kapatılamadı");
    }
  }

  if (state === "loading") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        Bildirim durumu yükleniyor…
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        Bu tarayıcı Web Push desteklemiyor. Yeni randevu uyarıları için e-posta bildirimleri kullanılmaya devam eder.
      </div>
    );
  }

  if (state === "need_config") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Telefon bildirimleri henüz sunucuda açılmamış.</p>
        <p className="mt-1">
          Vercel ortamına{" "}
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">VAPID_PUBLIC_KEY</code> ve{" "}
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">VAPID_PRIVATE_KEY</code> ekleyin; aynı public
          anahtarı <code className="rounded bg-white/80 px-1 dark:bg-black/30">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>{" "}
          olarak da tanımlayın. Üretmek için:{" "}
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">npx --yes web-push generate-vapid-keys</code>
        </p>
        {hint ? <p className="mt-1 text-amber-800 dark:text-amber-200">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Yeni randevu — telefon bildirimi (Web Push)</p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Mağaza uygulaması yerine tarayıcı bildirimi kullanılır (Android Chrome önerilir). iOS’ta çoğunlukla siteyi{" "}
        <strong>Ana ekrana ekle</strong> sonrası bildirim çalışır (iOS 16.4+).
      </p>
      {state === "denied" ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
          Tarayıcı bildirimleri engellenmiş. Adres çubuğundaki kilit / site ayarından bildirime izin verin.
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {state === "subscribed" ? (
          <>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Bildirimler açık
            </span>
            <button
              type="button"
              onClick={() => void disablePush()}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
            >
              Kapat
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void enablePush()}
            className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
          >
            Bu cihazda bildirimleri aç
          </button>
        )}
      </div>
    </div>
  );
}
