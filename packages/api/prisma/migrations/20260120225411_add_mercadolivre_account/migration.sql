-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'DISPATCHED', 'ERROR', 'REJECTED', 'PENDING_X_QUOTA');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'LOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'ERROR');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'TWITTER', 'SITE');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('HOJE', 'ULTIMAS_UNIDADES', 'LIMITADO', 'NORMAL');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "OfferSource" AS ENUM ('MANUAL', 'MERCADO_LIVRE', 'AMAZON', 'MAGALU', 'LOMADEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'Manu das Promoções',
    "siteBaseUrl" TEXT NOT NULL DEFAULT 'https://manupromocoes.com.br',
    "defaultUtmSource" TEXT NOT NULL DEFAULT 'manupromocoes',
    "defaultUtmMedium" TEXT NOT NULL DEFAULT 'site',
    "telegramChannel" TEXT,
    "whatsappNumber" TEXT,
    "twitterHandle" TEXT,
    "facebookPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchSchedule" (
    "id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "source" "OfferSource" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT[],
    "categories" TEXT[],
    "minDiscount" INTEGER NOT NULL DEFAULT 20,
    "minPrice" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "maxPrice" DECIMAL(10,2),
    "conditionFilter" TEXT[] DEFAULT ARRAY['new']::TEXT[],
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 50,
    "enableX" BOOLEAN NOT NULL DEFAULT true,
    "xDailyLimit" INTEGER NOT NULL DEFAULT 30,
    "xMinScore" INTEGER NOT NULL DEFAULT 60,
    "scheduleTimes" TEXT[] DEFAULT ARRAY['08:00', '11:00', '14:00', '18:00', '22:00']::TEXT[],
    "lastRunAt" TIMESTAMP(3),
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "accessToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "affiliateUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "nicheId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "source" "OfferSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "productUrl" TEXT,
    "sellerId" TEXT,
    "sellerName" TEXT,
    "sellerReputation" TEXT,
    "availableQuantity" INTEGER,
    "condition" TEXT,
    "categoryId" TEXT,
    "categoryPath" TEXT,
    "dedupeHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "dispatchedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostDraft" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "copyText" TEXT NOT NULL,
    "copyTextTelegram" TEXT,
    "copyTextSite" TEXT,
    "copyTextX" TEXT,
    "channels" "Channel"[],
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "aiScore" INTEGER,
    "errorMsg" TEXT,
    "imageUrl" TEXT,
    "requiresImage" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanForX" BOOLEAN NOT NULL DEFAULT true,
    "copyChannelVariants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostDelivery" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "externalId" TEXT,
    "errorMessage" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedPost" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "goCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "copyText" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "originalPrice" DECIMAL(10,2),
    "discountPct" INTEGER NOT NULL,
    "affiliateUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "nicheId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "goCode" TEXT NOT NULL,
    "publishedPostId" TEXT,
    "offerId" TEXT,
    "channel" "Channel",
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "filename" TEXT,
    "totalRows" INTEGER,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "draftId" TEXT,
    "deliveryId" TEXT,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "stack" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MercadoLivreAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "mlUserId" TEXT NOT NULL,
    "mlNickname" TEXT,
    "mlEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MercadoLivreAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BatchSchedule_order_idx" ON "BatchSchedule"("order");

-- CreateIndex
CREATE UNIQUE INDEX "BatchSchedule_time_key" ON "BatchSchedule"("time");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_source_key" ON "ProviderConfig"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");

-- CreateIndex
CREATE INDEX "Niche_slug_idx" ON "Niche"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_slug_idx" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Offer_nicheId_idx" ON "Offer"("nicheId");

-- CreateIndex
CREATE INDEX "Offer_storeId_idx" ON "Offer"("storeId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Offer_source_idx" ON "Offer"("source");

-- CreateIndex
CREATE INDEX "Offer_dedupeHash_idx" ON "Offer"("dedupeHash");

-- CreateIndex
CREATE INDEX "Offer_createdAt_idx" ON "Offer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_source_externalId_key" ON "Offer"("source", "externalId");

-- CreateIndex
CREATE INDEX "Batch_date_idx" ON "Batch"("date");

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_date_scheduledTime_key" ON "Batch"("date", "scheduledTime");

-- CreateIndex
CREATE INDEX "PostDraft_batchId_idx" ON "PostDraft"("batchId");

-- CreateIndex
CREATE INDEX "PostDraft_offerId_idx" ON "PostDraft"("offerId");

-- CreateIndex
CREATE INDEX "PostDraft_status_idx" ON "PostDraft"("status");

-- CreateIndex
CREATE INDEX "PostDraft_score_idx" ON "PostDraft"("score");

-- CreateIndex
CREATE INDEX "PostDraft_createdAt_idx" ON "PostDraft"("createdAt");

-- CreateIndex
CREATE INDEX "PostDelivery_status_idx" ON "PostDelivery"("status");

-- CreateIndex
CREATE INDEX "PostDelivery_channel_idx" ON "PostDelivery"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "PostDelivery_draftId_channel_key" ON "PostDelivery"("draftId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedPost_slug_key" ON "PublishedPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedPost_goCode_key" ON "PublishedPost"("goCode");

-- CreateIndex
CREATE INDEX "PublishedPost_slug_idx" ON "PublishedPost"("slug");

-- CreateIndex
CREATE INDEX "PublishedPost_goCode_idx" ON "PublishedPost"("goCode");

-- CreateIndex
CREATE INDEX "PublishedPost_nicheId_idx" ON "PublishedPost"("nicheId");

-- CreateIndex
CREATE INDEX "PublishedPost_storeId_idx" ON "PublishedPost"("storeId");

-- CreateIndex
CREATE INDEX "PublishedPost_isActive_idx" ON "PublishedPost"("isActive");

-- CreateIndex
CREATE INDEX "PublishedPost_publishedAt_idx" ON "PublishedPost"("publishedAt");

-- CreateIndex
CREATE INDEX "Click_goCode_idx" ON "Click"("goCode");

-- CreateIndex
CREATE INDEX "Click_publishedPostId_idx" ON "Click"("publishedPostId");

-- CreateIndex
CREATE INDEX "Click_offerId_idx" ON "Click"("offerId");

-- CreateIndex
CREATE INDEX "Click_channel_idx" ON "Click"("channel");

-- CreateIndex
CREATE INDEX "Click_createdAt_idx" ON "Click"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_isResolved_idx" ON "ErrorLog"("isResolved");

-- CreateIndex
CREATE INDEX "ErrorLog_errorType_idx" ON "ErrorLog"("errorType");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoLivreAccount_mlUserId_key" ON "MercadoLivreAccount"("mlUserId");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_mlUserId_idx" ON "MercadoLivreAccount"("mlUserId");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_userId_idx" ON "MercadoLivreAccount"("userId");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_isActive_idx" ON "MercadoLivreAccount"("isActive");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDelivery" ADD CONSTRAINT "PostDelivery_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PostDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_publishedPostId_fkey" FOREIGN KEY ("publishedPostId") REFERENCES "PublishedPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoLivreAccount" ADD CONSTRAINT "MercadoLivreAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
