-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('PENDING', 'READY', 'MANUAL', 'PUBLISHED', 'ERROR', 'SKIPPED');

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'INSTAGRAM';

-- CreateTable
CREATE TABLE "PromotionChannel" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "copyText" TEXT,
    "status" "ChannelStatus" NOT NULL DEFAULT 'PENDING',
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionChannel_channel_idx" ON "PromotionChannel"("channel");

-- CreateIndex
CREATE INDEX "PromotionChannel_status_idx" ON "PromotionChannel"("status");

-- CreateIndex
CREATE INDEX "PromotionChannel_autoPublish_idx" ON "PromotionChannel"("autoPublish");

-- CreateIndex
CREATE INDEX "PromotionChannel_scheduledAt_idx" ON "PromotionChannel"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionChannel_draftId_channel_key" ON "PromotionChannel"("draftId", "channel");

-- AddForeignKey
ALTER TABLE "PromotionChannel" ADD CONSTRAINT "PromotionChannel_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PostDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
