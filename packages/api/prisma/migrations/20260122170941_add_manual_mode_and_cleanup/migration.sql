-- CreateEnum
CREATE TYPE "ChannelMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChannelPostStatus" ADD VALUE 'READY_MANUAL';
ALTER TYPE "ChannelPostStatus" ADD VALUE 'DONE_MANUAL';

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "couponCode" TEXT;

-- AlterTable
ALTER TABLE "PromotionChannel" ADD COLUMN     "channelMode" "ChannelMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "editedCopyText" TEXT,
ADD COLUMN     "finalUrl" TEXT,
ADD COLUMN     "goUrl" TEXT,
ADD COLUMN     "manualDoneAt" TIMESTAMP(3),
ADD COLUMN     "manualDoneById" TEXT;

-- CreateIndex
CREATE INDEX "PromotionChannel_channelMode_status_idx" ON "PromotionChannel"("channelMode", "status");
