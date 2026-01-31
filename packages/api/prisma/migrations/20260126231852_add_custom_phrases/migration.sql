-- CreateTable
CREATE TABLE "CustomPhrase" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "productKeyword" TEXT,
    "category" TEXT,
    "channel" "Channel",
    "createdById" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomPhrase_productKeyword_idx" ON "CustomPhrase"("productKeyword");

-- CreateIndex
CREATE INDEX "CustomPhrase_category_idx" ON "CustomPhrase"("category");

-- CreateIndex
CREATE INDEX "CustomPhrase_channel_idx" ON "CustomPhrase"("channel");

-- CreateIndex
CREATE INDEX "CustomPhrase_isActive_idx" ON "CustomPhrase"("isActive");

-- CreateIndex
CREATE INDEX "CustomPhrase_createdById_idx" ON "CustomPhrase"("createdById");

-- AddForeignKey
ALTER TABLE "CustomPhrase" ADD CONSTRAINT "CustomPhrase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
