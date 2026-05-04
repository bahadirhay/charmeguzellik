import { nanoid } from "nanoid";
import type { PageBlock } from "@/lib/blocks/schema";
import { TESTIMONIAL_LAYOUT_ADMIN_HINT } from "@/lib/testimonial-admin-footnotes";

export type PageLayoutPresetId = "salon-vitrin" | "sosyal-guven" | "gorsel-hikaye";

export const PAGE_LAYOUT_PRESET_LIST: ReadonlyArray<{
  id: PageLayoutPresetId;
  title: string;
  blurb: string;
  icon: string;
}> = [
  {
    id: "salon-vitrin",
    title: "Salon vitrinı",
    blurb: "Markalı giriş, 3 hizmet kutusu, Instagram — ana sayfa havası",
    icon: "✨",
  },
  {
    id: "sosyal-guven",
    title: "Sosyal + güven",
    blurb: "Instagram vitrinı ve müşteri yorumları",
    icon: "💬",
  },
  {
    id: "gorsel-hikaye",
    title: "Görsel anlatım",
    blurb: "Başlık, metin, 3’lü galeri ve iletişim butonu",
    icon: "🖼️",
  },
];

function spacer(h: number): PageBlock {
  return { id: nanoid(), type: "spacer", props: { height: h } };
}

function promoGrid(): PageBlock {
  return {
    id: nanoid(),
    type: "servicePromoGrid",
    props: {
      items: [
        {
          id: nanoid(),
          faintWord: "Diode",
          titleDark: "Diode BUZ",
          titleAccent: "Lazer epilasyon",
          imageUrl:
            "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1400&q=85&auto=format&fit=crop",
          lightOnDark: true,
          badgeText: "Kadın & erkek",
        },
        {
          id: nanoid(),
          faintWord: "Hydrafacial",
          titleDark: "Cilt bakımı ·",
          titleAccent: "Hydrafacial",
          imageUrl:
            "https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1400&q=85&auto=format&fit=crop",
          lightOnDark: true,
        },
        {
          id: nanoid(),
          faintWord: "G5",
          titleDark: "Bölgesel",
          titleAccent: "zayıflama",
          imageUrl:
            "https://images.unsplash.com/photo-1544161515-4ab6be6f843b?w=1400&q=85&auto=format&fit=crop",
          lightOnDark: true,
          badgeText: "EMS · Slimbody",
        },
      ],
    },
  };
}

function testimonial(): PageBlock {
  return {
    id: nanoid(),
    type: "testimonialCarousel",
    props: {
      title: "Müşteri yorumları",
      subtitle: "Metinleri kendi yorumlarınızla değiştirin.",
      autoplayMs: 0,
      footnote: TESTIMONIAL_LAYOUT_ADMIN_HINT,
      reviews: [
        {
          id: nanoid(),
          name: "Örnek müşteri",
          relativeTimeLabel: "2 ay önce",
          rating: 5,
          text: "Profesyonel ekip ve hijyenik ortam.",
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
  };
}

/** Tek seferde eklenen bloklar; tümü Admin’den düzenlenebilir */
export function getPageLayoutPresetBlocks(id: PageLayoutPresetId): PageBlock[] {
  switch (id) {
    case "salon-vitrin":
      return [
        {
          id: nanoid(),
          type: "brandedIntro",
          props: {
            title: "Hizmetlerimiz",
            body:
              "Cilt bakımı, Diode BUZ lazer ve bölgesel şekillendirmeyi bir arada sunuyoruz. Charme ile hijyenik ortam ve güncel ekipmanlarla ışıltınıza değer katın — metni admin’den düzenleyin.",
            accentPhrase: "Charme",
            align: "left",
          },
        },
        spacer(28),
        promoGrid(),
        spacer(36),
        {
          id: nanoid(),
          type: "instagramFeed",
          props: { title: "Instagram’da bizi takip edin", columns: 3 },
        },
      ];
    case "sosyal-guven":
      return [
        {
          id: nanoid(),
          type: "instagramFeed",
          props: { title: "Son paylaşımlarımız", columns: 3 },
        },
        spacer(32),
        testimonial(),
      ];
    case "gorsel-hikaye":
      return [
        {
          id: nanoid(),
          type: "text",
          props: { content: "Bu hizmet hakkında", as: "h2", align: "left" },
        },
        {
          id: nanoid(),
          type: "text",
          props: {
            content:
              "Kısa açıklama paragrafı: kimlere uygun, süre, faydalar. Metni kendi hizmetinize göre düzenleyin.",
            as: "p",
            align: "left",
          },
        },
        {
          id: nanoid(),
          type: "button",
          props: {
            label: "Randevu / İletişim",
            href: "/iletisim",
            variant: "primary",
            fullWidthMobile: true,
          },
        },
        spacer(28),
        {
          id: nanoid(),
          type: "imageGallery",
          props: {
            title: "Salondan kareler",
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
        },
      ];
    default: {
      const _n: never = id;
      return _n;
    }
  }
}
