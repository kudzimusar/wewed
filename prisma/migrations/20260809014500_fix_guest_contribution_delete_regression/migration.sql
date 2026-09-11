-- Guest contributions are owned by a Guest record. The planner's Guest delete
-- flow already removes RSVP rows explicitly; worksheet rows cascade. When the
-- GuestContribution relation was added with ON DELETE RESTRICT it introduced
-- a regression where deleting an otherwise valid planner Guest rolled back.
--
-- Keep the Prisma-modeled FK unchanged and clean up the one-to-one contribution
-- immediately before the parent Guest delete. Prisma does not model PostgreSQL
-- triggers, so this avoids schema drift while restoring the established planner
-- deletion lifecycle.

ALTER TABLE "GuestContribution"
  DROP CONSTRAINT IF EXISTS "GuestContribution_guestId_fkey";

ALTER TABLE "GuestContribution"
  ADD CONSTRAINT "GuestContribution_guestId_fkey"
  FOREIGN KEY ("guestId")
  REFERENCES "Guest"("id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.wewed_delete_guest_contribution_before_guest()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public."GuestContribution"
  WHERE "guestId" = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS wewed_delete_guest_contribution_before_guest
ON public."Guest";

CREATE TRIGGER wewed_delete_guest_contribution_before_guest
BEFORE DELETE ON public."Guest"
FOR EACH ROW
EXECUTE FUNCTION public.wewed_delete_guest_contribution_before_guest();
