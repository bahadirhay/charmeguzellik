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
  saveSettingsLabel?: string;
  categories?: Array<{
    id: string;
    label: string;
    description?: string;
    required?: boolean;
    defaultEnabled?: boolean;
  }>;
};

const STORAGE_KEY = "cookie-consent-choice-v1";
const DEVICE_KEY = "cookie-consent-device-v1";

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
      saveSettingsLabel: "Ayarları Kaydet",
      categories: [
        { id: "functional", label: "Fonksiyonel", description: "Her zaman aktif.", required: true },
        { id: "analytics", label: "İstatistik", description: "Anonim analiz çerezleri.", defaultEnabled: false },
        { id: "marketing", label: "Pazarlama", description: "Reklam ve pazarlama çerezleri.", defaultEnabled: false },
      ],
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
  const categories = cfg.categories?.length
    ? cfg.categories
    : [
        { id: "functional", label: "Fonksiyonel", description: "Her zaman aktif.", required: true, defaultEnabled: true },
        { id: "analytics", label: "İstatistik", description: "Anonim analiz çerezleri.", defaultEnabled: false },
        { id: "marketing", label: "Pazarlama", description: "Reklam ve pazarlama çerezleri.", defaultEnabled: false },
      ];
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return cfg.enabled !== false && !window.localStorage.getItem(STORAGE_KEY);
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of categories) {
      initial[item.id] = item.required ? true : item.defaultEnabled !== false;
    }
    return initial;
  });

  if (!open || cfg.enabled === false) return null;

  const getDeviceKey = () => {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  };

  const save = async (v: "accepted" | "rejected" | "custom", nextPrefs?: Record<string, boolean>) => {
    const applied = nextPrefs ?? prefs;
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
      const consentKey = getDeviceKey();
      await fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentKey, decision: v, preferences: applied }),
      });
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(860px,94vw)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div>
          <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{cfg.title || "Çerez kullanıyoruz."}</h3>
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
          {settingsOpen ? (
            <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
              {categories.map((item) => (
                <label key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-white p-2 dark:bg-zinc-900">
                  <span>
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</span>
                    {item.description ? (
                      <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-300">{item.description}</span>
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={item.required ? true : !!prefs[item.id]}
                    disabled={item.required}
                    onChange={(e) => setPrefs((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() =>
              save(
                "accepted",
                Object.fromEntries(categories.map((item) => [item.id, true])),
              )
            }
          >
            {cfg.acceptLabel || "Hepsini Kabul Et"}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            onClick={() =>
              save(
                "rejected",
                Object.fromEntries(categories.map((item) => [item.id, !!item.required])),
              )
            }
          >
            {cfg.rejectLabel || "Hepsini Reddet"}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            {cfg.settingsLabel || "Ayarlar"}
          </button>
          {settingsOpen ? (
            <button
              type="button"
              className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold"
              onClick={() => save("custom")}
            >
              {cfg.saveSettingsLabel || "Ayarları Kaydet"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
