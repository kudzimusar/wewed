-- Guest contributions are owned by a Guest record. The planner's Guest delete
-- flow already removes RSVP rows explicitly; worksheet rows cascade. When the
-- GuestContribution relation was added with ON DELETE RESTRICT it introduced
-- a regression where deleting an otherwise valid planner Guest rolled back.
-- Keep the child lifecycle aligned with Guest deletion.

ALTER TABLE "GuestContribution"
  DROP CONSTRAINT IF EXISTS "GuestContribution_guestId_fkey";

ALTER TABLE "GuestContribution"
  ADD CONSTRAINT "GuestContribution_guestId_fkey"
  FOREIGN KEY ("guestId")
  REFERENCES "Guest"("id")
  ON UPDATE CASCADE
  ON DELETE CASCADE;
