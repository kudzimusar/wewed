-- Session Closeout — Admin Productivity and Production Completion Plan
-- Stage 2 database foundation.
--
-- This migration is additive. It reuses AdminWorkItem and BillingOffer rather than
-- creating parallel queue/commercial tables. Existing BusinessAccountBillingProfile
-- assignments remain untouched and therefore retain their historical offerCode.

CREATE SCHEMA IF NOT EXISTS wewed_admin;

-- ---------------------------------------------------------------------------
-- 1. Billing offer family/version lineage
-- ---------------------------------------------------------------------------

ALTER TABLE wewed_admin."BillingOffer"
  ADD COLUMN IF NOT EXISTS "offerFamilyCode" TEXT;

UPDATE wewed_admin."BillingOffer"
SET "offerFamilyCode" = "offerCode"
WHERE "offerFamilyCode" IS NULL;

ALTER TABLE wewed_admin."BillingOffer"
  ALTER COLUMN "offerFamilyCode" SET NOT NULL;

ALTER TABLE wewed_admin."BillingOffer"
  ADD COLUMN IF NOT EXISTS "supersedesOfferCode" TEXT;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BillingOffer_supersedesOfferCode_fkey'
      AND conrelid = 'wewed_admin."BillingOffer"'::regclass
  ) THEN
    ALTER TABLE wewed_admin."BillingOffer"
      ADD CONSTRAINT "BillingOffer_supersedesOfferCode_fkey"
      FOREIGN KEY ("supersedesOfferCode")
      REFERENCES wewed_admin."BillingOffer"("offerCode")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS "BillingOffer_family_type_version_unique"
  ON wewed_admin."BillingOffer"("offerFamilyCode", "accountType", version);

CREATE INDEX IF NOT EXISTS "BillingOffer_family_status_idx"
  ON wewed_admin."BillingOffer"("offerFamilyCode", "accountType", status, version DESC);

CREATE OR REPLACE FUNCTION wewed_admin.protect_billing_offer_commercial_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
BEGIN
  -- Published offer rows are historical commercial facts. New terms must be a
  -- new row/version. The only permitted mutation is active -> retired (plus
  -- updatedAt), so existing account assignments keep the original terms.
  IF ROW(
      OLD."offerCode",
      OLD."accountType",
      OLD.name,
      OLD.description,
      OLD."billingModel",
      OLD."legacyPlan",
      OLD.currency,
      OLD."monthlyCents",
      OLD."annualCents",
      OLD."departmentKeys",
      OLD.entitlements,
      OLD."selfService",
      OLD.version,
      OLD."offerFamilyCode",
      OLD."supersedesOfferCode"
    ) IS DISTINCT FROM ROW(
      NEW."offerCode",
      NEW."accountType",
      NEW.name,
      NEW.description,
      NEW."billingModel",
      NEW."legacyPlan",
      NEW.currency,
      NEW."monthlyCents",
      NEW."annualCents",
      NEW."departmentKeys",
      NEW.entitlements,
      NEW."selfService",
      NEW.version,
      NEW."offerFamilyCode",
      NEW."supersedesOfferCode"
    ) THEN
    RAISE EXCEPTION 'Published BillingOffer commercial terms are immutable; create a new offer version.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'retired' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Retired BillingOffer versions cannot be reactivated; create a new version.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'retired') THEN
    RAISE EXCEPTION 'BillingOffer status may only remain active or transition to retired.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_billing_offer_commercial_history
  ON wewed_admin."BillingOffer";
CREATE TRIGGER protect_billing_offer_commercial_history
BEFORE UPDATE
ON wewed_admin."BillingOffer"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.protect_billing_offer_commercial_history();

-- ---------------------------------------------------------------------------
-- 2. Durable/idempotent operational work synchronization
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION wewed_admin.sync_admin_operational_work_items()
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = wewed_admin, public, pg_temp
AS $function$
DECLARE
  reopened_count INTEGER := 0;
  created_count INTEGER := 0;
  resolved_count INTEGER := 0;
  active_count INTEGER := 0;
BEGIN
  DROP TABLE IF EXISTS pg_temp.wewed_desired_admin_work;

  CREATE TEMP TABLE wewed_desired_admin_work (
    id TEXT PRIMARY KEY,
    "businessAccountId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    "departmentKey" TEXT,
    source TEXT NOT NULL,
    "sourceCreatedAt" TIMESTAMP(3) NOT NULL
  ) ON COMMIT DROP;

  -- Account lifecycle review.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-account-review-' || ba.id,
    ba.id,
    'business_account',
    ba.id,
    'account_review',
    'high',
    'Review ' || ba.name,
    replace(ba.type, '_', ' ') || ' account is awaiting a lifecycle decision.',
    'operations',
    'account',
    ba."updatedAt"
  FROM wewed_admin."BusinessAccount" ba
  WHERE ba.type <> 'wewed_internal'
    AND ba.status = 'pending_review';

  -- Onboarding work is intentionally restricted to owned accounts. Imported,
  -- unclaimed marketplace listings may legitimately be not_started/in_progress
  -- and must not create thousands of false operational tasks.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-onboarding-' || ba.id,
    ba.id,
    'business_account',
    ba.id,
    'onboarding',
    'normal',
    'Complete onboarding: ' || ba.name,
    'Onboarding is ' || replace(ba."onboardingStatus", '_', ' ') || '.',
    'operations',
    'onboarding',
    ba."updatedAt"
  FROM wewed_admin."BusinessAccount" ba
  WHERE ba.type <> 'wewed_internal'
    AND ba."ownerUserId" IS NOT NULL
    AND ba."onboardingStatus" <> 'complete';

  -- Billing attention.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-billing-' || profile."businessAccountId",
    profile."businessAccountId",
    'business_account',
    profile."businessAccountId",
    'billing_attention',
    'high',
    'Billing attention: ' || ba.name,
    'Billing status is ' || replace(profile.status, '_', ' ') || '.',
    'billing_finance',
    'billing',
    profile."updatedAt"
  FROM wewed_admin."BusinessAccountBillingProfile" profile
  JOIN wewed_admin."BusinessAccount" ba ON ba.id = profile."businessAccountId"
  WHERE profile.status IN ('past_due','unpaid','incomplete_expired');

  -- Support cases.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-support-' || support.id,
    support."businessAccountId",
    'support_case',
    support.id,
    'support',
    CASE
      WHEN support.priority = 'critical' THEN 'critical'
      WHEN support.priority = 'high' THEN 'high'
      ELSE 'normal'
    END,
    support.title,
    COALESCE(NULLIF(left(support.description, 500), ''), 'Support case requires attention.'),
    'customer_support',
    'support',
    support."createdAt"
  FROM wewed_admin."SupportCase" support
  WHERE support.status NOT IN ('resolved','closed');

  -- Provider claim review.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-provider-claim-' || claim.id,
    claim."businessAccountId",
    'provider_claim',
    claim.id,
    'provider_claim',
    'high',
    'Provider claim: ' || ba.name,
    claim."claimantName" || ' submitted a ' || replace(claim.status, '_', ' ') || ' claim.',
    'marketplace',
    'provider_claim',
    claim."createdAt"
  FROM wewed_admin."ProviderClaimRequest" claim
  JOIN wewed_admin."BusinessAccount" ba ON ba.id = claim."businessAccountId"
  WHERE claim.status IN ('pending','under_review','verification_required');

  -- Provider verification work exists only when a verification row exists.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-provider-verification-' || verification.id,
    verification."businessAccountId",
    'provider_verification',
    verification.id,
    'provider_verification',
    'normal',
    'Verify ' || ba.name,
    'Identity ' || verification."identityStatus" || '; business ' || verification."businessStatus" ||
      '; insurance ' || verification."insuranceStatus" || '; permit ' || verification."permitStatus" || '.',
    'compliance',
    'provider_verification',
    verification."updatedAt"
  FROM wewed_admin."ProviderVerification" verification
  JOIN wewed_admin."BusinessAccount" ba ON ba.id = verification."businessAccountId"
  WHERE COALESCE(verification."identityStatus", 'pending') NOT IN ('verified','approved')
     OR COALESCE(verification."businessStatus", 'pending') NOT IN ('verified','approved')
     OR COALESCE(verification."insuranceStatus", 'pending') NOT IN ('verified','approved','not_required','not_applicable')
     OR COALESCE(verification."permitStatus", 'pending') NOT IN ('verified','approved','not_required','not_applicable');

  -- Planner/account relationship mismatch.
  INSERT INTO wewed_desired_admin_work
    (id,"businessAccountId","resourceType","resourceId",category,priority,title,summary,"departmentKey",source,"sourceCreatedAt")
  SELECT
    'system-planner-relationship-' || engagement.id,
    engagement."coupleBusinessAccountId",
    'planner_engagement',
    engagement.id,
    'planner_relationship',
    'high',
    'Planner relationship mismatch',
    'Active planner engagement is missing the corresponding active wedding membership.',
    'operations',
    'planner_relationship',
    engagement."updatedAt"
  FROM wewed_admin."PlannerEngagement" engagement
  WHERE engagement.status IN ('planner_accepted','active','paused')
    AND engagement."plannerUserId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public."WeddingMembership" membership
      WHERE membership."weddingId" = engagement."weddingId"
        AND membership."userId" = engagement."plannerUserId"
        AND membership.status = 'active'
    );

  -- Refresh active generated items and reopen items that were automatically
  -- resolved when the canonical condition has genuinely reappeared. A dismissed
  -- item remains dismissed until a human intentionally changes it.
  UPDATE wewed_admin."AdminWorkItem" item
  SET "businessAccountId" = desired."businessAccountId",
      priority = desired.priority,
      title = desired.title,
      summary = desired.summary,
      "departmentKey" = desired."departmentKey",
      status = CASE WHEN item.status = 'resolved' THEN 'open' ELSE item.status END,
      "resolvedAt" = CASE WHEN item.status = 'resolved' THEN NULL ELSE item."resolvedAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
  FROM wewed_desired_admin_work desired
  WHERE item.source = desired.source
    AND item."resourceType" = desired."resourceType"
    AND item."resourceId" = desired."resourceId"
    AND item.category = desired.category
    AND item.status <> 'dismissed';

  GET DIAGNOSTICS reopened_count = ROW_COUNT;

  INSERT INTO wewed_admin."AdminWorkItem" (
    id,"businessAccountId","resourceType","resourceId",category,priority,status,
    title,summary,"departmentKey",source,"createdAt","updatedAt"
  )
  SELECT
    desired.id,
    desired."businessAccountId",
    desired."resourceType",
    desired."resourceId",
    desired.category,
    desired.priority,
    'open',
    desired.title,
    desired.summary,
    desired."departmentKey",
    desired.source,
    desired."sourceCreatedAt",
    CURRENT_TIMESTAMP
  FROM wewed_desired_admin_work desired
  WHERE NOT EXISTS (
    SELECT 1
    FROM wewed_admin."AdminWorkItem" item
    WHERE item.source = desired.source
      AND item."resourceType" = desired."resourceType"
      AND item."resourceId" = desired."resourceId"
      AND item.category = desired.category
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS created_count = ROW_COUNT;

  -- Automatically resolve only system-generated active items whose canonical
  -- condition no longer exists. Manual items and human-dismissed items are kept.
  UPDATE wewed_admin."AdminWorkItem" item
  SET status = 'resolved',
      "resolvedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE item.source <> 'manual'
    AND item.status IN ('open','in_progress','blocked')
    AND NOT EXISTS (
      SELECT 1
      FROM wewed_desired_admin_work desired
      WHERE desired.source = item.source
        AND desired."resourceType" = item."resourceType"
        AND desired."resourceId" = item."resourceId"
        AND desired.category = item.category
    );

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  SELECT count(*)::int
  INTO active_count
  FROM wewed_admin."AdminWorkItem"
  WHERE status IN ('open','in_progress','blocked');

  RETURN jsonb_build_object(
    'created', created_count,
    'refreshed_or_reopened', reopened_count,
    'resolved', resolved_count,
    'active', active_count
  );
END;
$function$;

-- Internal database helpers are server-only, not public application RPCs.
REVOKE ALL ON FUNCTION wewed_admin.protect_billing_offer_commercial_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_admin.sync_admin_operational_work_items() FROM PUBLIC;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION wewed_admin.protect_billing_offer_commercial_history() FROM anon;
    REVOKE ALL ON FUNCTION wewed_admin.sync_admin_operational_work_items() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION wewed_admin.protect_billing_offer_commercial_history() FROM authenticated;
    REVOKE ALL ON FUNCTION wewed_admin.sync_admin_operational_work_items() FROM authenticated;
  END IF;
END
$roles$;
