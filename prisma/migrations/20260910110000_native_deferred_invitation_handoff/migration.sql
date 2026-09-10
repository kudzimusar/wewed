-- Wewed Phase 2: Native Deferred Invitation Handoff
-- Server-only ephemeral state belongs outside Prisma's public application schema.
-- Stores only opaque-token and current-RSVP hashes. No guest name, email, phone,
-- wedding slug, or raw RSVP credential crosses the Google Play boundary.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private."InvitationInstallHandoff" (
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
    ON private."InvitationInstallHandoff"("tokenHash");
CREATE INDEX "InvitationInstallHandoff_rsvpId_createdAt_idx"
    ON private."InvitationInstallHandoff"("rsvpId", "createdAt");
CREATE INDEX "InvitationInstallHandoff_expiresAt_idx"
    ON private."InvitationInstallHandoff"("expiresAt");
CREATE INDEX "InvitationInstallHandoff_weddingId_guestId_idx"
    ON private."InvitationInstallHandoff"("weddingId", "guestId");
CREATE INDEX "InvitationInstallHandoff_usedAt_idx"
    ON private."InvitationInstallHandoff"("usedAt");
CREATE INDEX "InvitationInstallHandoff_revokedAt_idx"
    ON private."InvitationInstallHandoff"("revokedAt");

ALTER TABLE private."InvitationInstallHandoff"
    ADD CONSTRAINT "InvitationInstallHandoff_rsvpId_fkey"
    FOREIGN KEY ("rsvpId") REFERENCES public."RSVP"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE private."InvitationInstallHandoff"
    ADD CONSTRAINT "InvitationInstallHandoff_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE private."InvitationInstallHandoff"
    ADD CONSTRAINT "InvitationInstallHandoff_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES public."Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Opportunistically purge terminal ephemeral records. This avoids requiring a
-- separate scheduler while ensuring every active installation stream performs
-- bounded retention maintenance using indexed timestamp columns.
CREATE OR REPLACE FUNCTION private.cleanup_invitation_install_handoffs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM private."InvitationInstallHandoff"
    WHERE "expiresAt" < NOW() - INTERVAL '7 days'
       OR ("usedAt" IS NOT NULL AND "usedAt" < NOW() - INTERVAL '7 days')
       OR ("revokedAt" IS NOT NULL AND "revokedAt" < NOW() - INTERVAL '7 days');
    RETURN NULL;
END;
$$;

CREATE TRIGGER "InvitationInstallHandoff_cleanup_trigger"
AFTER INSERT ON private."InvitationInstallHandoff"
FOR EACH STATEMENT
EXECUTE FUNCTION private.cleanup_invitation_install_handoffs();
