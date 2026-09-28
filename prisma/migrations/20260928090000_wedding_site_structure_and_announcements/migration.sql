-- QRO07-SHIP01 Phase C — additive only: normalized wedding-site structure and announcements.
-- No existing table or column is altered or dropped; WeddingContent stays authoritative for scalar copy.

-- CreateTable
CREATE TABLE "WeddingSiteSection" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "layoutVariant" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingSiteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingSiteItem" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "mediaId" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingSiteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingAnnouncement" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "audience" TEXT NOT NULL DEFAULT 'guests',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeddingSiteSection_weddingId_order_idx" ON "WeddingSiteSection"("weddingId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WeddingSiteSection_weddingId_key_key" ON "WeddingSiteSection"("weddingId", "key");

-- CreateIndex
CREATE INDEX "WeddingSiteItem_weddingId_sectionId_order_idx" ON "WeddingSiteItem"("weddingId", "sectionId", "order");

-- CreateIndex
CREATE INDEX "WeddingSiteItem_weddingId_kind_idx" ON "WeddingSiteItem"("weddingId", "kind");

-- CreateIndex
CREATE INDEX "WeddingAnnouncement_weddingId_status_order_idx" ON "WeddingAnnouncement"("weddingId", "status", "order");

-- AddForeignKey
ALTER TABLE "WeddingSiteSection" ADD CONSTRAINT "WeddingSiteSection_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingSiteItem" ADD CONSTRAINT "WeddingSiteItem_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingSiteItem" ADD CONSTRAINT "WeddingSiteItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WeddingSiteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingSiteItem" ADD CONSTRAINT "WeddingSiteItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingAnnouncement" ADD CONSTRAINT "WeddingAnnouncement_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

