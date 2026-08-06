-- Separate privileged platform administration from customer and partner membership.
-- These tables remain in the private wewed_admin schema and are accessed only
-- by server-side database connections.

CREATE SCHEMA IF NOT EXISTS wewed_admin;

CREATE TABLE IF NOT EXISTS wewed_admin."PlatformAdministrator" (
  "userId" TEXT NOT NULL,
  "legacyMembershipId" TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  "statusReason" TEXT,
  "invitedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdministrator_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PlatformAdministrator_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformAdministrator_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlatformAdministrator_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlatformAdministrator_role_check"
    CHECK (role IN (
      'wewed_super_admin',
      'wewed_operations_admin',
      'wewed_billing_admin',
      'wewed_support_admin',
      'wewed_analyst'
    )),
  CONSTRAINT "PlatformAdministrator_status_check"
    CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  CONSTRAINT "PlatformAdministrator_version_check" CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdministrator_legacyMembershipId_key"
  ON wewed_admin."PlatformAdministrator"("legacyMembershipId")
  WHERE "legacyMembershipId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PlatformAdministrator_role_status_idx"
  ON wewed_admin."PlatformAdministrator"(role, status);

CREATE TABLE IF NOT EXISTS wewed_admin."PlatformAdministratorScope" (
  id TEXT NOT NULL,
  "administratorUserId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeValue" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdministratorScope_pkey" PRIMARY KEY (id),
  CONSTRAINT "PlatformAdministratorScope_administratorUserId_fkey"
    FOREIGN KEY ("administratorUserId")
    REFERENCES wewed_admin."PlatformAdministrator"("userId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformAdministratorScope_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlatformAdministratorScope_type_check"
    CHECK ("scopeType" IN ('global', 'account_type', 'business_account')),
  CONSTRAINT "PlatformAdministratorScope_value_check"
    CHECK (
      ("scopeType" = 'global' AND "scopeValue" = '*') OR
      ("scopeType" = 'account_type' AND "scopeValue" IN (
        'planning_company', 'couple', 'venue', 'vendor', 'client'
      )) OR
      ("scopeType" = 'business_account' AND length("scopeValue") > 0)
    ),
  CONSTRAINT "PlatformAdministratorScope_unique"
    UNIQUE ("administratorUserId", "scopeType", "scopeValue")
);

CREATE INDEX IF NOT EXISTS "PlatformAdministratorScope_lookup_idx"
  ON wewed_admin."PlatformAdministratorScope"(
    "administratorUserId", "scopeType", "scopeValue"
  );

CREATE OR REPLACE FUNCTION wewed_admin.ensure_platform_admin_default_scopes(
  target_user_id TEXT,
  target_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
BEGIN
  IF target_role = 'wewed_super_admin' THEN
    DELETE FROM wewed_admin."PlatformAdministratorScope"
    WHERE "administratorUserId" = target_user_id
      AND NOT ("scopeType" = 'global' AND "scopeValue" = '*');

    INSERT INTO wewed_admin."PlatformAdministratorScope" (
      id, "administratorUserId", "scopeType", "scopeValue"
    ) VALUES (
      'platform-scope-' || gen_random_uuid()::text,
      target_user_id,
      'global',
      '*'
    )
    ON CONFLICT ("administratorUserId", "scopeType", "scopeValue")
    DO NOTHING;
  ELSE
    DELETE FROM wewed_admin."PlatformAdministratorScope"
    WHERE "administratorUserId" = target_user_id
      AND "scopeType" = 'global';

    IF NOT EXISTS (
      SELECT 1
      FROM wewed_admin."PlatformAdministratorScope"
      WHERE "administratorUserId" = target_user_id
    ) THEN
      INSERT INTO wewed_admin."PlatformAdministratorScope" (
        id, "administratorUserId", "scopeType", "scopeValue"
      )
      SELECT
        'platform-scope-' || gen_random_uuid()::text,
        target_user_id,
        'account_type',
        account_type
      FROM unnest(ARRAY[
        'planning_company', 'couple', 'venue', 'vendor', 'client'
      ]::TEXT[]) AS account_type
      ON CONFLICT ("administratorUserId", "scopeType", "scopeValue")
      DO NOTHING;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION wewed_admin.sync_platform_admin_from_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  internal_account BOOLEAN := FALSE;
  normalized_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT ba.type = 'wewed_internal'
      INTO internal_account
    FROM wewed_admin."BusinessAccount" ba
    WHERE ba.id = OLD."businessAccountId";

    IF internal_account THEN
      UPDATE wewed_admin."PlatformAdministrator"
      SET status = 'revoked',
          "statusReason" = COALESCE("statusReason", 'Legacy platform membership removed.'),
          "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
          version = version + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = OLD."userId";
    END IF;
    RETURN OLD;
  END IF;

  SELECT ba.type = 'wewed_internal'
    INTO internal_account
  FROM wewed_admin."BusinessAccount" ba
  WHERE ba.id = NEW."businessAccountId";

  IF NOT COALESCE(internal_account, FALSE)
     OR NEW.role NOT IN (
       'wewed_super_admin',
       'wewed_operations_admin',
       'wewed_billing_admin',
       'wewed_support_admin',
       'wewed_analyst'
     ) THEN
    RETURN NEW;
  END IF;

  normalized_status := CASE
    WHEN NEW.status IN ('invited', 'active', 'suspended', 'revoked')
      THEN NEW.status
    ELSE 'revoked'
  END;

  INSERT INTO wewed_admin."PlatformAdministrator" (
    "userId",
    "legacyMembershipId",
    role,
    status,
    "invitedAt",
    "activatedAt",
    "suspendedAt",
    "revokedAt"
  ) VALUES (
    NEW."userId",
    NEW.id,
    NEW.role,
    normalized_status,
    CASE WHEN normalized_status = 'invited' THEN COALESCE(NEW."createdAt", CURRENT_TIMESTAMP) END,
    CASE WHEN normalized_status = 'active' THEN CURRENT_TIMESTAMP END,
    CASE WHEN normalized_status = 'suspended' THEN CURRENT_TIMESTAMP END,
    CASE WHEN normalized_status = 'revoked' THEN CURRENT_TIMESTAMP END
  )
  ON CONFLICT ("userId") DO UPDATE SET
    "legacyMembershipId" = EXCLUDED."legacyMembershipId",
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    "invitedAt" = CASE
      WHEN EXCLUDED.status = 'invited'
        THEN COALESCE(wewed_admin."PlatformAdministrator"."invitedAt", CURRENT_TIMESTAMP)
      ELSE wewed_admin."PlatformAdministrator"."invitedAt"
    END,
    "activatedAt" = CASE
      WHEN EXCLUDED.status = 'active'
        THEN COALESCE(wewed_admin."PlatformAdministrator"."activatedAt", CURRENT_TIMESTAMP)
      ELSE wewed_admin."PlatformAdministrator"."activatedAt"
    END,
    "suspendedAt" = CASE
      WHEN EXCLUDED.status = 'suspended' THEN CURRENT_TIMESTAMP
      WHEN EXCLUDED.status = 'active' THEN NULL
      ELSE wewed_admin."PlatformAdministrator"."suspendedAt"
    END,
    "revokedAt" = CASE
      WHEN EXCLUDED.status = 'revoked' THEN CURRENT_TIMESTAMP
      ELSE wewed_admin."PlatformAdministrator"."revokedAt"
    END,
    version = wewed_admin."PlatformAdministrator".version + 1,
    "updatedAt" = CURRENT_TIMESTAMP;

  PERFORM wewed_admin.ensure_platform_admin_default_scopes(
    NEW."userId",
    NEW.role
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_platform_admin_membership
  ON wewed_admin."BusinessAccountMember";
CREATE TRIGGER sync_platform_admin_membership
AFTER INSERT OR UPDATE OF role, status OR DELETE
ON wewed_admin."BusinessAccountMember"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.sync_platform_admin_from_membership();

-- Idempotent backfill from the legacy internal account membership model.
INSERT INTO wewed_admin."PlatformAdministrator" (
  "userId",
  "legacyMembershipId",
  role,
  status,
  "invitedAt",
  "activatedAt",
  "suspendedAt",
  "revokedAt"
)
SELECT
  bam."userId",
  bam.id,
  bam.role,
  bam.status,
  CASE WHEN bam.status = 'invited' THEN bam."createdAt" END,
  CASE WHEN bam.status = 'active' THEN COALESCE(bam."updatedAt", CURRENT_TIMESTAMP) END,
  CASE WHEN bam.status = 'suspended' THEN COALESCE(bam."updatedAt", CURRENT_TIMESTAMP) END,
  CASE WHEN bam.status = 'revoked' THEN COALESCE(bam."updatedAt", CURRENT_TIMESTAMP) END
FROM wewed_admin."BusinessAccountMember" bam
JOIN wewed_admin."BusinessAccount" ba
  ON ba.id = bam."businessAccountId"
WHERE ba.type = 'wewed_internal'
  AND bam.role IN (
    'wewed_super_admin',
    'wewed_operations_admin',
    'wewed_billing_admin',
    'wewed_support_admin',
    'wewed_analyst'
  )
ON CONFLICT ("userId") DO UPDATE SET
  "legacyMembershipId" = EXCLUDED."legacyMembershipId",
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  "updatedAt" = CURRENT_TIMESTAMP;

DO $backfill_scopes$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT "userId", role
    FROM wewed_admin."PlatformAdministrator"
  LOOP
    PERFORM wewed_admin.ensure_platform_admin_default_scopes(
      admin_record."userId",
      admin_record.role
    );
  END LOOP;
END;
$backfill_scopes$;

REVOKE ALL PRIVILEGES ON TABLE
  wewed_admin."PlatformAdministrator",
  wewed_admin."PlatformAdministratorScope"
FROM PUBLIC;

DO $revoke_client_roles$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'PlatformAdministrator',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'PlatformAdministratorScope',
        role_name
      );
    END IF;
  END LOOP;
END;
$revoke_client_roles$;
