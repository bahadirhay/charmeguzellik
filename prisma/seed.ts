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
import { DEFAULT_TENANT_ID_SEED } from "../src/lib/tenant-default";

const prisma = new PrismaClient();
const TENANT_ID = DEFAULT_TENANT_ID_SEED;

async function ensureStaffRolesAndBootstrapUser() {
  await ensureDefaultStaffRoles(prisma);
  const n = await prisma.staffUser.count({ where: { tenantId: TENANT_ID } });
  const plain = process.env.ADMIN_PASSWORD?.trim();
  if (n === 0 && plain && plain.length >= 6) {
    const adminRole = await prisma.staffRole.findUnique({
      where: { tenantId_slug: { tenantId: TENANT_ID, slug: "admin" } },
    });
    if (!adminRole) return;
    const hash = await bcrypt.hash(plain, 12);
    const raw = (process.env.ADMIN_STAFF_USERNAME ?? "admin").trim().toLowerCase().replace(/\s+/g, "");
    const uname = raw.length >= 2 ? raw : "admin";
    await prisma.staffUser.create({
      data: {
        tenantId: TENANT_ID,
        username: uname,
        passwordHash: hash,
        displayName: "Yönetici",
        roleAssignments: { create: [{ roleId: adminRole.id }] },
      },
    });
    console.log(`[seed] Panel kullanıcısı: ${uname} (şifre: ADMIN_PASSWORD)`);
  }
}

async function main() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: { id: TENANT_ID, slug: "default", name: "Varsayılan site", status: "active" },
    update: {},
  });

  const defaultHost = (process.env.DEFAULT_TENANT_HOST ?? "localhost").trim().toLowerCase();
  if (defaultHost) {
    await prisma.tenantDomain.upsert({
      where: { host: defaultHost },
      create: { tenantId: TENANT_ID, host: defaultHost, isPrimary: true },
      update: { tenantId: TENANT_ID, isPrimary: true },
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, tenantId: TENANT_ID, ...salonSettingsData },
    update: { ...salonSettingsData, tenantId: TENANT_ID },
  });

  const demoBlocks = buildDemoBlocks();
  const hizmetlerBlocks = buildHizmetlerBlocks();
  const iletisimBlocks = buildIletisimBlocks();
  const sssBlocks = buildSssBlocks();

  await prisma.page.upsert({
    where: { tenantId_slug: { tenantId: TENANT_ID, slug: "home" } },
    create: {
      tenantId: TENANT_ID,
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
    where: { tenantId_slug: { tenantId: TENANT_ID, slug: "hizmetler" } },
    create: {
      tenantId: TENANT_ID,
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
    where: { tenantId_slug: { tenantId: TENANT_ID, slug: "iletisim" } },
    create: {
      tenantId: TENANT_ID,
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
      where: { tenantId_slug: { tenantId: TENANT_ID, slug } },
      create: {
        tenantId: TENANT_ID,
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
    where: { tenantId_slug: { tenantId: TENANT_ID, slug: "sss" } },
    create: {
      tenantId: TENANT_ID,
      slug: "sss",
      title: "Sıkça sorulan sorular",
      metaTitle: `SSS · ${SALON_META_SUFFIX}`,
      metaDescription: "Sıkça sorulan sorular.",
      blocks: sssBlocks,
      published: true,
    },
    update: { blocks: sssBlocks, published: true },
  });

  await prisma.navItem.deleteMany({ where: { tenantId: TENANT_ID } });

  for (const row of SEED_NAV_ITEMS) {
    await prisma.navItem.create({
      data: {
        tenantId: TENANT_ID,
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
