-- Wewed Phase 2: Native Deferred Invitation Handoff
-- Stores only opaque-token and current-RSVP hashes. No guest name, email, phone,
-- wedding slug, or raw RSVP credential crosses the Google Play boundary.

CREATE TABLE "InvitationInstallHandoff" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "rsvpTokenHash" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "card" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'install-cta',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "InvitationInstallHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvitationInstallHandoff_tokenHash_key"
    ON "InvitationInstallHandoff"("tokenHash");
CREATE INDEX "InvitationInstallHandoff_rsvpId_createdAt_idx"
    ON "InvitationInstallHandoff"("rsvpId", "createdAt");
CREATE INDEX "InvitationInstallHandoff_expiresAt_idx"
    ON "InvitationInstallHandoff"("expiresAt");
CREATE INDEX "InvitationInstallHandoff_weddingId_guestId_idx"
    ON "InvitationInstallHandoff"("weddingId", "guestId");
CREATE INDEX "InvitationInstallHandoff_usedAt_idx"
    ON "InvitationInstallHandoff"("usedAt");

ALTER TABLE "InvitationInstallHandoff"
    ADD CONSTRAINT "InvitationInstallHandoff_rsvpId_fkey"
    FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvitationInstallHandoff"
    ADD CONSTRAINT "InvitationInstallHandoff_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvitationInstallHandoff"
    ADD CONSTRAINT "InvitationInstallHandoff_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
