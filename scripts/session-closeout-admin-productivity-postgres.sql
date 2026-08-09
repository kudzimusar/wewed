\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Durable work-item synchronization
-- ---------------------------------------------------------------------------

INSERT INTO public."User" (id,email,name,role,"isActive")
VALUES ('closeout-productivity-owner','closeout.owner@example.test','Closeout Owner','couple',TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO wewed_admin."BusinessAccount" (
  id,name,slug,type,status,"ownerUserId","onboardingStatus","subscriptionPlan","subscriptionStatus",metadata
) VALUES (
  'closeout-productivity-account','Closeout Productivity Account','closeout-productivity-account',
  'client','active','closeout-productivity-owner','not_started','free','free','{"e2e":true}'::jsonb
);

SELECT wewed_admin.sync_admin_operational_work_items();

DO $work_created$
DECLARE
  active_count integer;
BEGIN
  SELECT count(*) INTO active_count
  FROM wewed_admin."AdminWorkItem"
  WHERE "resourceType"='business_account'
    AND "resourceId"='closeout-productivity-account'
    AND category='onboarding'
    AND status IN ('open','in_progress','blocked');

  IF active_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one durable onboarding work item, found %', active_count;
  END IF;
END
$work_created$;

-- Repeated synchronization must be idempotent.
SELECT wewed_admin.sync_admin_operational_work_items();

DO $work_idempotent$
DECLARE
  total_count integer;
BEGIN
  SELECT count(*) INTO total_count
  FROM wewed_admin."AdminWorkItem"
  WHERE "resourceType"='business_account'
    AND "resourceId"='closeout-productivity-account'
    AND category='onboarding';

  IF total_count <> 1 THEN
    RAISE EXCEPTION 'Repeated sync duplicated onboarding work: % rows', total_count;
  END IF;
END
$work_idempotent$;

-- Canonical source resolution closes generated work.
UPDATE wewed_admin."BusinessAccount"
SET "onboardingStatus"='complete', "updatedAt"=CURRENT_TIMESTAMP
WHERE id='closeout-productivity-account';
SELECT wewed_admin.sync_admin_operational_work_items();

DO $work_resolved$
DECLARE
  work_status text;
BEGIN
  SELECT status INTO work_status
  FROM wewed_admin."AdminWorkItem"
  WHERE "resourceType"='business_account'
    AND "resourceId"='closeout-productivity-account'
    AND category='onboarding';

  IF work_status IS DISTINCT FROM 'resolved' THEN
    RAISE EXCEPTION 'Resolved source did not close durable work; status=%', work_status;
  END IF;
END
$work_resolved$;

-- A genuinely reappearing canonical condition reopens an automatically resolved item.
UPDATE wewed_admin."BusinessAccount"
SET "onboardingStatus"='not_started', "updatedAt"=CURRENT_TIMESTAMP
WHERE id='closeout-productivity-account';
SELECT wewed_admin.sync_admin_operational_work_items();

DO $work_reopened$
DECLARE
  work_status text;
BEGIN
  SELECT status INTO work_status
  FROM wewed_admin."AdminWorkItem"
  WHERE "resourceType"='business_account'
    AND "resourceId"='closeout-productivity-account'
    AND category='onboarding';

  IF work_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Reappearing source did not reopen generated work; status=%', work_status;
  END IF;
END
$work_reopened$;

-- Unowned marketplace-style accounts are intentionally not onboarding work.
INSERT INTO wewed_admin."BusinessAccount" (
  id,name,slug,type,status,"onboardingStatus","subscriptionPlan","subscriptionStatus",metadata
) VALUES (
  'closeout-unclaimed-provider','Closeout Unclaimed Provider','closeout-unclaimed-provider',
  'vendor','active','in_progress','free','free','{"e2e":true,"unclaimed":true}'::jsonb
);
SELECT wewed_admin.sync_admin_operational_work_items();

DO $no_false_onboarding$
BEGIN
  IF EXISTS (
    SELECT 1 FROM wewed_admin."AdminWorkItem"
    WHERE "resourceId"='closeout-unclaimed-provider' AND category='onboarding'
  ) THEN
    RAISE EXCEPTION 'Unowned marketplace provider incorrectly generated onboarding work';
  END IF;
END
$no_false_onboarding$;

-- Support work is persisted and resolves with the canonical support case.
INSERT INTO wewed_admin."SupportCase" (
  id,"businessAccountId",title,description,category,priority,status,"requesterEmail"
) VALUES (
  'closeout-support-case','closeout-productivity-account','Closeout support regression',
  'Verify durable support work synchronization.','general','high','open','closeout.owner@example.test'
);
SELECT wewed_admin.sync_admin_operational_work_items();

DO $support_open$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM wewed_admin."AdminWorkItem"
    WHERE "resourceType"='support_case'
      AND "resourceId"='closeout-support-case'
      AND category='support'
      AND status='open'
  ) THEN
    RAISE EXCEPTION 'Open SupportCase did not create durable support work';
  END IF;
END
$support_open$;

UPDATE wewed_admin."SupportCase"
SET status='resolved', "resolvedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
WHERE id='closeout-support-case';
SELECT wewed_admin.sync_admin_operational_work_items();

DO $support_resolved$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM wewed_admin."AdminWorkItem"
    WHERE "resourceId"='closeout-support-case'
      AND category='support'
      AND status='resolved'
  ) THEN
    RAISE EXCEPTION 'Resolved SupportCase did not resolve durable support work';
  END IF;
END
$support_resolved$;

-- ---------------------------------------------------------------------------
-- Immutable pricing history and version lineage
-- ---------------------------------------------------------------------------

INSERT INTO wewed_admin."BillingOffer" (
  "offerCode","offerFamilyCode","accountType",name,description,"billingModel","legacyPlan",
  currency,"monthlyCents","annualCents","departmentKeys",entitlements,"selfService",status,version
) VALUES (
  'closeout_pricing_offer','closeout_pricing_offer','client','Closeout Pricing Offer',
  'Regression offer for immutable commercial history.','subscription','professional','USD',
  1000,10000,'[]'::jsonb,'["closeout"]'::jsonb,TRUE,'active',1
);

DO $immutable_terms$
BEGIN
  BEGIN
    UPDATE wewed_admin."BillingOffer"
    SET "monthlyCents"=2000
    WHERE "offerCode"='closeout_pricing_offer';
    RAISE EXCEPTION 'Expected in-place BillingOffer commercial mutation to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$immutable_terms$;

-- Retirement is the only permitted historical-row state mutation.
UPDATE wewed_admin."BillingOffer"
SET status='retired', "updatedAt"=CURRENT_TIMESTAMP
WHERE "offerCode"='closeout_pricing_offer';

DO $retirement_allowed$
DECLARE
  offer_status text;
BEGIN
  SELECT status INTO offer_status
  FROM wewed_admin."BillingOffer"
  WHERE "offerCode"='closeout_pricing_offer';
  IF offer_status IS DISTINCT FROM 'retired' THEN
    RAISE EXCEPTION 'BillingOffer retirement failed';
  END IF;
END
$retirement_allowed$;

DO $reactivation_rejected$
BEGIN
  BEGIN
    UPDATE wewed_admin."BillingOffer"
    SET status='active', "updatedAt"=CURRENT_TIMESTAMP
    WHERE "offerCode"='closeout_pricing_offer';
    RAISE EXCEPTION 'Expected retired BillingOffer reactivation to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$reactivation_rejected$;

INSERT INTO wewed_admin."BillingOffer" (
  "offerCode","offerFamilyCode","supersedesOfferCode","accountType",name,description,
  "billingModel","legacyPlan",currency,"monthlyCents","annualCents","departmentKeys",
  entitlements,"selfService",status,version
) VALUES (
  'closeout_pricing_offer_v2','closeout_pricing_offer','closeout_pricing_offer','client',
  'Closeout Pricing Offer v2','Second immutable pricing version.','subscription','professional',
  'USD',1500,15000,'[]'::jsonb,'["closeout","v2"]'::jsonb,TRUE,'active',2
);

DO $family_version_unique$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."BillingOffer" (
      "offerCode","offerFamilyCode","supersedesOfferCode","accountType",name,description,
      "billingModel","legacyPlan",currency,"monthlyCents","annualCents","departmentKeys",
      entitlements,"selfService",status,version
    ) VALUES (
      'closeout_pricing_offer_duplicate','closeout_pricing_offer','closeout_pricing_offer','client',
      'Duplicate v2','Must fail family/version uniqueness.','subscription','professional','USD',
      1600,16000,'[]'::jsonb,'[]'::jsonb,TRUE,'active',2
    );
    RAISE EXCEPTION 'Expected duplicate BillingOffer family/version to fail';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$family_version_unique$;

DO $supersedes_fk$
BEGIN
  BEGIN
    INSERT INTO wewed_admin."BillingOffer" (
      "offerCode","offerFamilyCode","supersedesOfferCode","accountType",name,description,
      "billingModel","legacyPlan",currency,"monthlyCents","annualCents","departmentKeys",
      entitlements,"selfService",status,version
    ) VALUES (
      'closeout_invalid_supersedes','closeout_invalid_supersedes','missing-offer','client',
      'Invalid lineage','Must fail supersedes FK.','contract','enterprise','USD',NULL,NULL,
      '[]'::jsonb,'[]'::jsonb,FALSE,'active',1
    );
    RAISE EXCEPTION 'Expected invalid supersedesOfferCode to fail';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END
$supersedes_fk$;

-- Existing open-work uniqueness remains in place.
DO $work_index$
BEGIN
  IF to_regclass('wewed_admin."AdminWorkItem_resource_open_unique"') IS NULL THEN
    RAISE EXCEPTION 'AdminWorkItem open uniqueness index is missing';
  END IF;
END
$work_index$;

-- Internal helper functions must not be executable through PUBLIC or untrusted
-- Supabase roles.
DO $function_privileges$
DECLARE
  public_execute_count integer;
BEGIN
  SELECT count(*) INTO public_execute_count
  FROM pg_proc procedure
  CROSS JOIN LATERAL aclexplode(
    COALESCE(procedure.proacl, acldefault('f', procedure.proowner))
  ) acl
  WHERE procedure.oid IN (
    'wewed_admin.sync_admin_operational_work_items()'::regprocedure,
    'wewed_admin.protect_billing_offer_commercial_history()'::regprocedure
  )
    AND acl.grantee=0
    AND acl.privilege_type='EXECUTE';

  IF public_execute_count <> 0 THEN
    RAISE EXCEPTION 'Admin productivity helper functions expose PUBLIC EXECUTE';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    IF has_function_privilege('anon','wewed_admin.sync_admin_operational_work_items()','EXECUTE')
       OR has_function_privilege('anon','wewed_admin.protect_billing_offer_commercial_history()','EXECUTE') THEN
      RAISE EXCEPTION 'anon can execute Admin productivity helper functions';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    IF has_function_privilege('authenticated','wewed_admin.sync_admin_operational_work_items()','EXECUTE')
       OR has_function_privilege('authenticated','wewed_admin.protect_billing_offer_commercial_history()','EXECUTE') THEN
      RAISE EXCEPTION 'authenticated can execute Admin productivity helper functions';
    END IF;
  END IF;
END
$function_privileges$;

ROLLBACK;

\echo 'Session closeout Admin productivity PostgreSQL regression: PASS'
