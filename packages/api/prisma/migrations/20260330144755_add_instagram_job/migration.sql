-- CreateEnum
CREATE TYPE "InstagramJobStatus" AS ENUM ('PENDING', 'SCORING', 'RENDERING', 'UPLOADING', 'PUBLISHING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstagramFormat" AS ENUM ('CAROUSEL', 'REEL', 'STORY');

-- CreateTable
CREATE TABLE "InstagramJob" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" "InstagramJobStatus" NOT NULL DEFAULT 'PENDING',
    "format" "InstagramFormat" NOT NULL DEFAULT 'CAROUSEL',
    "aiScore" INTEGER,
    "aiReasoning" TEXT,
    "aiChosenFormat" "InstagramFormat",
    "aiCaption" TEXT,
    "slideUrls" TEXT[],
    "captionUsed" TEXT,
    "postformePostId" TEXT,
    "postformeStatus" TEXT,
    "instagramPostId" TEXT,
    "instagramUrl" TEXT,
    "metricViews" INTEGER NOT NULL DEFAULT 0,
    "metricLikes" INTEGER NOT NULL DEFAULT 0,
    "metricComments" INTEGER NOT NULL DEFAULT 0,
    "metricSaves" INTEGER NOT NULL DEFAULT 0,
    "metricReach" INTEGER NOT NULL DEFAULT 0,
    "metricsUpdatedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "InstagramJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramJob_status_idx" ON "InstagramJob"("status");

-- CreateIndex
CREATE INDEX "InstagramJob_offerId_idx" ON "InstagramJob"("offerId");

-- CreateIndex
CREATE INDEX "InstagramJob_createdAt_idx" ON "InstagramJob"("createdAt");

-- CreateIndex
CREATE INDEX "InstagramJob_nextRetryAt_idx" ON "InstagramJob"("nextRetryAt");

-- AddForeignKey
ALTER TABLE "InstagramJob" ADD CONSTRAINT "InstagramJob_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
