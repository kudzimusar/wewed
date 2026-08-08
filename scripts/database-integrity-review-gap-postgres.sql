\set ON_ERROR_STOP on

BEGIN;

-- Executable Phase C review-closure contract for:
-- docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md

INSERT INTO wewed_admin."BusinessAccount" (
  id,name,slug,type,status,"sourceType","onboardingStatus","subscriptionPlan","subscriptionStatus",metadata
) VALUES
  ('e2e-review-vendor-a','Review Vendor A','review-vendor-a','vendor','active','provider_discovery','in_progress','free','free','{}'::jsonb),
  ('e2e-review-vendor-b','Review Vendor B','review-vendor-b','vendor','active','provider_discovery','in_progress','free','free','{}'::jsonb);

INSERT INTO wewed_admin."ProviderProfile" (
  id,"businessAccountId",slug,"displayName",visibility,"listingStatus","isClaimable","acceptingEnquiries"
) VALUES
  ('e2e-review-profile-a','e2e-review-vendor-a','review-provider-a','Review Provider A','published','unclaimed',true,false),
  ('e2e-review-profile-b','e2e-review-vendor-b','review-provider-b','Review Provider B','published','unclaimed',true,false);

INSERT INTO wewed_admin."ProviderDiscoveryCandidate" (
  id,"displayName","normalizedName","primaryCategory","dedupeKey",status,"importedBusinessAccountId"
) VALUES (
  'e2e-review-candidate','Review Provider A','review provider a','photography',
  'e2e-review-candidate-dedupe','imported','e2e-review-vendor-a'
);

UPDATE wewed_admin."BusinessAccount"
SET "sourceType"='marketplace_discovery', "sourceId"='e2e-review-candidate'
WHERE id='e2e-review-vendor-a';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

DO $reject_discovery_backlink_removal$
BEGIN
  BEGIN
    UPDATE wewed_admin."ProviderDiscoveryCandidate"
    SET "importedBusinessAccountId"=NULL
    WHERE id='e2e-review-candidate';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Expected imported candidate backlink removal to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected imported candidate backlink removal to be rejected' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
END
$reject_discovery_backlink_removal$;

INSERT INTO wewed_admin."ProviderClaimRequest" (
  id,"providerProfileId","businessAccountId","claimantName","claimantEmail",relationship,
  "verificationMethod","declarationAccepted",status
) VALUES (
  'e2e-review-claim','e2e-review-profile-a','e2e-review-vendor-a','Review Claimant',
  'review-claimant@wewed.test','Owner','manual_review',true,'pending'
);

DO $reject_profile_move_with_existing_claim$
BEGIN
  BEGIN
    UPDATE wewed_admin."ProviderProfile"
    SET "businessAccountId"='e2e-review-vendor-b'
    WHERE id='e2e-review-profile-a';
    RAISE EXCEPTION 'Expected ProviderProfile move with existing claim to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected ProviderProfile move with existing claim to be rejected' THEN RAISE; END IF;
  END;
END
$reject_profile_move_with_existing_claim$;

DO $assert_review_gap_state_preserved$
DECLARE
  current_backlink text;
  current_profile_account text;
BEGIN
  SELECT "importedBusinessAccountId" INTO current_backlink
  FROM wewed_admin."ProviderDiscoveryCandidate"
  WHERE id='e2e-review-candidate';
  IF current_backlink IS DISTINCT FROM 'e2e-review-vendor-a' THEN
    RAISE EXCEPTION 'Candidate backlink changed despite rejected unlink: %', current_backlink;
  END IF;

  SELECT "businessAccountId" INTO current_profile_account
  FROM wewed_admin."ProviderProfile"
  WHERE id='e2e-review-profile-a';
  IF current_profile_account IS DISTINCT FROM 'e2e-review-vendor-a' THEN
    RAISE EXCEPTION 'ProviderProfile account changed despite rejected move: %', current_profile_account;
  END IF;
END
$assert_review_gap_state_preserved$;

ROLLBACK;

SELECT 'Database integrity review-gap PostgreSQL contract: PASS' AS result;
