"use client";

import { useMemo, useState } from "react";

type CookieCfg = {
  enabled?: boolean;
  title?: string;
  body?: string;
  policyHref?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  settingsLabel?: string;
};

const STORAGE_KEY = "cookie-consent-choice-v1";

function parseCfg(raw: string | null | undefined): CookieCfg {
  if (!raw?.trim()) {
    return {
      enabled: true,
      title: "Çerez kullanıyoruz.",
      body:
        "İnternet sitesinin sağlanması ve kullanıcı deneyiminin iyileştirilmesi için çerezlerden yararlanıyoruz. Tercihlerinizi ayarlardan yönetebilirsiniz.",
      policyHref: "/cerez-aydinlatma",
      acceptLabel: "Hepsini Kabul Et",
      rejectLabel: "Hepsini Reddet",
      settingsLabel: "Ayarlar",
    };
  }
  try {
    return JSON.parse(raw) as CookieCfg;
  } catch {
    return { enabled: false };
  }
}

export function CookieConsentBanner({ rawConfig }: { rawConfig: string | null | undefined }) {
  const cfg = useMemo(() => parseCfg(rawConfig), [rawConfig]);
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return cfg.enabled !== false && !window.localStorage.getItem(STORAGE_KEY);
  });

  if (!open || cfg.enabled === false) return null;

  const save = (v: "accepted" | "rejected") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(980px,94vw)] rounded-3xl border border-zinc-300 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{cfg.title || "Çerez kullanıyoruz."}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {cfg.body}
        {cfg.policyHref ? (
          <>
            {" "}
            <a href={cfg.policyHref} className="underline">
              Çerez Aydınlatma Metni
            </a>
          </>
        ) : null}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full border border-zinc-400 px-6 py-2.5 text-lg font-semibold"
          onClick={() => save("accepted")}
        >
          {cfg.acceptLabel || "Hepsini Kabul Et"}
        </button>
        <button
          type="button"
          className="rounded-full border border-zinc-400 px-6 py-2.5 text-lg font-semibold"
          onClick={() => save("rejected")}
        >
          {cfg.rejectLabel || "Hepsini Reddet"}
        </button>
        <button
          type="button"
          className="rounded-full border border-zinc-400 px-6 py-2.5 text-lg font-semibold"
          onClick={() => setOpen(false)}
        >
          {cfg.settingsLabel || "Ayarlar"}
        </button>
      </div>
    </div>
  );
}
