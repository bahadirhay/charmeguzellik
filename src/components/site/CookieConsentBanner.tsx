"use client";

import { useEffect, useMemo, useState } from "react";

type CookieCategory = {
  id: string;
  label: string;
  /** Kısa satır (accordion başlığında) */
  summary?: string;
  /** Uzun açıklama (açılınca) — yoksa `description` kullanılır */
  detail?: string;
  /** Geriye uyumluluk */
  description?: string;
  required?: boolean;
  /** Varsayılan: işaretli (belirtilmezse seçenekler işaretli gelir) */
  defaultEnabled?: boolean;
};

type CookieCfg = {
  enabled?: boolean;
  title?: string;
  body?: string;
  policyHref?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  settingsLabel?: string;
  saveSettingsLabel?: string;
  categories?: CookieCategory[];
  personalDataNoticeTitle?: string;
  personalDataNoticeItems?: string[];
};

const STORAGE_KEY = "cookie-consent-choice-v1";
const DEVICE_KEY = "cookie-consent-device-v1";

const DEFAULT_PERSONAL_DATA_ITEMS = [
  "Kullanılan Tarayıcı ve İşletim Sistemi: Tarayıcı ve işletim sistemi bilgileri kaydedilir.",
  "IP Adresi: Kullanıcının IP adresi kaydedilir.",
  "Kullanıcı ID: Benzersiz bir kullanıcı kimliği oluşturulur.",
  "Ziyaret Tarihi ve Saati: Kullanıcının siteye erişim tarihi ve saati kaydedilir.",
  "Etkileşim Durumu: Siteye erişim durumu ve hata uyarıları kaydedilir.",
  "Sitedeki Özelliklerin Kullanımı: Kullanıcıların site içindeki etkileşimleri ve özellikleri kullanımları takip edilir.",
  "Arama İfadeleri: Girilen arama ifadeleri kaydedilir.",
  "Site Ziyaret Sıklığı: Kullanıcının siteyi ne sıklıkta ziyaret ettiği kaydedilir.",
  "Dil Tercihleri: Kullanıcı tercihleri ve dil ayarları kaydedilir.",
  "Sayfa Kaydırma Hareketleri: Sayfalar arasındaki kaydırma hareketleri takip edilir.",
  "Erişilen Sekmeler: Hangi sekmelere erişildiği kaydedilir.",
];

const FUNCTIONAL_DETAIL =
  "Zorunlu çerezler; sitenin güvenli şekilde çalışması, oturumun korunması, tercihlerinizi (ör. dil) hatırlamamız için gereklidir. Yasal gereklilikler ve temel işlevsellik dışında pazarlama veya izleme amacıyla kullanılmaz; devre dışı bırakılamaz.";

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
      personalDataNoticeTitle: "Çerezler aracılığıyla kişisel veriler şu şekilde toplanır:",
      personalDataNoticeItems: DEFAULT_PERSONAL_DATA_ITEMS,
      categories: [
        {
          id: "functional",
          label: "Fonksiyonel",
          summary: "Her zaman aktif.",
          detail: FUNCTIONAL_DETAIL,
          required: true,
        },
        {
          id: "analytics",
          label: "İstatistik",
          summary: "Anonim analiz çerezleri.",
          detail:
            "Ziyaretçi sayıları, sayfa görüntülemeleri ve benzeri istatistikleri anonim veya toplu halde analiz etmek için kullanılır. Bu tercihi kapatarak bu tür ölçümlemeyi reddedebilirsiniz.",
          defaultEnabled: true,
        },
        {
          id: "marketing",
          label: "Pazarlama",
          summary: "Reklam ve pazarlama çerezleri.",
          detail:
            "İlgi alanlarınıza uygun içerik ve reklamlar sunmak, kampanya performansını ölçmek için kullanılabilir. İstemediğinizde kapatabilirsiniz.",
          defaultEnabled: true,
        },
      ],
    };
  }
  try {
    return JSON.parse(raw) as CookieCfg;
  } catch {
    return { enabled: false };
  }
}

function categoryHeaderLine(c: CookieCategory): string {
  if (c.summary?.trim()) return c.summary.trim();
  if (c.description?.trim()) {
    const d = c.description.trim();
    if (c.detail?.trim()) return d;
    return d.length > 100 ? `${d.slice(0, 97)}…` : d;
  }
  return "";
}

function categoryDetailText(c: CookieCategory): string {
  if (c.detail?.trim()) return c.detail.trim();
  if (c.description?.trim()) return c.description.trim();
  return "";
}

function shouldShowExpandedDetail(c: CookieCategory): boolean {
  const header = categoryHeaderLine(c);
  const detail = categoryDetailText(c);
  if (!detail) return false;
  if (!header) return true;
  return detail !== header;
}

export function CookieConsentBanner({ rawConfig }: { rawConfig: string | null | undefined }) {
  const cfg = useMemo(() => parseCfg(rawConfig), [rawConfig]);
  const categories = cfg.categories?.length
    ? cfg.categories
    : [
        {
          id: "functional",
          label: "Fonksiyonel",
          summary: "Her zaman aktif.",
          detail: FUNCTIONAL_DETAIL,
          required: true,
        },
        {
          id: "analytics",
          label: "İstatistik",
          summary: "Anonim analiz çerezleri.",
          detail:
            "Ziyaretçi sayıları, sayfa görüntülemeleri ve benzeri istatistikleri anonim veya toplu halde analiz etmek için kullanılır.",
          defaultEnabled: true,
        },
        {
          id: "marketing",
          label: "Pazarlama",
          summary: "Reklam ve pazarlama çerezleri.",
          detail:
            "İlgi alanlarınıza uygun içerik ve reklamlar sunmak, kampanya performansını ölçmek için kullanılabilir.",
          defaultEnabled: true,
        },
      ];

  const noticeTitle =
    cfg.personalDataNoticeTitle?.trim() || "Çerezler aracılığıyla kişisel veriler şu şekilde toplanır:";
  const noticeItems =
    cfg.personalDataNoticeItems?.length ? cfg.personalDataNoticeItems : DEFAULT_PERSONAL_DATA_ITEMS;

  /** Sunucu ve istemcinin ilk boyaması aynı olmalı; localStorage sadece mount sonrası okunur. */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (cfg.enabled === false) {
      setOpen(false);
      return;
    }
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [cfg.enabled]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of categories) {
      if (item.required) {
        initial[item.id] = true;
      } else {
        // Üç seçenek de varsayılan işaretli: defaultEnabled belirtilmediyse true
        initial[item.id] = item.defaultEnabled !== false;
      }
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
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(860px,94vw)] max-h-[min(78vh,calc(100vh-2rem))] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-4 md:grid-cols-[1.45fr_1fr] md:items-start">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            {cfg.title || "Çerez kullanıyoruz."}
          </h3>
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
            <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/60 sm:p-3">
              {categories.map((item) => {
                const header = categoryHeaderLine(item);
                const detail = categoryDetailText(item);
                const showExpanded = shouldShowExpandedDetail(item);
                return (
                  <div
                    key={item.id}
                    className="flex gap-2 rounded-lg border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                  >
                    <details className="group min-w-0 flex-1 [&>summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-start gap-2 px-2 py-2.5 sm:px-3">
                        <span
                          className="mt-0.5 inline-block shrink-0 text-zinc-400 transition-transform group-open:rotate-90"
                          aria-hidden
                        >
                          ▶
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {item.label}
                            </span>
                            {item.required ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                Her zaman aktif
                              </span>
                            ) : null}
                          </span>
                          {header ? (
                            <span className="mt-1 block text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                              {header}
                            </span>
                          ) : null}
                        </span>
                      </summary>
                      {showExpanded ? (
                        <div className="border-t border-zinc-100 px-2 pb-2.5 pl-8 pr-2 pt-2 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-300 sm:px-3 sm:pl-9">
                          {detail}
                        </div>
                      ) : null}
                    </details>
                    <div className="flex shrink-0 items-center border-l border-zinc-100 px-2 dark:border-zinc-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={item.required ? true : !!prefs[item.id]}
                        disabled={item.required}
                        aria-label={item.label}
                        onChange={(e) => setPrefs((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-900">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{noticeTitle}</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {noticeItems.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 md:sticky md:top-0">
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
