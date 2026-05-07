"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContactFormNavSourceFields } from "@/components/admin/ContactFormNavSourceFields";
import { EditorLivePreview } from "@/components/admin/EditorLivePreview";
import { MarketingFooterBlockFields } from "@/components/admin/MarketingFooterBlockFields";
import { createMarketingFooterBlock } from "@/lib/blocks/marketing-footer-default";
import { HERO_SLIDER_MAX_SLIDES, type PageBlock } from "@/lib/blocks/schema";
import {
  DEFAULT_APPOINTMENT_DAYS,
  mergeAppointmentDays,
  WEEKDAY_LABELS_TR,
} from "@/lib/appointment-schedule";
import {
  PAGE_LAYOUT_PRESET_LIST,
  getPageLayoutPresetBlocks,
  type PageLayoutPresetId,
} from "@/lib/page-layout-presets";
import { TESTIMONIAL_LAYOUT_ADMIN_HINT } from "@/lib/testimonial-admin-footnotes";

type HeroSliderBlock = Extract<PageBlock, { type: "heroSlider" }>;

function parseBulkSliderJson(raw: string): { slides: HeroSliderBlock["props"]["slides"]; error: string | null } {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim() || "[]");
  } catch {
    return { slides: [], error: "Geçersiz JSON" };
  }
  if (!Array.isArray(data)) {
    return { slides: [], error: "Kök bir dizi [ ] olmalı" };
  }
  const out: HeroSliderBlock["props"]["slides"] = [];
  for (const row of data) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl.trim() : "";
    if (!imageUrl) continue;
    const ax = r.contentAlignX;
    const ay = r.contentAlignY;
    const contentAlignX =
      ax === "left" || ax === "center" || ax === "right" ? ax : undefined;
    const contentAlignY =
      ay === "top" || ay === "center" || ay === "bottom" ? ay : undefined;
    out.push({
      id: nanoid(),
      imageUrl,
      headline: typeof r.headline === "string" ? r.headline : undefined,
      subline: typeof r.subline === "string" ? r.subline : undefined,
      href: typeof r.href === "string" ? r.href : undefined,
      ctaLabel: typeof r.ctaLabel === "string" ? r.ctaLabel : undefined,
      contentAlignX,
      contentAlignY,
    });
    if (out.length >= HERO_SLIDER_MAX_SLIDES) break;
  }
  return { slides: out, error: null };
}

function HeroSliderBlockFields({
  block,
  onChange,
}: {
  block: HeroSliderBlock;
  onChange: (b: PageBlock) => void;
}) {
  const [bulkJson, setBulkJson] = useState("");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const slides = block.props.slides;
  const patchSlides = (next: typeof slides) => {
    const capped = next.slice(0, HERO_SLIDER_MAX_SLIDES);
    if (capped.length < 1) return;
    onChange({ ...block, props: { ...block.props, slides: capped } });
  };
  const setProps = (patch: Record<string, unknown>) => {
    onChange({ ...block, props: { ...block.props, ...patch } } as PageBlock);
  };
  const updateSlide = (sid: string, patch: Partial<(typeof slides)[0]>) => {
    patchSlides(slides.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
  };
  const moveSlide = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    const t = next[idx]!;
    next[idx] = next[j]!;
    next[j] = t;
    patchSlides(next);
  };

  const applyBulk = (mode: "replace" | "append") => {
    setBulkMsg(null);
    const { slides: parsed, error } = parseBulkSliderJson(bulkJson);
    if (error) {
      setBulkMsg(error);
      return;
    }
    if (parsed.length < 1) {
      setBulkMsg("En az bir geçerli imageUrl gerekli");
      return;
    }
    if (mode === "replace") {
      patchSlides(parsed);
      setBulkMsg(`${parsed.length} slayt yüklendi.`);
      return;
    }
    const merged = [...slides, ...parsed].slice(0, HERO_SLIDER_MAX_SLIDES);
    if (merged.length < 1) return;
    patchSlides(merged);
    setBulkMsg(`${parsed.length} slayt eklendi (toplam ${merged.length}).`);
  };

  return (
    <div className="mt-3 space-y-4 text-sm">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Bu blokta en fazla <strong>{HERO_SLIDER_MAX_SLIDES}</strong> slayt olabilir.{" "}
        <strong>+ Bu slayta görsel ekle</strong> (yalnızca bu slayt bloğu içinde) veya aşağıdaki JSON ile toplu ekleyin.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1">
          Otomatik geçiş (ms, 0=kapalı)
          <input
            type="number"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={block.props.autoplayMs ?? 6000}
            onChange={(e) => setProps({ autoplayMs: Number(e.target.value) })}
          />
        </label>
        <label className="grid gap-1">
          Oran
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={block.props.aspectRatio ?? "wide"}
            onChange={(e) =>
              setProps({ aspectRatio: e.target.value as "wide" | "tall" | "square" })
            }
          >
            <option value="wide">Geniş (21:9)</option>
            <option value="tall">Dikey (4:5)</option>
            <option value="square">Kare</option>
          </select>
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={block.props.showDots ?? true}
            onChange={(e) => setProps({ showDots: e.target.checked })}
          />
          Alt noktalar
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={block.props.overlayDark ?? true}
            onChange={(e) => setProps({ overlayDark: e.target.checked })}
          />
          Koyu gradient (metin okunaklı)
        </label>
      </div>

      <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-900/50">
        <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Toplu slayt (JSON) — referans siteden kopyaladığınız yapıyı yapıştırın
        </summary>
        <p className="mt-2 text-xs text-zinc-500">
          Her öğe: <code className="rounded bg-white px-1 dark:bg-zinc-800">imageUrl</code> zorunlu;{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">headline</code>,{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">subline</code>,{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">href</code>,{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">ctaLabel</code>,{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">contentAlignX</code>{" "}
          (<code className="rounded bg-white px-1 dark:bg-zinc-800">left|center|right</code>),{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">contentAlignY</code>{" "}
          (<code className="rounded bg-white px-1 dark:bg-zinc-800">top|center|bottom</code>) isteğe bağlı.
          Başka siteden görsel URL’lerini kullanmak telif riski taşır; kendi dosyalarınızı{" "}
          <code className="rounded bg-white px-1 dark:bg-zinc-800">/uploads/…</code> ile verin.
        </p>
        <textarea
          className="mt-2 w-full rounded border border-zinc-300 bg-white px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
          rows={6}
          placeholder={`[\n  { "imageUrl": "https://...", "headline": "...", "subline": "..." }\n]`}
          value={bulkJson}
          onChange={(e) => setBulkJson(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
            onClick={() => applyBulk("replace")}
          >
            Mevcut slaytların üzerine yaz
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
            onClick={() => applyBulk("append")}
          >
            Sonuna ekle
          </button>
        </div>
        {bulkMsg ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{bulkMsg}</p> : null}
      </details>

      <p className="text-xs text-zinc-500">
        Görselleri <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">public/uploads/…</code>{" "}
        altına koyup yol olarak örn.{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/uploads/siteniz/siteniz-slayt-01.jpg</code>{" "}
        yazın. Toplu indirme:{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run images:import -- --slug siteniz</code>{" "}
        (<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">scripts/image-urls.json</code> listesi gerekir;
        örnek: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">image-urls.example.json</code>)
      </p>
      {slides.map((s, idx) => (
        <div
          key={s.id}
          className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-500">
              Slayt {idx + 1} / {slides.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                disabled={idx <= 0}
                onClick={() => moveSlide(idx, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                disabled={idx >= slides.length - 1}
                onClick={() => moveSlide(idx, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="text-xs text-red-600"
                disabled={slides.length <= 1}
                onClick={() => patchSlides(slides.filter((x) => x.id !== s.id))}
              >
                Sil
              </button>
            </div>
          </div>
          <label className="grid gap-1">
            Görsel URL
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={s.imageUrl}
              onChange={(e) => updateSlide(s.id, { imageUrl: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={s.headline ?? ""}
              onChange={(e) => updateSlide(s.id, { headline: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Alt metin
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={s.subline ?? ""}
              onChange={(e) => updateSlide(s.id, { subline: e.target.value })}
            />
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1">
              Buton metni
              <input
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={s.ctaLabel ?? ""}
                onChange={(e) => updateSlide(s.id, { ctaLabel: e.target.value })}
              />
            </label>
            <label className="grid gap-1">
              Buton linki
              <input
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={s.href ?? ""}
                onChange={(e) => updateSlide(s.id, { href: e.target.value })}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              Metin / buton — yatay
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={s.contentAlignX ?? "center"}
                onChange={(e) =>
                  updateSlide(s.id, {
                    contentAlignX: e.target.value as "left" | "center" | "right",
                  })
                }
              >
                <option value="left">Sol</option>
                <option value="center">Orta</option>
                <option value="right">Sağ</option>
              </select>
            </label>
            <label className="grid gap-1">
              Metin / buton — dikey
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={s.contentAlignY ?? "center"}
                onChange={(e) =>
                  updateSlide(s.id, {
                    contentAlignY: e.target.value as "top" | "center" | "bottom",
                  })
                }
              >
                <option value="top">Üst</option>
                <option value="center">Orta</option>
                <option value="bottom">Alt</option>
              </select>
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="rounded-lg border border-dashed border-rose-300 px-3 py-2 text-xs text-rose-800 disabled:opacity-50 dark:border-rose-800 dark:text-rose-200"
        disabled={slides.length >= HERO_SLIDER_MAX_SLIDES}
        onClick={() =>
          patchSlides([
            ...slides,
            {
              id: nanoid(),
              imageUrl:
                "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1600&q=80",
              headline: "Yeni slayt",
            },
          ])
        }
      >
        + Bu slayta görsel ekle{" "}
        {slides.length >= HERO_SLIDER_MAX_SLIDES
          ? `(${HERO_SLIDER_MAX_SLIDES} sınırı)`
          : null}
      </button>
    </div>
  );
}

type PaletteItem = { label: string; icon: string; factory: () => PageBlock };

const PALETTE: PaletteItem[] = [
  {
    label: "Slayt (tam genişlik)",
    icon: "🎠",
    factory: () => ({
      id: nanoid(),
      type: "heroSlider",
      props: {
        slides: [
          {
            id: nanoid(),
            imageUrl:
              "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80",
            headline: "Güzelliğe dair her şey",
            subline: "Profesyonel bakım ve hijyenik ortam",
            href: "/iletisim",
            ctaLabel: "Randevu al",
          },
          {
            id: nanoid(),
            imageUrl:
              "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80",
            headline: "Yenilenmiş hissedin",
            subline: "Cilt bakımı ve lazer epilasyon",
            href: "/hizmetler",
            ctaLabel: "Hizmetler",
          },
          {
            id: nanoid(),
            imageUrl:
              "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1600&q=80",
            headline: "Kaş, kirpik, bakım",
            subline: "Detaylı hizmet listesi için tıklayın.",
            href: "/hizmetler",
            ctaLabel: "Keşfet",
          },
        ],
        autoplayMs: 6000,
        aspectRatio: "wide",
        showDots: true,
        overlayDark: true,
      },
    }),
  },
  {
    label: "Yorum şeridi (kart carousel)",
    icon: "💬",
    factory: () => ({
      id: nanoid(),
      type: "testimonialCarousel",
      props: {
        title: "Mükemmel",
        subtitle: "136 değerlendirme üzerinden örnek gösterim — metinleri kendi yorumlarınızla değiştirin.",
        autoplayMs: 0,
        footnote: TESTIMONIAL_LAYOUT_ADMIN_HINT,
        reviews: [
          {
            id: nanoid(),
            name: "Örnek müşteri",
            relativeTimeLabel: "2 ay önce",
            rating: 5,
            text: "Profesyonel ekip ve hijyenik ortam. Randevu süreci çok düzenli.",
            sourceLabel: "Google",
          },
          {
            id: nanoid(),
            name: "Örnek müşteri 2",
            relativeTimeLabel: "3 ay önce",
            rating: 5,
            text: "Memnun kaldım, tekrar gelirim.",
            sourceLabel: "Google",
          },
          {
            id: nanoid(),
            name: "Örnek müşteri 3",
            relativeTimeLabel: "3 ay önce",
            rating: 5,
            text: "İlgi ve hizmet kalitesi çok iyi.",
            sourceLabel: "Google",
          },
        ],
      },
    }),
  },
  {
    label: "Markalı giriş (Hizmetlerimiz + vurgu)",
    icon: "✨",
    factory: () => ({
      id: nanoid(),
      type: "brandedIntro",
      props: {
        title: "Hizmetlerimiz",
        body:
          "Cilt bakımı, lazer ve bölgesel şekillendirmeyi bir arada sunan salonumuza hoş geldiniz. Charme ile hijyenik ortam, deneyimli kadro ve güncel ekipmanlarla yanınızdayız.",
        accentPhrase: "Charme",
        align: "left",
      },
    }),
  },
  {
    label: "Hizmet promo ızgarası (3 kutu)",
    icon: "🧱",
    factory: () => ({
      id: nanoid(),
      type: "servicePromoGrid",
      props: {
        items: [
          {
            id: nanoid(),
            faintWord: "Diode",
            titleDark: "Premium",
            titleAccent: "Epilasyon",
            gradientFrom: "#e5d5cf",
            gradientTo: "#c9b4ab",
            lightOnDark: false,
          },
          {
            id: nanoid(),
            faintWord: "Bölgesel",
            titleDark: "G5",
            titleAccent: "Masajı",
            gradientFrom: "#d4e8e4",
            gradientTo: "#9cc5bc",
            badgeText: "Örnek rozet",
            lightOnDark: false,
          },
          {
            id: nanoid(),
            faintWord: "Hollywood",
            titleDark: "Hydrafacial",
            titleAccent: "Bakım",
            gradientFrom: "#4a5568",
            gradientTo: "#2d3748",
            lightOnDark: true,
          },
        ],
      },
    }),
  },
  {
    label: "Kahraman",
    icon: "🎯",
    factory: () => ({
      id: nanoid(),
      type: "hero",
      props: {
        headline: "Başlık",
        subline: "Alt başlık",
        ctaLabel: "Randevu al",
        ctaHref: "#iletisim",
        desktopLayout: "left",
        mobileLayout: "center",
      },
    }),
  },
  {
    label: "Metin",
    icon: "📝",
    factory: () => ({
      id: nanoid(),
      type: "text",
      props: { content: "Paragraf metni", as: "p", align: "left" },
    }),
  },
  {
    label: "Başlık (H2)",
    icon: "📰",
    factory: () => ({
      id: nanoid(),
      type: "text",
      props: { content: "Bölüm başlığı", as: "h2", align: "left" },
    }),
  },
  {
    label: "Başlık (H3)",
    icon: "📌",
    factory: () => ({
      id: nanoid(),
      type: "text",
      props: { content: "Alt başlık", as: "h3", align: "left" },
    }),
  },
  {
    label: "Buton",
    icon: "🔘",
    factory: () => ({
      id: nanoid(),
      type: "button",
      props: { label: "Tıkla", href: "/", variant: "primary", fullWidthMobile: true },
    }),
  },
  {
    label: "Görsel",
    icon: "🏞️",
    factory: () => ({
      id: nanoid(),
      type: "image",
      props: {
        src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
        alt: "Salon",
        rounded: true,
      },
    }),
  },
  {
    label: "Görsel galerisi (ızgara)",
    icon: "🖼️",
    factory: () => ({
      id: nanoid(),
      type: "imageGallery",
      props: {
        title: "Öne çıkanlar",
        columns: 3,
        gap: "md",
        rounded: true,
        imageAspect: "video",
        images: [
          {
            id: nanoid(),
            src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80",
            alt: "Salon 1",
          },
          {
            id: nanoid(),
            src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=900&q=80",
            alt: "Salon 2",
          },
          {
            id: nanoid(),
            src: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=900&q=80",
            alt: "Salon 3",
          },
        ],
      },
    }),
  },
  {
    label: "Video (YouTube / Vimeo)",
    icon: "▶️",
    factory: () => ({
      id: nanoid(),
      type: "videoEmbed",
      props: {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Örnek video",
      },
    }),
  },
  {
    label: "Ses dosyası (MP3 veya bağlantı)",
    icon: "🎧",
    factory: () => ({
      id: nanoid(),
      type: "audioEmbed",
      props: {
        src: "",
        title: "Ses",
      },
    }),
  },
  {
    label: "Harita",
    icon: "📍",
    factory: () => ({
      id: nanoid(),
      type: "map",
      props: { address: "İstanbul", height: 320 },
    }),
  },
  {
    label: "İletişim formu",
    icon: "✉️",
    factory: () => ({
      id: nanoid(),
      type: "contactForm",
      props: { title: "Bize yazın", successMessage: "Teşekkürler!" },
    }),
  },
  {
    label: "Randevu formu (hizmet + tarih)",
    icon: "📆",
    factory: () => ({
      id: nanoid(),
      type: "contactForm",
      props: {
        mode: "appointment",
        title: "Randevu — bilgilerinizi bırakın",
        successMessage: "Talebiniz alındı. Uygunluk onayı için sizinle iletişime geçeceğiz.",
        submitLabel: "Randevu talep et",
        slotDurationMinutes: 60,
        serviceNavUseAuto: true,
        serviceNavMenuSlug: "header",
        serviceOptions: [],
        appointmentDays: DEFAULT_APPOINTMENT_DAYS.map((d) => ({ ...d })),
      },
    }),
  },
  {
    label: "WhatsApp",
    icon: "💚",
    factory: () => ({
      id: nanoid(),
      type: "whatsapp",
      props: { label: "WhatsApp", prefilledMessage: "Merhaba" },
    }),
  },
  {
    label: "Boşluk",
    icon: "↕️",
    factory: () => ({
      id: nanoid(),
      type: "spacer",
      props: { height: 32 },
    }),
  },
  {
    label: "Randevu bilgisi",
    icon: "📅",
    factory: () => ({
      id: nanoid(),
      type: "calendarEmbed",
      props: {
        title: "Randevu",
        body: "Randevu ve müsaitlik taleplerinizi iletebilirsiniz; kesin saat salon onayıyla netleşir.",
        ctaLabel: "Randevu formuna git",
        ctaHref: "/iletisim",
      },
    }),
  },
  {
    label: "Sohbet notu",
    icon: "💭",
    factory: () => ({
      id: nanoid(),
      type: "chatSnippet",
      props: { title: "Canlı destek", htmlNote: "" },
    }),
  },
  {
    label: "Gömülü çerçeve (iframe / forum)",
    icon: "🗨️",
    factory: () => ({
      id: nanoid(),
      type: "embedFrame",
      props: {
        title: "Forum veya harici sayfa",
        src: "",
        height: 640,
        fullBleed: false,
      },
    }),
  },
  {
    label: "Sohbet veya AI bot (HTML kodu)",
    icon: "🤖",
    factory: () => ({
      id: nanoid(),
      type: "rawHtml",
      props: {
        html: `<!-- Crisp, Tidio, Intercom vb. size verilen <script> kodunu genelde Ayarlar → özel head HTML ile eklemek daha doğrudur.
Buraya üreticinin verdiği embed <div>…</div> parçasını yapıştırın (güvendiğiniz kaynak). -->`,
        fullBleed: false,
      },
    }),
  },
  {
    label: "HTML parçası (şablon / HTTrack)",
    icon: "🧩",
    factory: () => ({
      id: nanoid(),
      type: "rawHtml",
      props: {
        html: "<!-- public/webpace-mirror/index.html içinden <main>...</main> veya body parçası yapıştırın -->",
        fullBleed: true,
      },
    }),
  },
  {
    label: "Instagram vitrinı",
    icon: "📸",
    factory: () => ({
      id: nanoid(),
      type: "instagramFeed",
      props: {
        title: "Instagram’da bizi takip edin",
        columns: 3,
        displayMode: "mediaCard",
        embedHeightPx: 920,
      },
    }),
  },
  {
    label: "YouTube vitrinı",
    icon: "▶️",
    factory: () => ({
      id: nanoid(),
      type: "youtubeFeed",
      props: {
        title: "YouTube’da bizi izleyin",
        columns: 3,
        displayMode: "mediaCard",
        embedHeightPx: 920,
      },
    }),
  },
  {
    label: "TikTok vitrinı",
    icon: "🎵",
    factory: () => ({
      id: nanoid(),
      type: "tiktokFeed",
      props: {
        title: "TikTok’ta bizi takip edin",
        columns: 3,
        displayMode: "mediaCard",
        embedHeightPx: 920,
      },
    }),
  },
  {
    label: "Site menüsü (Admin)",
    icon: "🔗",
    factory: () => ({
      id: nanoid(),
      type: "navMenu",
      props: { menuSlug: "footer", style: "stacked" },
    }),
  },
  {
    label: "Klinik tarzı alt bilgi",
    icon: "🏥",
    factory: () => createMarketingFooterBlock(),
  },
];

/** HTML5 drag — önizleme üzerine bırakınca blok eklemek için */
const PALETTE_DRAG_MIME = "application/x-page-editor-palette";

const PALETTE_BY_LABEL = new Map(PALETTE.map((p) => [p.label, p]));

function readPaletteDropLabel(dt: DataTransfer): string {
  let label = dt.getData(PALETTE_DRAG_MIME);
  if (label) return label;
  const plain = dt.getData("text/plain");
  if (plain.startsWith("__palette__:")) return plain.slice("__palette__:".length);
  return "";
}

/** Sürükleme bittiğinde state temizliği — drop’tan sonra çalışsın diye gecikmeli */
function scheduleAfterDrop(fn: () => void) {
  window.setTimeout(fn, 0);
}

const WIDGET_CATEGORY_ORDER: { title: string; labels: string[] }[] = [
  {
    title: "Üst alan & kaydırma",
    labels: ["Slayt (tam genişlik)", "Kahraman", "Boşluk"],
  },
  {
    title: "Metin & aksiyon",
    labels: [
      "Markalı giriş (Hizmetlerimiz + vurgu)",
      "Başlık (H2)",
      "Başlık (H3)",
      "Metin",
      "Buton",
    ],
  },
  {
    title: "Medya & vitrin",
    labels: [
      "Görsel",
      "Görsel galerisi (ızgara)",
      "Video (YouTube / Vimeo)",
      "Ses dosyası (MP3 veya bağlantı)",
      "Hizmet promo ızgarası (3 kutu)",
      "Instagram vitrinı",
      "YouTube vitrinı",
      "TikTok vitrinı",
    ],
  },
  { title: "Güven & pazarlama", labels: ["Yorum şeridi (kart carousel)"] },
  {
    title: "İletişim & gömme",
    labels: ["Harita", "İletişim formu", "Randevu formu (hizmet + tarih)", "WhatsApp", "Randevu bilgisi", "Sohbet notu"],
  },
  {
    title: "Forum & sohbet",
    labels: ["Gömülü çerçeve (iframe / forum)", "Sohbet veya AI bot (HTML kodu)"],
  },
  { title: "Şablon & gelişmiş", labels: ["HTML parçası (şablon / HTTrack)"] },
  { title: "Menü & site yapısı", labels: ["Site menüsü (Admin)"] },
  { title: "Alt bilgi şablonları", labels: ["Klinik tarzı alt bilgi"] },
];

const WIDGET_CATEGORY_NAV_LABEL: Record<string, string> = {
  "Üst alan & kaydırma": "Üst & kaydırma",
  "Metin & aksiyon": "Metin",
  "Medya & vitrin": "Medya",
  "Güven & pazarlama": "Güven",
  "İletişim & gömme": "İletişim",
  "Forum & sohbet": "Forum",
  "Şablon & gelişmiş": "Şablon",
  "Menü & site yapısı": "Menü",
  "Alt bilgi şablonları": "Alt bilgi",
};

function paletteByCategory(): { title: string; items: PaletteItem[] }[] {
  const map = new Map(PALETTE.map((p) => [p.label, p]));
  return WIDGET_CATEGORY_ORDER.map(({ title, labels }) => ({
    title,
    items: labels.map((l) => map.get(l)).filter((x): x is (typeof PALETTE)[number] => !!x),
  })).filter((c) => c.items.length > 0);
}

function SortableRow({
  id,
  children,
  tone = "light",
}: {
  id: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  const shell =
    tone === "dark"
      ? "border-zinc-700 bg-zinc-800/90 text-zinc-100"
      : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-2 rounded-xl border p-3 ${shell}`}
    >
      <button
        type="button"
        className={`cursor-grab touch-none px-1 ${tone === "dark" ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}
        aria-label="Sürükle"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function BlockSummary({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return <span className="text-sm font-medium">{block.props.headline}</span>;
    case "text": {
      const t = block.props.as ?? "p";
      const pfx = t !== "p" ? `${t.toUpperCase()} · ` : "";
      return (
        <span className="truncate text-sm">
          {pfx}
          {block.props.content.slice(0, 72)}
        </span>
      );
    }
    case "button":
      return (
        <span className="text-sm">
          Buton: {block.props.label} → {block.props.href}
        </span>
      );
    case "instagramFeed":
      return (
        <span className="text-sm">
          Instagram ({block.props.columns ?? 3} sütun) — yayınlananlar Admin → Instagram
        </span>
      );
    case "youtubeFeed":
      return (
        <span className="text-sm">
          YouTube ({block.props.columns ?? 3} sütun) — Admin → YouTube vitrinı
        </span>
      );
    case "tiktokFeed":
      return (
        <span className="text-sm">
          TikTok ({block.props.columns ?? 3} sütun) — Admin → TikTok vitrinı
        </span>
      );
    case "heroSlider":
      return (
        <span className="text-sm">
          Slayt · {block.props.slides.length} görsel
        </span>
      );
    case "testimonialCarousel":
      return (
        <span className="text-sm">
          Yorum şeridi · {block.props.reviews.length} kart
        </span>
      );
    case "brandedIntro":
      return <span className="text-sm">Giriş: {block.props.title}</span>;
    case "servicePromoGrid":
      return (
        <span className="text-sm">
          Promo ızgara · {block.props.items.length} kutu
        </span>
      );
    case "rawHtml":
      return (
        <span className="text-sm">
          HTML · {block.props.html.length.toLocaleString("tr-TR")} karakter
        </span>
      );
    case "embedFrame":
      return (
        <span className="truncate text-sm">
          iframe · {(block.props.src || "URL yok").slice(0, 44)}
        </span>
      );
    case "videoEmbed":
      return <span className="truncate text-sm">Video · {block.props.url.slice(0, 48)}</span>;
    case "audioEmbed":
      return <span className="truncate text-sm">Ses · {block.props.src ? block.props.src.slice(0, 40) : "URL yok"}</span>;
    case "imageGallery":
      return (
        <span className="text-sm">
          Galeri · {block.props.images.length} görsel · {block.props.columns ?? 3} sütun
        </span>
      );
    case "marketingFooter":
      return (
        <span className="text-sm">
          Klinik alt bilgi · {block.props.brandLabel} · {block.props.columns.length} sütun
        </span>
      );
    case "navMenu": {
      const slug = block.props.menuSlug === "footer" ? "Alt bilgi menüsü" : "Üst menü";
      const st = block.props.style === "stacked" ? "dikey" : "yatay";
      return (
        <span className="text-sm">
          Site menüsü · {slug} · {st}
        </span>
      );
    }
    case "map":
      return (
        <span className="truncate text-sm">
          Harita · {(block.props.embedUrl || block.props.address || "adres yok").slice(0, 40)}
        </span>
      );
    case "contactForm": {
      const ap = block.props.mode === "appointment";
      const n = block.props.serviceOptions?.length ?? 0;
      const auto = block.props.serviceNavUseAuto !== false;
      return (
        <span className="text-sm">
          {ap ? "Randevu formu" : "İletişim formu"}
          {ap ? (auto ? ` · Hizmetlerimiz${n > 0 ? `+${n} ek` : ""}` : ` · özel menü${n > 0 ? `+${n} ek` : ""}`) : ""}
        </span>
      );
    }
    case "calendarEmbed":
      return (
        <span className="truncate text-sm">
          Randevu bilgisi · {block.props.title?.trim() || "başlıksız"}
          {block.props.ctaHref ? ` → ${block.props.ctaHref.slice(0, 28)}` : ""}
        </span>
      );
    default:
      return <span className="text-sm capitalize">{block.type}</span>;
  }
}

function BlockFields({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (b: PageBlock) => void;
}) {
  const setProps = (patch: Record<string, unknown>) => {
    onChange({ ...block, props: { ...block.props, ...patch } } as PageBlock);
  };

  switch (block.type) {
    case "hero":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <label className="grid gap-1">
            Başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.headline}
              onChange={(e) => setProps({ headline: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Alt başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.subline ?? ""}
              onChange={(e) => setProps({ subline: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Görsel URL
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.imageUrl ?? ""}
              onChange={(e) => setProps({ imageUrl: e.target.value })}
            />
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1">
              Masaüstü hizalama
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={block.props.desktopLayout ?? "left"}
                onChange={(e) =>
                  setProps({ desktopLayout: e.target.value as "left" | "center" | "right" })
                }
              >
                <option value="left">Sol</option>
                <option value="center">Orta</option>
                <option value="right">Sağ</option>
              </select>
            </label>
            <label className="grid gap-1">
              Mobil hizalama
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={block.props.mobileLayout ?? "center"}
                onChange={(e) =>
                  setProps({ mobileLayout: e.target.value as "left" | "center" | "right" })
                }
              >
                <option value="left">Sol</option>
                <option value="center">Orta</option>
                <option value="right">Sağ</option>
              </select>
            </label>
          </div>
        </div>
      );
    case "text":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs text-zinc-500">
            Başlık için ayrıca paletten <strong>Başlık (H2/H3)</strong> veya burada etiketi H1–H3 yapın.
          </p>
          <label className="grid gap-1">
            Metin
            <textarea
              rows={4}
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.content}
              onChange={(e) => setProps({ content: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Etiket (başlık / paragraf)
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.as ?? "p"}
              onChange={(e) =>
                setProps({ as: e.target.value as "p" | "h1" | "h2" | "h3" })
              }
            >
              <option value="p">Paragraf</option>
              <option value="h1">H1 (sayfa ana başlığı — sayfada bir kez)</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
          </label>
          <label className="grid gap-1">
            Hizalama
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.align ?? "left"}
              onChange={(e) => setProps({ align: e.target.value as "left" | "center" | "right" })}
            >
              <option value="left">Sol</option>
              <option value="center">Orta</option>
              <option value="right">Sağ</option>
            </select>
          </label>
        </div>
      );
    case "button":
      return (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <label className="grid gap-1">
            Yazı
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.label}
              onChange={(e) => setProps({ label: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Bağlantı
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.href}
              onChange={(e) => setProps({ href: e.target.value })}
            />
          </label>
        </div>
      );
    case "image":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <label className="grid gap-1">
            URL
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.src}
              onChange={(e) => setProps({ src: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Alt metin
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.alt}
              onChange={(e) => setProps({ alt: e.target.value })}
            />
          </label>
        </div>
      );
    case "imageGallery": {
      type GalleryBlock = Extract<PageBlock, { type: "imageGallery" }>;
      const b = block as GalleryBlock;
      const imgs = b.props.images;
      const patchImages = (next: typeof imgs) => {
        const capped = next.slice(0, 12);
        if (capped.length < 1) return;
        onChange({ ...b, props: { ...b.props, images: capped } } as PageBlock);
      };
      const setImg = (id: string, patch: Partial<(typeof imgs)[0]>) => {
        onChange({
          ...b,
          props: { ...b.props, images: imgs.map((x) => (x.id === id ? { ...x, ...patch } : x)) },
        } as PageBlock);
      };
      const moveImg = (idx: number, dir: -1 | 1) => {
        const j = idx + dir;
        if (j < 0 || j >= imgs.length) return;
        const n = [...imgs];
        const t = n[idx]!;
        n[idx] = n[j]!;
        n[j] = t;
        patchImages(n);
      };
      return (
        <div className="mt-3 space-y-4 text-sm">
          <label className="grid gap-1">
            Bölüm başlığı (opsiyonel)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={b.props.title ?? ""}
              onChange={(e) => onChange({ ...b, props: { ...b.props, title: e.target.value || undefined } } as PageBlock)}
            />
          </label>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1">
              Sütun (masaüstü)
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={b.props.columns ?? 3}
                onChange={(e) =>
                  onChange({
                    ...b,
                    props: { ...b.props, columns: Number(e.target.value) as 2 | 3 | 4 },
                  } as PageBlock)
                }
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
            <label className="grid gap-1">
              Boşluk
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={b.props.gap ?? "md"}
                onChange={(e) =>
                  onChange({
                    ...b,
                    props: { ...b.props, gap: e.target.value as "sm" | "md" | "lg" },
                  } as PageBlock)
                }
              >
                <option value="sm">Sıkı</option>
                <option value="md">Normal</option>
                <option value="lg">Geniş</option>
              </select>
            </label>
            <label className="grid gap-1">
              Görsel oranı
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={b.props.imageAspect ?? "video"}
                onChange={(e) =>
                  onChange({
                    ...b,
                    props: { ...b.props, imageAspect: e.target.value as "video" | "square" | "auto" },
                  } as PageBlock)
                }
              >
                <option value="video">16:9</option>
                <option value="square">Kare</option>
                <option value="auto">Doğal</option>
              </select>
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={b.props.rounded !== false}
              onChange={(e) => onChange({ ...b, props: { ...b.props, rounded: e.target.checked } } as PageBlock)}
            />
            Köşeleri yuvarlat
          </label>
          <div className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="text-xs text-zinc-500">En fazla 12 görsel. Sırayı oklarla değiştirin.</p>
            {imgs.map((im, idx) => (
              <div key={im.id} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
                <div className="mb-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] dark:border-zinc-600"
                    onClick={() => moveImg(idx, -1)}
                    disabled={idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] dark:border-zinc-600"
                    onClick={() => moveImg(idx, 1)}
                    disabled={idx === imgs.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ml-auto text-[10px] text-red-600 hover:underline disabled:opacity-40"
                    disabled={imgs.length <= 1}
                    onClick={() => patchImages(imgs.filter((x) => x.id !== im.id))}
                  >
                    Kaldır
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1 md:col-span-2">
                    Görsel URL
                    <input
                      className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      value={im.src}
                      onChange={(e) => setImg(im.id, { src: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-1">
                    Alt metin
                    <input
                      className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                      value={im.alt ?? ""}
                      onChange={(e) => setImg(im.id, { alt: e.target.value || undefined })}
                    />
                  </label>
                  <label className="grid gap-1">
                    Bağlantı (opsiyonel)
                    <input
                      className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      value={im.href ?? ""}
                      onChange={(e) => setImg(im.id, { href: e.target.value || undefined })}
                      placeholder="https://…"
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-lg border border-dashed border-zinc-400 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              disabled={imgs.length >= 12}
              onClick={() =>
                patchImages([
                  ...imgs,
                  { id: nanoid(), src: "", alt: "" },
                ])
              }
            >
              + Görsel ekle
            </button>
          </div>
        </div>
      );
    }
    case "marketingFooter":
      return (
        <MarketingFooterBlockFields
          block={block as Extract<PageBlock, { type: "marketingFooter" }>}
          onChange={onChange}
        />
      );
    case "navMenu":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <label className="grid gap-1">
            Hangi menü listesi
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.menuSlug}
              onChange={(e) =>
                setProps({
                  menuSlug: e.target.value === "footer" ? "footer" : "header",
                })
              }
            >
              <option value="header">Üst menü (header) — Admin → Menü</option>
              <option value="footer">Alt bilgi menüsü (footer)</option>
            </select>
          </label>
          <label className="grid gap-1">
            Görünüm
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.style ?? "links"}
              onChange={(e) =>
                setProps({
                  style: e.target.value === "stacked" ? "stacked" : "links",
                })
              }
            >
              <option value="links">Yatay linkler</option>
              <option value="stacked">Alt alta (footer için uygun)</option>
            </select>
          </label>
          <p className="text-xs text-zinc-500">
            Linkleri düzenlemek için <strong>Admin → Menü &amp; kategoriler</strong> sayfasını kullanın.
          </p>
        </div>
      );
    case "map":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs leading-relaxed text-zinc-500">
            Haritayı sayfadan kaldırmak için <strong>Yapı</strong> sekmesinde bu satırı silin veya listeden
            kaldırın. Yeni harita: widgetlardan <strong>Harita</strong> sürükleyin.
          </p>
          <label className="grid gap-1">
            Embed URL (opsiyonel)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.embedUrl ?? ""}
              onChange={(e) => setProps({ embedUrl: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Adres
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.address ?? ""}
              onChange={(e) => setProps({ address: e.target.value })}
            />
          </label>
        </div>
      );
    case "embedFrame":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs leading-relaxed text-zinc-500">
            Discourse, bazı wiki veya “embed URL” veren forumlar için. Site X-Frame-Options ile
            iframe’i engelliyorsa boş kalır — o zaman harici bağlantı veya üreticinin HTML kodunu
            kullanın.
          </p>
          <label className="grid gap-1">
            Bölüm başlığı (opsiyonel)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            iframe src (https://…)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.src}
              onChange={(e) => setProps({ src: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Yükseklik (px)
            <input
              type="number"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.height ?? 640}
              onChange={(e) => setProps({ height: Number(e.target.value) })}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={block.props.fullBleed === true}
              onChange={(e) => setProps({ fullBleed: e.target.checked })}
            />
            Tam genişlik (kenarlara kadar)
          </label>
        </div>
      );
    case "videoEmbed":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs text-zinc-500">
            YouTube veya Vimeo sayfa bağlantısı (watch, shorts, youtu.be).
          </p>
          <label className="grid gap-1">
            Video URL
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.url}
              onChange={(e) => setProps({ url: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Başlık (opsiyonel)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
        </div>
      );
    case "audioEmbed":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs text-zinc-500">
            Doğrudan ses dosyası adresi (.mp3, .ogg, .wav — barındırmanızın CORS’a izin vermesi gerekir).
          </p>
          <label className="grid gap-1">
            Ses dosyası URL
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.src}
              onChange={(e) => setProps({ src: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Başlık (opsiyonel)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
        </div>
      );
    case "contactForm": {
      const cf = block.props;
      const mode = cf.mode ?? "contact";
      const opts = cf.serviceOptions ?? [];
      const patchOpts = (next: typeof opts) =>
        onChange({
          ...block,
          props: { ...cf, serviceOptions: next.length ? next : undefined },
        } as PageBlock);
      return (
        <div className="mt-3 grid gap-3 text-sm">
          <label className="grid gap-1">
            Form türü
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={mode}
              onChange={(e) => {
                const next = e.target.value === "appointment" ? "appointment" : "contact";
                if (next === "appointment" && !cf.appointmentDays?.length) {
                  setProps({
                    mode: "appointment",
                    appointmentDays: DEFAULT_APPOINTMENT_DAYS.map((d) => ({ ...d })),
                  });
                } else {
                  setProps({ mode: next });
                }
              }}
            >
              <option value="contact">İletişim (mesaj)</option>
              <option value="appointment">Randevu (hizmet + tarih/saat)</option>
            </select>
          </label>
          <label className="grid gap-1">
            Başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={cf.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Başarı mesajı
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={cf.successMessage ?? ""}
              onChange={(e) => setProps({ successMessage: e.target.value || undefined })}
            />
          </label>
          <label className="grid gap-1">
            Gönder düğmesi metni
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={cf.submitLabel ?? ""}
              onChange={(e) => setProps({ submitLabel: e.target.value || undefined })}
              placeholder={mode === "appointment" ? "Randevu talep et" : "Gönder"}
            />
          </label>
          {mode === "appointment" ? (
            <>
              {cf.appointmentShowService !== false ? (
                <ContactFormNavSourceFields
                  useAuto={cf.serviceNavUseAuto !== false}
                  menuSlug={cf.serviceNavMenuSlug ?? "header"}
                  parentId={cf.serviceNavParentId}
                  onChange={(next) => setProps(next)}
                />
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Hizmet seçimi kapalı — randevular «Belirtilmedi» hizmetiyle kaydedilir.
                </p>
              )}
              <label className="grid gap-1 text-xs">
                Randevu süresi (dakika; bitiş = başlangıç + bu süre)
                <input
                  type="number"
                  min={15}
                  max={240}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={cf.slotDurationMinutes ?? 60}
                  onChange={(e) =>
                    setProps({ slotDurationMinutes: Math.min(240, Math.max(15, Number(e.target.value) || 60)) })
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                Saat dilimi (IANA, randevu saatleri)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={cf.appointmentTimeZone ?? ""}
                  onChange={(e) =>
                    setProps({ appointmentTimeZone: e.target.value.trim() || undefined })
                  }
                  placeholder="Europe/Istanbul"
                />
              </label>
              <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                <p className="mb-2 text-[11px] font-medium text-zinc-500">Randevu formunda göster</p>
                <div className="flex flex-col gap-2 text-[11px]">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cf.appointmentShowService !== false}
                      onChange={(e) =>
                        setProps({ appointmentShowService: e.target.checked ? undefined : false })
                      }
                    />
                    Hizmet seçimi
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cf.appointmentShowEmail !== false}
                      onChange={(e) =>
                        setProps({ appointmentShowEmail: e.target.checked ? undefined : false })
                      }
                    />
                    E-posta
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cf.appointmentShowPhone !== false}
                      onChange={(e) =>
                        setProps({ appointmentShowPhone: e.target.checked ? undefined : false })
                      }
                    />
                    Telefon
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cf.appointmentShowMessage !== false}
                      onChange={(e) =>
                        setProps({ appointmentShowMessage: e.target.checked ? undefined : false })
                      }
                    />
                    Not (mesaj)
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                <p className="mb-2 text-[11px] font-medium text-zinc-500">
                  Onay kutuları (randevu) — varsayılan işaretli. Link ve yeni sekme ayarı JSON ile yönetilir.
                </p>
                <textarea
                  rows={5}
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-[11px] dark:border-zinc-600 dark:bg-zinc-950"
                  defaultValue={JSON.stringify(cf.appointmentConsentItems ?? [], null, 2)}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      setProps({ appointmentConsentItems: undefined });
                      return;
                    }
                    try {
                      const parsed = JSON.parse(raw) as unknown;
                      if (!Array.isArray(parsed)) return;
                      setProps({ appointmentConsentItems: parsed as typeof cf.appointmentConsentItems });
                    } catch {
                      /* ignore invalid draft */
                    }
                  }}
                />
                <label className="mt-2 grid gap-1 text-[11px] text-zinc-500">
                  Gizlilik sözleşmesi linki (randevu zorunlu onay — boşsa charmeguzellik.com kullanılır)
                  <input
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                    placeholder="https://charmeguzellik.com/gizlilik-sozlesmesi"
                    defaultValue={cf.appointmentPrivacyPolicyHref ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      setProps({ appointmentPrivacyPolicyHref: v ? v : undefined });
                    }}
                  />
                </label>
              </div>
              <div className="rounded-lg border border-amber-900/25 bg-amber-950/15 p-2 dark:border-amber-800/35">
                <p className="mb-2 text-[11px] font-medium text-amber-100/90">
                  Haftalık çalışma saatleri (yalnızca bu aralıkta saat seçilir)
                </p>
                <div className="space-y-2">
                  {([0, 1, 2, 3, 4, 5, 6] as const).map((dayNum) => {
                    const baseList = cf.appointmentDays?.length
                      ? [...cf.appointmentDays]
                      : [...mergeAppointmentDays(undefined)];
                    const row = baseList.find((r) => r.day === dayNum);
                    const active = Boolean(row);
                    return (
                      <div
                        key={dayNum}
                        className="flex flex-wrap items-center gap-2 rounded border border-zinc-600/40 bg-zinc-900/40 px-2 py-1.5 text-[11px]"
                      >
                        <label className="flex min-w-[7rem] items-center gap-1.5 font-medium text-zinc-200">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (row) return;
                                const next = [
                                  ...baseList.filter((r) => r.day !== dayNum),
                                  { day: dayNum, start: "09:00", end: "18:00" },
                                ].sort((a, b) => a.day - b.day);
                                setProps({ appointmentDays: next });
                              } else {
                                setProps({
                                  appointmentDays: baseList.filter((r) => r.day !== dayNum),
                                });
                              }
                            }}
                          />
                          {WEEKDAY_LABELS_TR[dayNum]}
                        </label>
                        {active ? (
                          <>
                            <input
                              type="time"
                              className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] text-zinc-900 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100"
                              value={row?.start ?? "09:00"}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProps({
                                  appointmentDays: baseList.map((r) =>
                                    r.day === dayNum ? { ...r, start: v.slice(0, 5) } : r,
                                  ),
                                });
                              }}
                            />
                            <span className="text-zinc-500">—</span>
                            <input
                              type="time"
                              className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] text-zinc-900 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100"
                              value={row?.end ?? "18:00"}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProps({
                                  appointmentDays: baseList.map((r) =>
                                    r.day === dayNum ? { ...r, end: v.slice(0, 5) } : r,
                                  ),
                                });
                              }}
                            />
                          </>
                        ) : (
                          <span className="text-zinc-500">Kapalı</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                <p className="mb-2 text-[11px] font-medium text-zinc-500">
                  Manuel ek hizmetler — menüde olmayan veya ekstra satırlar; listede menü alt linkleriyle birleşir.
                  İsterseniz buradan «Diğer» vb. satırı kendiniz ekleyin (sabit «Diğer» seçeneği yoktur).
                </p>
                <div className="space-y-2">
                  {opts.map((s, si) => (
                    <div key={s.id} className="flex flex-wrap gap-1">
                      <input
                        className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        value={s.label}
                        onChange={(e) => {
                          const next = [...opts];
                          next[si] = { ...s, label: e.target.value };
                          patchOpts(next);
                        }}
                      />
                      <button
                        type="button"
                        className="text-[10px] text-red-600"
                        onClick={() => patchOpts(opts.filter((_, j) => j !== si))}
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-[10px] text-rose-600 hover:underline"
                    disabled={opts.length >= 40}
                    onClick={() => patchOpts([...opts, { id: nanoid(), label: "Yeni hizmet" }])}
                  >
                    + Hizmet
                  </button>
                </div>
              </div>
            </>
          ) : null}
          {mode === "contact" ? (
            <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              <p className="mb-2 text-[11px] font-medium text-zinc-500">İletişim formunda göster</p>
              <div className="flex flex-col gap-2 text-[11px]">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cf.contactShowEmail !== false}
                    onChange={(e) =>
                      setProps({ contactShowEmail: e.target.checked ? undefined : false })
                    }
                  />
                  E-posta
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cf.contactShowPhone !== false}
                    onChange={(e) =>
                      setProps({ contactShowPhone: e.target.checked ? undefined : false })
                    }
                  />
                  Telefon
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cf.contactShowMessage !== false}
                    onChange={(e) =>
                      setProps({ contactShowMessage: e.target.checked ? undefined : false })
                    }
                  />
                  Mesaj
                </label>
              </div>
              <p className="mt-2 mb-1 text-[11px] font-medium text-zinc-500">Onay kutuları (iletişim) JSON</p>
              <textarea
                rows={5}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-[11px] dark:border-zinc-600 dark:bg-zinc-950"
                defaultValue={JSON.stringify(cf.contactConsentItems ?? [], null, 2)}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    setProps({ contactConsentItems: undefined });
                    return;
                  }
                  try {
                    const parsed = JSON.parse(raw) as unknown;
                    if (!Array.isArray(parsed)) return;
                    setProps({ contactConsentItems: parsed as typeof cf.contactConsentItems });
                  } catch {
                    /* ignore invalid draft */
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      );
    }
    case "whatsapp":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Numara site genelinde <strong>Admin → WhatsApp</strong> ekranından yönetilir. Burada yalnızca
            buton metni ve isteğe bağlı ön doldurulmuş mesaj vardır.
          </p>
          <label className="grid gap-1 md:max-w-md">
            Etiket
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.label ?? ""}
              onChange={(e) => setProps({ label: e.target.value })}
            />
          </label>
          <label className="grid gap-1 md:max-w-md">
            Ön mesaj (WhatsApp’ta açılınca)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.prefilledMessage ?? ""}
              onChange={(e) => setProps({ prefilledMessage: e.target.value || undefined })}
              placeholder="Merhaba, randevu almak istiyorum"
            />
          </label>
        </div>
      );
    case "spacer":
      return (
        <label className="mt-3 grid gap-1 text-sm">
          Yükseklik (px)
          <input
            type="number"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={block.props.height}
            onChange={(e) => setProps({ height: Number(e.target.value) })}
          />
        </label>
      );
    case "calendarEmbed":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs text-zinc-500">
            Yayında harici iframe yok; ziyaretçiye kısa metin ve bir buton gösterilir (randevu formuna yönlendirme).
          </p>
          <label className="grid gap-1">
            Başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value || undefined })}
            />
          </label>
          <label className="grid gap-1">
            Metin
            <textarea
              rows={3}
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.body ?? ""}
              onChange={(e) => setProps({ body: e.target.value || undefined })}
            />
          </label>
          <label className="grid gap-1">
            Buton metni
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.ctaLabel ?? ""}
              onChange={(e) => setProps({ ctaLabel: e.target.value || undefined })}
            />
          </label>
          <label className="grid gap-1">
            Buton bağlantısı (site içi yol, örn. /iletisim)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.ctaHref ?? ""}
              onChange={(e) => setProps({ ctaHref: e.target.value || undefined })}
            />
          </label>
        </div>
      );
    case "chatSnippet":
      return (
        <label className="mt-3 grid gap-1 text-sm">
          Not / kod parçası
          <textarea
            rows={3}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            value={block.props.htmlNote ?? ""}
            onChange={(e) => setProps({ htmlNote: e.target.value })}
          />
        </label>
      );
    case "rawHtml":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            <strong>Şablon / HTTrack:</strong>{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run mirror:webpace</code> ile{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">public/webpace-mirror</code> güncellenir;
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">index.html</code> içinden{" "}
            <strong>body/main parçası</strong> yapıştırın.
          </p>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            <strong>Sohbet / AI bot:</strong> Üreticinin verdiği <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">&lt;script&gt;</code>{" "}
            kodunu genelde <strong>Ayarlar → özel head HTML</strong> ile ekleyin; buraya çoğunlukla{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">&lt;div&gt;</code> embed parçası gelir.
          </p>
          <label className="grid gap-1">
            HTML
            <textarea
              rows={14}
              spellCheck={false}
              className="min-h-[200px] rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.html}
              onChange={(e) => setProps({ html: e.target.value })}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={block.props.fullBleed !== false}
              onChange={(e) => setProps({ fullBleed: e.target.checked })}
            />
            Tam genişlik (slayt gibi kenarlara kadar)
          </label>
        </div>
      );
    case "instagramFeed":
    case "youtubeFeed":
    case "tiktokFeed": {
      const adminPath =
        block.type === "youtubeFeed"
          ? "Admin → YouTube vitrinı"
          : block.type === "tiktokFeed"
            ? "Admin → TikTok vitrinı"
            : "Admin → Instagram vitrinı";
      const embedLabel =
        block.type === "instagramFeed"
          ? "Tam Instagram embed (kaydırma olabilir)"
          : block.type === "youtubeFeed"
            ? "Tam YouTube iframe"
            : "Tam TikTok iframe";
      const help =
        block.type === "instagramFeed" ? (
          <>
            Hangi gönderilerin çıkacağını <strong>{adminPath}</strong> ekranından işaretleyin.{" "}
            <strong>Görsel + bağlantı</strong> için gönderilerde küçük resim URL’si olmalı (Graph
            senkron); yalnız permalink olanlar tam embed ile gösterilir.
          </>
        ) : block.type === "youtubeFeed" ? (
          <>
            Videoları <strong>{adminPath}</strong> ekranından ekleyin. Kart modu YouTube önizleme
            görselini kullanır (iframe yok).
          </>
        ) : (
          <>
            Videoları <strong>{adminPath}</strong> ekranından ekleyin. Kart modu TikTok oEmbed
            küçük resmine bağlıdır; oEmbed boşsa tam iframe kullanılır.
          </>
        );
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <label className="grid gap-1">
            Bölüm başlığı
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Sütun (2–4)
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.columns ?? 3}
              onChange={(e) => setProps({ columns: Number(e.target.value) })}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          {block.type === "instagramFeed" ? (
            <>
              <label className="grid gap-1">
                Instagram düzeni
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={block.props.feedLayout ?? "grid"}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        feedLayout: e.target.value === "carousel" ? "carousel" : "grid",
                      },
                    } as PageBlock)
                  }
                >
                  <option value="grid">Izgara (tüm gönderiler, çok satır)</option>
                  <option value="carousel">Kayan şerit (yatay kaydırma)</option>
                </select>
              </label>
              <label className="grid gap-1">
                Otomatik kaydırma (ms) — yalnız kayan şerit
                <input
                  type="number"
                  min={0}
                  max={120000}
                  step={500}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={
                    block.props.feedLayout === "carousel"
                      ? (block.props.carouselAutoplayMs ?? 0)
                      : 0
                  }
                  disabled={block.props.feedLayout !== "carousel"}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (!Number.isFinite(n)) return;
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        carouselAutoplayMs: Math.min(120000, Math.max(0, n)),
                      },
                    } as PageBlock);
                  }}
                  placeholder="0 = kapalı, 4000 = 4 sn"
                />
              </label>
            </>
          ) : null}
          <label className="grid gap-1">
            Görünüm
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.displayMode ?? "mediaCard"}
              onChange={(e) =>
                setProps({
                  displayMode: e.target.value === "iframe" ? "iframe" : "mediaCard",
                })
              }
            >
              <option value="mediaCard">Görsel + bağlantı (önerilen, scroll yok)</option>
              <option value="iframe">{embedLabel}</option>
            </select>
          </label>
          <label className="grid gap-1">
            Embed yüksekliği (px, 400–1400) — yalnız tam embed
            <input
              type="number"
              min={400}
              max={1400}
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.embedHeightPx ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setProps({ embedHeightPx: undefined });
                  return;
                }
                const n = Math.round(Number(raw));
                if (!Number.isFinite(n)) return;
                setProps({ embedHeightPx: Math.min(1400, Math.max(400, n)) });
              }}
              placeholder="920"
              disabled={(block.props.displayMode ?? "mediaCard") !== "iframe"}
            />
          </label>
          <p className="text-xs text-zinc-500">{help}</p>
        </div>
      );
    }
    case "heroSlider":
      return <HeroSliderBlockFields block={block} onChange={onChange} />;
    case "testimonialCarousel": {
      const revs = block.props.reviews;
      const patchRevs = (next: typeof revs) =>
        onChange({ ...block, props: { ...block.props, reviews: next } } as PageBlock);
      return (
        <div className="mt-3 space-y-3 text-sm">
          <label className="grid gap-1">
            Üst başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title ?? ""}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Alt açıklama
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.subtitle ?? ""}
              onChange={(e) => setProps({ subtitle: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Otomatik kaydırma (ms, 0=kapalı)
            <input
              type="number"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.autoplayMs ?? 0}
              onChange={(e) => setProps({ autoplayMs: Number(e.target.value) })}
            />
          </label>
          <label className="grid gap-1">
            Alt not
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.footnote ?? ""}
              onChange={(e) => setProps({ footnote: e.target.value })}
            />
            <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Şablondaki yerleşim / üçüncü parti widget yönergesi alt nota yazılırsa{" "}
              <strong>canlı sitede gösterilmez</strong>; yalnızca bu panel ve önizlemede görünür. Ziyaretçiye
              göstermek için metni değiştirin veya alanı boşaltın.
            </span>
          </label>
          {revs.map((r, idx) => (
            <div key={r.id} className="space-y-2 rounded border border-zinc-200 p-2 dark:border-zinc-700">
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                Kart {idx + 1}
                <button
                  type="button"
                  className="text-red-600"
                  disabled={revs.length <= 1}
                  onClick={() => patchRevs(revs.filter((x) => x.id !== r.id))}
                >
                  Sil
                </button>
              </div>
              <label className="grid gap-1">
                İsim
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={r.name}
                  onChange={(e) =>
                    patchRevs(revs.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))
                  }
                />
              </label>
              <label className="grid gap-1">
                Zaman etiketi
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={r.relativeTimeLabel ?? ""}
                  onChange={(e) =>
                    patchRevs(
                      revs.map((x) =>
                        x.id === r.id ? { ...x, relativeTimeLabel: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="grid gap-1">
                Yıldız (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={r.rating ?? 5}
                  onChange={(e) =>
                    patchRevs(
                      revs.map((x) =>
                        x.id === r.id ? { ...x, rating: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="grid gap-1">
                Metin
                <textarea
                  rows={2}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={r.text}
                  onChange={(e) =>
                    patchRevs(revs.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))
                  }
                />
              </label>
              <label className="grid gap-1">
                Kaynak etiketi (örn. Google)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={r.sourceLabel ?? ""}
                  onChange={(e) =>
                    patchRevs(
                      revs.map((x) =>
                        x.id === r.id ? { ...x, sourceLabel: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="grid gap-1">
                Avatar URL (boşsa baş harfler)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={r.avatarUrl ?? ""}
                  onChange={(e) =>
                    patchRevs(
                      revs.map((x) =>
                        x.id === r.id ? { ...x, avatarUrl: e.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="rounded border border-dashed border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
            disabled={revs.length >= 24}
            onClick={() =>
              patchRevs([
                ...revs,
                {
                  id: nanoid(),
                  name: "Yeni yorum",
                  rating: 5,
                  text: "Metin",
                  sourceLabel: "Google",
                },
              ])
            }
          >
            + Kart ekle
          </button>
        </div>
      );
    }
    case "brandedIntro":
      return (
        <div className="mt-3 grid gap-2 text-sm">
          <label className="grid gap-1">
            Başlık
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.title}
              onChange={(e) => setProps({ title: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Paragraf
            <textarea
              rows={4}
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.body}
              onChange={(e) => setProps({ body: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Vurgulanacak kelime (marka rengi)
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.accentPhrase ?? ""}
              onChange={(e) => setProps({ accentPhrase: e.target.value || undefined })}
            />
          </label>
          <label className="grid gap-1">
            Hiza
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              value={block.props.align ?? "left"}
              onChange={(e) => setProps({ align: e.target.value as "left" | "center" })}
            >
              <option value="left">Sol</option>
              <option value="center">Orta</option>
            </select>
          </label>
        </div>
      );
    case "servicePromoGrid": {
      const items = block.props.items;
      const patchItems = (next: typeof items) =>
        onChange({ ...block, props: { ...block.props, items: next } } as PageBlock);
      return (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-xs text-zinc-500">
            Görsel URL boşsa gradient kullanılır. Kendi klasörünüzden:{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/uploads/…</code>
          </p>
          {items.map((it, idx) => (
            <div key={it.id} className="space-y-2 rounded border border-zinc-200 p-2 dark:border-zinc-700">
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                Kutu {idx + 1}
                <button
                  type="button"
                  className="text-red-600"
                  disabled={items.length <= 1}
                  onClick={() => patchItems(items.filter((x) => x.id !== it.id))}
                >
                  Sil
                </button>
              </div>
              <label className="grid gap-1">
                Arka büyük yazı (soluk)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={it.faintWord}
                  onChange={(e) =>
                    patchItems(items.map((x) => (x.id === it.id ? { ...x, faintWord: e.target.value } : x)))
                  }
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1">
                  Başlık (koyu / ana)
                  <input
                    className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                    value={it.titleDark}
                    onChange={(e) =>
                      patchItems(
                        items.map((x) => (x.id === it.id ? { ...x, titleDark: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1">
                  Başlık (marka rengi)
                  <input
                    className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                    value={it.titleAccent ?? ""}
                    onChange={(e) =>
                      patchItems(
                        items.map((x) =>
                          x.id === it.id ? { ...x, titleAccent: e.target.value || undefined } : x,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <label className="grid gap-1">
                Görsel URL (opsiyonel)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={it.imageUrl ?? ""}
                  onChange={(e) =>
                    patchItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, imageUrl: e.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1">
                  Gradient başlangıç (#hex)
                  <input
                    className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    value={it.gradientFrom ?? ""}
                    onChange={(e) =>
                      patchItems(
                        items.map((x) =>
                          x.id === it.id ? { ...x, gradientFrom: e.target.value || undefined } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1">
                  Gradient bitiş (#hex)
                  <input
                    className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    value={it.gradientTo ?? ""}
                    onChange={(e) =>
                      patchItems(
                        items.map((x) =>
                          x.id === it.id ? { ...x, gradientTo: e.target.value || undefined } : x,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <label className="grid gap-1">
                Rozet metni (opsiyonel)
                <input
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                  value={it.badgeText ?? ""}
                  onChange={(e) =>
                    patchItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, badgeText: e.target.value || undefined } : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={it.lightOnDark ?? false}
                  onChange={(e) =>
                    patchItems(
                      items.map((x) =>
                        x.id === it.id ? { ...x, lightOnDark: e.target.checked } : x,
                      ),
                    )
                  }
                />
                Koyu kutu (açık renkli yazı)
              </label>
            </div>
          ))}
          <button
            type="button"
            className="rounded border border-dashed border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
            disabled={items.length >= 6}
            onClick={() =>
              patchItems([
                ...items,
                {
                  id: nanoid(),
                  faintWord: "Yeni",
                  titleDark: "Başlık",
                  titleAccent: "Vurgu",
                  gradientFrom: "#e5e7eb",
                  gradientTo: "#d1d5db",
                },
              ])
            }
          >
            + Kutu ekle
          </button>
        </div>
      );
    }
    default:
      return null;
  }
}

export type PageEditorSharedProps = {
  initialDesktop: PageBlock[];
  initialMobile: PageBlock[] | null;
  separateMobile: boolean;
  previewThemeId: string;
  previewThemeCss: string;
  previewGoogleFontsHref: string | null;
  /** Ayarlar → WhatsApp; önizlemede wa.me bağlantıları için */
  previewSiteWhatsappNumber?: string | null;
  /** Site düzeni kaydından sonra sunucu verisini yenile (örn. `router.refresh`) */
  onPersisted?: () => void;
};

export type PageEditorProps = PageEditorSharedProps &
  ({ pageId: string; siteRegion?: undefined } | { siteRegion: "header" | "footer"; pageId?: undefined });

export function PageEditor(props: PageEditorProps) {
  const isSiteRegion = "siteRegion" in props && props.siteRegion != null;
  const [desktop, setDesktop] = useState<PageBlock[]>(props.initialDesktop);
  const [mobile, setMobile] = useState<PageBlock[] | null>(
    isSiteRegion ? null : props.separateMobile ? props.initialMobile ?? props.initialDesktop : null,
  );
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"widgets" | "structure">("widgets");
  /** HTML5 palette sürüklemesi — iframe üstü katman için */
  const [paletteDragActive, setPaletteDragActive] = useState(false);
  const [previewDropHover, setPreviewDropHover] = useState(false);
  const [structureDropHover, setStructureDropHover] = useState(false);

  const widgetCategories = useMemo(() => paletteByCategory(), []);

  const blocks = isSiteRegion ? desktop : viewport === "desktop" || !mobile ? desktop : mobile;
  const setBlocks = isSiteRegion
    ? setDesktop
    : viewport === "desktop" || !mobile
      ? setDesktop
      : (updater: PageBlock[] | ((p: PageBlock[]) => PageBlock[])) => {
          setMobile((m) => {
            const base = m ?? desktop;
            return typeof updater === "function" ? updater(base) : updater;
          });
        };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => blocks.map((b) => b.id), [blocks]);

  useEffect(() => {
    const clear = () => {
      scheduleAfterDrop(() => {
        setPaletteDragActive(false);
        setPreviewDropHover(false);
        setStructureDropHover(false);
      });
    };
    document.addEventListener("dragend", clear);
    return () => document.removeEventListener("dragend", clear);
  }, []);

  function appendBlockFromPaletteLabel(label: string, fromDrop = false) {
    const def = PALETTE_BY_LABEL.get(label);
    if (!def) {
      setMessage("Bilinmeyen widget");
      return;
    }
    const nb = def.factory();
    setBlocks((prev) => [...prev, nb]);
    setSelectedId(nb.id);
    if (fromDrop) setLeftTab("structure");
    setMessage(`“${def.label}” eklendi. Yayına almak için Kaydet.`);
  }

  function appendPageLayoutPreset(id: PageLayoutPresetId) {
    if (isSiteRegion) return;
    const extra = getPageLayoutPresetBlocks(id);
    if (extra.length === 0) return;
    setBlocks((prev) => [...prev, ...extra]);
    const last = extra[extra.length - 1];
    setSelectedId(last.id);
    setLeftTab("structure");
    setMessage("Hazır set eklendi. Blokları seçip metinleri düzenleyin, sonra Kaydet.");
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    setBlocks(arrayMove(blocks, oldIndex, newIndex));
  }

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const propsPanelScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId && propsPanelScrollRef.current) {
      propsPanelScrollRef.current.scrollTop = 0;
    }
  }, [selectedId]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      if (isSiteRegion) {
        const field = props.siteRegion === "header" ? "headerBlocks" : "footerBlocks";
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ [field]: desktop }),
        });
        let detail = "";
        try {
          const j = (await res.json()) as { error?: unknown };
          if (!res.ok && j.error != null) detail = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
        } catch {
          if (!res.ok) detail = res.statusText || `HTTP ${res.status}`;
        }
        if (res.ok) {
          setMessage("Kaydedildi.");
          props.onPersisted?.();
        } else {
          setMessage(
            detail
              ? `Hata: ${detail} (${res.status})`
              : `Kayıt başarısız (${res.status}). Oturum süresi dolmuş olabilir — sayfayı yenileyip tekrar giriş yapın.`,
          );
        }
        return;
      }
      const pageId = "pageId" in props ? props.pageId : undefined;
      if (!pageId) {
        setMessage("Yapılandırma hatası: sayfa kimliği yok.");
        return;
      }
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          blocks: desktop,
          blocksMobile: mobile === null ? null : mobile,
        }),
      });
      let detail = "";
      try {
        const j = (await res.json()) as { error?: unknown };
        if (!res.ok && j.error != null) detail = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
      } catch {
        if (!res.ok) detail = res.statusText || `HTTP ${res.status}`;
      }
      if (res.ok) {
        setMessage("Kaydedildi.");
        props.onPersisted?.();
      } else {
        setMessage(detail ? `Hata: ${detail} (${res.status})` : `Kayıt başarısız (${res.status}).`);
      }
    } catch (e) {
      setMessage(
        `Ağ veya tarayıcı hatası: ${e instanceof Error ? e.message : String(e)}. Kaydet’i tekrar deneyin; sorun sürerse sayfayı yenileyin.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3">
      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl lg:grid-cols-[minmax(0,15rem)_1fr_minmax(0,18rem)] xl:grid-cols-[minmax(0,17rem)_1fr_minmax(0,20rem)]">
        <aside className="flex max-h-[min(88vh,820px)] min-h-0 flex-col border-b border-zinc-800 lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 border-b border-zinc-800">
            <button
              type="button"
              className={`flex-1 px-2 py-2.5 text-xs font-medium ${leftTab === "widgets" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              onClick={() => setLeftTab("widgets")}
            >
              Widget&apos;lar
            </button>
            <button
              type="button"
              className={`flex-1 px-2 py-2.5 text-xs font-medium ${leftTab === "structure" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              onClick={() => setLeftTab("structure")}
            >
              Yapı
            </button>
          </div>
          <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-2 py-1.5">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Widget kategorileri</p>
            <div className="flex max-h-[4.5rem] flex-wrap gap-1 overflow-y-auto overscroll-contain">
              {widgetCategories.map((cat, i) => (
                <button
                  key={cat.title}
                  type="button"
                  title={cat.title}
                  onClick={() => {
                    setLeftTab("widgets");
                    window.requestAnimationFrame(() => {
                      document.getElementById(`widget-cat-${i}`)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  }}
                  className="rounded-full border border-zinc-700/90 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-300 transition hover:border-rose-500/70 hover:text-white"
                >
                  {WIDGET_CATEGORY_NAV_LABEL[cat.title] ?? cat.title.slice(0, 14)}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {leftTab === "widgets" ? (
              <div className="space-y-4">
                <p className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-2 py-2 text-[11px] leading-relaxed text-rose-100/90">
                  {isSiteRegion ? (
                    <>
                      <strong>Site düzeni:</strong> Bu içerik <strong>tüm sayfalarda</strong> tekrarlanır (sayfa
                      düzeninden ayrı). Orta alan anında güncellenir; yayın için <strong>Kaydet</strong>. Üst / alt
                      sekmesi değiştirirken kaydetmeyi unutmayın.
                    </>
                  ) : (
                    <>
                      <strong>Yeni alan:</strong> kutuya <strong>tıklayın</strong> veya <strong>sürükleyip</strong>{" "}
                      ortadaki önizleme / Yapı altındaki kesik alana bırakın. Orta alan <strong>anında</strong>{" "}
                      güncellenir; canlı site için <strong>Kaydet</strong>.
                    </>
                  )}
                </p>
                {!isSiteRegion ? (
                  <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/35 px-2 py-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                      Sayfa boş mu? Hazır set (anasayfa havası)
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {PAGE_LAYOUT_PRESET_LIST.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => appendPageLayoutPreset(p.id)}
                          className="flex w-full items-start gap-2 rounded-lg border border-emerald-800/50 bg-zinc-900/50 px-2 py-1.5 text-left text-[10px] text-zinc-200 transition hover:border-emerald-500/60 hover:bg-zinc-900"
                        >
                          <span className="shrink-0 text-base leading-none" aria-hidden>
                            {p.icon}
                          </span>
                          <span>
                            <span className="font-semibold text-emerald-100/95">{p.title}</span>
                            <span className="mt-0.5 block text-zinc-400">{p.blurb}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {widgetCategories.map((cat, catIdx) => (
                  <div key={cat.title} id={`widget-cat-${catIdx}`} className="scroll-mt-28 space-y-2">
                    <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {cat.title}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.items.map((p) => (
                        <div
                          key={p.label}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(PALETTE_DRAG_MIME, p.label);
                            e.dataTransfer.setData("text/plain", `__palette__:${p.label}`);
                            e.dataTransfer.effectAllowed = "copy";
                            setPaletteDragActive(true);
                          }}
                          onDragEnd={() =>
                            scheduleAfterDrop(() => setPaletteDragActive(false))
                          }
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            appendBlockFromPaletteLabel(p.label);
                          }}
                          onClick={() => appendBlockFromPaletteLabel(p.label)}
                          className="flex min-h-[5.25rem] cursor-grab flex-col items-center justify-center gap-1 rounded-xl border border-zinc-700/90 bg-zinc-900/90 px-1.5 py-2 text-center outline-none transition hover:border-rose-500/70 hover:bg-zinc-800 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {p.icon}
                          </span>
                          <span className="line-clamp-3 text-[10px] font-medium leading-tight text-zinc-100">
                            {p.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="border-t border-zinc-800 px-1 pt-3 text-[11px] leading-relaxed text-zinc-500">
                  Sırayı değiştirmek veya blok silmek için <strong className="text-zinc-400">Yapı</strong>{" "}
                  sekmesine geçin; içerik ve stiller sağdaki <strong className="text-zinc-400">Özellikler</strong>{" "}
                  panelinde (seçili blokta).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full rounded-lg bg-rose-600 px-2 py-2.5 text-center text-xs font-semibold text-white shadow hover:bg-rose-500"
                  onClick={() => setLeftTab("widgets")}
                >
                  + Yeni blok ekle → Widget&apos;lar sekmesi
                </button>
                <p className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-400">
                  Sol üstteki <strong className="text-zinc-300">Widget kategorileri</strong> şeridi bu sekmede de
                  görünür; bir kategoriye tıklayınca <strong className="text-zinc-300">Widget&apos;lar</strong>{" "}
                  sekmesine geçilir ve ilgili gruba kaydırılır. Üst site alanı için{" "}
                  <strong className="text-zinc-300">Üst & kaydırma</strong> grubunu kullanın.
                </p>
                <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
                  <strong className="text-zinc-400">⋮⋮</strong> tutamacından sürükleyin. Satıra tıklayınca
                  sağda alanlar açılır.
                </p>
                {blocks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 px-2 py-3 text-[11px] leading-relaxed text-zinc-400">
                    Henüz blok yok. Yukarıdaki <strong className="text-zinc-300">pembe düğmeye</strong> veya üstte{" "}
                    <strong className="text-zinc-300">Widget&apos;lar</strong> sekmesine geçin; ＋ satırlarına
                    tıklayın.
                  </p>
                ) : null}
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {isSiteRegion ? "Bölüm sırası" : "Sayfa yapısı"} ({blocks.length})
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-1.5">
                      {blocks.map((b) => (
                        <SortableRow key={b.id} id={b.id} tone="dark">
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-xs ${selectedId === b.id ? "text-rose-300" : "text-zinc-200"}`}
                            onClick={() => setSelectedId(b.id)}
                          >
                            <span className="min-w-0 truncate font-medium">
                              <BlockSummary block={b} />
                            </span>
                            <span className="shrink-0 text-[10px] uppercase text-zinc-500">{b.type}</span>
                          </button>
                          <button
                            type="button"
                            className="mt-1 text-[10px] text-red-400 hover:underline"
                            onClick={() => {
                              setBlocks(blocks.filter((x) => x.id !== b.id));
                              setSelectedId((sid) => (sid === b.id ? null : sid));
                            }}
                          >
                            Kaldır
                          </button>
                        </SortableRow>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div
                  className={`mt-2 rounded-xl border-2 border-dashed px-2 py-4 text-center text-[11px] transition-colors ${
                    structureDropHover
                      ? "border-rose-400 bg-rose-950/40 text-rose-100"
                      : "border-zinc-600 text-zinc-500"
                  }`}
                  onDragOver={(e) => {
                    if (!paletteDragActive) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setStructureDropHover(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setStructureDropHover(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const label = readPaletteDropLabel(e.dataTransfer);
                    if (label) appendBlockFromPaletteLabel(label, true);
                    else setMessage("Bırakılan veri okunamadı — kutuya tıklayarak ekleyin.");
                    setStructureDropHover(false);
                    setPaletteDragActive(false);
                  }}
                >
                  Widget’ı buraya bırakın → {isSiteRegion ? "listenin sonuna eklenir" : "sayfa sonuna eklenir"}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col bg-zinc-900/50">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Canlı önizleme
            </span>
            {!isSiteRegion ? (
              <>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs ${viewport === "desktop" ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
                  onClick={() => setViewport("desktop")}
                >
                  Masaüstü
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs ${viewport === "mobile" ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-300"}`}
                  onClick={() => {
                    setMobile((m) => m ?? [...desktop]);
                    setViewport("mobile");
                  }}
                >
                  Mobil
                </button>
                {mobile !== null ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                    onClick={() => {
                      if (confirm("Mobil sıra kapatılıp masaüstüyle birleştirilsin mi?")) {
                        setMobile(null);
                        setViewport("desktop");
                      }
                    }}
                  >
                    Mobili birleştir
                  </button>
                ) : null}
                <Link
                  href={`/admin/preview/${"pageId" in props ? props.pageId : ""}${viewport === "mobile" && mobile !== null ? "?mobile=1" : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-zinc-400 underline hover:text-zinc-200"
                >
                  DB önizleme (yeni sekme)
                </Link>
              </>
            ) : (
              <span className="max-w-[14rem] text-[10px] leading-snug text-zinc-500 md:max-w-none">
                {props.siteRegion === "header"
                  ? "Üst alan (menü altı, tüm sayfalar)"
                  : "Alt bilgi (tüm sayfalar)"}{" "}
                · masaüstü önizleme
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Kayıt…" : "Kaydet"}
            </button>
          </div>

          <div
            className={`relative flex min-h-[280px] flex-1 items-start justify-center overflow-auto p-3 lg:min-h-[360px] ${!isSiteRegion && viewport === "mobile" ? "bg-zinc-900" : "bg-zinc-800/40"}`}
          >
            <div
              className={`relative z-0 shrink-0 overflow-y-auto overflow-x-hidden rounded-lg border border-zinc-700 bg-white shadow-2xl ${
                !isSiteRegion && viewport === "mobile"
                  ? "w-[390px] max-w-full max-h-[min(100vh,820px)]"
                  : "w-full max-w-5xl max-h-[min(88vh,920px)]"
              }`}
            >
              <EditorLivePreview
                blocks={blocks}
                themeId={props.previewThemeId}
                themeOverrideCss={props.previewThemeCss}
                googleFontsHref={props.previewGoogleFontsHref}
                siteWhatsappNumber={props.previewSiteWhatsappNumber ?? null}
                blockGap={isSiteRegion ? "tight" : "default"}
                selectedBlockId={selectedId}
                onSelectBlock={setSelectedId}
              />
            </div>
            <div
              className={`absolute inset-3 z-10 flex items-center justify-center rounded-lg transition-colors lg:inset-6 ${
                paletteDragActive ? "pointer-events-auto" : "pointer-events-none"
              } ${previewDropHover ? "bg-rose-500/20 ring-2 ring-rose-400 ring-offset-2 ring-offset-zinc-900" : ""}`}
              onDragEnter={(e) => {
                if (!paletteDragActive) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragOver={(e) => {
                if (!paletteDragActive) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setPreviewDropHover(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setPreviewDropHover(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const label = readPaletteDropLabel(e.dataTransfer);
                if (label) appendBlockFromPaletteLabel(label, true);
                else setMessage("Bırakılan veri okunamadı — kutuya tıklayarak ekleyin.");
                setPreviewDropHover(false);
                setPaletteDragActive(false);
              }}
            >
              {paletteDragActive ? (
                <span className="pointer-events-none rounded-lg bg-zinc-950/80 px-4 py-2 text-center text-sm font-medium text-rose-100 shadow-lg">
                  Buraya bırakın — {isSiteRegion ? "listeye eklenir" : "sayfaya eklenir"}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="flex max-h-[55vh] flex-col border-t border-zinc-800 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 lg:max-h-none lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Özellikler</h3>
            {selected ? (
              <p className="mt-0.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">{selected.type}</p>
            ) : null}
          </div>
          <div ref={propsPanelScrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
            {selected ? (
              <BlockFields
                block={selected}
                onChange={(next) => {
                  const sid = selected.id;
                  setBlocks((prev) => prev.map((x) => (x.id === sid ? next : x)));
                }}
              />
            ) : (
              <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <p className="font-medium text-zinc-800 dark:text-zinc-200">Sağ panel = seçili bloğun alanları</p>
                {isSiteRegion && props.siteRegion === "footer" ? (
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Alt bilgi önizlemesinde (link olmayan) bir alana tıklayarak <strong>Klinik tarzı alt bilgi</strong> veya
                    diğer blokları seçin; marka, sütunlar, iletişim kartları ve telif sağdaki formlardan düzenlenir.
                  </p>
                ) : null}
                <p>Buraya yeni blok <strong>eklenmez</strong>. Envato / Elementor’daki &quot;widget paleti&quot; soldadır:</p>
                <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-300">Widget&apos;lar</strong> sekmesinden + ile blok
                    ekleyin (slayt, metin, harita…).
                  </li>
                  <li>
                    <strong className="text-zinc-700 dark:text-zinc-300">Yapı</strong> sekmesinde sırayı değiştirin veya
                    kaldırın.
                  </li>
                  <li>
                    Listeden veya önizlemeden bir bloğa tıklayın — alanları burada düzenleyin,{" "}
                    <strong className="text-zinc-700 dark:text-zinc-300">Kaydet</strong>.
                  </li>
                </ol>
                <p className="text-xs text-zinc-500">
                  Statik siteyi bire bir taşımak için:{" "}
                  <strong className="text-zinc-600 dark:text-zinc-400">HTML parçası (şablon / HTTrack)</strong> widget’ı +
                  <code className="mx-0.5 rounded bg-zinc-200 px-1 dark:bg-zinc-800">npm run mirror:webpace</code>.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {message ? (
        <p
          className={`text-sm ${
            message.startsWith("Hata:") ||
            message.startsWith("Ağ ") ||
            message.startsWith("Yapılandırma") ||
            message.includes("Kayıt başarısız")
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
