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

type PushHealth = { sendReady: boolean; subscriptionCount: number };

export function AdminAppointmentPushBanner() {
  const [state, setState] = useState<BannerState>("loading");
  const [hint, setHint] = useState<string | null>(null);
  const [pushHealth, setPushHealth] = useState<PushHealth | null>(null);

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
      const active = reg?.active ?? reg?.installing ?? reg?.waiting;
      if (!reg?.pushManager || !active) return;
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

  useEffect(() => {
    if (state === "loading" || state === "unsupported" || state === "need_config") {
      setPushHealth(null);
      return;
    }
    void fetch("/api/admin/push/health", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setPushHealth(j as PushHealth))
      .catch(() => setPushHealth(null));
  }, [state]);

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
      /** Önce kayıt; PushManager etkin bir Service Worker olmadan subscribe etmez. */
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;

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
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <p>
          Bu ortamda Web Push kullanılamıyor. Yeni randevu uyarıları için e-posta bildirimleri kullanılmaya devam eder.
        </p>
        {isIOS && !isStandalone ? (
          <p className="mt-2 border-t border-amber-300/60 pt-2 dark:border-amber-700/60">
            <span className="font-medium">iPhone / iPad:</span> Bu ekranda uyarı varken tarayıcı bildirimi{" "}
            <strong>açılamaz</strong> — sunucuya abonelik kaydı gitmez; yeni randevuda push da gelmez (e-posta devam
            eder). <strong>iOS’ta Chrome Web Push desteklemez</strong>;{" "}
            <strong>Safari</strong> kullanın. Paylaş menüsünde &quot;Ana Ekrana Ekle&quot; listede{" "}
            <strong>altta</strong> kalabilir — aşağı kaydırın. Siteyi ana ekrana ekleyip{" "}
            <strong>o kısayoldan</strong> açın (iOS 16.4+), sonra bildirime izin verin.
          </p>
        ) : null}
        {isIOS && isStandalone ? (
          <p className="mt-2 border-t border-amber-300/60 pt-2 dark:border-amber-700/60">
            Ana ekrandan açıkken hâlâ görünüyorsa iOS sürümünüzü kontrol edin (16.4+). Geçici olarak e-posta uyarılarını
            kullanın veya Android / masaüstü Chrome ile panelden push açın.
          </p>
        ) : null}
      </div>
    );
  }

  if (state === "need_config") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Telefon bildirimleri henüz sunucuda açılmamış.</p>
        <p className="mt-1">
          Vercel ortamına <code className="rounded bg-white/80 px-1 dark:bg-black/30">VAPID_PRIVATE_KEY</code> (gizli) ve
          açık anahtarı{" "}
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>{" "}
          veya <code className="rounded bg-white/80 px-1 dark:bg-black/30">VAPID_PUBLIC_KEY</code>{" "}
          olarak ekleyin — <strong>üçü aynı web-push çiftinden</strong> olmalı. Üretmek için:{" "}
          <code className="rounded bg-white/80 px-1 dark:bg-black/30">npx --yes web-push generate-vapid-keys</code>{" "}
          Sonra <strong>Redeploy</strong>.
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
      {pushHealth && !pushHealth.sendReady ? (
        <p className="mt-3 border-t border-zinc-200 pt-2 text-xs text-amber-800 dark:border-zinc-700 dark:text-amber-200">
          Sunucu tarafında push gönderimi kapalı (VAPID private veya eşleşen public anahtar eksik). Vercel ortam
          değişkenlerini kontrol edin; özellikle sadece{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> varken{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">VAPID_PRIVATE_KEY</code>{" "}
          tanımlı mı ve <strong>aynı çift</strong> mü — sonra Redeploy.
        </p>
      ) : null}
      {pushHealth?.sendReady && pushHealth.subscriptionCount === 0 && state !== "subscribed" ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Veritabanında kayıtlı push cihazı yok; randevu gelince bildirim gidemez. Bu tarayıcıda &quot;Bu cihazda
          bildirimleri aç&quot; ile kayıt oluşturun.
        </p>
      ) : null}
      {pushHealth?.sendReady && state === "subscribed" ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Sunucu gönderimi hazır. Kayıtlı push cihazı: {pushHealth.subscriptionCount}
        </p>
      ) : null}
    </div>
  );
}
