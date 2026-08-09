-- Database Integrity Hardening — Phase C review closure
-- Authoritative plan:
-- docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md
--
-- This follow-up keeps the first hardening migration additive and closes two review gaps:
-- 1. a discovery candidate backlink cannot be removed while a canonical BusinessAccount still
--    points at that candidate; and
-- 2. a ProviderProfile cannot move between BusinessAccounts if existing claims would be left
--    attached to a different account.

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
  ELSIF TG_TABLE_NAME = 'ProviderProfile'
        AND TG_OP = 'UPDATE'
        AND OLD."businessAccountId" IS DISTINCT FROM NEW."businessAccountId"
        AND EXISTS (
          SELECT 1
          FROM wewed_admin."ProviderClaimRequest" claim
          WHERE claim."providerProfileId" = NEW.id
            AND claim."businessAccountId" IS DISTINCT FROM NEW."businessAccountId"
        ) THEN
    RAISE EXCEPTION 'Provider profile % cannot move from account % to % while claim requests reference the original account',
      NEW.id, OLD."businessAccountId", NEW."businessAccountId";
  END IF;

  RETURN NEW;
END;
$function$;

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
    IF EXISTS (
      SELECT 1
      FROM wewed_admin."BusinessAccount" b
      WHERE b."sourceId" = NEW.id
        AND (
          b."sourceType" IN ('marketplace_discovery', 'provider_discovery_candidate', 'discovery')
          OR b."sourceType" = 'provider_discovery'
        )
    ) THEN
      RAISE EXCEPTION 'Discovery candidate % cannot remove its imported BusinessAccount backlink while a BusinessAccount still references it as sourceId',
        NEW.id;
    END IF;

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

-- CREATE OR REPLACE retains the previously revoked ACLs, but explicitly assert a fixed
-- search_path again in the replacement definitions. The existing triggers continue to call
-- these function identities and therefore pick up the hardened bodies automatically.
