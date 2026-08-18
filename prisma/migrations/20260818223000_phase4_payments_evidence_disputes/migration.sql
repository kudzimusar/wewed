-- Phase 4 — Payments, Evidence & Disputes
-- All transaction/dispute governance records are server-only in wewed_contracts.
-- Payment facts never imply Wewed custody/processing and never imply contract acceptance.
-- Dispute allegations never imply a Wewed breach finding or adjudication.

CREATE TABLE wewed_contracts."PaymentMilestone" (
  "id" text PRIMARY KEY,
  "serviceEngagementId" text NOT NULL,
  "weddingId" text NOT NULL,
  "contractId" text,
  "contractVersionId" text,
  "milestoneType" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "amount" numeric(14,2) NOT NULL,
  "currency" text NOT NULL,
  "dueAt" timestamp(3),
  "status" text NOT NULL DEFAULT 'PLANNED',
  "sequence" integer NOT NULL DEFAULT 0,
  "proofRequired" boolean NOT NULL DEFAULT true,
  "createdById" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentMilestone_service_engagement_wedding_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId") REFERENCES public."ServiceEngagement"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentMilestone_contract_wedding_fkey"
    FOREIGN KEY ("contractId", "weddingId") REFERENCES public."Contract"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentMilestone_version_contract_fkey"
    FOREIGN KEY ("contractVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentMilestone_type_check" CHECK ("milestoneType" IN ('DEPOSIT','INSTALLMENT','PRE_EVENT_BALANCE','POST_EVENT_DELIVERY','SECURITY_DAMAGE_DEPOSIT','CUSTOM')),
  CONSTRAINT "PaymentMilestone_status_check" CHECK ("status" IN ('PLANNED','WAIVED','CANCELLED')),
  CONSTRAINT "PaymentMilestone_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "PaymentMilestone_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PaymentMilestone_label_check" CHECK (char_length(btrim("label")) BETWEEN 2 AND 180),
  CONSTRAINT "PaymentMilestone_contract_version_pair_check" CHECK (("contractId" IS NULL AND "contractVersionId" IS NULL) OR ("contractId" IS NOT NULL AND "contractVersionId" IS NOT NULL))
);
CREATE INDEX "PaymentMilestone_service_engagement_wedding_idx" ON wewed_contracts."PaymentMilestone" ("serviceEngagementId", "weddingId");
CREATE INDEX "PaymentMilestone_contract_wedding_idx" ON wewed_contracts."PaymentMilestone" ("contractId", "weddingId");
CREATE INDEX "PaymentMilestone_version_contract_idx" ON wewed_contracts."PaymentMilestone" ("contractVersionId", "contractId");
CREATE INDEX "PaymentMilestone_engagement_status_due_idx" ON wewed_contracts."PaymentMilestone" ("serviceEngagementId", "status", "dueAt", "sequence");

CREATE TABLE wewed_contracts."ManagedPaymentRecord" (
  "id" text PRIMARY KEY,
  "serviceEngagementId" text NOT NULL,
  "weddingId" text NOT NULL,
  "milestoneId" text,
  "entryType" text NOT NULL DEFAULT 'PAYMENT',
  "amount" numeric(14,2) NOT NULL,
  "currency" text NOT NULL,
  "paidAt" timestamp(3) NOT NULL,
  "method" text,
  "reference" text,
  "notes" text,
  "source" text NOT NULL DEFAULT 'MANUAL_FACT',
  "proofRequired" boolean NOT NULL DEFAULT true,
  "proofWaiverReason" text,
  "proofVaultObjectId" text,
  "reversesPaymentId" text,
  "recordedById" text NOT NULL,
  "recordNature" text NOT NULL DEFAULT 'FACT_ONLY',
  "wewedProcessorRole" text NOT NULL DEFAULT 'NONE',
  "custodyStatus" text NOT NULL DEFAULT 'NOT_HELD_BY_WEWED',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedPaymentRecord_service_engagement_wedding_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId") REFERENCES public."ServiceEngagement"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManagedPaymentRecord_milestone_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES wewed_contracts."PaymentMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManagedPaymentRecord_proof_vault_wedding_fkey"
    FOREIGN KEY ("proofVaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManagedPaymentRecord_reversal_fkey"
    FOREIGN KEY ("reversesPaymentId") REFERENCES wewed_contracts."ManagedPaymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManagedPaymentRecord_entry_type_check" CHECK ("entryType" IN ('PAYMENT','REFUND','REVERSAL')),
  CONSTRAINT "ManagedPaymentRecord_source_check" CHECK ("source" IN ('MANUAL_FACT','EXTERNAL_PROCESSOR_FACT','CORRECTION_FACT')),
  CONSTRAINT "ManagedPaymentRecord_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "ManagedPaymentRecord_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ManagedPaymentRecord_record_nature_check" CHECK ("recordNature" = 'FACT_ONLY'),
  CONSTRAINT "ManagedPaymentRecord_processor_role_check" CHECK ("wewedProcessorRole" = 'NONE'),
  CONSTRAINT "ManagedPaymentRecord_custody_check" CHECK ("custodyStatus" = 'NOT_HELD_BY_WEWED'),
  CONSTRAINT "ManagedPaymentRecord_proof_waiver_check" CHECK ("proofRequired" OR ("proofWaiverReason" IS NOT NULL AND char_length(btrim("proofWaiverReason")) >= 3)),
  CONSTRAINT "ManagedPaymentRecord_reversal_shape_check" CHECK (("entryType"='REVERSAL' AND "reversesPaymentId" IS NOT NULL) OR ("entryType"<>'REVERSAL' AND "reversesPaymentId" IS NULL))
);
CREATE INDEX "ManagedPaymentRecord_service_engagement_wedding_idx" ON wewed_contracts."ManagedPaymentRecord" ("serviceEngagementId", "weddingId");
CREATE INDEX "ManagedPaymentRecord_milestone_idx" ON wewed_contracts."ManagedPaymentRecord" ("milestoneId");
CREATE INDEX "ManagedPaymentRecord_proof_vault_wedding_idx" ON wewed_contracts."ManagedPaymentRecord" ("proofVaultObjectId", "weddingId");
CREATE UNIQUE INDEX "ManagedPaymentRecord_reversesPaymentId_key" ON wewed_contracts."ManagedPaymentRecord" ("reversesPaymentId") WHERE "reversesPaymentId" IS NOT NULL;
CREATE INDEX "ManagedPaymentRecord_engagement_paid_idx" ON wewed_contracts."ManagedPaymentRecord" ("serviceEngagementId", "paidAt", "createdAt");

CREATE TABLE wewed_contracts."DisputeCase" (
  "id" text PRIMARY KEY,
  "weddingId" text NOT NULL,
  "serviceEngagementId" text NOT NULL,
  "contractId" text,
  "contractVersionId" text,
  "status" text NOT NULL DEFAULT 'OPEN',
  "summary" text NOT NULL,
  "openedById" text NOT NULL,
  "openedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeCase_service_engagement_wedding_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId") REFERENCES public."ServiceEngagement"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeCase_contract_wedding_fkey"
    FOREIGN KEY ("contractId", "weddingId") REFERENCES public."Contract"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeCase_version_contract_fkey"
    FOREIGN KEY ("contractVersionId", "contractId") REFERENCES public."ContractVersion"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeCase_status_check" CHECK ("status" IN ('OPEN','NOTICE_SENT','RESPONSE_RECEIVED','NEGOTIATING','SETTLED','WITHDRAWN','EXTERNAL_RESOLUTION_RECORDED','CLOSED')),
  CONSTRAINT "DisputeCase_summary_check" CHECK (char_length(btrim("summary")) BETWEEN 10 AND 4000),
  CONSTRAINT "DisputeCase_contract_version_pair_check" CHECK (("contractId" IS NULL AND "contractVersionId" IS NULL) OR ("contractId" IS NOT NULL AND "contractVersionId" IS NOT NULL))
);
CREATE INDEX "DisputeCase_service_engagement_wedding_idx" ON wewed_contracts."DisputeCase" ("serviceEngagementId", "weddingId");
CREATE INDEX "DisputeCase_contract_wedding_idx" ON wewed_contracts."DisputeCase" ("contractId", "weddingId");
CREATE INDEX "DisputeCase_version_contract_idx" ON wewed_contracts."DisputeCase" ("contractVersionId", "contractId");
CREATE INDEX "DisputeCase_wedding_status_created_idx" ON wewed_contracts."DisputeCase" ("weddingId", "status", "createdAt");

CREATE TABLE wewed_contracts."DisputeIssue" (
  "id" text PRIMARY KEY,
  "disputeCaseId" text NOT NULL,
  "clauseReference" text,
  "category" text NOT NULL,
  "allegationText" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ALLEGED',
  "findingStatus" text NOT NULL DEFAULT 'UNADJUDICATED',
  "createdById" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeIssue_case_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES wewed_contracts."DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeIssue_status_check" CHECK ("status" IN ('ALLEGED','RESPONDED','RESOLVED','WITHDRAWN')),
  CONSTRAINT "DisputeIssue_finding_check" CHECK ("findingStatus" = 'UNADJUDICATED'),
  CONSTRAINT "DisputeIssue_category_check" CHECK (char_length(btrim("category")) BETWEEN 2 AND 120),
  CONSTRAINT "DisputeIssue_allegation_check" CHECK (char_length(btrim("allegationText")) BETWEEN 5 AND 6000)
);
CREATE INDEX "DisputeIssue_case_idx" ON wewed_contracts."DisputeIssue" ("disputeCaseId");
CREATE INDEX "DisputeIssue_case_status_idx" ON wewed_contracts."DisputeIssue" ("disputeCaseId", "status", "createdAt");

CREATE TABLE wewed_contracts."DisputeEvent" (
  "id" text PRIMARY KEY,
  "disputeCaseId" text NOT NULL,
  "issueId" text,
  "eventType" text NOT NULL,
  "source" text NOT NULL,
  "actorId" text NOT NULL,
  "actorPartyId" text,
  "note" text NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeEvent_case_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES wewed_contracts."DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeEvent_issue_fkey" FOREIGN KEY ("issueId") REFERENCES wewed_contracts."DisputeIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeEvent_actor_party_fkey" FOREIGN KEY ("actorPartyId") REFERENCES public."EngagementParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeEvent_type_check" CHECK ("eventType" IN ('NOTICE_RECORDED','PARTY_RESPONSE_RECORDED','NEGOTIATION_NOTE','EVIDENCE_ADDED','HOLD_RELEASED','OUTCOME_RECORDED')),
  CONSTRAINT "DisputeEvent_source_check" CHECK ("source" IN ('IN_APP_ACTOR','EXTERNAL_REPORTED','SYSTEM_GOVERNANCE')),
  CONSTRAINT "DisputeEvent_note_check" CHECK (char_length(btrim("note")) BETWEEN 2 AND 6000)
);
CREATE INDEX "DisputeEvent_case_idx" ON wewed_contracts."DisputeEvent" ("disputeCaseId");
CREATE INDEX "DisputeEvent_issue_idx" ON wewed_contracts."DisputeEvent" ("issueId");
CREATE INDEX "DisputeEvent_actor_party_idx" ON wewed_contracts."DisputeEvent" ("actorPartyId");
CREATE INDEX "DisputeEvent_case_created_idx" ON wewed_contracts."DisputeEvent" ("disputeCaseId", "createdAt", "id");

CREATE TABLE wewed_contracts."DisputeOutcome" (
  "id" text PRIMARY KEY,
  "disputeCaseId" text NOT NULL UNIQUE,
  "weddingId" text NOT NULL,
  "source" text NOT NULL,
  "outcomeSummary" text NOT NULL,
  "remedyType" text NOT NULL DEFAULT 'NONE',
  "amount" numeric(14,2),
  "currency" text,
  "externalReference" text,
  "evidenceVaultObjectId" text,
  "recordedById" text NOT NULL,
  "recordedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "wewedAdjudicationRole" text NOT NULL DEFAULT 'NONE',
  CONSTRAINT "DisputeOutcome_case_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES wewed_contracts."DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeOutcome_evidence_vault_wedding_fkey" FOREIGN KEY ("evidenceVaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeOutcome_source_check" CHECK ("source" IN ('MUTUAL_SETTLEMENT','EXTERNAL_ADJUDICATION','COURT_ORDER','WITHDRAWAL')),
  CONSTRAINT "DisputeOutcome_remedy_check" CHECK ("remedyType" IN ('NONE','REFUND','SERVICE_CREDIT','FEE_ADJUSTMENT','REPERFORMANCE','CUSTOM')),
  CONSTRAINT "DisputeOutcome_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0),
  CONSTRAINT "DisputeOutcome_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "DisputeOutcome_amount_currency_pair_check" CHECK (("amount" IS NULL AND "currency" IS NULL) OR ("amount" IS NOT NULL AND "currency" IS NOT NULL)),
  CONSTRAINT "DisputeOutcome_summary_check" CHECK (char_length(btrim("outcomeSummary")) BETWEEN 5 AND 6000),
  CONSTRAINT "DisputeOutcome_wewed_role_check" CHECK ("wewedAdjudicationRole" = 'NONE')
);
CREATE INDEX "DisputeOutcome_case_idx" ON wewed_contracts."DisputeOutcome" ("disputeCaseId");
CREATE INDEX "DisputeOutcome_evidence_vault_wedding_idx" ON wewed_contracts."DisputeOutcome" ("evidenceVaultObjectId", "weddingId");

CREATE TABLE wewed_contracts."EvidenceHold" (
  "id" text PRIMARY KEY,
  "weddingId" text NOT NULL,
  "vaultObjectId" text NOT NULL,
  "disputeCaseId" text,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "placedById" text NOT NULL,
  "placedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedById" text,
  "releasedAt" timestamp(3),
  "releaseReason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceHold_vault_wedding_fkey" FOREIGN KEY ("vaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EvidenceHold_case_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES wewed_contracts."DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EvidenceHold_status_check" CHECK ("status" IN ('ACTIVE','RELEASED')),
  CONSTRAINT "EvidenceHold_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 3 AND 2000),
  CONSTRAINT "EvidenceHold_release_shape_check" CHECK (("status"='ACTIVE' AND "releasedById" IS NULL AND "releasedAt" IS NULL AND "releaseReason" IS NULL) OR ("status"='RELEASED' AND "releasedById" IS NOT NULL AND "releasedAt" IS NOT NULL AND "releaseReason" IS NOT NULL AND char_length(btrim("releaseReason")) >= 3))
);
CREATE INDEX "EvidenceHold_vault_wedding_idx" ON wewed_contracts."EvidenceHold" ("vaultObjectId", "weddingId");
CREATE INDEX "EvidenceHold_case_idx" ON wewed_contracts."EvidenceHold" ("disputeCaseId");
CREATE INDEX "EvidenceHold_vault_status_idx" ON wewed_contracts."EvidenceHold" ("vaultObjectId", "status", "placedAt");

CREATE OR REPLACE FUNCTION wewed_contracts.validate_payment_milestone_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE c_engagement text; c_wedding text; v_contract text; v_wedding text; v_status text;
BEGIN
  IF NEW."contractId" IS NOT NULL THEN
    SELECT c."serviceEngagementId", c."weddingId" INTO c_engagement, c_wedding FROM public."Contract" c WHERE c."id"=NEW."contractId";
    IF c_engagement IS DISTINCT FROM NEW."serviceEngagementId" OR c_wedding IS DISTINCT FROM NEW."weddingId" THEN
      RAISE EXCEPTION 'Payment milestone contract must belong to the same service engagement and wedding';
    END IF;
    SELECT v."contractId", v."weddingId", v."status" INTO v_contract, v_wedding, v_status FROM public."ContractVersion" v WHERE v."id"=NEW."contractVersionId";
    IF v_contract IS DISTINCT FROM NEW."contractId" OR v_wedding IS DISTINCT FROM NEW."weddingId" OR v_status NOT IN ('EFFECTIVE','SUPERSEDED') THEN
      RAISE EXCEPTION 'Payment milestone contract version must be an effective or superseded governed version of the same contract';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PaymentMilestone_binding_guard" BEFORE INSERT OR UPDATE ON wewed_contracts."PaymentMilestone" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_payment_milestone_binding();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_payment_milestone_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment milestones are governance records; cancel or waive instead of deleting'; END IF;
  IF OLD."status" IN ('WAIVED','CANCELLED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN RAISE EXCEPTION 'Final milestone state cannot be reopened'; END IF;
  IF EXISTS (SELECT 1 FROM wewed_contracts."ManagedPaymentRecord" p WHERE p."milestoneId"=OLD."id") THEN
    IF NEW."serviceEngagementId" IS DISTINCT FROM OLD."serviceEngagementId" OR NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR NEW."contractId" IS DISTINCT FROM OLD."contractId" OR NEW."contractVersionId" IS DISTINCT FROM OLD."contractVersionId" OR NEW."milestoneType" IS DISTINCT FROM OLD."milestoneType" OR NEW."amount" IS DISTINCT FROM OLD."amount" OR NEW."currency" IS DISTINCT FROM OLD."currency" OR NEW."dueAt" IS DISTINCT FROM OLD."dueAt" THEN
      RAISE EXCEPTION 'A milestone with recorded payment facts cannot have its governed financial identity rewritten';
    END IF;
    IF NEW."status" IN ('WAIVED','CANCELLED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN RAISE EXCEPTION 'A milestone with payment facts cannot be waived or cancelled'; END IF;
  END IF;
  NEW."updatedAt"=CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PaymentMilestone_integrity_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."PaymentMilestone" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_payment_milestone_integrity();

CREATE OR REPLACE FUNCTION wewed_contracts.validate_managed_payment_record()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE m_engagement text; m_wedding text; m_currency text; original wewed_contracts."ManagedPaymentRecord"%ROWTYPE;
BEGIN
  IF NEW."milestoneId" IS NOT NULL THEN
    SELECT m."serviceEngagementId", m."weddingId", m."currency" INTO m_engagement, m_wedding, m_currency FROM wewed_contracts."PaymentMilestone" m WHERE m."id"=NEW."milestoneId";
    IF m_engagement IS DISTINCT FROM NEW."serviceEngagementId" OR m_wedding IS DISTINCT FROM NEW."weddingId" OR m_currency IS DISTINCT FROM NEW."currency" THEN
      RAISE EXCEPTION 'Managed payment milestone must belong to the same engagement, wedding and currency';
    END IF;
  END IF;
  IF NEW."entryType"='REVERSAL' THEN
    SELECT * INTO original FROM wewed_contracts."ManagedPaymentRecord" WHERE "id"=NEW."reversesPaymentId";
    IF original."id" IS NULL OR original."entryType"='REVERSAL' THEN RAISE EXCEPTION 'A reversal must reference a non-reversal payment fact'; END IF;
    IF original."serviceEngagementId" IS DISTINCT FROM NEW."serviceEngagementId" OR original."weddingId" IS DISTINCT FROM NEW."weddingId" OR original."milestoneId" IS DISTINCT FROM NEW."milestoneId" OR original."amount" IS DISTINCT FROM NEW."amount" OR original."currency" IS DISTINCT FROM NEW."currency" THEN
      RAISE EXCEPTION 'A reversal must exactly reverse the original engagement, milestone, amount and currency';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ManagedPaymentRecord_validation_guard" BEFORE INSERT ON wewed_contracts."ManagedPaymentRecord" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_managed_payment_record();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_managed_payment_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN RAISE EXCEPTION 'Managed payment facts are append-only; record a governed reversal or refund instead'; END;
$$;
CREATE TRIGGER "ManagedPaymentRecord_append_only_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."ManagedPaymentRecord" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_managed_payment_append_only();

CREATE OR REPLACE FUNCTION wewed_contracts.validate_dispute_case_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE c_engagement text; c_wedding text; v_contract text; v_wedding text; v_status text;
BEGIN
  IF NEW."contractId" IS NOT NULL THEN
    SELECT c."serviceEngagementId", c."weddingId" INTO c_engagement, c_wedding FROM public."Contract" c WHERE c."id"=NEW."contractId";
    IF c_engagement IS DISTINCT FROM NEW."serviceEngagementId" OR c_wedding IS DISTINCT FROM NEW."weddingId" THEN RAISE EXCEPTION 'Dispute contract must belong to the same service engagement and wedding'; END IF;
    SELECT v."contractId", v."weddingId", v."status" INTO v_contract, v_wedding, v_status FROM public."ContractVersion" v WHERE v."id"=NEW."contractVersionId";
    IF v_contract IS DISTINCT FROM NEW."contractId" OR v_wedding IS DISTINCT FROM NEW."weddingId" OR v_status NOT IN ('EFFECTIVE','SUPERSEDED','DISPUTED','CANCELLED') THEN RAISE EXCEPTION 'Dispute must reference a governed effective/superseded contract version'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DisputeCase_binding_guard" BEFORE INSERT OR UPDATE ON wewed_contracts."DisputeCase" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_dispute_case_binding();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_dispute_case_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Dispute cases are governance records and cannot be deleted'; END IF;
  IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR NEW."serviceEngagementId" IS DISTINCT FROM OLD."serviceEngagementId" OR NEW."contractId" IS DISTINCT FROM OLD."contractId" OR NEW."contractVersionId" IS DISTINCT FROM OLD."contractVersionId" OR NEW."summary" IS DISTINCT FROM OLD."summary" OR NEW."openedById" IS DISTINCT FROM OLD."openedById" OR NEW."openedAt" IS DISTINCT FROM OLD."openedAt" THEN RAISE EXCEPTION 'Dispute case identity and opening allegation summary are immutable'; END IF;
  IF OLD."status" IN ('SETTLED','WITHDRAWN','EXTERNAL_RESOLUTION_RECORDED','CLOSED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN RAISE EXCEPTION 'Final dispute case state cannot be reopened'; END IF;
  NEW."updatedAt"=CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DisputeCase_integrity_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."DisputeCase" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_dispute_case_integrity();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_dispute_issue_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Dispute issues are governance records and cannot be deleted'; END IF;
  IF NEW."disputeCaseId" IS DISTINCT FROM OLD."disputeCaseId" OR NEW."clauseReference" IS DISTINCT FROM OLD."clauseReference" OR NEW."category" IS DISTINCT FROM OLD."category" OR NEW."allegationText" IS DISTINCT FROM OLD."allegationText" OR NEW."findingStatus" IS DISTINCT FROM OLD."findingStatus" OR NEW."createdById" IS DISTINCT FROM OLD."createdById" THEN RAISE EXCEPTION 'Dispute allegation identity cannot be rewritten'; END IF;
  IF OLD."status" IN ('RESOLVED','WITHDRAWN') AND NEW."status" IS DISTINCT FROM OLD."status" THEN RAISE EXCEPTION 'Final dispute issue state cannot be reopened'; END IF;
  NEW."updatedAt"=CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DisputeIssue_integrity_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."DisputeIssue" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_dispute_issue_integrity();

CREATE OR REPLACE FUNCTION wewed_contracts.validate_dispute_event()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE case_engagement text; case_wedding text; issue_case text; party_engagement text; party_wedding text;
BEGIN
  SELECT c."serviceEngagementId", c."weddingId" INTO case_engagement, case_wedding FROM wewed_contracts."DisputeCase" c WHERE c."id"=NEW."disputeCaseId";
  IF NEW."issueId" IS NOT NULL THEN
    SELECT i."disputeCaseId" INTO issue_case FROM wewed_contracts."DisputeIssue" i WHERE i."id"=NEW."issueId";
    IF issue_case IS DISTINCT FROM NEW."disputeCaseId" THEN RAISE EXCEPTION 'Dispute event issue must belong to the same dispute case'; END IF;
  END IF;
  IF NEW."actorPartyId" IS NOT NULL THEN
    SELECT p."serviceEngagementId", p."weddingId" INTO party_engagement, party_wedding FROM public."EngagementParty" p WHERE p."id"=NEW."actorPartyId";
    IF party_engagement IS DISTINCT FROM case_engagement OR party_wedding IS DISTINCT FROM case_wedding THEN RAISE EXCEPTION 'Dispute event party must belong to the same service engagement and wedding'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DisputeEvent_validation_guard" BEFORE INSERT ON wewed_contracts."DisputeEvent" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_dispute_event();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_dispute_event_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN RAISE EXCEPTION 'Dispute events are append-only'; END;
$$;
CREATE TRIGGER "DisputeEvent_append_only_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."DisputeEvent" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_dispute_event_append_only();

CREATE OR REPLACE FUNCTION wewed_contracts.validate_dispute_outcome()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE case_wedding text;
BEGIN
  SELECT c."weddingId" INTO case_wedding FROM wewed_contracts."DisputeCase" c WHERE c."id"=NEW."disputeCaseId";
  IF case_wedding IS DISTINCT FROM NEW."weddingId" THEN RAISE EXCEPTION 'Dispute outcome must use the dispute wedding'; END IF;
  IF NEW."source" IN ('EXTERNAL_ADJUDICATION','COURT_ORDER') AND NEW."externalReference" IS NULL AND NEW."evidenceVaultObjectId" IS NULL THEN RAISE EXCEPTION 'External adjudication/court outcomes require an external reference or evidence object'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DisputeOutcome_validation_guard" BEFORE INSERT ON wewed_contracts."DisputeOutcome" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_dispute_outcome();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_dispute_outcome_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN RAISE EXCEPTION 'Dispute outcomes are append-only; corrections require a new governed record outside this final outcome'; END;
$$;
CREATE TRIGGER "DisputeOutcome_append_only_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."DisputeOutcome" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_dispute_outcome_append_only();

CREATE OR REPLACE FUNCTION wewed_contracts.apply_dispute_outcome_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN
  UPDATE wewed_contracts."DisputeCase"
  SET "status"=CASE WHEN NEW."source"='MUTUAL_SETTLEMENT' THEN 'SETTLED' WHEN NEW."source"='WITHDRAWAL' THEN 'WITHDRAWN' ELSE 'EXTERNAL_RESOLUTION_RECORDED' END,
      "closedAt"=NEW."recordedAt", "updatedAt"=NEW."recordedAt"
  WHERE "id"=NEW."disputeCaseId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DisputeOutcome_case_status_guard" AFTER INSERT ON wewed_contracts."DisputeOutcome" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.apply_dispute_outcome_status();

CREATE OR REPLACE FUNCTION wewed_contracts.validate_evidence_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE object_wedding text; case_wedding text;
BEGIN
  SELECT v."weddingId" INTO object_wedding FROM public."VaultObject" v WHERE v."id"=NEW."vaultObjectId";
  IF object_wedding IS DISTINCT FROM NEW."weddingId" THEN RAISE EXCEPTION 'Evidence hold object must belong to the same wedding'; END IF;
  IF NEW."disputeCaseId" IS NOT NULL THEN
    SELECT c."weddingId" INTO case_wedding FROM wewed_contracts."DisputeCase" c WHERE c."id"=NEW."disputeCaseId";
    IF case_wedding IS DISTINCT FROM NEW."weddingId" THEN RAISE EXCEPTION 'Evidence hold dispute case must belong to the same wedding'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "EvidenceHold_validation_guard" BEFORE INSERT OR UPDATE ON wewed_contracts."EvidenceHold" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.validate_evidence_hold();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_evidence_hold_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Evidence holds cannot be deleted'; END IF;
  IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR NEW."vaultObjectId" IS DISTINCT FROM OLD."vaultObjectId" OR NEW."disputeCaseId" IS DISTINCT FROM OLD."disputeCaseId" OR NEW."reason" IS DISTINCT FROM OLD."reason" OR NEW."placedById" IS DISTINCT FROM OLD."placedById" OR NEW."placedAt" IS DISTINCT FROM OLD."placedAt" THEN RAISE EXCEPTION 'Evidence hold identity cannot be rewritten'; END IF;
  IF OLD."status"='RELEASED' AND NEW."status" IS DISTINCT FROM OLD."status" THEN RAISE EXCEPTION 'Released evidence holds are final'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "EvidenceHold_integrity_guard" BEFORE UPDATE OR DELETE ON wewed_contracts."EvidenceHold" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_evidence_hold_integrity();

CREATE OR REPLACE FUNCTION wewed_contracts.sync_vault_legal_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
DECLARE object_id text;
BEGIN
  object_id=COALESCE(NEW."vaultObjectId", OLD."vaultObjectId");
  UPDATE public."VaultObject" v
  SET "legalHold"=EXISTS (SELECT 1 FROM wewed_contracts."EvidenceHold" h WHERE h."vaultObjectId"=object_id AND h."status"='ACTIVE'), "updatedAt"=CURRENT_TIMESTAMP
  WHERE v."id"=object_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "EvidenceHold_sync_vault_guard" AFTER INSERT OR UPDATE ON wewed_contracts."EvidenceHold" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.sync_vault_legal_hold();

CREATE OR REPLACE FUNCTION wewed_contracts.enforce_vault_evidence_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_contracts AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM wewed_contracts."EvidenceHold" h WHERE h."vaultObjectId"=OLD."id" AND h."status"='ACTIVE') THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Vault evidence under active hold cannot be deleted'; END IF;
    IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR NEW."storageProvider" IS DISTINCT FROM OLD."storageProvider" OR NEW."objectKey" IS DISTINCT FROM OLD."objectKey" OR NEW."mimeType" IS DISTINCT FROM OLD."mimeType" OR NEW."byteSize" IS DISTINCT FROM OLD."byteSize" OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256" OR NEW."storageState" IS DISTINCT FROM OLD."storageState" OR NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt" OR NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" OR (OLD."legalHold" AND NOT NEW."legalHold") THEN
      RAISE EXCEPTION 'Vault evidence under active hold cannot be destructively changed';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "VaultObject_evidence_hold_guard" BEFORE UPDATE OR DELETE ON public."VaultObject" FOR EACH ROW EXECUTE FUNCTION wewed_contracts.enforce_vault_evidence_hold();

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_contracts FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA wewed_contracts FROM PUBLIC;
DO $phase4_private_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_contracts FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_contracts FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA wewed_contracts FROM %I', role_name);
    END IF;
  END LOOP;
END
$phase4_private_roles$;
