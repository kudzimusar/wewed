-- Database Integrity Hardening — vendor growth + Admin expansion
-- Authoritative plan:
-- docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md
--
-- This migration is additive. It repairs only deterministic discovery backlinks and
-- adds database guards around relationships that were previously enforced mainly by route code.

-- 1. Repair candidate-backed BusinessAccounts that already have a unique imported candidate backlink
--    but are missing BusinessAccount.sourceId.
WITH deterministic_candidate_sources AS (
  SELECT
    b.id AS business_account_id,
    min(c.id) AS candidate_id
  FROM wewed_admin."BusinessAccount" b
  JOIN wewed_admin."ProviderDiscoveryCandidate" c
    ON c."importedBusinessAccountId" = b.id
   AND c.status = 'imported'
  JOIN wewed_admin."ProviderProfile" p
    ON p."businessAccountId" = b.id
  WHERE b."sourceType" = 'provider_discovery_candidate'
    AND b."sourceId" IS NULL
  GROUP BY b.id
  HAVING count(*) = 1
)
UPDATE wewed_admin."BusinessAccount" b
SET "sourceId" = repair.candidate_id,
    "updatedAt" = CURRENT_TIMESTAMP
FROM deterministic_candidate_sources repair
WHERE b.id = repair.business_account_id
  AND b."sourceId" IS NULL;

-- 2. Repair imported candidates whose BusinessAccount already points uniquely to the candidate.
WITH deterministic_account_links AS (
  SELECT
    c.id AS candidate_id,
    min(b.id) AS business_account_id
  FROM wewed_admin."ProviderDiscoveryCandidate" c
  JOIN wewed_admin."BusinessAccount" b
    ON b."sourceId" = c.id
  JOIN wewed_admin."ProviderProfile" p
    ON p."businessAccountId" = b.id
  WHERE c.status = 'imported'
    AND c."importedBusinessAccountId" IS NULL
    AND b."sourceType" IN (
      'marketplace_discovery',
      'provider_discovery_candidate',
      'discovery'
    )
    AND b.type IN ('vendor', 'venue')
  GROUP BY c.id
  HAVING count(*) = 1
)
UPDATE wewed_admin."ProviderDiscoveryCandidate" c
SET "importedBusinessAccountId" = repair.business_account_id,
    "updatedAt" = CURRENT_TIMESTAMP
FROM deterministic_account_links repair
WHERE c.id = repair.candidate_id
  AND c."importedBusinessAccountId" IS NULL;

-- 3. Historical fallback: an imported candidate may predate BusinessAccount.sourceId usage.
--    Repair only an exact, unique provider match with the same business name, website and phone.
WITH strong_matches AS (
  SELECT
    c.id AS candidate_id,
    min(p."businessAccountId") AS business_account_id
  FROM wewed_admin."ProviderDiscoveryCandidate" c
  JOIN wewed_admin."ProviderProfile" p
    ON lower(btrim(p."displayName")) = lower(btrim(c."displayName"))
   AND c.website IS NOT NULL
   AND p.website IS NOT NULL
   AND lower(btrim(p.website)) = lower(btrim(c.website))
   AND c.phone IS NOT NULL
   AND p.phone IS NOT NULL
   AND regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(c.phone, '\D', '', 'g')
  JOIN wewed_admin."BusinessAccount" b
    ON b.id = p."businessAccountId"
   AND b.type IN ('vendor', 'venue')
  WHERE c.status = 'imported'
    AND c."importedBusinessAccountId" IS NULL
  GROUP BY c.id
  HAVING count(*) = 1
)
UPDATE wewed_admin."ProviderDiscoveryCandidate" c
SET "importedBusinessAccountId" = repair.business_account_id,
    "updatedAt" = CURRENT_TIMESTAMP
FROM strong_matches repair
WHERE c.id = repair.candidate_id
  AND c."importedBusinessAccountId" IS NULL;

-- The live audit showed one imported discovery candidate per imported account.
-- Preserve that cardinality while allowing historical/null candidates to remain unlinked.
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderDiscoveryCandidate_importedBusinessAccountId_unique"
  ON wewed_admin."ProviderDiscoveryCandidate" ("importedBusinessAccountId")
  WHERE "importedBusinessAccountId" IS NOT NULL;

-- Prevent duplicate open claims by the same claimant email for one profile even if multiple
-- application requests race. Different claimants may still submit independent claims.
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderClaimRequest_open_profile_email_unique"
  ON wewed_admin."ProviderClaimRequest" ("providerProfileId", lower("claimantEmail"))
  WHERE status IN ('pending', 'verification_required');

-- 4. Provider-facing child records must belong only to vendor/venue BusinessAccounts.
CREATE OR REPLACE FUNCTION wewed_admin.validate_provider_business_account_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
DECLARE
  target_account_type text;
  profile_account_id text;
BEGIN
  SELECT type
  INTO target_account_type
  FROM wewed_admin."BusinessAccount"
  WHERE id = NEW."businessAccountId";

  IF target_account_type IS NULL THEN
    RAISE EXCEPTION 'Provider resource references missing business account %', NEW."businessAccountId";
  END IF;

  IF target_account_type NOT IN ('vendor', 'venue') THEN
    RAISE EXCEPTION 'Provider resource requires vendor/venue business account; % is %',
      NEW."businessAccountId", target_account_type;
  END IF;

  IF TG_TABLE_NAME = 'ProviderClaimRequest' THEN
    SELECT "businessAccountId"
    INTO profile_account_id
    FROM wewed_admin."ProviderProfile"
    WHERE id = NEW."providerProfileId";

    IF profile_account_id IS NULL THEN
      RAISE EXCEPTION 'Provider claim references missing provider profile %', NEW."providerProfileId";
    END IF;

    IF profile_account_id IS DISTINCT FROM NEW."businessAccountId" THEN
      RAISE EXCEPTION 'Provider claim profile/account mismatch: profile % belongs to %, claim points to %',
        NEW."providerProfileId", profile_account_id, NEW."businessAccountId";
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_provider_profile_business_account
  ON wewed_admin."ProviderProfile";
CREATE TRIGGER validate_provider_profile_business_account
BEFORE INSERT OR UPDATE OF "businessAccountId"
ON wewed_admin."ProviderProfile"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_provider_business_account_link();

DROP TRIGGER IF EXISTS validate_provider_offering_business_account
  ON wewed_admin."ProviderServiceOffering";
CREATE TRIGGER validate_provider_offering_business_account
BEFORE INSERT OR UPDATE OF "businessAccountId"
ON wewed_admin."ProviderServiceOffering"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_provider_business_account_link();

DROP TRIGGER IF EXISTS validate_provider_verification_business_account
  ON wewed_admin."ProviderVerification";
CREATE TRIGGER validate_provider_verification_business_account
BEFORE INSERT OR UPDATE OF "businessAccountId"
ON wewed_admin."ProviderVerification"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_provider_business_account_link();

DROP TRIGGER IF EXISTS validate_provider_claim_business_account
  ON wewed_admin."ProviderClaimRequest";
CREATE TRIGGER validate_provider_claim_business_account
BEFORE INSERT OR UPDATE OF "businessAccountId", "providerProfileId"
ON wewed_admin."ProviderClaimRequest"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_provider_business_account_link();

-- Protect the parent side too: a BusinessAccount with provider resources cannot be changed
-- to an unrelated account population while those resources still exist.
CREATE OR REPLACE FUNCTION wewed_admin.protect_provider_business_account_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
BEGIN
  IF OLD.type IS DISTINCT FROM NEW.type
     AND NEW.type NOT IN ('vendor', 'venue')
     AND (
       EXISTS (SELECT 1 FROM wewed_admin."ProviderProfile" p WHERE p."businessAccountId" = NEW.id)
       OR EXISTS (SELECT 1 FROM wewed_admin."ProviderServiceOffering" o WHERE o."businessAccountId" = NEW.id)
       OR EXISTS (SELECT 1 FROM wewed_admin."ProviderVerification" v WHERE v."businessAccountId" = NEW.id)
       OR EXISTS (SELECT 1 FROM wewed_admin."ProviderClaimRequest" c WHERE c."businessAccountId" = NEW.id)
     ) THEN
    RAISE EXCEPTION 'Business account % has provider resources and cannot change type from % to %',
      NEW.id, OLD.type, NEW.type;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_provider_business_account_type
  ON wewed_admin."BusinessAccount";
CREATE TRIGGER protect_provider_business_account_type
BEFORE UPDATE OF type
ON wewed_admin."BusinessAccount"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.protect_provider_business_account_type();

-- 5. Candidate-backed source links must be bidirectionally consistent at transaction end.
-- `provider_discovery` is historical/mixed: enforce it only when sourceId actually resolves
-- to a ProviderDiscoveryCandidate.
CREATE OR REPLACE FUNCTION wewed_admin.validate_candidate_backed_business_account_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
DECLARE
  candidate_backlink text;
  candidate_status text;
  candidate_backed boolean := false;
BEGIN
  IF NEW."sourceType" IN ('marketplace_discovery', 'provider_discovery_candidate', 'discovery') THEN
    candidate_backed := true;
  ELSIF NEW."sourceType" = 'provider_discovery' AND NEW."sourceId" IS NOT NULL THEN
    candidate_backed := EXISTS (
      SELECT 1 FROM wewed_admin."ProviderDiscoveryCandidate" c WHERE c.id = NEW."sourceId"
    );
  END IF;

  IF NOT candidate_backed THEN
    RETURN NEW;
  END IF;

  IF NEW."sourceId" IS NULL THEN
    RAISE EXCEPTION 'Candidate-backed business account % is missing sourceId', NEW.id;
  END IF;

  SELECT c."importedBusinessAccountId", c.status
  INTO candidate_backlink, candidate_status
  FROM wewed_admin."ProviderDiscoveryCandidate" c
  WHERE c.id = NEW."sourceId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate-backed business account % references missing candidate %',
      NEW.id, NEW."sourceId";
  END IF;

  IF candidate_status <> 'imported' THEN
    RAISE EXCEPTION 'Candidate-backed business account % references candidate % with status %',
      NEW.id, NEW."sourceId", candidate_status;
  END IF;

  IF candidate_backlink IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Candidate-backed business account % is not the imported backlink for candidate %',
      NEW.id, NEW."sourceId";
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_candidate_backed_business_account
  ON wewed_admin."BusinessAccount";
CREATE CONSTRAINT TRIGGER validate_candidate_backed_business_account
AFTER INSERT OR UPDATE
ON wewed_admin."BusinessAccount"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_candidate_backed_business_account_link();

CREATE OR REPLACE FUNCTION wewed_admin.validate_discovery_candidate_import_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
DECLARE
  account_type text;
  account_source_type text;
  account_source_id text;
BEGIN
  IF NEW."importedBusinessAccountId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.type, b."sourceType", b."sourceId"
  INTO account_type, account_source_type, account_source_id
  FROM wewed_admin."BusinessAccount" b
  WHERE b.id = NEW."importedBusinessAccountId";

  IF account_type IS NULL THEN
    RAISE EXCEPTION 'Discovery candidate % references missing imported business account %',
      NEW.id, NEW."importedBusinessAccountId";
  END IF;

  IF account_type NOT IN ('vendor', 'venue') THEN
    RAISE EXCEPTION 'Discovery candidate % imported account % must be vendor/venue, found %',
      NEW.id, NEW."importedBusinessAccountId", account_type;
  END IF;

  IF NEW.status <> 'imported' THEN
    RAISE EXCEPTION 'Discovery candidate % has imported business account % but status is %',
      NEW.id, NEW."importedBusinessAccountId", NEW.status;
  END IF;

  IF account_source_type IN ('marketplace_discovery', 'provider_discovery_candidate', 'discovery')
     AND account_source_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Discovery candidate % backlink target % does not point back through BusinessAccount.sourceId',
      NEW.id, NEW."importedBusinessAccountId";
  END IF;

  IF account_source_type = 'provider_discovery'
     AND account_source_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM wewed_admin."ProviderDiscoveryCandidate" c WHERE c.id = account_source_id)
     AND account_source_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Discovery candidate % conflicts with provider_discovery source candidate % on account %',
      NEW.id, account_source_id, NEW."importedBusinessAccountId";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wewed_admin."ProviderProfile" p
    WHERE p."businessAccountId" = NEW."importedBusinessAccountId"
  ) THEN
    RAISE EXCEPTION 'Discovery candidate % imported account % has no ProviderProfile',
      NEW.id, NEW."importedBusinessAccountId";
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_discovery_candidate_import_link
  ON wewed_admin."ProviderDiscoveryCandidate";
CREATE CONSTRAINT TRIGGER validate_discovery_candidate_import_link
AFTER INSERT OR UPDATE
ON wewed_admin."ProviderDiscoveryCandidate"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_discovery_candidate_import_link();

-- 6. Validate authority exactly when a claim transitions to approved.
CREATE OR REPLACE FUNCTION wewed_admin.validate_provider_claim_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
DECLARE
  profile_account_id text;
  profile_listing_status text;
  profile_is_claimable boolean;
  account_owner_user_id text;
BEGIN
  IF NEW.status <> 'approved'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT p."businessAccountId", p."listingStatus", p."isClaimable", b."ownerUserId"
  INTO profile_account_id, profile_listing_status, profile_is_claimable, account_owner_user_id
  FROM wewed_admin."ProviderProfile" p
  JOIN wewed_admin."BusinessAccount" b ON b.id = p."businessAccountId"
  WHERE p.id = NEW."providerProfileId";

  IF profile_account_id IS NULL OR profile_account_id IS DISTINCT FROM NEW."businessAccountId" THEN
    RAISE EXCEPTION 'Approved provider claim % has inconsistent profile/account link', NEW.id;
  END IF;

  IF NEW."claimantUserId" IS NULL THEN
    RAISE EXCEPTION 'Approved provider claim % must record claimantUserId', NEW.id;
  END IF;

  IF account_owner_user_id IS DISTINCT FROM NEW."claimantUserId" THEN
    RAISE EXCEPTION 'Approved provider claim % claimant % is not BusinessAccount owner %',
      NEW.id, NEW."claimantUserId", account_owner_user_id;
  END IF;

  IF profile_listing_status NOT IN ('claimed', 'verified') OR profile_is_claimable THEN
    RAISE EXCEPTION 'Approved provider claim % requires claimed/verified non-claimable ProviderProfile', NEW.id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccountMember" m
    WHERE m."businessAccountId" = NEW."businessAccountId"
      AND m."userId" = NEW."claimantUserId"
      AND m.role = 'business_owner'
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Approved provider claim % has no active business_owner membership', NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_provider_claim_approval
  ON wewed_admin."ProviderClaimRequest";
CREATE CONSTRAINT TRIGGER validate_provider_claim_approval
AFTER INSERT OR UPDATE
ON wewed_admin."ProviderClaimRequest"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_provider_claim_approval();

-- Trigger functions are internal database guards, not callable application APIs.
REVOKE ALL ON FUNCTION wewed_admin.validate_provider_business_account_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_admin.protect_provider_business_account_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_admin.validate_candidate_backed_business_account_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_admin.validate_discovery_candidate_import_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_admin.validate_provider_claim_approval() FROM PUBLIC;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION wewed_admin.validate_provider_business_account_link() FROM anon;
    REVOKE ALL ON FUNCTION wewed_admin.protect_provider_business_account_type() FROM anon;
    REVOKE ALL ON FUNCTION wewed_admin.validate_candidate_backed_business_account_link() FROM anon;
    REVOKE ALL ON FUNCTION wewed_admin.validate_discovery_candidate_import_link() FROM anon;
    REVOKE ALL ON FUNCTION wewed_admin.validate_provider_claim_approval() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION wewed_admin.validate_provider_business_account_link() FROM authenticated;
    REVOKE ALL ON FUNCTION wewed_admin.protect_provider_business_account_type() FROM authenticated;
    REVOKE ALL ON FUNCTION wewed_admin.validate_candidate_backed_business_account_link() FROM authenticated;
    REVOKE ALL ON FUNCTION wewed_admin.validate_discovery_candidate_import_link() FROM authenticated;
    REVOKE ALL ON FUNCTION wewed_admin.validate_provider_claim_approval() FROM authenticated;
  END IF;
END
$roles$;

-- Fail the migration if deterministic candidate-backed provenance remains broken.
DO $integrity$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccount" b
    LEFT JOIN wewed_admin."ProviderDiscoveryCandidate" c ON c.id = b."sourceId"
    WHERE b."sourceType" IN ('marketplace_discovery', 'provider_discovery_candidate', 'discovery')
      AND (
        b."sourceId" IS NULL
        OR c.id IS NULL
        OR c.status <> 'imported'
        OR c."importedBusinessAccountId" IS DISTINCT FROM b.id
      )
  ) THEN
    RAISE EXCEPTION 'Candidate-backed BusinessAccount provenance remains inconsistent after deterministic repair';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wewed_admin."ProviderDiscoveryCandidate" c
    WHERE c.status = 'imported'
      AND c."importedBusinessAccountId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Imported discovery candidates remain without deterministic BusinessAccount backlinks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wewed_admin."ProviderClaimRequest" claim
    JOIN wewed_admin."ProviderProfile" profile ON profile.id = claim."providerProfileId"
    WHERE claim."businessAccountId" IS DISTINCT FROM profile."businessAccountId"
  ) THEN
    RAISE EXCEPTION 'Provider claim/profile BusinessAccount mismatch exists';
  END IF;
END
$integrity$;
