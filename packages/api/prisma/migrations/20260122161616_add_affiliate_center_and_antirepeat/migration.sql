-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('RELAMPAGO', 'OFERTA_DO_DIA', 'NORMAL', 'CUPOM');

-- CreateEnum
CREATE TYPE "AffiliateLinkMode" AS ENUM ('DIRECT_PASTE', 'TEMPLATE_APPEND', 'REDIRECTOR');

-- CreateEnum
CREATE TYPE "AutomationLevel" AS ENUM ('TOTAL', 'MANUAL_APPROVAL', 'HUMAN_ONLY');

-- AlterTable
ALTER TABLE "ChannelConfig" ADD COLUMN     "automationLevel" "AutomationLevel" NOT NULL DEFAULT 'TOTAL',
ADD COLUMN     "burstCooldownSecs" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "burstSchedule" JSONB,
ADD COLUMN     "repostCooldownHours" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "affiliateProgramId" TEXT,
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "ownerAffiliateAccountId" TEXT,
ADD COLUMN     "promoType" "PromoType" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "PromotionChannel" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uniqueHash" TEXT;

-- CreateTable
CREATE TABLE "AffiliateAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "linkMode" "AffiliateLinkMode" NOT NULL DEFAULT 'REDIRECTOR',
    "urlTemplate" TEXT,
    "allowedDomains" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "affiliateTag" TEXT,
    "affiliateId" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostHistory" (
    "id" TEXT NOT NULL,
    "uniqueHash" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "humorStyle" "HumorStyle" NOT NULL,
    "copyText" TEXT NOT NULL,
    "externalId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_slug_key" ON "AffiliateAccount"("slug");

-- CreateIndex
CREATE INDEX "AffiliateAccount_slug_idx" ON "AffiliateAccount"("slug");

-- CreateIndex
CREATE INDEX "AffiliateAccount_userId_idx" ON "AffiliateAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProgram_slug_key" ON "AffiliateProgram"("slug");

-- CreateIndex
CREATE INDEX "AffiliateProgram_slug_idx" ON "AffiliateProgram"("slug");

-- CreateIndex
CREATE INDEX "AffiliateCredential_accountId_idx" ON "AffiliateCredential"("accountId");

-- CreateIndex
CREATE INDEX "AffiliateCredential_programId_idx" ON "AffiliateCredential"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCredential_accountId_programId_key" ON "AffiliateCredential"("accountId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "PostHistory_uniqueHash_key" ON "PostHistory"("uniqueHash");

-- CreateIndex
CREATE INDEX "PostHistory_offerId_idx" ON "PostHistory"("offerId");

-- CreateIndex
CREATE INDEX "PostHistory_channel_idx" ON "PostHistory"("channel");

-- CreateIndex
CREATE INDEX "PostHistory_postedAt_idx" ON "PostHistory"("postedAt");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_ownerAffiliateAccountId_fkey" FOREIGN KEY ("ownerAffiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_affiliateProgramId_fkey" FOREIGN KEY ("affiliateProgramId") REFERENCES "AffiliateProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAccount" ADD CONSTRAINT "AffiliateAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCredential" ADD CONSTRAINT "AffiliateCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCredential" ADD CONSTRAINT "AffiliateCredential_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
