-- Phase 3 evidence identity hardening.
-- Acceptance receipts preserve party identity at decision time, and any accepted party's
-- evidentiary identity cannot be rewritten through later EngagementParty edits.

ALTER TABLE wewed_contracts."ContractAcceptance"
  ADD COLUMN "partyDisplayName" text,
  ADD COLUMN "partyLegalName" text;

UPDATE wewed_contracts."ContractAcceptance" a
SET
  "partyDisplayName" = p."displayName",
  "partyLegalName" = p."legalName"
FROM public."EngagementParty" p
WHERE p."id" = a."engagementPartyId";

ALTER TABLE wewed_contracts."ContractAcceptance"
  ALTER COLUMN "partyDisplayName" SET NOT NULL;

ALTER TABLE wewed_contracts."ContractPartyRequirement"
  ADD CONSTRAINT "ContractPartyRequirement_identity_key"
  UNIQUE ("id", "contractId", "contractVersionId", "engagementPartyId");

ALTER TABLE wewed_contracts."ContractAcceptance"
  DROP CONSTRAINT "ContractAcceptance_requirement_fkey",
  ADD CONSTRAINT "ContractAcceptance_requirement_identity_fkey"
  FOREIGN KEY ("requirementId", "contractId", "contractVersionId", "engagementPartyId")
  REFERENCES wewed_contracts."ContractPartyRequirement"("id", "contractId", "contractVersionId", "engagementPartyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wewed_contracts.validate_requirement_contract_party()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
DECLARE
  contract_engagement_id text;
  contract_wedding_id text;
  party_engagement_id text;
  party_wedding_id text;
  party_role text;
BEGIN
  SELECT c."serviceEngagementId", c."weddingId"
    INTO contract_engagement_id, contract_wedding_id
  FROM public."Contract" c
  WHERE c."id" = NEW."contractId";

  SELECT p."serviceEngagementId", p."weddingId", p."partyRole"
    INTO party_engagement_id, party_wedding_id, party_role
  FROM public."EngagementParty" p
  WHERE p."id" = NEW."engagementPartyId";

  IF contract_engagement_id IS NULL OR party_engagement_id IS NULL THEN
    RAISE EXCEPTION 'Acceptance requirement contract or party is missing';
  END IF;
  IF party_engagement_id IS DISTINCT FROM contract_engagement_id
     OR party_wedding_id IS DISTINCT FROM contract_wedding_id THEN
    RAISE EXCEPTION 'Acceptance requirement party must belong to the contract service engagement and wedding';
  END IF;
  IF party_role IS DISTINCT FROM NEW."requiredRole" THEN
    RAISE EXCEPTION 'Acceptance requirement role must match the governed party role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ContractPartyRequirement_contract_party_guard"
BEFORE INSERT OR UPDATE ON wewed_contracts."ContractPartyRequirement"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_requirement_contract_party();

CREATE OR REPLACE FUNCTION wewed_contracts.capture_acceptance_party_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  SELECT p."displayName", p."legalName"
    INTO NEW."partyDisplayName", NEW."partyLegalName"
  FROM public."EngagementParty" p
  WHERE p."id" = NEW."engagementPartyId";

  IF NEW."partyDisplayName" IS NULL OR btrim(NEW."partyDisplayName") = '' THEN
    RAISE EXCEPTION 'Acceptance party identity is unavailable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ContractAcceptance_party_snapshot_guard"
BEFORE INSERT ON wewed_contracts."ContractAcceptance"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.capture_acceptance_party_snapshot();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_accepted_party_identity_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM wewed_contracts."ContractAcceptance" a
    WHERE a."engagementPartyId" = OLD."id"
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'A party with a governed contract decision cannot be deleted';
    END IF;
    IF NEW."serviceEngagementId" IS DISTINCT FROM OLD."serviceEngagementId"
       OR NEW."weddingId" IS DISTINCT FROM OLD."weddingId"
       OR NEW."partyRole" IS DISTINCT FROM OLD."partyRole"
       OR NEW."partyKind" IS DISTINCT FROM OLD."partyKind"
       OR NEW."displayName" IS DISTINCT FROM OLD."displayName"
       OR NEW."legalName" IS DISTINCT FROM OLD."legalName"
       OR NEW."email" IS DISTINCT FROM OLD."email"
       OR NEW."linkedEntityType" IS DISTINCT FROM OLD."linkedEntityType"
       OR NEW."linkedEntityId" IS DISTINCT FROM OLD."linkedEntityId" THEN
      RAISE EXCEPTION 'Accepted contract party identity is immutable; create a governed replacement party/version instead';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "EngagementParty_accepted_identity_guard"
BEFORE UPDATE OR DELETE ON public."EngagementParty"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_accepted_party_identity_immutability();

REVOKE ALL PRIVILEGES ON FUNCTION wewed_contracts.validate_requirement_contract_party() FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION wewed_contracts.capture_acceptance_party_snapshot() FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION wewed_contracts.enforce_accepted_party_identity_immutability() FROM PUBLIC;

DO $phase3_identity_private_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION wewed_contracts.validate_requirement_contract_party() FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION wewed_contracts.capture_acceptance_party_snapshot() FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION wewed_contracts.enforce_accepted_party_identity_immutability() FROM %I', role_name);
    END IF;
  END LOOP;
END
$phase3_identity_private_roles$;
