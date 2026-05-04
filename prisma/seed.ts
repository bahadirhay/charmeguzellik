import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SEED_NAV_ITEMS,
  buildDemoBlocks,
  buildHizmetlerBlocks,
  buildIletisimBlocks,
  buildSssBlocks,
  miniPage,
  SALON_META_SUFFIX,
  salonSettingsData,
} from "./seed-data";
import { ensureDefaultStaffRoles } from "../src/lib/staff-roles-defaults";

const prisma = new PrismaClient();

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

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...salonSettingsData },
    update: salonSettingsData,
  });

  const demoBlocks = buildDemoBlocks();
  const hizmetlerBlocks = buildHizmetlerBlocks();
  const iletisimBlocks = buildIletisimBlocks();
  const sssBlocks = buildSssBlocks();

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

  for (const row of SEED_NAV_ITEMS) {
    await prisma.navItem.create({
      data: {
        id: row.id,
        parentId: row.parentId,
        label: row.label,
        href: row.href,
        sortOrder: row.sortOrder,
        menuSlug: row.menuSlug ?? "header",
        published: row.published ?? true,
        openInNewTab: row.openInNewTab ?? false,
      },
    });
  }

  await ensureStaffRolesAndBootstrapUser();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
