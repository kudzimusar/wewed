-- Phase 3 — Acceptance, Immutability & Amendments
-- Evidence-sensitive consent records live in a private server-only schema.
-- Existing public Phase 2 Contract/ContractVersion rows remain the governed document spine.

CREATE SCHEMA IF NOT EXISTS wewed_contracts;
REVOKE ALL ON SCHEMA wewed_contracts FROM PUBLIC;

-- Canonical lifecycle additions. Viewing/review remains separate from acceptance.
ALTER TABLE public."Contract" DROP CONSTRAINT IF EXISTS "Contract_status_check";
ALTER TABLE public."Contract"
  ADD CONSTRAINT "Contract_status_check" CHECK ("status" IN (
    'DRAFT', 'READY_FOR_REVIEW', 'ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED',
    'EFFECTIVE', 'COMPLETED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED',
    'CANCELLED', 'DISPUTED', 'VOIDED_BY_GOVERNED_PROCESS'
  ));

ALTER TABLE public."ContractVersion" DROP CONSTRAINT IF EXISTS "ContractVersion_status_check";
ALTER TABLE public."ContractVersion"
  ADD CONSTRAINT "ContractVersion_status_check" CHECK ("status" IN (
    'DRAFT', 'ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED', 'EFFECTIVE', 'SUPERSEDED',
    'REJECTED', 'WITHDRAWN', 'CANCELLED', 'DISPUTED', 'VOIDED_BY_GOVERNED_PROCESS'
  ));

ALTER TABLE public."ServiceEngagement" DROP CONSTRAINT IF EXISTS "ServiceEngagement_lifecycleStatus_check";
ALTER TABLE public."ServiceEngagement"
  ADD CONSTRAINT "ServiceEngagement_lifecycleStatus_check" CHECK ("lifecycleStatus" IN (
    'historical_capture', 'draft', 'ready_for_review', 'issued', 'awaiting_acceptance',
    'partially_accepted', 'effective', 'rejected', 'completed', 'cancelled', 'disputed'
  ));

CREATE TABLE wewed_contracts."ContractPartyRequirement" (
  "id" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "contractVersionId" text NOT NULL,
  "engagementPartyId" text NOT NULL,
  "requiredRole" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "acceptedAt" timestamp(3),
  "rejectedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractPartyRequirement_contract_fkey"
    FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractPartyRequirement_version_contract_fkey"
    FOREIGN KEY ("contractVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractPartyRequirement_party_fkey"
    FOREIGN KEY ("engagementPartyId") REFERENCES public."EngagementParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractPartyRequirement_version_party_key" UNIQUE ("contractVersionId", "engagementPartyId"),
  CONSTRAINT "ContractPartyRequirement_role_check"
    CHECK ("requiredRole" IN ('CLIENT', 'PLANNER', 'SERVICE_PROVIDER', 'AUTHORIZED_REPRESENTATIVE', 'WITNESS')),
  CONSTRAINT "ContractPartyRequirement_status_check"
    CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT "ContractPartyRequirement_decision_time_check" CHECK (
    ("status" = 'PENDING' AND "acceptedAt" IS NULL AND "rejectedAt" IS NULL) OR
    ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "rejectedAt" IS NULL) OR
    ("status" = 'REJECTED' AND "rejectedAt" IS NOT NULL AND "acceptedAt" IS NULL) OR
    ("status" = 'SUPERSEDED')
  )
);
CREATE INDEX "ContractPartyRequirement_contractVersion_status_idx"
  ON wewed_contracts."ContractPartyRequirement" ("contractVersionId", "status");
CREATE INDEX "ContractPartyRequirement_party_idx"
  ON wewed_contracts."ContractPartyRequirement" ("engagementPartyId");

CREATE TABLE wewed_contracts."ContractAcceptance" (
  "id" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "contractVersionId" text NOT NULL,
  "engagementPartyId" text NOT NULL,
  "requirementId" text NOT NULL,
  "decision" text NOT NULL,
  "representedRole" text NOT NULL,
  "actorUserId" text,
  "identityKind" text NOT NULL,
  "identityEvidence" jsonb NOT NULL,
  "declarationVersion" text NOT NULL,
  "declarationSha256" text NOT NULL,
  "contractContentSha256" text NOT NULL,
  "contractArtifactSha256" text NOT NULL,
  "sourceChannel" text NOT NULL,
  "decisionAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAcceptance_contract_fkey"
    FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAcceptance_version_contract_fkey"
    FOREIGN KEY ("contractVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAcceptance_party_fkey"
    FOREIGN KEY ("engagementPartyId") REFERENCES public."EngagementParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAcceptance_requirement_fkey"
    FOREIGN KEY ("requirementId") REFERENCES wewed_contracts."ContractPartyRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAcceptance_version_party_key" UNIQUE ("contractVersionId", "engagementPartyId"),
  CONSTRAINT "ContractAcceptance_decision_check" CHECK ("decision" IN ('ACCEPTED', 'REJECTED')),
  CONSTRAINT "ContractAcceptance_identity_kind_check" CHECK ("identityKind" IN ('SECURE_REVIEW_LINK', 'AUTHENTICATED_ACCOUNT')),
  CONSTRAINT "ContractAcceptance_source_check" CHECK ("sourceChannel" IN ('WEB', 'MOBILE_WEB', 'ADMIN_SUPPORT_OBSERVED')),
  CONSTRAINT "ContractAcceptance_hashes_check" CHECK (
    char_length("declarationSha256") = 64 AND
    char_length("contractContentSha256") = 64 AND
    char_length("contractArtifactSha256") = 64
  )
);
CREATE INDEX "ContractAcceptance_contractVersion_decision_idx"
  ON wewed_contracts."ContractAcceptance" ("contractVersionId", "decision", "decisionAt");
CREATE INDEX "ContractAcceptance_party_idx"
  ON wewed_contracts."ContractAcceptance" ("engagementPartyId", "decisionAt");

CREATE TABLE wewed_contracts."ContractVersionEffectivity" (
  "contractVersionId" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "weddingId" text NOT NULL,
  "effectiveAt" timestamp(3) NOT NULL,
  "acceptanceCertificateVaultObjectId" text NOT NULL,
  "acceptanceCertificateSha256" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractVersionEffectivity_version_contract_fkey"
    FOREIGN KEY ("contractVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractVersionEffectivity_contract_wedding_fkey"
    FOREIGN KEY ("contractId", "weddingId") REFERENCES public."Contract"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractVersionEffectivity_vault_wedding_fkey"
    FOREIGN KEY ("acceptanceCertificateVaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractVersionEffectivity_hash_check" CHECK (char_length("acceptanceCertificateSha256") = 64)
);
CREATE INDEX "ContractVersionEffectivity_contract_idx"
  ON wewed_contracts."ContractVersionEffectivity" ("contractId", "effectiveAt");
CREATE INDEX "ContractVersionEffectivity_vault_idx"
  ON wewed_contracts."ContractVersionEffectivity" ("acceptanceCertificateVaultObjectId", "weddingId");

CREATE TABLE wewed_contracts."ContractAmendment" (
  "id" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "baseVersionId" text NOT NULL,
  "proposedVersionId" text NOT NULL,
  "reason" text NOT NULL,
  "diffSummary" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "proposedById" text NOT NULL,
  "proposedAt" timestamp(3),
  "effectiveAt" timestamp(3),
  "rejectedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAmendment_contract_fkey"
    FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAmendment_base_contract_fkey"
    FOREIGN KEY ("baseVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAmendment_proposed_contract_fkey"
    FOREIGN KEY ("proposedVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractAmendment_proposedVersion_key" UNIQUE ("proposedVersionId"),
  CONSTRAINT "ContractAmendment_status_check" CHECK ("status" IN ('DRAFT', 'PROPOSED', 'PARTIALLY_ACCEPTED', 'EFFECTIVE', 'REJECTED', 'WITHDRAWN')),
  CONSTRAINT "ContractAmendment_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 3 AND 2000)
);
CREATE INDEX "ContractAmendment_contract_status_idx"
  ON wewed_contracts."ContractAmendment" ("contractId", "status", "createdAt");
CREATE INDEX "ContractAmendment_baseVersion_idx"
  ON wewed_contracts."ContractAmendment" ("baseVersionId");

-- Existing issued Phase 2 review grants become explicit Phase 3 requirements without inventing acceptance.
INSERT INTO wewed_contracts."ContractPartyRequirement" (
  "id", "contractId", "contractVersionId", "engagementPartyId", "requiredRole", "status"
)
SELECT
  'phase3-req-' || md5(g."id"),
  g."contractId",
  g."contractVersionId",
  g."engagementPartyId",
  g."role",
  'PENDING'
FROM public."ContractReviewGrant" g
WHERE g."engagementPartyId" IS NOT NULL
  AND g."status" IN ('ACTIVE', 'REVOKED', 'EXPIRED')
ON CONFLICT ("contractVersionId", "engagementPartyId") DO NOTHING;

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_acceptance_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  RAISE EXCEPTION 'Contract acceptance receipts are append-only';
END;
$$;
CREATE TRIGGER "ContractAcceptance_append_only_guard"
BEFORE UPDATE OR DELETE ON wewed_contracts."ContractAcceptance"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_acceptance_append_only();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_effectivity_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  RAISE EXCEPTION 'Contract effectivity evidence is append-only';
END;
$$;
CREATE TRIGGER "ContractVersionEffectivity_append_only_guard"
BEFORE UPDATE OR DELETE ON wewed_contracts."ContractVersionEffectivity"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_effectivity_append_only();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_requirement_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Acceptance requirements cannot be deleted';
  END IF;
  IF NEW."contractId" IS DISTINCT FROM OLD."contractId"
     OR NEW."contractVersionId" IS DISTINCT FROM OLD."contractVersionId"
     OR NEW."engagementPartyId" IS DISTINCT FROM OLD."engagementPartyId"
     OR NEW."requiredRole" IS DISTINCT FROM OLD."requiredRole" THEN
    RAISE EXCEPTION 'Acceptance requirement identity is immutable';
  END IF;
  IF OLD."status" <> 'PENDING' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Final acceptance requirement decisions cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ContractPartyRequirement_identity_guard"
BEFORE UPDATE OR DELETE ON wewed_contracts."ContractPartyRequirement"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_requirement_identity();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_amendment_finality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Contract amendments cannot be deleted';
  END IF;
  IF NEW."contractId" IS DISTINCT FROM OLD."contractId"
     OR NEW."baseVersionId" IS DISTINCT FROM OLD."baseVersionId"
     OR NEW."proposedVersionId" IS DISTINCT FROM OLD."proposedVersionId"
     OR NEW."reason" IS DISTINCT FROM OLD."reason"
     OR NEW."diffSummary" IS DISTINCT FROM OLD."diffSummary"
     OR NEW."proposedById" IS DISTINCT FROM OLD."proposedById" THEN
    RAISE EXCEPTION 'Amendment identity and terms are immutable after creation';
  END IF;
  IF OLD."status" IN ('EFFECTIVE', 'REJECTED', 'WITHDRAWN') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Final amendment state cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ContractAmendment_finality_guard"
BEFORE UPDATE OR DELETE ON wewed_contracts."ContractAmendment"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_amendment_finality();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_contract_version_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, wewed_contracts
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('EFFECTIVE', 'SUPERSEDED', 'REJECTED') THEN
    RAISE EXCEPTION 'Final governed contract versions cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'SUPERSEDED' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
      RAISE EXCEPTION 'Superseded contract versions are final';
    END IF;
    IF OLD."status" = 'REJECTED' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
      RAISE EXCEPTION 'Rejected contract versions are final';
    END IF;
    IF OLD."status" = 'EFFECTIVE' AND NEW."status" NOT IN ('EFFECTIVE', 'SUPERSEDED', 'DISPUTED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Effective contract versions cannot regress to a pre-effective state';
    END IF;
    IF OLD."status" = 'PARTIALLY_ACCEPTED' AND NEW."status" IN ('DRAFT', 'ISSUED', 'AWAITING_ACCEPTANCE') THEN
      RAISE EXCEPTION 'Partially accepted contract versions cannot regress';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "ContractVersion_phase3_lifecycle_guard"
BEFORE UPDATE OR DELETE ON public."ContractVersion"
FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_contract_version_lifecycle();

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_contracts FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA wewed_contracts FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA wewed_contracts FROM PUBLIC;

DO $phase3_private_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_contracts FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_contracts FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA wewed_contracts FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA wewed_contracts FROM %I', role_name);
    END IF;
  END LOOP;
END
$phase3_private_roles$;
