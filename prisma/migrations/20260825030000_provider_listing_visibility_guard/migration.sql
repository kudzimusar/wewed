-- Keep provider lifecycle state authoritative across every public reader.
-- Existing public profile, catalogue, pricing and booking paths already require visibility='published'.
-- A suspended/removed listing must therefore never remain published or accept enquiries even if
-- an administrative caller updates only listingStatus.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

CREATE OR REPLACE FUNCTION wewed_admin.enforce_provider_listing_visibility_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW."listingStatus" IN ('suspended', 'removed') THEN
    NEW.visibility := 'draft';
    NEW."acceptingEnquiries" := false;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION wewed_admin.enforce_provider_listing_visibility_guard() FROM PUBLIC;

-- Repair any historical state before installing the invariant. This is idempotent and currently
-- expected to affect zero production rows, but it prevents an old suspended listing from leaking
-- through public readers when the migration is eventually deployed.
UPDATE wewed_admin."ProviderProfile"
SET visibility = 'draft',
    "acceptingEnquiries" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "listingStatus" IN ('suspended', 'removed')
  AND (visibility <> 'draft' OR "acceptingEnquiries" IS DISTINCT FROM false);

DROP TRIGGER IF EXISTS provider_listing_visibility_guard ON wewed_admin."ProviderProfile";
CREATE TRIGGER provider_listing_visibility_guard
BEFORE INSERT OR UPDATE OF "listingStatus", visibility, "acceptingEnquiries"
ON wewed_admin."ProviderProfile"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.enforce_provider_listing_visibility_guard();
