-- CreateEnum
CREATE TYPE "CurationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED');

-- CreateEnum
CREATE TYPE "PostJobStatus" AS ENUM ('PENDING', 'QUEUED', 'POSTED', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "aiBlockReason" TEXT,
ADD COLUMN     "aiPriorityScore" INTEGER,
ADD COLUMN     "aiProcessedAt" TIMESTAMP(3),
ADD COLUMN     "aiRecommendedNetworks" TEXT[],
ADD COLUMN     "aiRiskLevel" "RiskLevel",
ADD COLUMN     "curationStatus" "CurationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "mainImage" TEXT;

-- CreateTable
CREATE TABLE "PostJob" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "network" "Channel" NOT NULL,
    "textFinal" TEXT NOT NULL,
    "imageUsed" TEXT,
    "agentName" TEXT NOT NULL,
    "agentStyle" TEXT,
    "status" "PostJobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "postUrl" TEXT,
    "errorReason" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "aiMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostJob_network_status_idx" ON "PostJob"("network", "status");

-- CreateIndex
CREATE INDEX "PostJob_scheduledAt_idx" ON "PostJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "PostJob_status_idx" ON "PostJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PostJob_offerId_network_key" ON "PostJob"("offerId", "network");

-- CreateIndex
CREATE INDEX "Offer_curationStatus_idx" ON "Offer"("curationStatus");

-- AddForeignKey
ALTER TABLE "PostJob" ADD CONSTRAINT "PostJob_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
