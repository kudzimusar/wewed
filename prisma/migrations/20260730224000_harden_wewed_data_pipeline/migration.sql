-- Wewed data-pipeline hardening.
-- Additive/constraint-only migration: no source wedding, couple, user, vendor, or billing rows are deleted.

-- The application reads and writes platform data through server-side APIs. Remove the
-- pre-existing PostgREST table bypass while keeping the service role/database owner intact.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  END IF;
END $$;

-- Prevent duplicate source mappings, Stripe events, and provider payment references.
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessAccount_source_unique"
  ON wewed_admin."BusinessAccount" ("sourceType", "sourceId")
  WHERE "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_provider_reference_unique"
  ON wewed_admin."PaymentRecord" (provider, "providerReference")
  WHERE "providerReference" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessAuditLog_stripe_event_unique"
  ON wewed_admin."BusinessAuditLog" ("resourceType", "resourceId")
  WHERE "resourceType" = 'StripeEvent' AND "resourceId" IS NOT NULL;

-- Constrain operational values at the data boundary. NOT VALID keeps the migration
-- deployable on legacy datasets; validation below proves current rows comply.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccount_type_check') THEN
    ALTER TABLE wewed_admin."BusinessAccount"
      ADD CONSTRAINT "BusinessAccount_type_check"
      CHECK (type IN ('wewed_internal','planning_company','couple','venue','vendor','client')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccount_status_check') THEN
    ALTER TABLE wewed_admin."BusinessAccount"
      ADD CONSTRAINT "BusinessAccount_status_check"
      CHECK (status IN ('pending_review','active','rejected','suspended','blocked','cancelled','archived')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccount_onboarding_check') THEN
    ALTER TABLE wewed_admin."BusinessAccount"
      ADD CONSTRAINT "BusinessAccount_onboarding_check"
      CHECK ("onboardingStatus" IN ('not_started','in_progress','complete','blocked')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccount_plan_check') THEN
    ALTER TABLE wewed_admin."BusinessAccount"
      ADD CONSTRAINT "BusinessAccount_plan_check"
      CHECK ("subscriptionPlan" IN ('free','starter','professional','enterprise','internal')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccount_subscription_status_check') THEN
    ALTER TABLE wewed_admin."BusinessAccount"
      ADD CONSTRAINT "BusinessAccount_subscription_status_check"
      CHECK ("subscriptionStatus" IN ('free','trialing','active','past_due','unpaid','incomplete','incomplete_expired','paused','cancelled')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccountMember_status_check') THEN
    ALTER TABLE wewed_admin."BusinessAccountMember"
      ADD CONSTRAINT "BusinessAccountMember_status_check"
      CHECK (status IN ('invited','active','suspended','revoked')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_provider_check') THEN
    ALTER TABLE wewed_admin."PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_provider_check"
      CHECK (provider IN ('manual','stripe')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_status_check') THEN
    ALTER TABLE wewed_admin."PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_status_check"
      CHECK (status IN ('paid','pending','due','failed','refunded')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_amount_check') THEN
    ALTER TABLE wewed_admin."PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_amount_check" CHECK ("amountCents" >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_currency_check') THEN
    ALTER TABLE wewed_admin."PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_currency_check"
      CHECK (currency ~ '^[A-Z]{3}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportCase_priority_check') THEN
    ALTER TABLE wewed_admin."SupportCase"
      ADD CONSTRAINT "SupportCase_priority_check"
      CHECK (priority IN ('low','normal','high','urgent')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportCase_status_check') THEN
    ALTER TABLE wewed_admin."SupportCase"
      ADD CONSTRAINT "SupportCase_status_check"
      CHECK (status IN ('open','in_progress','waiting','resolved','closed')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformIncident_status_check') THEN
    ALTER TABLE wewed_admin."PlatformIncident"
      ADD CONSTRAINT "PlatformIncident_status_check"
      CHECK (status IN ('investigating','identified','monitoring','resolved')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformIncident_severity_check') THEN
    ALTER TABLE wewed_admin."PlatformIncident"
      ADD CONSTRAINT "PlatformIncident_severity_check"
      CHECK (severity IN ('minor','major','critical')) NOT VALID;
  END IF;
END $$;

ALTER TABLE wewed_admin."BusinessAccount" VALIDATE CONSTRAINT "BusinessAccount_type_check";
ALTER TABLE wewed_admin."BusinessAccount" VALIDATE CONSTRAINT "BusinessAccount_status_check";
ALTER TABLE wewed_admin."BusinessAccount" VALIDATE CONSTRAINT "BusinessAccount_onboarding_check";
ALTER TABLE wewed_admin."BusinessAccount" VALIDATE CONSTRAINT "BusinessAccount_plan_check";
ALTER TABLE wewed_admin."BusinessAccount" VALIDATE CONSTRAINT "BusinessAccount_subscription_status_check";
ALTER TABLE wewed_admin."BusinessAccountMember" VALIDATE CONSTRAINT "BusinessAccountMember_status_check";
ALTER TABLE wewed_admin."PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_provider_check";
ALTER TABLE wewed_admin."PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_status_check";
ALTER TABLE wewed_admin."PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_amount_check";
ALTER TABLE wewed_admin."PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_currency_check";
ALTER TABLE wewed_admin."SupportCase" VALIDATE CONSTRAINT "SupportCase_priority_check";
ALTER TABLE wewed_admin."SupportCase" VALIDATE CONSTRAINT "SupportCase_status_check";
ALTER TABLE wewed_admin."PlatformIncident" VALIDATE CONSTRAINT "PlatformIncident_status_check";
ALTER TABLE wewed_admin."PlatformIncident" VALIDATE CONSTRAINT "PlatformIncident_severity_check";

-- Validate polymorphic links before they enter the governed account graph.
CREATE OR REPLACE FUNCTION wewed_admin.validate_business_account_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."entityType" = 'wedding' THEN
    IF NOT EXISTS (SELECT 1 FROM public."Wedding" WHERE id = NEW."entityId") THEN
      RAISE EXCEPTION 'Business account link references missing wedding %', NEW."entityId";
    END IF;
  ELSIF NEW."entityType" = 'couple' THEN
    IF NOT EXISTS (SELECT 1 FROM public."Couple" WHERE id = NEW."entityId") THEN
      RAISE EXCEPTION 'Business account link references missing couple %', NEW."entityId";
    END IF;
  ELSIF NEW."entityType" = 'vendor' THEN
    IF NOT EXISTS (SELECT 1 FROM public."Vendor" WHERE id = NEW."entityId") THEN
      RAISE EXCEPTION 'Business account link references missing vendor %', NEW."entityId";
    END IF;
  ELSIF NEW."entityType" = 'user' THEN
    IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = NEW."entityId") THEN
      RAISE EXCEPTION 'Business account link references missing user %', NEW."entityId";
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported business account entity type %', NEW."entityType";
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "BusinessAccountLink_validate" ON wewed_admin."BusinessAccountLink";
CREATE TRIGGER "BusinessAccountLink_validate"
BEFORE INSERT OR UPDATE OF "entityType", "entityId"
ON wewed_admin."BusinessAccountLink"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_business_account_link();

-- Owners must always be represented in the membership graph. The check is deferred so
-- registration can create the account and invited membership in one transaction.
CREATE OR REPLACE FUNCTION wewed_admin.validate_business_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_id text;
  owner_id text;
BEGIN
  account_id := CASE
    WHEN TG_TABLE_NAME = 'BusinessAccount' THEN COALESCE(NEW.id, OLD.id)
    ELSE COALESCE(NEW."businessAccountId", OLD."businessAccountId")
  END;

  SELECT "ownerUserId" INTO owner_id
  FROM wewed_admin."BusinessAccount"
  WHERE id = account_id;

  IF owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM wewed_admin."BusinessAccountMember"
    WHERE "businessAccountId" = account_id
      AND "userId" = owner_id
      AND status <> 'revoked'
  ) THEN
    RAISE EXCEPTION 'Business account % owner % has no governed membership', account_id, owner_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS "BusinessAccount_owner_membership" ON wewed_admin."BusinessAccount";
CREATE CONSTRAINT TRIGGER "BusinessAccount_owner_membership"
AFTER INSERT OR UPDATE OF "ownerUserId"
ON wewed_admin."BusinessAccount"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_business_owner_membership();

DROP TRIGGER IF EXISTS "BusinessAccountMember_owner_membership" ON wewed_admin."BusinessAccountMember";
CREATE CONSTRAINT TRIGGER "BusinessAccountMember_owner_membership"
AFTER INSERT OR UPDATE OR DELETE
ON wewed_admin."BusinessAccountMember"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_business_owner_membership();

-- Enforce the lifecycle matrix independently from the UI/API.
CREATE OR REPLACE FUNCTION wewed_admin.validate_business_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status
    WHEN 'pending_review' THEN NEW.status IN ('active','rejected')
    WHEN 'active' THEN NEW.status IN ('suspended','blocked','cancelled','archived')
    WHEN 'rejected' THEN NEW.status IN ('pending_review','archived')
    WHEN 'suspended' THEN NEW.status IN ('active','blocked','cancelled','archived')
    WHEN 'blocked' THEN NEW.status IN ('active','cancelled','archived')
    WHEN 'cancelled' THEN NEW.status IN ('active','archived')
    WHEN 'archived' THEN NEW.status IN ('pending_review','active')
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid business account transition from % to %', OLD.status, NEW.status;
  END IF;

  IF NEW."sourceType" = 'public_registration'
     AND OLD.status = 'pending_review'
     AND NEW.status = 'active'
     AND NEW."onboardingStatus" <> 'complete' THEN
    NEW."onboardingStatus" := 'in_progress';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "BusinessAccount_lifecycle_validate" ON wewed_admin."BusinessAccount";
CREATE TRIGGER "BusinessAccount_lifecycle_validate"
BEFORE UPDATE OF status ON wewed_admin."BusinessAccount"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_business_lifecycle();

-- Synchronize access state after lifecycle decisions. Existing wedding/user records are
-- preserved; access is removed through governed memberships rather than destructive deletes.
CREATE OR REPLACE FUNCTION wewed_admin.sync_business_lifecycle_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('rejected','suspended','blocked','cancelled','archived') THEN
    UPDATE wewed_admin."BusinessAccountMember"
    SET status = 'suspended', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "businessAccountId" = NEW.id AND status IN ('active','invited');

    IF NEW."sourceType" = 'public_registration' AND NEW."ownerUserId" IS NOT NULL THEN
      UPDATE public."User"
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = NEW."ownerUserId";
    END IF;
  ELSIF NEW.status = 'pending_review' AND NEW."sourceType" = 'public_registration' THEN
    UPDATE wewed_admin."BusinessAccountMember"
    SET status = 'invited', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "businessAccountId" = NEW.id AND "userId" = NEW."ownerUserId";
    UPDATE public."User"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW."ownerUserId";
  ELSIF NEW.status = 'active' THEN
    IF NEW."onboardingStatus" = 'complete' THEN
      UPDATE wewed_admin."BusinessAccountMember"
      SET status = 'active', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "businessAccountId" = NEW.id AND status <> 'revoked';
    ELSIF NEW."sourceType" = 'public_registration' THEN
      UPDATE wewed_admin."BusinessAccountMember"
      SET status = 'invited', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "businessAccountId" = NEW.id AND "userId" = NEW."ownerUserId";
      UPDATE public."User"
      SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = NEW."ownerUserId";
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "BusinessAccount_lifecycle_access" ON wewed_admin."BusinessAccount";
CREATE TRIGGER "BusinessAccount_lifecycle_access"
AFTER UPDATE OF status ON wewed_admin."BusinessAccount"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.sync_business_lifecycle_access();

-- A public application cannot be marked complete until every identity and stakeholder
-- relationship required by the current dashboard model exists and is active.
CREATE OR REPLACE FUNCTION wewed_admin.validate_public_onboarding_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_email text;
  owner_role text;
  owner_active boolean;
  owner_couple_id text;
  auth_user_id text;
BEGIN
  IF NEW."sourceType" <> 'public_registration'
     OR NEW."onboardingStatus" <> 'complete'
     OR OLD."onboardingStatus" = 'complete' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'active' OR NEW."ownerUserId" IS NULL THEN
    RAISE EXCEPTION 'Public onboarding requires an active account and owner';
  END IF;

  IF NEW.type NOT IN ('couple','planning_company') THEN
    RAISE EXCEPTION 'No supported dashboard role exists for % onboarding', NEW.type;
  END IF;

  SELECT email, role, "isActive", "coupleId"
    INTO owner_email, owner_role, owner_active, owner_couple_id
  FROM public."User" WHERE id = NEW."ownerUserId";

  IF owner_email IS NULL OR owner_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Public onboarding owner identity is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wewed_admin."BusinessAccountMember"
    WHERE "businessAccountId" = NEW.id
      AND "userId" = NEW."ownerUserId"
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Public onboarding requires an active business membership';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccountLink" bal
    JOIN public."WeddingMembership" wm
      ON wm."weddingId" = bal."entityId"
     AND wm."userId" = NEW."ownerUserId"
     AND wm.status = 'active'
    WHERE bal."businessAccountId" = NEW.id
      AND bal."entityType" = 'wedding'
  ) THEN
    RAISE EXCEPTION 'Public onboarding requires a linked wedding and active wedding membership';
  END IF;

  auth_user_id := NEW.metadata->>'authUserId';
  IF auth_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public."UserProfile"
    WHERE id = auth_user_id AND lower(email) = lower(owner_email)
  ) THEN
    RAISE EXCEPTION 'Public onboarding authentication profile is not synchronized';
  END IF;

  IF NEW.type = 'couple' THEN
    IF owner_role <> 'couple' OR owner_couple_id IS NULL THEN
      RAISE EXCEPTION 'Couple onboarding owner role/couple relationship is incomplete';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM wewed_admin."BusinessAccountLink" couple_link
      JOIN wewed_admin."BusinessAccountLink" wedding_link
        ON wedding_link."businessAccountId" = couple_link."businessAccountId"
       AND wedding_link."entityType" = 'wedding'
      JOIN public."Wedding" w
        ON w.id = wedding_link."entityId"
       AND w."coupleId" = couple_link."entityId"
      WHERE couple_link."businessAccountId" = NEW.id
        AND couple_link."entityType" = 'couple'
        AND couple_link."entityId" = owner_couple_id
    ) THEN
      RAISE EXCEPTION 'Couple onboarding links do not form a consistent couple/wedding graph';
    END IF;
  ELSIF owner_role <> 'planner' THEN
    RAISE EXCEPTION 'Planning-company onboarding owner must have planner dashboard role';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "BusinessAccount_public_onboarding_validate" ON wewed_admin."BusinessAccount";
CREATE TRIGGER "BusinessAccount_public_onboarding_validate"
BEFORE UPDATE OF "onboardingStatus" ON wewed_admin."BusinessAccount"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_public_onboarding_completion();

-- Serialize demotion/revocation of Super Admin memberships so concurrent requests cannot
-- remove the final active platform owner.
CREATE OR REPLACE FUNCTION wewed_admin.protect_final_super_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  remaining integer;
  internal_account boolean;
BEGIN
  IF OLD.role <> 'wewed_super_admin' OR OLD.status <> 'active' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.role = 'wewed_super_admin' AND NEW.status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM wewed_admin."BusinessAccount"
    WHERE id = OLD."businessAccountId" AND type = 'wewed_internal'
  ) INTO internal_account;

  IF NOT internal_account THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('wewed-final-super-admin', 0));
  SELECT COUNT(*) INTO remaining
  FROM wewed_admin."BusinessAccountMember" bam
  JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
  WHERE ba.type = 'wewed_internal'
    AND bam.role = 'wewed_super_admin'
    AND bam.status = 'active'
    AND bam.id <> OLD.id;

  IF remaining < 1 THEN
    RAISE EXCEPTION 'At least one active Wewed Super Admin must remain';
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS "BusinessAccountMember_final_super_admin" ON wewed_admin."BusinessAccountMember";
CREATE TRIGGER "BusinessAccountMember_final_super_admin"
BEFORE UPDATE OF role, status OR DELETE
ON wewed_admin."BusinessAccountMember"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.protect_final_super_admin();
