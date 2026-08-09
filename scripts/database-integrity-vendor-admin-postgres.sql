\set ON_ERROR_STOP on

BEGIN;

-- Executable contract for:
-- docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md

INSERT INTO public."User" (id,email,name,"updatedAt") VALUES
  ('e2e-integrity-owner','integrity-owner@wewed.test','Integrity Owner',CURRENT_TIMESTAMP),
  ('e2e-integrity-other','integrity-other@wewed.test','Integrity Other',CURRENT_TIMESTAMP);

INSERT INTO wewed_admin."BusinessAccount" (
  id,name,slug,type,status,"onboardingStatus","subscriptionPlan","subscriptionStatus",metadata
) VALUES
  ('e2e-integrity-vendor-a','Integrity Vendor A','integrity-vendor-a','vendor','active','in_progress','free','free','{}'::jsonb),
  ('e2e-integrity-vendor-b','Integrity Vendor B','integrity-vendor-b','vendor','active','in_progress','free','free','{}'::jsonb),
  ('e2e-integrity-venue','Integrity Venue','integrity-venue','venue','active','in_progress','free','free','{}'::jsonb),
  ('e2e-integrity-couple','Integrity Couple','integrity-couple','couple','active','in_progress','free','free','{}'::jsonb);

-- Valid provider resources on both supported account populations.
INSERT INTO wewed_admin."ProviderProfile" (
  id,"businessAccountId",slug,"displayName",visibility,"listingStatus","isClaimable","acceptingEnquiries"
) VALUES
  ('e2e-integrity-profile-a','e2e-integrity-vendor-a','integrity-provider-a','Integrity Provider A','published','unclaimed',true,false),
  ('e2e-integrity-profile-b','e2e-integrity-vendor-b','integrity-provider-b','Integrity Provider B','published','unclaimed',true,false),
  ('e2e-integrity-profile-venue','e2e-integrity-venue','integrity-provider-venue','Integrity Provider Venue','published','unclaimed',true,false);

INSERT INTO wewed_admin."ProviderServiceOffering" (
  id,"businessAccountId",category,"displayName",status,currency
) VALUES
  ('e2e-integrity-offering-a','e2e-integrity-vendor-a','photography','Integrity Photography','published','USD'),
  ('e2e-integrity-offering-venue','e2e-integrity-venue','venue','Integrity Venue Service','published','USD');

INSERT INTO wewed_admin."ProviderVerification" (id,"businessAccountId")
VALUES ('e2e-integrity-verification-a','e2e-integrity-vendor-a');

DO $reject_provider_profile_on_couple$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."ProviderProfile" (id,"businessAccountId",slug,"displayName")
    VALUES ('e2e-integrity-bad-profile','e2e-integrity-couple','integrity-bad-profile','Bad Profile');
    RAISE EXCEPTION 'Expected ProviderProfile on couple account to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected ProviderProfile on couple account to be rejected' THEN RAISE; END IF;
  END;
END
$reject_provider_profile_on_couple$;

DO $reject_provider_offering_on_couple$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."ProviderServiceOffering" (id,"businessAccountId",category,"displayName",status,currency)
    VALUES ('e2e-integrity-bad-offering','e2e-integrity-couple','photography','Bad Offering','published','USD');
    RAISE EXCEPTION 'Expected ProviderServiceOffering on couple account to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected ProviderServiceOffering on couple account to be rejected' THEN RAISE; END IF;
  END;
END
$reject_provider_offering_on_couple$;

DO $reject_provider_verification_on_couple$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."ProviderVerification" (id,"businessAccountId")
    VALUES ('e2e-integrity-bad-verification','e2e-integrity-couple');
    RAISE EXCEPTION 'Expected ProviderVerification on couple account to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected ProviderVerification on couple account to be rejected' THEN RAISE; END IF;
  END;
END
$reject_provider_verification_on_couple$;

DO $reject_parent_type_change$
BEGIN
  BEGIN
    UPDATE wewed_admin."BusinessAccount" SET type='client' WHERE id='e2e-integrity-vendor-a';
    RAISE EXCEPTION 'Expected provider-backed BusinessAccount type change to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected provider-backed BusinessAccount type change to be rejected' THEN RAISE; END IF;
  END;
END
$reject_parent_type_change$;

-- Valid candidate-backed provenance: create neutral account/profile first, then link both sides.
INSERT INTO wewed_admin."BusinessAccount" (
  id,name,slug,type,status,"sourceType","onboardingStatus","subscriptionPlan","subscriptionStatus",metadata
) VALUES (
  'e2e-integrity-discovered-account','Integrity Discovered Provider','integrity-discovered-provider','vendor','active',
  'provider_discovery','in_progress','free','free','{}'::jsonb
);
INSERT INTO wewed_admin."ProviderProfile" (
  id,"businessAccountId",slug,"displayName",visibility,"listingStatus","isClaimable","acceptingEnquiries"
) VALUES (
  'e2e-integrity-discovered-profile','e2e-integrity-discovered-account','integrity-discovered-profile','Integrity Discovered Provider',
  'published','unclaimed',true,false
);
INSERT INTO wewed_admin."ProviderDiscoveryCandidate" (
  id,"displayName","normalizedName","primaryCategory","dedupeKey",status,"importedBusinessAccountId"
) VALUES (
  'e2e-integrity-candidate','Integrity Discovered Provider','integrity discovered provider','photography',
  'e2e-integrity-dedupe','imported','e2e-integrity-discovered-account'
);
UPDATE wewed_admin."BusinessAccount"
SET "sourceType"='marketplace_discovery', "sourceId"='e2e-integrity-candidate'
WHERE id='e2e-integrity-discovered-account';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

DO $reject_candidate_backlink_reuse$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."ProviderDiscoveryCandidate" (
      id,"displayName","normalizedName","primaryCategory","dedupeKey",status,"importedBusinessAccountId"
    ) VALUES (
      'e2e-integrity-candidate-duplicate','Duplicate Candidate','duplicate candidate','photography',
      'e2e-integrity-dedupe-duplicate','imported','e2e-integrity-discovered-account'
    );
    RAISE EXCEPTION 'Expected duplicate importedBusinessAccountId backlink to be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$reject_candidate_backlink_reuse$;

DO $reject_candidate_source_mismatch$
BEGIN
  BEGIN
    UPDATE wewed_admin."BusinessAccount"
    SET "sourceType"='marketplace_discovery', "sourceId"='e2e-integrity-candidate'
    WHERE id='e2e-integrity-vendor-b';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Expected candidate source/backlink mismatch to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected candidate source/backlink mismatch to be rejected' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
END
$reject_candidate_source_mismatch$;

-- Claim profile/account redundancy must agree.
DO $reject_claim_profile_account_mismatch$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."ProviderClaimRequest" (
      id,"providerProfileId","businessAccountId","claimantName","claimantEmail",relationship,
      "verificationMethod","declarationAccepted",status
    ) VALUES (
      'e2e-integrity-bad-claim','e2e-integrity-profile-a','e2e-integrity-vendor-b','Integrity Owner',
      'integrity-owner@wewed.test','Owner','manual_review',true,'pending'
    );
    RAISE EXCEPTION 'Expected claim profile/account mismatch to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected claim profile/account mismatch to be rejected' THEN RAISE; END IF;
  END;
END
$reject_claim_profile_account_mismatch$;

INSERT INTO wewed_admin."ProviderClaimRequest" (
  id,"providerProfileId","businessAccountId","claimantName","claimantEmail",relationship,
  "verificationMethod","declarationAccepted",status
) VALUES (
  'e2e-integrity-claim','e2e-integrity-profile-a','e2e-integrity-vendor-a','Integrity Owner',
  'integrity-owner@wewed.test','Owner','manual_review',true,'pending'
);

DO $reject_duplicate_open_claim$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."ProviderClaimRequest" (
      id,"providerProfileId","businessAccountId","claimantName","claimantEmail",relationship,
      "verificationMethod","declarationAccepted",status
    ) VALUES (
      'e2e-integrity-claim-duplicate','e2e-integrity-profile-a','e2e-integrity-vendor-a','Integrity Owner',
      'INTEGRITY-OWNER@WEWED.TEST','Owner','manual_review',true,'verification_required'
    );
    RAISE EXCEPTION 'Expected duplicate open claim by same email/profile to be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$reject_duplicate_open_claim$;

-- Prepare the same authority state the application establishes before marking the claim approved.
INSERT INTO wewed_admin."BusinessAccountMember" (
  id,"businessAccountId","userId",role,status,permissions
) VALUES (
  'e2e-integrity-owner-member','e2e-integrity-vendor-a','e2e-integrity-owner','business_owner','active','[]'::jsonb
);
UPDATE wewed_admin."BusinessAccount"
SET "ownerUserId"='e2e-integrity-owner'
WHERE id='e2e-integrity-vendor-a';
UPDATE wewed_admin."ProviderProfile"
SET "listingStatus"='claimed', "isClaimable"=false
WHERE id='e2e-integrity-profile-a';
UPDATE wewed_admin."ProviderClaimRequest"
SET "claimantUserId"='e2e-integrity-owner', status='approved', "approvedAt"=CURRENT_TIMESTAMP
WHERE id='e2e-integrity-claim';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

DO $assert_core_relationships$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM wewed_admin."ProviderClaimRequest" c
  JOIN wewed_admin."ProviderProfile" p ON p.id=c."providerProfileId"
  WHERE c."businessAccountId" IS DISTINCT FROM p."businessAccountId";
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'Claim/profile account mismatch remains: %', mismatch_count;
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM wewed_admin."BusinessAccount" b
  LEFT JOIN wewed_admin."ProviderDiscoveryCandidate" c ON c.id=b."sourceId"
  WHERE b."sourceType" IN ('marketplace_discovery','provider_discovery_candidate','discovery')
    AND (c.id IS NULL OR c.status <> 'imported' OR c."importedBusinessAccountId" IS DISTINCT FROM b.id);
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'Candidate-backed BusinessAccount mismatch remains: %', mismatch_count;
  END IF;
END
$assert_core_relationships$;

DO $assert_trigger_function_privileges$
DECLARE
  fn regprocedure;
  role_name text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'wewed_admin.validate_provider_business_account_link()'::regprocedure,
    'wewed_admin.protect_provider_business_account_type()'::regprocedure,
    'wewed_admin.validate_candidate_backed_business_account_link()'::regprocedure,
    'wewed_admin.validate_discovery_candidate_import_link()'::regprocedure,
    'wewed_admin.validate_provider_claim_approval()'::regprocedure
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p,
      LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
      WHERE p.oid = fn::oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'Trigger helper % exposes PUBLIC EXECUTE', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'Trigger helper % exposes % EXECUTE', fn, role_name;
      END IF;
    END LOOP;
  END LOOP;
END
$assert_trigger_function_privileges$;

COMMIT;

SELECT 'Database integrity vendor/Admin PostgreSQL contract: PASS' AS result;
