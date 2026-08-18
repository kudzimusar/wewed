-- Phase 2 — Service Engagement Deal Room + Branded Contract Generator
-- Additive only. Acceptance/e-signature records deliberately belong to Phase 3.

ALTER TABLE public."ServiceEngagement"
  ADD COLUMN "lifecycleStatus" text NOT NULL DEFAULT 'historical_capture',
  ADD COLUMN "createdById" text;

ALTER TABLE public."ServiceEngagement"
  ADD CONSTRAINT "ServiceEngagement_origin_check"
    CHECK ("origin" IN ('historical', 'current')),
  ADD CONSTRAINT "ServiceEngagement_recordMode_check"
    CHECK ("recordMode" IN ('record_only', 'managed_contract')),
  ADD CONSTRAINT "ServiceEngagement_lifecycleStatus_check"
    CHECK ("lifecycleStatus" IN (
      'historical_capture', 'draft', 'ready_for_review', 'issued',
      'awaiting_acceptance', 'completed', 'cancelled', 'disputed'
    ));

CREATE INDEX "ServiceEngagement_wedding_lifecycle_idx"
  ON public."ServiceEngagement" ("weddingId", "lifecycleStatus");

CREATE TABLE public."EngagementParty" (
  "id" text PRIMARY KEY,
  "serviceEngagementId" text NOT NULL,
  "weddingId" text NOT NULL,
  "partyRole" text NOT NULL,
  "partyKind" text NOT NULL,
  "displayName" text NOT NULL,
  "legalName" text,
  "email" text,
  "phone" text,
  "userId" text,
  "entityId" text,
  "authorityBasis" text,
  "requiredForReview" boolean NOT NULL DEFAULT true,
  "status" text NOT NULL DEFAULT 'active',
  "createdById" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "EngagementParty_engagement_wedding_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId")
    REFERENCES public."ServiceEngagement"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EngagementParty_role_check"
    CHECK ("partyRole" IN (
      'CLIENT', 'PLANNER', 'SERVICE_PROVIDER', 'AUTHORIZED_REPRESENTATIVE',
      'WITNESS', 'WEWED_PLATFORM'
    )),
  CONSTRAINT "EngagementParty_kind_check"
    CHECK ("partyKind" IN ('PERSON', 'COUPLE', 'VENDOR', 'PLANNING_COMPANY', 'PLATFORM')),
  CONSTRAINT "EngagementParty_status_check"
    CHECK ("status" IN ('active', 'removed', 'replaced'))
);
CREATE INDEX "EngagementParty_engagement_idx"
  ON public."EngagementParty" ("serviceEngagementId", "status", "partyRole");
CREATE INDEX "EngagementParty_wedding_idx"
  ON public."EngagementParty" ("weddingId", "partyRole");

CREATE TABLE public."ContractTemplate" (
  "id" text PRIMARY KEY,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "serviceCategory" text NOT NULL,
  "marketCode" text NOT NULL DEFAULT 'GLOBAL',
  "jurisdictionCode" text,
  "language" text NOT NULL DEFAULT 'en',
  "semanticVersion" text NOT NULL,
  "status" text NOT NULL DEFAULT 'internal_review',
  "reviewStatus" text NOT NULL DEFAULT 'operator_review',
  "effectiveFrom" timestamptz,
  "retiredAt" timestamptz,
  "summary" text,
  "templateHash" text NOT NULL,
  "metadata" text,
  "createdById" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ContractTemplate_identity_key"
    UNIQUE ("code", "semanticVersion", "marketCode"),
  CONSTRAINT "ContractTemplate_status_check"
    CHECK ("status" IN ('draft', 'internal_review', 'counsel_approved', 'active', 'retired')),
  CONSTRAINT "ContractTemplate_hash_check"
    CHECK (char_length("templateHash") = 64)
);
CREATE INDEX "ContractTemplate_service_status_idx"
  ON public."ContractTemplate" ("serviceCategory", "marketCode", "status");

CREATE TABLE public."ContractClause" (
  "id" text PRIMARY KEY,
  "code" text NOT NULL,
  "version" text NOT NULL,
  "title" text NOT NULL,
  "clauseFamily" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'internal_review',
  "reviewStatus" text NOT NULL DEFAULT 'operator_review',
  "contentHash" text NOT NULL,
  "createdById" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ContractClause_code_version_key" UNIQUE ("code", "version"),
  CONSTRAINT "ContractClause_status_check"
    CHECK ("status" IN ('draft', 'internal_review', 'counsel_approved', 'active', 'retired')),
  CONSTRAINT "ContractClause_hash_check" CHECK (char_length("contentHash") = 64)
);
CREATE INDEX "ContractClause_family_status_idx"
  ON public."ContractClause" ("clauseFamily", "status");

CREATE TABLE public."ContractTemplateClause" (
  "id" text PRIMARY KEY,
  "templateId" text NOT NULL,
  "clauseId" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "required" boolean NOT NULL DEFAULT true,
  "configuration" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ContractTemplateClause_template_fkey"
    FOREIGN KEY ("templateId") REFERENCES public."ContractTemplate"("id") ON DELETE CASCADE,
  CONSTRAINT "ContractTemplateClause_clause_fkey"
    FOREIGN KEY ("clauseId") REFERENCES public."ContractClause"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractTemplateClause_template_clause_key" UNIQUE ("templateId", "clauseId"),
  CONSTRAINT "ContractTemplateClause_position_check" CHECK ("position" >= 0)
);
CREATE INDEX "ContractTemplateClause_template_position_idx"
  ON public."ContractTemplateClause" ("templateId", "position", "id");

CREATE SEQUENCE IF NOT EXISTS public.wewed_contract_number_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_wewed_contract_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path TO pg_catalog, public
AS $$
  SELECT 'WW-CON-' || to_char(clock_timestamp(), 'YYYY') || '-' ||
         lpad(nextval('public.wewed_contract_number_seq')::text, 6, '0')
$$;

CREATE TABLE public."Contract" (
  "id" text PRIMARY KEY,
  "contractNumber" text NOT NULL UNIQUE,
  "serviceEngagementId" text NOT NULL,
  "weddingId" text NOT NULL,
  "templateId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "currentVersionNumber" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "createdById" text,
  "issuedAt" timestamptz,
  "closedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Contract_engagement_wedding_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId")
    REFERENCES public."ServiceEngagement"("id", "weddingId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Contract_template_fkey"
    FOREIGN KEY ("templateId") REFERENCES public."ContractTemplate"("id") ON DELETE RESTRICT,
  CONSTRAINT "Contract_id_wedding_key" UNIQUE ("id", "weddingId"),
  CONSTRAINT "Contract_version_number_check" CHECK ("currentVersionNumber" >= 0),
  CONSTRAINT "Contract_status_check"
    CHECK ("status" IN (
      'DRAFT', 'READY_FOR_REVIEW', 'ISSUED', 'AWAITING_ACCEPTANCE',
      'EFFECTIVE', 'COMPLETED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED',
      'CANCELLED', 'DISPUTED', 'VOIDED_BY_GOVERNED_PROCESS'
    ))
);
CREATE INDEX "Contract_engagement_status_idx"
  ON public."Contract" ("serviceEngagementId", "status", "createdAt" DESC);
CREATE INDEX "Contract_wedding_status_idx"
  ON public."Contract" ("weddingId", "status", "createdAt" DESC);

CREATE TABLE public."ContractVersion" (
  "id" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "weddingId" text NOT NULL,
  "versionNumber" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "templateSemanticVersion" text NOT NULL,
  "canonicalJson" text NOT NULL,
  "renderedHtml" text NOT NULL,
  "contentSha256" text,
  "artifactVaultObjectId" text,
  "artifactSha256" text,
  "issuedAt" timestamptz,
  "createdById" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ContractVersion_contract_wedding_fkey"
    FOREIGN KEY ("contractId", "weddingId")
    REFERENCES public."Contract"("id", "weddingId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractVersion_contract_version_key" UNIQUE ("contractId", "versionNumber"),
  CONSTRAINT "ContractVersion_id_contract_key" UNIQUE ("id", "contractId"),
  CONSTRAINT "ContractVersion_version_check" CHECK ("versionNumber" > 0),
  CONSTRAINT "ContractVersion_status_check"
    CHECK ("status" IN (
      'DRAFT', 'ISSUED', 'AWAITING_ACCEPTANCE', 'EFFECTIVE', 'SUPERSEDED',
      'REJECTED', 'WITHDRAWN', 'CANCELLED', 'DISPUTED', 'VOIDED_BY_GOVERNED_PROCESS'
    )),
  CONSTRAINT "ContractVersion_content_hash_check"
    CHECK ("contentSha256" IS NULL OR char_length("contentSha256") = 64),
  CONSTRAINT "ContractVersion_artifact_hash_check"
    CHECK ("artifactSha256" IS NULL OR char_length("artifactSha256") = 64),
  CONSTRAINT "ContractVersion_issue_integrity_check"
    CHECK (
      "issuedAt" IS NULL OR
      ("contentSha256" IS NOT NULL AND "artifactVaultObjectId" IS NOT NULL AND "artifactSha256" IS NOT NULL)
    )
);
CREATE INDEX "ContractVersion_contract_status_idx"
  ON public."ContractVersion" ("contractId", "status", "versionNumber" DESC);
CREATE INDEX "ContractVersion_artifact_idx"
  ON public."ContractVersion" ("artifactVaultObjectId") WHERE "artifactVaultObjectId" IS NOT NULL;

CREATE TABLE public."ContractReviewGrant" (
  "id" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "contractVersionId" text NOT NULL,
  "engagementPartyId" text,
  "role" text NOT NULL,
  "tokenHash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "lastAccessedAt" timestamptz,
  "createdById" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ContractReviewGrant_contract_fkey"
    FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE CASCADE,
  CONSTRAINT "ContractReviewGrant_version_contract_fkey"
    FOREIGN KEY ("contractVersionId", "contractId")
    REFERENCES public."ContractVersion"("id", "contractId") ON DELETE CASCADE,
  CONSTRAINT "ContractReviewGrant_party_fkey"
    FOREIGN KEY ("engagementPartyId") REFERENCES public."EngagementParty"("id") ON DELETE SET NULL,
  CONSTRAINT "ContractReviewGrant_role_check"
    CHECK ("role" IN ('CLIENT', 'PLANNER', 'SERVICE_PROVIDER', 'AUTHORIZED_REPRESENTATIVE', 'WITNESS')),
  CONSTRAINT "ContractReviewGrant_status_check"
    CHECK ("status" IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  CONSTRAINT "ContractReviewGrant_token_hash_check" CHECK (char_length("tokenHash") = 64)
);
CREATE INDEX "ContractReviewGrant_version_status_idx"
  ON public."ContractReviewGrant" ("contractVersionId", "status", "expiresAt");

CREATE TABLE public."ContractEvent" (
  "id" text PRIMARY KEY,
  "contractId" text NOT NULL,
  "versionId" text,
  "eventType" text NOT NULL,
  "actorId" text,
  "metadata" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ContractEvent_contract_fkey"
    FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT
);
CREATE INDEX "ContractEvent_contract_created_idx"
  ON public."ContractEvent" ("contractId", "createdAt", "id");

CREATE OR REPLACE FUNCTION public.enforce_issued_contract_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."issuedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Issued contract versions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."issuedAt" IS NOT NULL AND (
    NEW."contractId" IS DISTINCT FROM OLD."contractId" OR
    NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR
    NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
    NEW."templateSemanticVersion" IS DISTINCT FROM OLD."templateSemanticVersion" OR
    NEW."canonicalJson" IS DISTINCT FROM OLD."canonicalJson" OR
    NEW."renderedHtml" IS DISTINCT FROM OLD."renderedHtml" OR
    NEW."contentSha256" IS DISTINCT FROM OLD."contentSha256" OR
    NEW."artifactVaultObjectId" IS DISTINCT FROM OLD."artifactVaultObjectId" OR
    NEW."artifactSha256" IS DISTINCT FROM OLD."artifactSha256" OR
    NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt"
  ) THEN
    RAISE EXCEPTION 'Issued contract version content is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ContractVersion_issued_immutability_guard"
BEFORE UPDATE OR DELETE ON public."ContractVersion"
FOR EACH ROW EXECUTE FUNCTION public.enforce_issued_contract_version_immutability();

CREATE OR REPLACE FUNCTION public.enforce_contract_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Contract events are append-only';
END;
$$;

CREATE TRIGGER "ContractEvent_append_only_guard"
BEFORE UPDATE OR DELETE ON public."ContractEvent"
FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_event_append_only();

REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_issued_contract_version_immutability() FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_contract_event_append_only() FROM PUBLIC;

-- Browser-facing roles never receive direct table access; all contract operations remain server-authorized.
DO $phase2_private_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."EngagementParty" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."ContractTemplate" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."ContractClause" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."ContractTemplateClause" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."Contract" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."ContractVersion" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."ContractReviewGrant" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON public."ContractEvent" FROM %I', role_name);
    END IF;
  END LOOP;
END
$phase2_private_roles$;
