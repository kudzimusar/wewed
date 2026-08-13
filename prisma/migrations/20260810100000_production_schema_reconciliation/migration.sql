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

-- 20260729131000_normalize_planner_metadata also introduced compatibility
-- triggers for historical write paths. Production already has the normalized
-- columns but never installed these trigger functions because the historical
-- Prisma replay collided before reaching them. Current planner regression tests
-- still require these compatibility writes, so install the same behavior here
-- rather than removing it from clean databases.
CREATE OR REPLACE FUNCTION public.sync_vendor_planner_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  metadata JSONB;
  raw_metadata TEXT;
  rating_value DOUBLE PRECISION;
BEGIN
  IF NEW."description" IS NULL OR NEW."description" NOT LIKE '__wewed_meta__:%' THEN
    RETURN NEW;
  END IF;

  raw_metadata := split_part(substring(NEW."description" FROM 16), '|||', 1);
  BEGIN
    metadata := raw_metadata::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  NEW."contact" := COALESCE(NULLIF(trim(metadata->>'contact'), ''), NEW."contact");
  IF metadata->>'contractStatus' IN ('signed', 'pending', 'negotiating', 'declined') THEN
    NEW."contractStatus" := metadata->>'contractStatus';
  END IF;
  IF metadata->>'paymentStatus' IN ('paid', 'deposit', 'unpaid') THEN
    NEW."paymentStatus" := metadata->>'paymentStatus';
  END IF;
  NEW."notes" := COALESCE(NULLIF(trim(metadata->>'notes'), ''), NEW."notes");

  BEGIN
    IF metadata ? 'rating' AND jsonb_typeof(metadata->'rating') = 'number' THEN
      rating_value := (metadata->>'rating')::DOUBLE PRECISION;
      IF rating_value BETWEEN 0 AND 5 THEN
        NEW."planningRating" := rating_value;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "sync_vendor_planner_metadata_trigger"
  ON public."Vendor";
CREATE TRIGGER "sync_vendor_planner_metadata_trigger"
BEFORE INSERT OR UPDATE OF "description" ON public."Vendor"
FOR EACH ROW
EXECUTE FUNCTION public.sync_vendor_planner_metadata();

CREATE OR REPLACE FUNCTION public.sync_programme_item_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  metadata JSONB;
BEGIN
  IF NEW."icon" IS NULL OR NEW."icon" NOT LIKE '{%' THEN
    RETURN NEW;
  END IF;

  BEGIN
    metadata := NEW."icon"::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  NEW."duration" := COALESCE(NULLIF(trim(metadata->>'d'), ''), NEW."duration");
  NEW."location" := COALESCE(NULLIF(trim(metadata->>'l'), ''), NEW."location");
  NEW."displayIcon" := COALESCE(NULLIF(trim(metadata->>'i'), ''), NEW."displayIcon");
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "sync_programme_item_metadata_trigger"
  ON public."ProgrammeItem";
CREATE TRIGGER "sync_programme_item_metadata_trigger"
BEFORE INSERT OR UPDATE OF "icon" ON public."ProgrammeItem"
FOR EACH ROW
EXECUTE FUNCTION public.sync_programme_item_metadata();

-- Trigger functions are internal database guards, not application-callable APIs.
REVOKE ALL ON FUNCTION public.wewed_delete_guest_contribution_before_guest() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_vendor_planner_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_programme_item_metadata() FROM PUBLIC;

DO $reconciliation_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.wewed_delete_guest_contribution_before_guest() FROM anon;
    REVOKE ALL ON FUNCTION public.sync_vendor_planner_metadata() FROM anon;
    REVOKE ALL ON FUNCTION public.sync_programme_item_metadata() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.wewed_delete_guest_contribution_before_guest() FROM authenticated;
    REVOKE ALL ON FUNCTION public.sync_vendor_planner_metadata() FROM authenticated;
    REVOKE ALL ON FUNCTION public.sync_programme_item_metadata() FROM authenticated;
  END IF;
END
$reconciliation_roles$;
