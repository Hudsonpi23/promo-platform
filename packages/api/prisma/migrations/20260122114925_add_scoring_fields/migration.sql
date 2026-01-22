-- AlterEnum
ALTER TYPE "OfferSource" ADD VALUE 'AWIN';

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'BR',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "errorReason" TEXT,
ADD COLUMN     "rawPayload" JSONB;
