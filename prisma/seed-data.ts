/**
 * prisma/seed.ts ve scripts/generate-neon-full-sql.ts tarafından paylaşılır.
 * Yerel seed ile Neon SQL bootstrap aynı kaynaktan beslenir.
 */
import { DEFAULT_APPOINTMENT_DAYS } from "../src/lib/appointment-schedule";
import { allStaffPermissions, editorStaffPermissions } from "../src/lib/staff-permissions";
import { TESTIMONIAL_LAYOUT_ADMIN_HINT } from "../src/lib/testimonial-admin-footnotes";

export const SALON_PHONE_E164 = "905519784348";
export const SALON_ADDRESS_LINE =
  "Charme Güzellik, Özlem Apt, Zeytinlik, Fişekhane Cd. No:50 Kat:5 Daire:16, 34110 Bakırköy/İstanbul";
export const SALON_BRAND = "Charme Güzellik Salonu";
export const SALON_META_SUFFIX = "Charme Güzellik Salonu";

export const SERVICE_PROMO_ITEMS = [
  {
    id: "p1",
    faintWord: "Diode",
    titleDark: "Diode BUZ",
    titleAccent: "Lazer epilasyon",
    imageUrl:
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1400&q=85&auto=format&fit=crop",
    lightOnDark: true,
    badgeText: "Kadın & erkek",
  },
  {
    id: "p2",
    faintWord: "Hydrafacial",
    titleDark: "Cilt bakımı ·",
    titleAccent: "Hydrafacial",
    imageUrl:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1400&q=85&auto=format&fit=crop",
    lightOnDark: true,
  },
  {
    id: "p3",
    faintWord: "G5",
    titleDark: "Bölgesel",
    titleAccent: "zayıflama",
    imageUrl:
      "https://images.unsplash.com/photo-1544161515-4ab6be6f843b?w=1400&q=85&auto=format&fit=crop",
    lightOnDark: true,
    badgeText: "EMS · Slimbody",
  },
] as const;

export const BRANDED_INTRO_HIZMETLER = {
  title: "Hizmetlerimiz",
  body:
    "Cilt bakımı, lazer epilasyon ve bölgesel şekillendirmeyi bir arada sunuyoruz. Charme ile hijyenik ortam, deneyimli kadro ve güncel ekipmanlarla ışıltınıza değer katıyoruz. Hydrafacial ışıltısı, Diode BUZ konforu, G5 · EMS · Slimbody ile hedefe yönelik bakım.",
  accentPhrase: "Charme",
  align: "left" as const,
};

export function miniPage(title: string) {
  return JSON.stringify([
    {
      id: "mp1",
      type: "text",
      props: { as: "h2", align: "left", content: title },
    },
    {
      id: "mp2",
      type: "text",
      props: {
        content:
          "Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin.",
      },
    },
    {
      id: "mp3",
      type: "button",
      props: {
        label: "İletişim",
        href: "/iletisim",
        variant: "primary",
        fullWidthMobile: true,
      },
    },
  ]);
}

export function buildDemoBlocks() {
  return JSON.stringify([
    {
      id: "slider-1",
      type: "heroSlider",
      props: {
        slides: [
          {
            id: "s1",
            imageUrl:
              "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80",
            headline: "Charme Güzellik",
            subline:
              "Cilt bakımı, Diode BUZ lazer ve bölgesel şekillendirme — randevu için iletişime geçin.",
            href: "/iletisim",
            ctaLabel: "Randevu al",
          },
          {
            id: "s2",
            imageUrl:
              "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80",
            headline: "Hizmetlerimiz",
            subline: "Hydrafacial, altın bakım, Diode BUZ lazer, G5 · EMS · Slimbody.",
            href: "/hizmetler",
            ctaLabel: "Hizmetler",
          },
          {
            id: "s3",
            imageUrl:
              "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1600&q=80",
            headline: "Bakırköy’de güzellik",
            subline: "Hijyenik ortam ve deneyimli ekip.",
            href: "/hakkimizda",
            ctaLabel: "Hakkımızda",
          },
          {
            id: "s4",
            imageUrl:
              "https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1600&q=80",
            headline: "Hydrafacial & bakım",
            subline: "Cilt yenileme ve bakım protokolleri hakkında bilgi alın.",
            href: "/hydrafacial",
            ctaLabel: "Hydrafacial",
          },
        ],
        autoplayMs: 6000,
        aspectRatio: "wide",
        showDots: true,
        overlayDark: true,
      },
    },
    {
      id: "reviews-1",
      type: "testimonialCarousel",
      props: {
        title: "Mükemmel",
        subtitle: "Örnek yorum kartları — admin’den kendi metinlerinizle güncelleyin.",
        autoplayMs: 6500,
        footnote: TESTIMONIAL_LAYOUT_ADMIN_HINT,
        reviews: [
          {
            id: "rv1",
            name: "Örnek müşteri",
            relativeTimeLabel: "2 ay önce",
            rating: 5,
            text: "Profesyonel ekip ve hijyenik ortam. Randevu süreci düzenli.",
            sourceLabel: "Google",
          },
          {
            id: "rv2",
            name: "Örnek müşteri 2",
            relativeTimeLabel: "2 ay önce",
            rating: 5,
            text: "Memnun kaldım, tekrar tercih ederim.",
            sourceLabel: "Google",
          },
          {
            id: "rv3",
            name: "Örnek müşteri 3",
            relativeTimeLabel: "3 ay önce",
            rating: 5,
            text: "İlgi ve hizmet kalitesi çok iyi.",
            sourceLabel: "Google",
          },
        ],
      },
    },
    {
      id: "intro-branded",
      type: "brandedIntro",
      props: BRANDED_INTRO_HIZMETLER,
    },
    {
      id: "promo-grid-1",
      type: "servicePromoGrid",
      props: {
        items: [...SERVICE_PROMO_ITEMS],
      },
    },
    {
      id: "btn-cta",
      type: "button",
      props: {
        label: "Hemen bize ulaşın",
        href: "/iletisim",
        variant: "primary",
        fullWidthMobile: true,
      },
    },
    {
      id: "txt-sss",
      type: "text",
      props: {
        as: "h2",
        align: "left",
        content: "Sıkça sorulan sorular",
      },
    },
    {
      id: "txt-sss-hint",
      type: "text",
      props: {
        content:
          "Uzun SSS metninizi buraya blok ekleyerek veya ayrı bir SSS sayfasına taşıyarak yapıştırın (içerik telif açısından sizin sorumluluğunuzdadır).",
      },
    },
    {
      id: "btn-sss",
      type: "button",
      props: {
        label: "Tüm SSS sayfası",
        href: "/sss",
        variant: "outline",
        fullWidthMobile: false,
      },
    },
    {
      id: "ig-feed-1",
      type: "instagramFeed",
      props: {
        title: "Instagram’da bizi takip edin",
        columns: 3,
      },
    },
  ]);
}

export function buildHizmetlerBlocks() {
  return JSON.stringify([
    {
      id: "h-intro",
      type: "brandedIntro",
      props: BRANDED_INTRO_HIZMETLER,
    },
    {
      id: "h-promo",
      type: "servicePromoGrid",
      props: {
        items: SERVICE_PROMO_ITEMS.map((it, i) => ({ ...it, id: `hp-${i}` })),
      },
    },
    {
      id: "h-list",
      type: "text",
      props: {
        as: "h3",
        align: "left",
        content:
          "Menüden detay sayfalarına gidin: Cilt bakımı (Hydrafacial, altın bakım, gıdı eritme) · Diode BUZ lazer epilasyon · G5 · EMS · Slimbody.",
      },
    },
    {
      id: "hb",
      type: "button",
      props: {
        label: "İletişim / randevu",
        href: "/iletisim",
        variant: "primary",
        fullWidthMobile: true,
      },
    },
  ]);
}

export function buildIletisimBlocks() {
  return JSON.stringify([
    {
      id: "i1",
      type: "text",
      props: { as: "h2", content: "İletişim" },
    },
    {
      id: "i1b",
      type: "text",
      props: { content: `${SALON_ADDRESS_LINE}\nTel: +90 551 978 43 48` },
    },
    {
      id: "i2",
      type: "map",
      props: { address: SALON_ADDRESS_LINE, height: 380 },
    },
    {
      id: "i3",
      type: "contactForm",
      props: {
        mode: "appointment",
        title: "Randevu — bilgilerinizi bırakın",
        successMessage: "Teşekkürler, en kısa sürede dönüş yapacağız.",
        slotDurationMinutes: 60,
        serviceNavUseAuto: true,
        serviceNavMenuSlug: "header",
        appointmentDays: DEFAULT_APPOINTMENT_DAYS.map((d) => ({ ...d })),
      },
    },
    {
      id: "i4",
      type: "whatsapp",
      props: { phone: SALON_PHONE_E164, label: "WhatsApp" },
    },
  ]);
}

export function buildSssBlocks() {
  return JSON.stringify([
    {
      id: "sss1",
      type: "text",
      props: { as: "h2", content: "Sıkça sorulan sorular" },
    },
    {
      id: "sss2",
      type: "text",
      props: {
        content:
          "Bu sayfaya kendi soru-cevap metinlerinizi Admin’den ekleyin. Otomatik olarak başka bir siteden metin kopyalanmamıştır.",
      },
    },
  ]);
}

export const salonSettingsData = {
  siteName: SALON_BRAND,
  activeThemeId: "cherry",
  mediaUploadSlug: "charme-guzellik",
  headerPromoLine: "Yeni sezon bakım paketleri",
  socialInstagramUrl: "https://www.instagram.com/",
  socialFacebookUrl: "https://www.facebook.com/",
  whatsappNumber: SALON_PHONE_E164,
  defaultMetaTitle: `Bakırköy Güzellik | Cilt Bakımı | Lazer Epilasyon — ${SALON_META_SUFFIX}`,
  defaultMetaDescription:
    "Charme Güzellik — Hydrafacial, altın bakım, Diode BUZ lazer epilasyon, G5 · EMS · Slimbody. Randevu ve iletişim.",
  seoKeywords:
    "bakırköy güzellik salonu, charme güzellik, hydrafacial, diode lazer, epilasyon, cilt bakımı, istanbul",
  businessJson: JSON.stringify({
    name: SALON_BRAND,
    description:
      "Cilt bakımı (Hydrafacial, altın bakım, gıdı eritme), Diode BUZ lazer epilasyon, bölgesel zayıflama (G5, EMS, Slimbody).",
    telephone: "+90 551 978 43 48",
    address: {
      streetAddress: "Bakırköy",
      addressLocality: "İstanbul",
      addressCountry: "TR",
    },
    url: "https://example.com/",
  }),
} as const;

export type SeedNavRow = {
  id: string;
  parentId: string | null;
  label: string;
  href: string;
  sortOrder: number;
  menuSlug?: string;
  published?: boolean;
  openInNewTab?: boolean;
};

/** prisma/seed.ts içindeki menü sırası ve hiyerarşi ile aynı, sabit id’ler (SQL FK için). */
export const SEED_NAV_ITEMS: SeedNavRow[] = [
  { id: "cmseednav001", parentId: null, label: "ANASAYFA", href: "/", sortOrder: 0 },
  { id: "cmseednav002", parentId: null, label: "LAZER EPİLASYON", href: "/lazer-epilasyon", sortOrder: 1 },
  { id: "cmseednav003", parentId: "cmseednav002", label: "Bikini lazer epilasyon", href: "/lazer-bikini", sortOrder: 0 },
  {
    id: "cmseednav004",
    parentId: "cmseednav002",
    label: "Koltukaltı lazer epilasyon",
    href: "/lazer-koltukalti",
    sortOrder: 1,
  },
  { id: "cmseednav005", parentId: null, label: "HYDRAFACIAL", href: "/hydrafacial", sortOrder: 2 },
  { id: "cmseednav006", parentId: null, label: "HİZMETLERİMİZ", href: "/hizmetler", sortOrder: 3 },
  {
    id: "cmseednav007",
    parentId: "cmseednav006",
    label: "Altın bakım — Lüks deneyim",
    href: "/altin-bakim",
    sortOrder: 0,
  },
  {
    id: "cmseednav008",
    parentId: "cmseednav006",
    label: "Gıdı eritme — Keskin hatlar",
    href: "/gidi-eritme",
    sortOrder: 1,
  },
  {
    id: "cmseednav009",
    parentId: "cmseednav006",
    label: "Hydrafacial — Işıltınız",
    href: "/hydrafacial",
    sortOrder: 2,
  },
  { id: "cmseednav010", parentId: "cmseednav006", label: "Cilt bakımı", href: "/cilt-bakimi", sortOrder: 3 },
  {
    id: "cmseednav011",
    parentId: "cmseednav006",
    label: "Diode BUZ lazer — Kadın & erkek",
    href: "/lazer-epilasyon",
    sortOrder: 4,
  },
  {
    id: "cmseednav012",
    parentId: "cmseednav006",
    label: "G5 · EMS · Slimbody",
    href: "/g5-masaj",
    sortOrder: 5,
  },
  {
    id: "cmseednav013",
    parentId: "cmseednav006",
    label: "Manikür & protez tırnak",
    href: "/manikur-pedikur",
    sortOrder: 6,
  },
  {
    id: "cmseednav014",
    parentId: "cmseednav006",
    label: "Kaş · kirpik · kalıcı makyaj",
    href: "/kas-dizayni",
    sortOrder: 7,
  },
  { id: "cmseednav015", parentId: null, label: "HAKKIMIZDA", href: "/hakkimizda", sortOrder: 4 },
  { id: "cmseednav016", parentId: null, label: "KAMPANYALARIMIZ", href: "/kampanyalar", sortOrder: 5 },
  { id: "cmseednav017", parentId: null, label: "SSS", href: "/sss", sortOrder: 6 },
  { id: "cmseednav018", parentId: null, label: "İLETİŞİM", href: "/iletisim", sortOrder: 7 },
];

export const SEED_STAFF_ROLES = [
  {
    id: "cmseedrole_admin",
    slug: "admin",
    label: "Yönetici",
    permissionsJson: JSON.stringify([...allStaffPermissions()]),
  },
  {
    id: "cmseedrole_editor",
    slug: "editor",
    label: "Editör",
    permissionsJson: JSON.stringify([...editorStaffPermissions()]),
  },
  {
    id: "cmseedrole_scheduler",
    slug: "scheduler",
    label: "Randevu operatörü",
    permissionsJson: JSON.stringify(["crm.appointments"]),
  },
  {
    id: "cmseedrole_commerce",
    slug: "commerce",
    label: "Ticaret (kasa, paket, cari)",
    permissionsJson: JSON.stringify(["commerce.manage"]),
  },
] as const;

export const SEED_STAFF_USER_ID = "cmseeduser_admin";

export type SeedPageRow = {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  blocks: string;
  published: boolean;
};

export function buildAllSeedPages(): SeedPageRow[] {
  const demoBlocks = buildDemoBlocks();
  const hizmetlerBlocks = buildHizmetlerBlocks();
  const iletisimBlocks = buildIletisimBlocks();
  const sssBlocks = buildSssBlocks();

  const mini = (slug: string, title: string, id: string): SeedPageRow => ({
    id,
    slug,
    title,
    metaTitle: `${title} · ${SALON_META_SUFFIX}`,
    metaDescription: `${title} — ${SALON_BRAND}`,
    blocks: miniPage(title),
    published: true,
  });

  const rows: SeedPageRow[] = [
    {
      id: "cmseedpg_home",
      slug: "home",
      title: "Ana sayfa",
      metaTitle: `Bakırköy Güzellik | Cilt Bakımı | Lazer Epilasyon — ${SALON_META_SUFFIX}`,
      metaDescription:
        "Charme Güzellik Salonu — cilt bakımı, lazer epilasyon ve bölgesel şekillendirme. Randevu için iletişime geçin.",
      blocks: demoBlocks,
      published: true,
    },
    {
      id: "cmseedpg_hizmetler",
      slug: "hizmetler",
      title: "Hizmetlerimiz",
      metaTitle: `Hizmetlerimiz · ${SALON_META_SUFFIX}`,
      metaDescription:
        "Hydrafacial, altın bakım, gıdı eritme, Diode BUZ lazer, G5 · EMS · Slimbody — Charme Güzellik.",
      blocks: hizmetlerBlocks,
      published: true,
    },
    {
      id: "cmseedpg_iletisim",
      slug: "iletisim",
      title: "İletişim",
      metaTitle: `İletişim · ${SALON_META_SUFFIX}`,
      metaDescription: "Adres, harita ve randevu formu. Bakırköy / İstanbul.",
      blocks: iletisimBlocks,
      published: true,
    },
    {
      id: "cmseedpg_sss",
      slug: "sss",
      title: "Sıkça sorulan sorular",
      metaTitle: `SSS · ${SALON_META_SUFFIX}`,
      metaDescription: "Sıkça sorulan sorular.",
      blocks: sssBlocks,
      published: true,
    },
  ];

  const miniSpecs: [string, string, string][] = [
    ["lazer-epilasyon", "Lazer epilasyon", "cmseedpg_lazer"],
    ["lazer-bikini", "Bikini lazer epilasyon", "cmseedpg_lbikini"],
    ["lazer-koltukalti", "Koltukaltı lazer epilasyon", "cmseedpg_lkol"],
    ["hydrafacial", "Hydrafacial", "cmseedpg_hyd"],
    ["altin-bakim", "Altın bakım", "cmseedpg_altin"],
    ["gidi-eritme", "Gıdı eritme", "cmseedpg_gidi"],
    ["cilt-bakimi", "Cilt bakımı", "cmseedpg_cilt"],
    ["manikur-pedikur", "Manikür pedikür", "cmseedpg_mani"],
    ["protez-tirnak", "Protez tırnak", "cmseedpg_prot"],
    ["kalici-oje", "Kalıcı oje", "cmseedpg_oje"],
    ["kas-dizayni", "Kaş dizaynı", "cmseedpg_kas"],
    ["kalici-makyaj", "Kalıcı makyaj", "cmseedpg_mak"],
    ["g5-masaj", "G5 masajı | bölgesel zayıflama", "cmseedpg_g5"],
    ["lenf-drenaj", "Lenf drenaj masajı", "cmseedpg_lenf"],
    ["kirpik-lifting", "Kirpik lifting", "cmseedpg_kirlift"],
    ["ipek-kirpik", "İpek kirpik", "cmseedpg_ipek"],
    ["hakkimizda", "Hakkımızda", "cmseedpg_hakk"],
    ["kampanyalar", "Kampanyalarımız", "cmseedpg_kamp"],
  ];

  for (const [slug, title, id] of miniSpecs) {
    rows.push(mini(slug, title, id));
  }

  return rows;
}
