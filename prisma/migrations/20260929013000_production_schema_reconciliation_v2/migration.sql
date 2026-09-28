-- Production schema reconciliation v2.
--
-- Purpose:
--   Capture integrity objects that exist in the established production database
--   but were never represented in main's migration history. This migration is
--   intentionally additive/idempotent: production keeps its current behavior,
--   while clean databases converge to the same protections.
--
-- This migration does NOT:
--   - repair historical BusinessAccount backfills,
--   - seed Charity & Kudzie content,
--   - rotate/replace the printed invitation QR,
--   - rewrite contribution/payment history,
--   - drop any live integrity object.

-- 1. Wedding membership domain checks that are already validated in production.
DO $membership_checks$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WeddingMembership_role_check'
      AND conrelid = 'public."WeddingMembership"'::regclass
  ) THEN
    ALTER TABLE public."WeddingMembership"
      ADD CONSTRAINT "WeddingMembership_role_check"
      CHECK (role = ANY (ARRAY[
        'owner'::text,
        'planner'::text,
        'coordinator'::text,
        'viewer'::text
      ])) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WeddingMembership_status_check'
      AND conrelid = 'public."WeddingMembership"'::regclass
  ) THEN
    ALTER TABLE public."WeddingMembership"
      ADD CONSTRAINT "WeddingMembership_status_check"
      CHECK (status = ANY (ARRAY[
        'invited'::text,
        'active'::text,
        'revoked'::text
      ])) NOT VALID;
  END IF;
END
$membership_checks$;

ALTER TABLE public."WeddingMembership"
  VALIDATE CONSTRAINT "WeddingMembership_role_check";
ALTER TABLE public."WeddingMembership"
  VALIDATE CONSTRAINT "WeddingMembership_status_check";

-- 2. Provider normalized-identity uniqueness protections already live in
-- production. The normalize_provider_identity(text) helper is canonicalized by
-- 20260818173000_harden_provider_identity_functions.
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessAccount_vendor_normalized_name_unique"
  ON wewed_admin."BusinessAccount"
  USING btree (wewed_admin.normalize_provider_identity(name))
  WHERE (
    type = 'vendor'::text
    AND length(wewed_admin.normalize_provider_identity(name)) > 0
  );

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderDiscoveryCandidate_active_normalized_identity_unique"
  ON wewed_admin."ProviderDiscoveryCandidate"
  USING btree (wewed_admin.normalize_provider_identity("displayName"))
  WHERE (
    status <> 'duplicate'::text
    AND length(wewed_admin.normalize_provider_identity("displayName")) > 0
  );

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderProfile_normalized_identity_unique"
  ON wewed_admin."ProviderProfile"
  USING btree (wewed_admin.normalize_provider_identity("displayName"))
  WHERE length(wewed_admin.normalize_provider_identity("displayName")) > 0;

-- 3. Preserve the established production Guest deletion compatibility behavior.
-- GuestContribution intentionally retains an ON DELETE RESTRICT FK; the trigger
-- clears the dependent contribution immediately before the owning Guest is
-- deleted. Keep this behavior until the Living Wedding Site retention policy
-- explicitly supersedes it.
DO $guest_contribution_cleanup$
BEGIN
  IF to_regprocedure('public.wewed_delete_guest_contribution_before_guest()') IS NULL THEN
    EXECUTE $function_sql$
      CREATE FUNCTION public.wewed_delete_guest_contribution_before_guest()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $function$
      BEGIN
        DELETE FROM public."GuestContribution"
        WHERE "guestId" = OLD.id;
        RETURN OLD;
      END;
      $function$
    $function_sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'wewed_delete_guest_contribution_before_guest'
      AND tgrelid = 'public."Guest"'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER wewed_delete_guest_contribution_before_guest
    BEFORE DELETE ON public."Guest"
    FOR EACH ROW
    EXECUTE FUNCTION public.wewed_delete_guest_contribution_before_guest();
  END IF;
END
$guest_contribution_cleanup$;

REVOKE ALL ON FUNCTION public.wewed_delete_guest_contribution_before_guest() FROM PUBLIC;

DO $reconciliation_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.wewed_delete_guest_contribution_before_guest() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.wewed_delete_guest_contribution_before_guest() FROM authenticated;
  END IF;
END
$reconciliation_roles$;
