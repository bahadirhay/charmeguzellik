import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_APPOINTMENT_DAYS } from "../src/lib/appointment-schedule";
import { ensureDefaultStaffRoles } from "../src/lib/staff-roles-defaults";
import { TESTIMONIAL_LAYOUT_ADMIN_HINT } from "../src/lib/testimonial-admin-footnotes";

const prisma = new PrismaClient();

const miniPage = (title: string) =>
  JSON.stringify([
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

const SALON_PHONE_E164 = "905519784348";
/** Harita ve iletişim metni — Google’da doğru pin için tam satır */
const SALON_ADDRESS_LINE =
  "Charme Güzellik, Özlem Apt, Zeytinlik, Fişekhane Cd. No:50 Kat:5 Daire:16, 34110 Bakırköy/İstanbul";
const SALON_BRAND = "Charme Güzellik Salonu";
const SALON_META_SUFFIX = "Charme Güzellik Salonu";

/** Vitrin kartları — Unsplash (güzellik / lazer / masaj) */
const SERVICE_PROMO_ITEMS = [
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

const BRANDED_INTRO_HIZMETLER = {
  title: "Hizmetlerimiz",
  body:
    "Cilt bakımı, lazer epilasyon ve bölgesel şekillendirmeyi bir arada sunuyoruz. Charme ile hijyenik ortam, deneyimli kadro ve güncel ekipmanlarla ışıltınıza değer katıyoruz. Hydrafacial ışıltısı, Diode BUZ konforu, G5 · EMS · Slimbody ile hedefe yönelik bakım.",
  accentPhrase: "Charme",
  align: "left" as const,
};

const demoBlocks = JSON.stringify([
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
          subline: "Cilt bakımı, Diode BUZ lazer ve bölgesel şekillendirme — randevu için iletişime geçin.",
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

async function ensureStaffRolesAndBootstrapUser() {
  await ensureDefaultStaffRoles(prisma);
  const n = await prisma.staffUser.count();
  const plain = process.env.ADMIN_PASSWORD?.trim();
  if (n === 0 && plain && plain.length >= 6) {
    const adminRole = await prisma.staffRole.findUnique({ where: { slug: "admin" } });
    if (!adminRole) return;
    const hash = await bcrypt.hash(plain, 12);
    const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
    const uname = raw.length >= 2 ? raw : "admin";
    await prisma.staffUser.create({
      data: {
        username: uname,
        passwordHash: hash,
        displayName: "Yönetici",
        roleId: adminRole.id,
      },
    });
    console.log(`[seed] Panel kullanıcısı: ${uname} (şifre: ADMIN_PASSWORD)`);
  }
}

const salonSettingsData = {
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
};

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...salonSettingsData },
    update: salonSettingsData,
  });

  await prisma.page.upsert({
    where: { slug: "home" },
    create: {
      slug: "home",
      title: "Ana sayfa",
      metaTitle: `Bakırköy Güzellik | Cilt Bakımı | Lazer Epilasyon — ${SALON_META_SUFFIX}`,
      metaDescription:
        "Charme Güzellik Salonu — cilt bakımı, lazer epilasyon ve bölgesel şekillendirme. Randevu için iletişime geçin.",
      blocks: demoBlocks,
      published: true,
    },
    update: {
      metaTitle: `Bakırköy Güzellik | Cilt Bakımı | Lazer Epilasyon — ${SALON_META_SUFFIX}`,
      metaDescription:
        "Charme Güzellik Salonu — cilt bakımı, lazer epilasyon ve bölgesel şekillendirme. Randevu için iletişime geçin.",
      blocks: demoBlocks,
      published: true,
    },
  });

  const hizmetlerBlocks = JSON.stringify([
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
      props: { label: "İletişim / randevu", href: "/iletisim", variant: "primary", fullWidthMobile: true },
    },
  ]);

  await prisma.page.upsert({
    where: { slug: "hizmetler" },
    create: {
      slug: "hizmetler",
      title: "Hizmetlerimiz",
      metaTitle: `Hizmetlerimiz · ${SALON_META_SUFFIX}`,
      metaDescription:
        "Hydrafacial, altın bakım, gıdı eritme, Diode BUZ lazer, G5 · EMS · Slimbody — Charme Güzellik.",
      blocks: hizmetlerBlocks,
      published: true,
    },
    update: {
      title: "Hizmetlerimiz",
      metaTitle: `Hizmetlerimiz · ${SALON_META_SUFFIX}`,
      metaDescription:
        "Hydrafacial, altın bakım, gıdı eritme, Diode BUZ lazer, G5 · EMS · Slimbody — Charme Güzellik.",
      blocks: hizmetlerBlocks,
      published: true,
    },
  });

  const iletisimBlocks = JSON.stringify([
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

  await prisma.page.upsert({
    where: { slug: "iletisim" },
    create: {
      slug: "iletisim",
      title: "İletişim",
      metaTitle: `İletişim · ${SALON_META_SUFFIX}`,
      metaDescription: "Adres, harita ve randevu formu. Bakırköy / İstanbul.",
      blocks: iletisimBlocks,
      published: true,
    },
    update: {
      metaTitle: `İletişim · ${SALON_META_SUFFIX}`,
      metaDescription: "Adres, harita ve randevu formu. Bakırköy / İstanbul.",
      blocks: iletisimBlocks,
      published: true,
    },
  });

  const ensurePage = async (slug: string, title: string) => {
    await prisma.page.upsert({
      where: { slug },
      create: {
        slug,
        title,
        metaTitle: `${title} · ${SALON_META_SUFFIX}`,
        blocks: miniPage(title),
        published: true,
      },
      update: {
        metaTitle: `${title} · ${SALON_META_SUFFIX}`,
        published: true,
      },
    });
  };

  await ensurePage("lazer-epilasyon", "Lazer epilasyon");
  await ensurePage("lazer-bikini", "Bikini lazer epilasyon");
  await ensurePage("lazer-koltukalti", "Koltukaltı lazer epilasyon");
  await ensurePage("hydrafacial", "Hydrafacial");
  await ensurePage("altin-bakim", "Altın bakım");
  await ensurePage("gidi-eritme", "Gıdı eritme");
  await ensurePage("cilt-bakimi", "Cilt bakımı");
  await ensurePage("manikur-pedikur", "Manikür pedikür");
  await ensurePage("protez-tirnak", "Protez tırnak");
  await ensurePage("kalici-oje", "Kalıcı oje");
  await ensurePage("kas-dizayni", "Kaş dizaynı");
  await ensurePage("kalici-makyaj", "Kalıcı makyaj");
  await ensurePage("g5-masaj", "G5 masajı | bölgesel zayıflama");
  await ensurePage("lenf-drenaj", "Lenf drenaj masajı");
  await ensurePage("kirpik-lifting", "Kirpik lifting");
  await ensurePage("ipek-kirpik", "İpek kirpik");
  await ensurePage("hakkimizda", "Hakkımızda");
  await ensurePage("kampanyalar", "Kampanyalarımız");

  const sssBlocks = JSON.stringify([
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
  await prisma.page.upsert({
    where: { slug: "sss" },
    create: {
      slug: "sss",
      title: "Sıkça sorulan sorular",
      metaTitle: `SSS · ${SALON_META_SUFFIX}`,
      metaDescription: "Sıkça sorulan sorular.",
      blocks: sssBlocks,
      published: true,
    },
    update: { blocks: sssBlocks, published: true },
  });

  await prisma.navItem.deleteMany();

  await prisma.navItem.create({
    data: { label: "ANASAYFA", href: "/", sortOrder: 0, published: true },
  });

  const lazer = await prisma.navItem.create({
    data: {
      label: "LAZER EPİLASYON",
      href: "/lazer-epilasyon",
      sortOrder: 1,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: lazer.id,
      label: "Bikini lazer epilasyon",
      href: "/lazer-bikini",
      sortOrder: 0,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: lazer.id,
      label: "Koltukaltı lazer epilasyon",
      href: "/lazer-koltukalti",
      sortOrder: 1,
      published: true,
    },
  });

  await prisma.navItem.create({
    data: { label: "HYDRAFACIAL", href: "/hydrafacial", sortOrder: 2, published: true },
  });

  const hiz = await prisma.navItem.create({
    data: {
      label: "HİZMETLERİMİZ",
      href: "/hizmetler",
      sortOrder: 3,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Altın bakım — Lüks deneyim",
      href: "/altin-bakim",
      sortOrder: 0,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Gıdı eritme — Keskin hatlar",
      href: "/gidi-eritme",
      sortOrder: 1,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Hydrafacial — Işıltınız",
      href: "/hydrafacial",
      sortOrder: 2,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Cilt bakımı",
      href: "/cilt-bakimi",
      sortOrder: 3,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Diode BUZ lazer — Kadın & erkek",
      href: "/lazer-epilasyon",
      sortOrder: 4,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "G5 · EMS · Slimbody",
      href: "/g5-masaj",
      sortOrder: 5,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Manikür & protez tırnak",
      href: "/manikur-pedikur",
      sortOrder: 6,
      published: true,
    },
  });
  await prisma.navItem.create({
    data: {
      parentId: hiz.id,
      label: "Kaş · kirpik · kalıcı makyaj",
      href: "/kas-dizayni",
      sortOrder: 7,
      published: true,
    },
  });

  await prisma.navItem.create({
    data: { label: "HAKKIMIZDA", href: "/hakkimizda", sortOrder: 4, published: true },
  });
  await prisma.navItem.create({
    data: { label: "KAMPANYALARIMIZ", href: "/kampanyalar", sortOrder: 5, published: true },
  });
  await prisma.navItem.create({
    data: { label: "SSS", href: "/sss", sortOrder: 6, published: true },
  });
  await prisma.navItem.create({
    data: { label: "İLETİŞİM", href: "/iletisim", sortOrder: 7, published: true },
  });

  await ensureStaffRolesAndBootstrapUser();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
