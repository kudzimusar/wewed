\set ON_ERROR_STOP on

DO $$
DECLARE missing text; leaked bigint;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES
    ('PaymentMilestone'),
    ('ManagedPaymentRecord'),
    ('DisputeCase'),
    ('DisputeIssue'),
    ('DisputeEvent'),
    ('DisputeOutcome'),
    ('EvidenceHold')
  ) AS required(expected)
  WHERE to_regclass(format('wewed_contracts.%I', required.expected)) IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 4 tables: %', missing; END IF;

  SELECT count(*) INTO leaked
  FROM information_schema.role_table_grants
  WHERE table_schema='wewed_contracts'
    AND table_name IN ('PaymentMilestone','ManagedPaymentRecord','DisputeCase','DisputeIssue','DisputeEvent','DisputeOutcome','EvidenceHold')
    AND grantee IN ('PUBLIC','anon','authenticated');
  IF leaked <> 0 THEN RAISE EXCEPTION 'Client/browser roles have direct Phase 4 table grants: %', leaked; END IF;
END $$;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES
    ('PaymentMilestone_binding_guard'),
    ('PaymentMilestone_integrity_guard'),
    ('ManagedPaymentRecord_validation_guard'),
    ('ManagedPaymentRecord_append_only_guard'),
    ('DisputeCase_binding_guard'),
    ('DisputeCase_integrity_guard'),
    ('DisputeIssue_integrity_guard'),
    ('DisputeEvent_validation_guard'),
    ('DisputeEvent_append_only_guard'),
    ('DisputeOutcome_validation_guard'),
    ('DisputeOutcome_append_only_guard'),
    ('DisputeOutcome_case_status_guard'),
    ('EvidenceHold_validation_guard'),
    ('EvidenceHold_integrity_guard'),
    ('EvidenceHold_sync_vault_guard'),
    ('VaultObject_evidence_hold_guard')
  ) AS required(expected)
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=required.expected AND NOT tgisinternal);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 4 triggers: %', missing; END IF;
END $$;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES
    ('PaymentMilestone_service_engagement_wedding_idx'),
    ('PaymentMilestone_contract_wedding_idx'),
    ('PaymentMilestone_version_contract_idx'),
    ('ManagedPaymentRecord_service_engagement_wedding_idx'),
    ('ManagedPaymentRecord_milestone_idx'),
    ('ManagedPaymentRecord_proof_vault_wedding_idx'),
    ('ManagedPaymentRecord_reversesPaymentId_key'),
    ('DisputeCase_service_engagement_wedding_idx'),
    ('DisputeCase_contract_wedding_idx'),
    ('DisputeCase_version_contract_idx'),
    ('DisputeIssue_case_idx'),
    ('DisputeEvent_case_idx'),
    ('DisputeEvent_issue_idx'),
    ('DisputeEvent_actor_party_idx'),
    ('DisputeOutcome_case_idx'),
    ('DisputeOutcome_evidence_vault_wedding_idx'),
    ('EvidenceHold_vault_wedding_idx'),
    ('EvidenceHold_case_idx')
  ) AS required(expected)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='wewed_contracts' AND indexname=required.expected
  );
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 4 FK indexes: %', missing; END IF;
END $$;

BEGIN;

INSERT INTO public."Couple" ("id", "slug", "partner1", "partner2", "updatedAt")
VALUES ('phase4-couple-a', 'phase4-couple-a', 'Phase', 'Four', now()),
       ('phase4-couple-b', 'phase4-couple-b', 'Other', 'Wedding', now());

INSERT INTO public."Wedding" (
  "id", "slug", "title", "date", "venue", "venueCity", "venueCountry", "coupleId", "updatedAt"
) VALUES
  ('phase4-wedding-a', 'phase4-wedding-a', 'Phase 4 Wedding', now() + interval '90 days', 'Venue A', 'Harare', 'Zimbabwe', 'phase4-couple-a', now()),
  ('phase4-wedding-b', 'phase4-wedding-b', 'Other Wedding', now() + interval '120 days', 'Venue B', 'Bulawayo', 'Zimbabwe', 'phase4-couple-b', now());

INSERT INTO public."Vendor" ("id", "name", "category", "weddingId", "updatedAt")
VALUES ('phase4-vendor-a', 'Phase 4 Photography', 'Photography', 'phase4-wedding-a', now()),
       ('phase4-vendor-b', 'Other Vendor', 'Catering', 'phase4-wedding-b', now());

INSERT INTO public."ServiceEngagement" (
  "id", "origin", "recordMode", "lifecycleStatus", "serviceCategory", "serviceDescription",
  "agreedAmount", "currency", "weddingId", "vendorId", "createdById", "updatedAt"
) VALUES
  ('phase4-engagement-a', 'current', 'managed_contract', 'draft', 'Photography', 'Photography coverage', 1000.00, 'USD', 'phase4-wedding-a', 'phase4-vendor-a', 'phase4-actor', now()),
  ('phase4-engagement-b', 'current', 'managed_contract', 'draft', 'Catering', 'Other service', 900.00, 'USD', 'phase4-wedding-b', 'phase4-vendor-b', 'phase4-actor', now());

INSERT INTO public."BudgetItem" (
  "id", "category", "description", "estimatedCost", "actualCost", "paidAmount", "currency",
  "vendorId", "serviceEngagementId", "weddingId", "updatedAt"
) VALUES (
  'phase4-budget-a', 'photo_video', 'Photography', 1000, 1000, 250, 'USD',
  'phase4-vendor-a', 'phase4-engagement-a', 'phase4-wedding-a', now()
);

INSERT INTO public."VaultObject" (
  "id", "storageProvider", "objectKey", "originalFilename", "displayName", "mimeType", "extension",
  "byteSize", "checksumSha256", "uploadSource", "storageState", "scanState", "weddingId", "updatedAt"
) VALUES
  ('phase4-vault-proof', 'supabase', 'phase4/proof.pdf', 'proof.pdf', 'proof.pdf', 'application/pdf', 'pdf', 100, repeat('a',64), 'phase4_test', 'stored_private', 'content_validated', 'phase4-wedding-a', now()),
  ('phase4-vault-dispute', 'supabase', 'phase4/dispute.pdf', 'dispute.pdf', 'dispute.pdf', 'application/pdf', 'pdf', 100, repeat('b',64), 'phase4_test', 'stored_private', 'content_validated', 'phase4-wedding-a', now());

INSERT INTO public."EngagementParty" (
  "id", "serviceEngagementId", "weddingId", "partyRole", "partyKind", "displayName", "requiredForReview", "updatedAt"
) VALUES ('phase4-party-client', 'phase4-engagement-a', 'phase4-wedding-a', 'CLIENT', 'COUPLE', 'Phase & Four', true, now());

INSERT INTO wewed_contracts."PaymentMilestone" (
  "id", "serviceEngagementId", "weddingId", "milestoneType", "label", "amount", "currency", "dueAt", "createdById"
) VALUES ('phase4-milestone-a', 'phase4-engagement-a', 'phase4-wedding-a', 'DEPOSIT', 'Deposit', 250, 'USD', now() - interval '1 day', 'phase4-actor');

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_contracts."ManagedPaymentRecord" (
      "id", "serviceEngagementId", "weddingId", "milestoneId", "entryType", "amount", "currency", "paidAt",
      "proofRequired", "proofVaultObjectId", "recordedById", "recordNature", "wewedProcessorRole", "custodyStatus"
    ) VALUES (
      'phase4-payment-cross', 'phase4-engagement-b', 'phase4-wedding-b', 'phase4-milestone-a', 'PAYMENT', 250, 'USD', now(),
      true, NULL, 'phase4-actor', 'FACT_ONLY', 'NONE', 'NOT_HELD_BY_WEWED'
    );
    RAISE EXCEPTION 'Cross-engagement milestone payment unexpectedly succeeded';
  EXCEPTION
    WHEN foreign_key_violation OR check_violation THEN NULL;
    WHEN raise_exception THEN
      IF SQLERRM = 'Cross-engagement milestone payment unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_contracts."ManagedPaymentRecord" (
      "id", "serviceEngagementId", "weddingId", "entryType", "amount", "currency", "paidAt", "proofRequired",
      "proofWaiverReason", "recordedById", "recordNature", "wewedProcessorRole", "custodyStatus"
    ) VALUES ('phase4-payment-merchant-fiction', 'phase4-engagement-a', 'phase4-wedding-a', 'PAYMENT', 10, 'USD', now(), false,
      'test', 'phase4-actor', 'FACT_ONLY', 'PROCESSOR', 'HELD');
    RAISE EXCEPTION 'Wewed merchant/custody fiction unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

INSERT INTO wewed_contracts."ManagedPaymentRecord" (
  "id", "serviceEngagementId", "weddingId", "milestoneId", "entryType", "amount", "currency", "paidAt",
  "method", "reference", "source", "proofRequired", "proofVaultObjectId", "recordedById"
) VALUES (
  'phase4-payment-a', 'phase4-engagement-a', 'phase4-wedding-a', 'phase4-milestone-a', 'PAYMENT', 250, 'USD', now(),
  'BANK_TRANSFER', 'EXT-001', 'MANUAL_FACT', true, 'phase4-vault-proof', 'phase4-actor'
);

DO $$
DECLARE budget_paid numeric; acceptance_count bigint; effectivity_count bigint;
BEGIN
  SELECT "paidAmount" INTO budget_paid FROM public."BudgetItem" WHERE id='phase4-budget-a';
  IF budget_paid <> 250 THEN RAISE EXCEPTION 'Managed payment fact mutated BudgetItem'; END IF;

  SELECT count(*) INTO acceptance_count FROM wewed_contracts."ContractAcceptance";
  SELECT count(*) INTO effectivity_count FROM wewed_contracts."ContractVersionEffectivity";
  IF acceptance_count <> 0 OR effectivity_count <> 0 THEN
    RAISE EXCEPTION 'Recording a payment created contract acceptance/effectivity evidence';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_contracts."ManagedPaymentRecord" SET "reference"='tampered' WHERE id='phase4-payment-a';
    RAISE EXCEPTION 'Managed payment update unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Managed payment update unexpectedly succeeded' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM wewed_contracts."ManagedPaymentRecord" WHERE id='phase4-payment-a';
    RAISE EXCEPTION 'Managed payment delete unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Managed payment delete unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_contracts."ManagedPaymentRecord" (
  "id", "serviceEngagementId", "weddingId", "milestoneId", "entryType", "amount", "currency", "paidAt",
  "source", "proofRequired", "proofWaiverReason", "reversesPaymentId", "recordedById"
) VALUES (
  'phase4-payment-a-reversal', 'phase4-engagement-a', 'phase4-wedding-a', 'phase4-milestone-a', 'REVERSAL', 250, 'USD', now(),
  'CORRECTION_FACT', false, 'Governed correction', 'phase4-payment-a', 'phase4-actor'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_contracts."ManagedPaymentRecord" (
      "id", "serviceEngagementId", "weddingId", "milestoneId", "entryType", "amount", "currency", "paidAt",
      "source", "proofRequired", "proofWaiverReason", "reversesPaymentId", "recordedById"
    ) VALUES ('phase4-payment-second-reversal', 'phase4-engagement-a', 'phase4-wedding-a', 'phase4-milestone-a', 'REVERSAL', 250, 'USD', now(),
      'CORRECTION_FACT', false, 'Second correction', 'phase4-payment-a', 'phase4-actor');
    RAISE EXCEPTION 'Second reversal unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

INSERT INTO wewed_contracts."DisputeCase" (
  "id", "weddingId", "serviceEngagementId", "summary", "openedById"
) VALUES ('phase4-dispute-a', 'phase4-wedding-a', 'phase4-engagement-a', 'Client reports that delivery timing is disputed.', 'phase4-actor');

INSERT INTO wewed_contracts."DisputeIssue" (
  "id", "disputeCaseId", "clauseReference", "category", "allegationText", "createdById"
) VALUES ('phase4-issue-a', 'phase4-dispute-a', 'DELIVERY_TIMING', 'delivery_timing', 'The client alleges that delivery was later than agreed.', 'phase4-actor');

DO $$
BEGIN
  BEGIN
    UPDATE wewed_contracts."DisputeIssue" SET "findingStatus"='BREACH_CONFIRMED' WHERE id='phase4-issue-a';
    RAISE EXCEPTION 'Wewed dispute finding fiction unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
    WHEN raise_exception THEN
      IF SQLERRM = 'Wewed dispute finding fiction unexpectedly succeeded' THEN RAISE; END IF;
      IF SQLERRM <> 'Dispute allegation identity cannot be rewritten' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_contracts."DisputeEvent" (
  "id", "disputeCaseId", "issueId", "eventType", "source", "actorId", "actorPartyId", "note"
) VALUES ('phase4-event-a', 'phase4-dispute-a', 'phase4-issue-a', 'NOTICE_RECORDED', 'IN_APP_ACTOR', 'phase4-actor', 'phase4-party-client', 'Client notice recorded without adjudicating the allegation.');

DO $$
BEGIN
  BEGIN
    UPDATE wewed_contracts."DisputeEvent" SET "note"='tampered' WHERE id='phase4-event-a';
    RAISE EXCEPTION 'Dispute event update unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Dispute event update unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_contracts."EvidenceHold" (
  "id", "weddingId", "vaultObjectId", "disputeCaseId", "reason", "placedById"
) VALUES
  ('phase4-hold-a', 'phase4-wedding-a', 'phase4-vault-dispute', 'phase4-dispute-a', 'Preserve primary dispute evidence', 'phase4-actor'),
  ('phase4-hold-b', 'phase4-wedding-a', 'phase4-vault-dispute', 'phase4-dispute-a', 'Preserve secondary investigation hold', 'phase4-actor');

DO $$
DECLARE held boolean;
BEGIN
  SELECT "legalHold" INTO held FROM public."VaultObject" WHERE id='phase4-vault-dispute';
  IF held IS DISTINCT FROM true THEN RAISE EXCEPTION 'Active evidence hold did not set VaultObject legalHold'; END IF;
  BEGIN
    DELETE FROM public."VaultObject" WHERE id='phase4-vault-dispute';
    RAISE EXCEPTION 'Vault evidence under active hold was deleted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Vault evidence under active hold was deleted' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public."VaultObject" SET "checksumSha256"=repeat('c',64) WHERE id='phase4-vault-dispute';
    RAISE EXCEPTION 'Vault evidence under active hold was mutated';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Vault evidence under active hold was mutated' THEN RAISE; END IF;
  END;
END $$;

UPDATE wewed_contracts."EvidenceHold"
SET "status"='RELEASED', "releasedById"='phase4-actor', "releasedAt"=now(), "releaseReason"='First hold no longer required'
WHERE id='phase4-hold-a';

DO $$
DECLARE held boolean;
BEGIN
  SELECT "legalHold" INTO held FROM public."VaultObject" WHERE id='phase4-vault-dispute';
  IF held IS DISTINCT FROM true THEN RAISE EXCEPTION 'Releasing one of multiple holds incorrectly cleared legalHold'; END IF;
END $$;

UPDATE wewed_contracts."EvidenceHold"
SET "status"='RELEASED', "releasedById"='phase4-actor', "releasedAt"=now(), "releaseReason"='All preservation needs have ended'
WHERE id='phase4-hold-b';

DO $$
DECLARE held boolean; object_count bigint;
BEGIN
  SELECT "legalHold" INTO held FROM public."VaultObject" WHERE id='phase4-vault-dispute';
  IF held IS DISTINCT FROM false THEN RAISE EXCEPTION 'Releasing all holds did not clear legalHold'; END IF;
  SELECT count(*) INTO object_count FROM public."VaultObject" WHERE id='phase4-vault-dispute';
  IF object_count <> 1 THEN RAISE EXCEPTION 'Releasing evidence hold deleted Vault object'; END IF;
  BEGIN
    UPDATE wewed_contracts."EvidenceHold" SET "status"='ACTIVE', "releasedById"=NULL, "releasedAt"=NULL, "releaseReason"=NULL WHERE id='phase4-hold-a';
    RAISE EXCEPTION 'Released evidence hold reopened unexpectedly';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Released evidence hold reopened unexpectedly' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_contracts."DisputeOutcome" (
      "id", "disputeCaseId", "weddingId", "source", "outcomeSummary", "recordedById", "wewedAdjudicationRole"
    ) VALUES ('phase4-outcome-fiction', 'phase4-dispute-a', 'phase4-wedding-a', 'MUTUAL_SETTLEMENT', 'Parties settled.', 'phase4-actor', 'JUDGE');
    RAISE EXCEPTION 'Wewed adjudication role fiction unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

INSERT INTO wewed_contracts."DisputeOutcome" (
  "id", "disputeCaseId", "weddingId", "source", "outcomeSummary", "remedyType", "amount", "currency", "externalReference", "recordedById"
) VALUES (
  'phase4-outcome-a', 'phase4-dispute-a', 'phase4-wedding-a', 'MUTUAL_SETTLEMENT',
  'The parties mutually agreed to a service credit without a Wewed adjudication.', 'SERVICE_CREDIT', 50, 'USD', 'SETTLEMENT-001', 'phase4-actor'
);

DO $$
DECLARE case_status text;
BEGIN
  SELECT "status" INTO case_status FROM wewed_contracts."DisputeCase" WHERE id='phase4-dispute-a';
  IF case_status <> 'SETTLED' THEN RAISE EXCEPTION 'Mutual settlement did not finalize dispute case status'; END IF;
  BEGIN
    UPDATE wewed_contracts."DisputeOutcome" SET "outcomeSummary"='tampered' WHERE id='phase4-outcome-a';
    RAISE EXCEPTION 'Dispute outcome update unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Dispute outcome update unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

ROLLBACK;

\echo 'Phase 4 payments/evidence/disputes PostgreSQL integration: PASS'
