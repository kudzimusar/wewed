-- Production schema reconciliation.
--
-- Production DDL has historically been applied through the Supabase migration
-- ledger while repository migrations are also replayed against clean CI databases.
-- This migration makes the two end states converge without falsifying Prisma's
-- historical production ledger.

-- GuestContribution is owned by Guest, but Prisma intentionally models the FK
-- as RESTRICT. Preserve that contract while restoring the established planner
-- Guest delete lifecycle with a narrowly scoped BEFORE DELETE cleanup trigger.
ALTER TABLE public."GuestContribution"
  DROP CONSTRAINT IF EXISTS "GuestContribution_guestId_fkey";

ALTER TABLE public."GuestContribution"
  ADD CONSTRAINT "GuestContribution_guestId_fkey"
  FOREIGN KEY ("guestId")
  REFERENCES public."Guest"("id")
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

-- 20260729131000_normalize_planner_metadata contained transitional sync triggers
-- for legacy sentinel payloads. Production never installed them because that
-- historical Prisma migration collided with columns already present through the
-- Supabase-managed schema. The application now writes the normalized columns
-- directly, so remove the transitional triggers from clean-database replays too.
DROP TRIGGER IF EXISTS "sync_vendor_planner_metadata_trigger"
  ON public."Vendor";
DROP FUNCTION IF EXISTS public."sync_vendor_planner_metadata"();

DROP TRIGGER IF EXISTS "sync_programme_item_metadata_trigger"
  ON public."ProgrammeItem";
DROP FUNCTION IF EXISTS public."sync_programme_item_metadata"();
