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
    "cookieConsentJson" TEXT,
    "appointmentNotifyAdminEmails" TEXT,
    "appointmentNotifyOperatorEmails" TEXT,
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
    "cancelCodeHash" TEXT,
    "cancelCodeLast4" TEXT,
    "cancelTokenHash" TEXT,
    "cancelTokenExpiresAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "StaffPushSubscription" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "subscriptionJson" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookieConsentLog" (
    "id" TEXT NOT NULL,
    "consentKey" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "preferencesJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookieConsentLog_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "StaffPushSubscription_endpoint_key" ON "StaffPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "StaffPushSubscription_staffId_idx" ON "StaffPushSubscription"("staffId");

-- CreateIndex
CREATE INDEX "CookieConsentLog_consentKey_createdAt_idx" ON "CookieConsentLog"("consentKey", "createdAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavItem" ADD CONSTRAINT "NavItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NavItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPushSubscription" ADD CONSTRAINT "StaffPushSubscription_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
