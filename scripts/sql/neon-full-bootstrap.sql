-- =============================================================================
-- Neon / PostgreSQL — TAM şema + prisma/seed.ts ile aynı içerik (tek dosya)
-- Oluşturma: npm run sql:neon-full
-- =============================================================================
-- ADIM 1 — BOŞ veritabanı / yeni branch: Aşağıdaki DDL (BÖLÜM A) çalıştırın.
-- ADIM 2 — Tablolar ZATEN varsa: BÖLÜM A'yı ATLAYIN; BÖLÜM B + C yeter.
-- =============================================================================
-- Panel girişi (ilk kurulum): kullanıcı adı  admin  şifre  CharmeGecici2026!
-- (Bu dosyayı yeniden üretmeden önce scripts/generate-neon-full-sql.ts içinde şifreyi değiştirin.)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BÖLÜM A — Şema (Prisma migrate diff; boş DB için)
-- -----------------------------------------------------------------------------
-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "canonicalPath" TEXT,
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "blocksMobile" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "includeInSitemap" BOOLEAN NOT NULL DEFAULT true,
    "sitemapPriority" DOUBLE PRECISION,
    "sitemapChangeFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "siteName" TEXT NOT NULL DEFAULT 'Güzellik Merkezi',
    "activeThemeId" TEXT NOT NULL DEFAULT 'default',
    "mediaUploadSlug" TEXT,
    "headerPromoLine" TEXT,
    "showHeaderTopBar" BOOLEAN NOT NULL DEFAULT true,
    "socialInstagramUrl" TEXT,
    "socialFacebookUrl" TEXT,
    "defaultMetaTitle" TEXT,
    "defaultMetaDescription" TEXT,
    "businessJson" TEXT,
    "googleAnalyticsId" TEXT,
    "googleTagManagerId" TEXT,
    "facebookPixelId" TEXT,
    "customHeadHtml" TEXT,
    "whatsappNumber" TEXT,
    "seoKeywords" TEXT,
    "instagramGraphUserId" TEXT,
    "instagramAccessToken" TEXT,
    "themeTokensJson" TEXT,
    "headerBlocks" TEXT NOT NULL DEFAULT '[]',
    "footerBlocks" TEXT NOT NULL DEFAULT '[]',
    "sitemapExtrasJson" TEXT NOT NULL DEFAULT '[]',
    "sitemapHomePriority" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sitemapPagePriority" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "transactionalMailFrom" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteInstagramPost" (
    "id" TEXT NOT NULL,
    "instagramId" TEXT,
    "permalink" TEXT NOT NULL,
    "caption" TEXT,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "mediaType" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteInstagramPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteYoutubeVideo" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT,
    "watchUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteYoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteTiktokVideo" (
    "id" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "videoId" TEXT,
    "thumbnailUrl" TEXT,
    "title" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteTiktokVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "serviceName" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientPhoneKey" TEXT,
    "clientNameKey" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "crmContactId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavItem" (
    "id" TEXT NOT NULL,
    "menuSlug" TEXT NOT NULL DEFAULT 'header',
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NavItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "permissionsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SiteInstagramPost_instagramId_key" ON "SiteInstagramPost"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteInstagramPost_permalink_key" ON "SiteInstagramPost"("permalink");

-- CreateIndex
CREATE UNIQUE INDEX "SiteYoutubeVideo_videoId_key" ON "SiteYoutubeVideo"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteTiktokVideo_permalink_key" ON "SiteTiktokVideo"("permalink");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_phoneKey_key" ON "CrmContact"("phoneKey");

-- CreateIndex
CREATE INDEX "Appointment_startAt_serviceName_status_idx" ON "Appointment"("startAt", "serviceName", "status");

-- CreateIndex
CREATE INDEX "NavItem_menuSlug_parentId_sortOrder_idx" ON "NavItem"("menuSlug", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_slug_key" ON "StaffRole"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_username_key" ON "StaffUser"("username");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavItem" ADD CONSTRAINT "NavItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NavItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- -----------------------------------------------------------------------------
-- BÖLÜM B — Uygulama verisini temizle (şemaya dokunmaz)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
  "StaffUser",
  "Appointment",
  "CrmContact",
  "NavItem",
  "Lead",
  "SiteInstagramPost",
  "SiteYoutubeVideo",
  "SiteTiktokVideo",
  "Page",
  "SiteSettings",
  "StaffRole"
RESTART IDENTITY CASCADE;



-- -----------------------------------------------------------------------------
-- BÖLÜM C — Site ayarları, sayfalar, menü, panel rolleri + admin
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "SiteSettings" ("id", "siteName", "activeThemeId", "mediaUploadSlug", "headerPromoLine", "socialInstagramUrl", "socialFacebookUrl", "whatsappNumber", "defaultMetaTitle", "defaultMetaDescription", "seoKeywords", "businessJson", "updatedAt")
VALUES (1, $d0$Charme Güzellik Salonu$d0$, $d0$cherry$d0$, $d0$charme-guzellik$d0$, $d0$Yeni sezon bakım paketleri$d0$, $d0$https://www.instagram.com/$d0$, $d0$https://www.facebook.com/$d0$, $d0$905519784348$d0$, $d0$Bakırköy Güzellik | Cilt Bakımı | Lazer Epilasyon — Charme Güzellik Salonu$d0$, $d0$Charme Güzellik — Hydrafacial, altın bakım, Diode BUZ lazer epilasyon, G5 · EMS · Slimbody. Randevu ve iletişim.$d0$, $d0$bakırköy güzellik salonu, charme güzellik, hydrafacial, diode lazer, epilasyon, cilt bakımı, istanbul$d0$, $d0${"name":"Charme Güzellik Salonu","description":"Cilt bakımı (Hydrafacial, altın bakım, gıdı eritme), Diode BUZ lazer epilasyon, bölgesel zayıflama (G5, EMS, Slimbody).","telephone":"+90 551 978 43 48","address":{"streetAddress":"Bakırköy","addressLocality":"İstanbul","addressCountry":"TR"},"url":"https://example.com/"}$d0$, NOW())
ON CONFLICT ("id") DO UPDATE SET
  "siteName" = EXCLUDED."siteName",
  "activeThemeId" = EXCLUDED."activeThemeId",
  "mediaUploadSlug" = EXCLUDED."mediaUploadSlug",
  "headerPromoLine" = EXCLUDED."headerPromoLine",
  "socialInstagramUrl" = EXCLUDED."socialInstagramUrl",
  "socialFacebookUrl" = EXCLUDED."socialFacebookUrl",
  "whatsappNumber" = EXCLUDED."whatsappNumber",
  "defaultMetaTitle" = EXCLUDED."defaultMetaTitle",
  "defaultMetaDescription" = EXCLUDED."defaultMetaDescription",
  "seoKeywords" = EXCLUDED."seoKeywords",
  "businessJson" = EXCLUDED."businessJson",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_home$d0$, $d0$home$d0$, $d0$Ana sayfa$d0$, $d0$Bakırköy Güzellik | Cilt Bakımı | Lazer Epilasyon — Charme Güzellik Salonu$d0$, $d0$Charme Güzellik Salonu — cilt bakımı, lazer epilasyon ve bölgesel şekillendirme. Randevu için iletişime geçin.$d0$, $d0$[{"id":"slider-1","type":"heroSlider","props":{"slides":[{"id":"s1","imageUrl":"https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80","headline":"Charme Güzellik","subline":"Cilt bakımı, Diode BUZ lazer ve bölgesel şekillendirme — randevu için iletişime geçin.","href":"/iletisim","ctaLabel":"Randevu al"},{"id":"s2","imageUrl":"https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80","headline":"Hizmetlerimiz","subline":"Hydrafacial, altın bakım, Diode BUZ lazer, G5 · EMS · Slimbody.","href":"/hizmetler","ctaLabel":"Hizmetler"},{"id":"s3","imageUrl":"https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1600&q=80","headline":"Bakırköy’de güzellik","subline":"Hijyenik ortam ve deneyimli ekip.","href":"/hakkimizda","ctaLabel":"Hakkımızda"},{"id":"s4","imageUrl":"https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1600&q=80","headline":"Hydrafacial & bakım","subline":"Cilt yenileme ve bakım protokolleri hakkında bilgi alın.","href":"/hydrafacial","ctaLabel":"Hydrafacial"}],"autoplayMs":6000,"aspectRatio":"wide","showDots":true,"overlayDark":true}},{"id":"reviews-1","type":"testimonialCarousel","props":{"title":"Mükemmel","subtitle":"Örnek yorum kartları — admin’den kendi metinlerinizle güncelleyin.","autoplayMs":6500,"footnote":"Bu alan yerleşim şablonudur. Google / Trustindex gibi üçüncü parti widget'ları Ayarlar → özel HTML veya blok notları ile ekleyebilirsiniz.","reviews":[{"id":"rv1","name":"Örnek müşteri","relativeTimeLabel":"2 ay önce","rating":5,"text":"Profesyonel ekip ve hijyenik ortam. Randevu süreci düzenli.","sourceLabel":"Google"},{"id":"rv2","name":"Örnek müşteri 2","relativeTimeLabel":"2 ay önce","rating":5,"text":"Memnun kaldım, tekrar tercih ederim.","sourceLabel":"Google"},{"id":"rv3","name":"Örnek müşteri 3","relativeTimeLabel":"3 ay önce","rating":5,"text":"İlgi ve hizmet kalitesi çok iyi.","sourceLabel":"Google"}]}},{"id":"intro-branded","type":"brandedIntro","props":{"title":"Hizmetlerimiz","body":"Cilt bakımı, lazer epilasyon ve bölgesel şekillendirmeyi bir arada sunuyoruz. Charme ile hijyenik ortam, deneyimli kadro ve güncel ekipmanlarla ışıltınıza değer katıyoruz. Hydrafacial ışıltısı, Diode BUZ konforu, G5 · EMS · Slimbody ile hedefe yönelik bakım.","accentPhrase":"Charme","align":"left"}},{"id":"promo-grid-1","type":"servicePromoGrid","props":{"items":[{"id":"p1","faintWord":"Diode","titleDark":"Diode BUZ","titleAccent":"Lazer epilasyon","imageUrl":"https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1400&q=85&auto=format&fit=crop","lightOnDark":true,"badgeText":"Kadın & erkek"},{"id":"p2","faintWord":"Hydrafacial","titleDark":"Cilt bakımı ·","titleAccent":"Hydrafacial","imageUrl":"https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1400&q=85&auto=format&fit=crop","lightOnDark":true},{"id":"p3","faintWord":"G5","titleDark":"Bölgesel","titleAccent":"zayıflama","imageUrl":"https://images.unsplash.com/photo-1544161515-4ab6be6f843b?w=1400&q=85&auto=format&fit=crop","lightOnDark":true,"badgeText":"EMS · Slimbody"}]}},{"id":"btn-cta","type":"button","props":{"label":"Hemen bize ulaşın","href":"/iletisim","variant":"primary","fullWidthMobile":true}},{"id":"txt-sss","type":"text","props":{"as":"h2","align":"left","content":"Sıkça sorulan sorular"}},{"id":"txt-sss-hint","type":"text","props":{"content":"Uzun SSS metninizi buraya blok ekleyerek veya ayrı bir SSS sayfasına taşıyarak yapıştırın (içerik telif açısından sizin sorumluluğunuzdadır)."}},{"id":"btn-sss","type":"button","props":{"label":"Tüm SSS sayfası","href":"/sss","variant":"outline","fullWidthMobile":false}},{"id":"ig-feed-1","type":"instagramFeed","props":{"title":"Instagram’da bizi takip edin","columns":3}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_hizmetler$d0$, $d0$hizmetler$d0$, $d0$Hizmetlerimiz$d0$, $d0$Hizmetlerimiz · Charme Güzellik Salonu$d0$, $d0$Hydrafacial, altın bakım, gıdı eritme, Diode BUZ lazer, G5 · EMS · Slimbody — Charme Güzellik.$d0$, $d0$[{"id":"h-intro","type":"brandedIntro","props":{"title":"Hizmetlerimiz","body":"Cilt bakımı, lazer epilasyon ve bölgesel şekillendirmeyi bir arada sunuyoruz. Charme ile hijyenik ortam, deneyimli kadro ve güncel ekipmanlarla ışıltınıza değer katıyoruz. Hydrafacial ışıltısı, Diode BUZ konforu, G5 · EMS · Slimbody ile hedefe yönelik bakım.","accentPhrase":"Charme","align":"left"}},{"id":"h-promo","type":"servicePromoGrid","props":{"items":[{"id":"hp-0","faintWord":"Diode","titleDark":"Diode BUZ","titleAccent":"Lazer epilasyon","imageUrl":"https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1400&q=85&auto=format&fit=crop","lightOnDark":true,"badgeText":"Kadın & erkek"},{"id":"hp-1","faintWord":"Hydrafacial","titleDark":"Cilt bakımı ·","titleAccent":"Hydrafacial","imageUrl":"https://images.unsplash.com/photo-1570172619644-dfd03ed8d084?w=1400&q=85&auto=format&fit=crop","lightOnDark":true},{"id":"hp-2","faintWord":"G5","titleDark":"Bölgesel","titleAccent":"zayıflama","imageUrl":"https://images.unsplash.com/photo-1544161515-4ab6be6f843b?w=1400&q=85&auto=format&fit=crop","lightOnDark":true,"badgeText":"EMS · Slimbody"}]}},{"id":"h-list","type":"text","props":{"as":"h3","align":"left","content":"Menüden detay sayfalarına gidin: Cilt bakımı (Hydrafacial, altın bakım, gıdı eritme) · Diode BUZ lazer epilasyon · G5 · EMS · Slimbody."}},{"id":"hb","type":"button","props":{"label":"İletişim / randevu","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_iletisim$d0$, $d0$iletisim$d0$, $d0$İletişim$d0$, $d0$İletişim · Charme Güzellik Salonu$d0$, $d0$Adres, harita ve randevu formu. Bakırköy / İstanbul.$d0$, $d0$[{"id":"i1","type":"text","props":{"as":"h2","content":"İletişim"}},{"id":"i1b","type":"text","props":{"content":"Charme Güzellik, Özlem Apt, Zeytinlik, Fişekhane Cd. No:50 Kat:5 Daire:16, 34110 Bakırköy/İstanbul\nTel: +90 551 978 43 48"}},{"id":"i2","type":"map","props":{"address":"Charme Güzellik, Özlem Apt, Zeytinlik, Fişekhane Cd. No:50 Kat:5 Daire:16, 34110 Bakırköy/İstanbul","height":380}},{"id":"i3","type":"contactForm","props":{"mode":"appointment","title":"Randevu — bilgilerinizi bırakın","successMessage":"Teşekkürler, en kısa sürede dönüş yapacağız.","slotDurationMinutes":60,"serviceNavUseAuto":true,"serviceNavMenuSlug":"header","appointmentDays":[{"day":1,"start":"09:00","end":"19:00"},{"day":2,"start":"09:00","end":"19:00"},{"day":3,"start":"09:00","end":"19:00"},{"day":4,"start":"09:00","end":"19:00"},{"day":5,"start":"09:00","end":"19:00"},{"day":6,"start":"09:00","end":"15:00"}]}},{"id":"i4","type":"whatsapp","props":{"phone":"905519784348","label":"WhatsApp"}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_sss$d0$, $d0$sss$d0$, $d0$Sıkça sorulan sorular$d0$, $d0$SSS · Charme Güzellik Salonu$d0$, $d0$Sıkça sorulan sorular.$d0$, $d0$[{"id":"sss1","type":"text","props":{"as":"h2","content":"Sıkça sorulan sorular"}},{"id":"sss2","type":"text","props":{"content":"Bu sayfaya kendi soru-cevap metinlerinizi Admin’den ekleyin. Otomatik olarak başka bir siteden metin kopyalanmamıştır."}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_lazer$d0$, $d0$lazer-epilasyon$d0$, $d0$Lazer epilasyon$d0$, $d0$Lazer epilasyon · Charme Güzellik Salonu$d0$, $d0$Lazer epilasyon — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Lazer epilasyon"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_lbikini$d0$, $d0$lazer-bikini$d0$, $d0$Bikini lazer epilasyon$d0$, $d0$Bikini lazer epilasyon · Charme Güzellik Salonu$d0$, $d0$Bikini lazer epilasyon — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Bikini lazer epilasyon"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_lkol$d0$, $d0$lazer-koltukalti$d0$, $d0$Koltukaltı lazer epilasyon$d0$, $d0$Koltukaltı lazer epilasyon · Charme Güzellik Salonu$d0$, $d0$Koltukaltı lazer epilasyon — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Koltukaltı lazer epilasyon"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_hyd$d0$, $d0$hydrafacial$d0$, $d0$Hydrafacial$d0$, $d0$Hydrafacial · Charme Güzellik Salonu$d0$, $d0$Hydrafacial — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Hydrafacial"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_altin$d0$, $d0$altin-bakim$d0$, $d0$Altın bakım$d0$, $d0$Altın bakım · Charme Güzellik Salonu$d0$, $d0$Altın bakım — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Altın bakım"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_gidi$d0$, $d0$gidi-eritme$d0$, $d0$Gıdı eritme$d0$, $d0$Gıdı eritme · Charme Güzellik Salonu$d0$, $d0$Gıdı eritme — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Gıdı eritme"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_cilt$d0$, $d0$cilt-bakimi$d0$, $d0$Cilt bakımı$d0$, $d0$Cilt bakımı · Charme Güzellik Salonu$d0$, $d0$Cilt bakımı — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Cilt bakımı"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_mani$d0$, $d0$manikur-pedikur$d0$, $d0$Manikür pedikür$d0$, $d0$Manikür pedikür · Charme Güzellik Salonu$d0$, $d0$Manikür pedikür — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Manikür pedikür"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_prot$d0$, $d0$protez-tirnak$d0$, $d0$Protez tırnak$d0$, $d0$Protez tırnak · Charme Güzellik Salonu$d0$, $d0$Protez tırnak — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Protez tırnak"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_oje$d0$, $d0$kalici-oje$d0$, $d0$Kalıcı oje$d0$, $d0$Kalıcı oje · Charme Güzellik Salonu$d0$, $d0$Kalıcı oje — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Kalıcı oje"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_kas$d0$, $d0$kas-dizayni$d0$, $d0$Kaş dizaynı$d0$, $d0$Kaş dizaynı · Charme Güzellik Salonu$d0$, $d0$Kaş dizaynı — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Kaş dizaynı"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_mak$d0$, $d0$kalici-makyaj$d0$, $d0$Kalıcı makyaj$d0$, $d0$Kalıcı makyaj · Charme Güzellik Salonu$d0$, $d0$Kalıcı makyaj — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Kalıcı makyaj"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_g5$d0$, $d0$g5-masaj$d0$, $d0$G5 masajı | bölgesel zayıflama$d0$, $d0$G5 masajı | bölgesel zayıflama · Charme Güzellik Salonu$d0$, $d0$G5 masajı | bölgesel zayıflama — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"G5 masajı | bölgesel zayıflama"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_lenf$d0$, $d0$lenf-drenaj$d0$, $d0$Lenf drenaj masajı$d0$, $d0$Lenf drenaj masajı · Charme Güzellik Salonu$d0$, $d0$Lenf drenaj masajı — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Lenf drenaj masajı"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_kirlift$d0$, $d0$kirpik-lifting$d0$, $d0$Kirpik lifting$d0$, $d0$Kirpik lifting · Charme Güzellik Salonu$d0$, $d0$Kirpik lifting — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Kirpik lifting"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_ipek$d0$, $d0$ipek-kirpik$d0$, $d0$İpek kirpik$d0$, $d0$İpek kirpik · Charme Güzellik Salonu$d0$, $d0$İpek kirpik — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"İpek kirpik"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_hakk$d0$, $d0$hakkimizda$d0$, $d0$Hakkımızda$d0$, $d0$Hakkımızda · Charme Güzellik Salonu$d0$, $d0$Hakkımızda — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Hakkımızda"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "Page" ("id", "slug", "title", "metaTitle", "metaDescription", "blocks", "published", "noIndex", "includeInSitemap", "createdAt", "updatedAt")
VALUES ($d0$cmseedpg_kamp$d0$, $d0$kampanyalar$d0$, $d0$Kampanyalarımız$d0$, $d0$Kampanyalarımız · Charme Güzellik Salonu$d0$, $d0$Kampanyalarımız — Charme Güzellik Salonu$d0$, $d0$[{"id":"mp1","type":"text","props":{"as":"h2","align":"left","content":"Kampanyalarımız"}},{"id":"mp2","type":"text","props":{"content":"Örnek içerik. Admin → Sayfalar bölümünden blokları ve Menü ekranından bağlantıları düzenleyin."}},{"id":"mp3","type":"button","props":{"label":"İletişim","href":"/iletisim","variant":"primary","fullWidthMobile":true}}]$d0$, true, false, true, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "metaTitle" = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "blocks" = EXCLUDED."blocks",
  "published" = EXCLUDED."published",
  "updatedAt" = NOW();

INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav001$d0$, $d0$header$d0$, NULL, $d0$ANASAYFA$d0$, $d0$/$d0$, 0, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav002$d0$, $d0$header$d0$, NULL, $d0$LAZER EPİLASYON$d0$, $d0$/lazer-epilasyon$d0$, 1, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav003$d0$, $d0$header$d0$, $d0$cmseednav002$d0$, $d0$Bikini lazer epilasyon$d0$, $d0$/lazer-bikini$d0$, 0, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav004$d0$, $d0$header$d0$, $d0$cmseednav002$d0$, $d0$Koltukaltı lazer epilasyon$d0$, $d0$/lazer-koltukalti$d0$, 1, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav005$d0$, $d0$header$d0$, NULL, $d0$HYDRAFACIAL$d0$, $d0$/hydrafacial$d0$, 2, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav006$d0$, $d0$header$d0$, NULL, $d0$HİZMETLERİMİZ$d0$, $d0$/hizmetler$d0$, 3, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav007$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Altın bakım — Lüks deneyim$d0$, $d0$/altin-bakim$d0$, 0, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav008$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Gıdı eritme — Keskin hatlar$d0$, $d0$/gidi-eritme$d0$, 1, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav009$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Hydrafacial — Işıltınız$d0$, $d0$/hydrafacial$d0$, 2, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav010$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Cilt bakımı$d0$, $d0$/cilt-bakimi$d0$, 3, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav011$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Diode BUZ lazer — Kadın & erkek$d0$, $d0$/lazer-epilasyon$d0$, 4, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav012$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$G5 · EMS · Slimbody$d0$, $d0$/g5-masaj$d0$, 5, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav013$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Manikür & protez tırnak$d0$, $d0$/manikur-pedikur$d0$, 6, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav014$d0$, $d0$header$d0$, $d0$cmseednav006$d0$, $d0$Kaş · kirpik · kalıcı makyaj$d0$, $d0$/kas-dizayni$d0$, 7, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav015$d0$, $d0$header$d0$, NULL, $d0$HAKKIMIZDA$d0$, $d0$/hakkimizda$d0$, 4, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav016$d0$, $d0$header$d0$, NULL, $d0$KAMPANYALARIMIZ$d0$, $d0$/kampanyalar$d0$, 5, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav017$d0$, $d0$header$d0$, NULL, $d0$SSS$d0$, $d0$/sss$d0$, 6, true, false);
INSERT INTO "NavItem" ("id", "menuSlug", "parentId", "label", "href", "sortOrder", "published", "openInNewTab")
VALUES ($d0$cmseednav018$d0$, $d0$header$d0$, NULL, $d0$İLETİŞİM$d0$, $d0$/iletisim$d0$, 7, true, false);

INSERT INTO "StaffRole" ("id", "slug", "label", "permissionsJson")
VALUES ($d0$cmseedrole_admin$d0$, $d0$admin$d0$, $d0$Yönetici$d0$, $d0$["site.settings","site.theme","content.pages","content.regions","content.nav","content.sitemap","social.instagram","social.youtube","social.tiktok","crm.leads","crm.appointments","users.manage"]$d0$)
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "permissionsJson" = EXCLUDED."permissionsJson";

INSERT INTO "StaffRole" ("id", "slug", "label", "permissionsJson")
VALUES ($d0$cmseedrole_editor$d0$, $d0$editor$d0$, $d0$Editör$d0$, $d0$["content.pages","content.regions","content.nav"]$d0$)
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "permissionsJson" = EXCLUDED."permissionsJson";

INSERT INTO "StaffRole" ("id", "slug", "label", "permissionsJson")
VALUES ($d0$cmseedrole_scheduler$d0$, $d0$scheduler$d0$, $d0$Randevu operatörü$d0$, $d0$["crm.appointments"]$d0$)
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "permissionsJson" = EXCLUDED."permissionsJson";

INSERT INTO "StaffUser" ("id", "username", "passwordHash", "displayName", "roleId", "active", "createdAt", "updatedAt")
VALUES (
  $d0$cmseeduser_admin$d0$,
  'admin',
  crypt('CharmeGecici2026!', gen_salt('bf', 12)),
  'Yönetici',
  $d0$cmseedrole_admin$d0$,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "displayName" = EXCLUDED."displayName",
  "roleId" = EXCLUDED."roleId",
  "active" = true,
  "updatedAt" = NOW();

