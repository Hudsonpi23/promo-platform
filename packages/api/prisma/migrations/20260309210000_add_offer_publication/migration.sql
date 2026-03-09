-- CreateTable
CREATE TABLE "OfferPublication" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferPublication_offerId_idx" ON "OfferPublication"("offerId");

-- CreateIndex
CREATE INDEX "OfferPublication_channel_idx" ON "OfferPublication"("channel");

-- CreateIndex
CREATE INDEX "OfferPublication_publishedAt_idx" ON "OfferPublication"("publishedAt");

-- AddForeignKey
ALTER TABLE "OfferPublication" ADD CONSTRAINT "OfferPublication_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
