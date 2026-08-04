ALTER TABLE "Wedding"
  ADD COLUMN "invitationCardStyle" TEXT NOT NULL DEFAULT 'botanical',
  ADD COLUMN "invitationCardMessage" TEXT,
  ADD COLUMN "rsvpDeadline" TIMESTAMP(3);

ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_invitationCardStyle_check"
  CHECK ("invitationCardStyle" IN ('botanical', 'editorial', 'midnight'));
