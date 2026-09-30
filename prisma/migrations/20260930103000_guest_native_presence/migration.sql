CREATE TABLE "GuestNativePresence" (
  "id" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "appVersion" TEXT,
  "buildVersion" TEXT,
  "firstActivatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastInvitationOpenAt" TIMESTAMP(3),
  "appInstanceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestNativePresence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuestNativePresence_platform_check" CHECK ("platform" IN ('android', 'ios'))
);

CREATE UNIQUE INDEX "GuestNativePresence_weddingId_guestId_platform_key"
  ON "GuestNativePresence"("weddingId", "guestId", "platform");

CREATE INDEX "GuestNativePresence_weddingId_platform_lastSeenAt_idx"
  ON "GuestNativePresence"("weddingId", "platform", "lastSeenAt");

CREATE INDEX "GuestNativePresence_guestId_lastSeenAt_idx"
  ON "GuestNativePresence"("guestId", "lastSeenAt");

ALTER TABLE "GuestNativePresence"
  ADD CONSTRAINT "GuestNativePresence_guestId_weddingId_fkey"
  FOREIGN KEY ("guestId", "weddingId")
  REFERENCES "Guest"("id", "weddingId")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
