\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public."User"
  (id, email, name, role, "isActive", "createdAt", "updatedAt")
VALUES
  ('ci-registration-trigger-user', 'ci.registration.trigger@example.invalid', 'CI Registration Trigger', 'viewer', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO public."UserProfile"
  (id, email, "displayName", role, "createdAt", "updatedAt")
VALUES
  ('ci-registration-trigger-auth', 'ci.registration.trigger@example.invalid', 'CI Registration Trigger', 'viewer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO public."BusinessAccount"
  (id, name, slug, type, status, "ownerUserId", "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", notes, metadata)
VALUES
  ('ci-registration-trigger-account', 'CI Registration Trigger', 'ci-registration-trigger-account', 'couple', 'pending_review',
   'ci-registration-trigger-user', 'public_registration', 'ci-registration-trigger-auth', 'not_started', 'starter', 'free',
   'Rollback-only registration trigger integration',
   '{"authUserId":"ci-registration-trigger-auth","requestedRole":"couple_owner","requestedPlan":"starter"}'::jsonb);

INSERT INTO public."BusinessAccountMember"
  (id, "businessAccountId", "userId", role, status, permissions)
VALUES
  ('ci-registration-trigger-member', 'ci-registration-trigger-account', 'ci-registration-trigger-user', 'couple_owner', 'invited', '[]'::jsonb);

INSERT INTO public."BusinessAuditLog"
  (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
VALUES
  ('ci-registration-trigger-audit', NULL, 'ci-registration-trigger-account',
   'business_account.public_application_submitted', 'BusinessAccount', 'ci-registration-trigger-account',
   '{"integration":true}'::jsonb);

-- Force the deferred owner-membership trigger at the same boundary that failed in Preview.
SET CONSTRAINTS ALL IMMEDIATE;

DO $$
DECLARE
  user_count integer;
  profile_count integer;
  account_count integer;
  member_count integer;
  audit_count integer;
  active_super_admins integer;
  target_super_admin text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public."User" WHERE id = 'ci-registration-trigger-user';
  SELECT COUNT(*) INTO profile_count FROM public."UserProfile" WHERE id = 'ci-registration-trigger-auth';
  SELECT COUNT(*) INTO account_count FROM public."BusinessAccount" WHERE id = 'ci-registration-trigger-account';
  SELECT COUNT(*) INTO member_count FROM public."BusinessAccountMember" WHERE id = 'ci-registration-trigger-member';
  SELECT COUNT(*) INTO audit_count FROM public."BusinessAuditLog" WHERE id = 'ci-registration-trigger-audit';

  IF user_count <> 1 OR profile_count <> 1 OR account_count <> 1 OR member_count <> 1 OR audit_count <> 1 THEN
    RAISE EXCEPTION 'Registration graph incomplete: user %, profile %, account %, member %, audit %',
      user_count, profile_count, account_count, member_count, audit_count;
  END IF;

  -- Ordinary membership updates must not fail by resolving NEW as a SQL column.
  UPDATE wewed_admin."BusinessAccountMember"
  SET permissions = permissions || '["ci.permission"]'::jsonb
  WHERE id = 'ci-registration-trigger-member';

  SELECT COUNT(*), MIN(bam.id)
    INTO active_super_admins, target_super_admin
  FROM wewed_admin."BusinessAccountMember" bam
  JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
  WHERE ba.type = 'wewed_internal'
    AND bam.role = 'wewed_super_admin'
    AND bam.status = 'active';

  IF active_super_admins <> 1 OR target_super_admin IS NULL THEN
    RAISE EXCEPTION 'Clean database must contain exactly one active Wewed Super Admin, found %', active_super_admins;
  END IF;

  BEGIN
    UPDATE wewed_admin."BusinessAccountMember"
    SET status = 'suspended'
    WHERE id = target_super_admin;

    RAISE EXCEPTION 'Expected final Super Admin protection to reject the update';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'Expected final Super Admin protection to reject the update' THEN
        RAISE;
      END IF;
      IF SQLERRM NOT LIKE 'At least one active Wewed Super Admin must remain%' THEN
        RAISE;
      END IF;
  END;
END $$;

ROLLBACK;

SELECT
  (SELECT COUNT(*) FROM public."User" WHERE id = 'ci-registration-trigger-user') AS retained_users,
  (SELECT COUNT(*) FROM public."BusinessAccount" WHERE id = 'ci-registration-trigger-account') AS retained_accounts;
