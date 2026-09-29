-- Desktop Invitation Desk delivery tracking.
--
-- This is intentionally separate from RSVP state. A planner marking an invitation
-- as sent is operational delivery metadata; it never changes the guest's RSVP,
-- token, Wedding Pass eligibility, or check-in state.

CREATE TABLE "GuestInvitationDelivery" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'sent',
  "recipient" TEXT,
  "note" TEXT,
  "invitationVersionFingerprint" TEXT NOT NULL,
  "invitationStyle" TEXT NOT NULL,
  "invitationMessage" TEXT,
  "rsvpDeadline" TIMESTAMP(3),
  "childrenPolicy" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "weddingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "actorId" TEXT,

  CONSTRAINT "GuestInvitationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuestInvitationDelivery_state_check" CHECK ("state" IN ('sent')),
  CONSTRAINT "GuestInvitationDelivery_channel_check" CHECK ("channel" IN ('whatsapp','email','sms','copy_link','share_sheet','other')),
  CONSTRAINT "GuestInvitationDelivery_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuestInvitationDelivery_guestId_weddingId_fkey"
    FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuestInvitationDelivery_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "GuestInvitationDelivery_weddingId_sentAt_idx"
  ON "GuestInvitationDelivery"("weddingId", "sentAt");

CREATE INDEX "GuestInvitationDelivery_guestId_sentAt_idx"
  ON "GuestInvitationDelivery"("guestId", "sentAt");

CREATE INDEX "GuestInvitationDelivery_weddingId_channel_sentAt_idx"
  ON "GuestInvitationDelivery"("weddingId", "channel", "sentAt");
