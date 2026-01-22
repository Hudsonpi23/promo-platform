/*
  Warnings:

  - You are about to drop the column `autoPublish` on the `PromotionChannel` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `PromotionChannel` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `PromotionChannel` table. All the data in the column will be lost.
  - The `status` column on the `PromotionChannel` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ChannelPostStatus" AS ENUM ('PENDING', 'QUEUED', 'POSTED', 'ERROR');

-- CreateEnum
CREATE TYPE "HumorStyle" AS ENUM ('URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO');

-- DropIndex
DROP INDEX "PromotionChannel_autoPublish_idx";

-- DropIndex
DROP INDEX "PromotionChannel_channel_idx";

-- DropIndex
DROP INDEX "PromotionChannel_scheduledAt_idx";

-- DropIndex
DROP INDEX "PromotionChannel_status_idx";

-- AlterTable
ALTER TABLE "PromotionChannel" DROP COLUMN "autoPublish",
DROP COLUMN "publishedAt",
DROP COLUMN "scheduledAt",
ADD COLUMN     "humorStyle" "HumorStyle" NOT NULL DEFAULT 'URUBU',
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "queuedAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "ChannelPostStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "ChannelStatus";

-- CreateTable
CREATE TABLE "ChannelConfig" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "dailyLimit" INTEGER NOT NULL DEFAULT 0,
    "activeHours" TEXT DEFAULT '08:00-22:00',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSchedulerRun" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConfig_channel_key" ON "ChannelConfig"("channel");

-- CreateIndex
CREATE INDEX "PromotionChannel_channel_status_idx" ON "PromotionChannel"("channel", "status");

-- CreateIndex
CREATE INDEX "PromotionChannel_queuedAt_idx" ON "PromotionChannel"("queuedAt");

-- CreateIndex
CREATE INDEX "PromotionChannel_postedAt_idx" ON "PromotionChannel"("postedAt");
