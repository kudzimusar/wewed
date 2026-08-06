-- Prevent any application path or direct database mutation from removing the
-- final usable Super Admin identity. A transaction-scoped advisory lock
-- serializes concurrent demotion, suspension, revocation, and deactivation.

CREATE OR REPLACE FUNCTION wewed_admin.protect_last_super_admin_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  was_internal_super BOOLEAN := FALSE;
  remaining_active_supers INTEGER := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccount" ba
    WHERE ba.id = OLD."businessAccountId"
      AND ba.type = 'wewed_internal'
  )
  INTO was_internal_super;

  IF NOT was_internal_super
     OR OLD.role <> 'wewed_super_admin'
     OR OLD.status <> 'active' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW."businessAccountId" = OLD."businessAccountId"
     AND NEW.role = 'wewed_super_admin'
     AND NEW.status = 'active' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('wewed:last-active-super-admin'));

  SELECT COUNT(*)::int
  INTO remaining_active_supers
  FROM wewed_admin."BusinessAccountMember" bam
  JOIN wewed_admin."BusinessAccount" ba
    ON ba.id = bam."businessAccountId"
  JOIN public."User" u ON u.id = bam."userId"
  WHERE bam.id <> OLD.id
    AND ba.type = 'wewed_internal'
    AND bam.role = 'wewed_super_admin'
    AND bam.status = 'active'
    AND u."isActive" = TRUE;

  IF remaining_active_supers = 0 THEN
    RAISE EXCEPTION 'The last active Super Admin cannot be demoted, suspended, revoked, moved, or deleted.'
      USING ERRCODE = '23514';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS protect_last_super_admin_membership
  ON wewed_admin."BusinessAccountMember";
CREATE TRIGGER protect_last_super_admin_membership
BEFORE UPDATE OR DELETE
ON wewed_admin."BusinessAccountMember"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.protect_last_super_admin_membership();

CREATE OR REPLACE FUNCTION wewed_admin.protect_last_super_admin_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  is_active_super BOOLEAN := FALSE;
  remaining_active_supers INTEGER := 0;
BEGIN
  IF NOT OLD."isActive" THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."isActive" THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccountMember" bam
    JOIN wewed_admin."BusinessAccount" ba
      ON ba.id = bam."businessAccountId"
    WHERE bam."userId" = OLD.id
      AND ba.type = 'wewed_internal'
      AND bam.role = 'wewed_super_admin'
      AND bam.status = 'active'
  )
  INTO is_active_super;

  IF NOT is_active_super THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('wewed:last-active-super-admin'));

  SELECT COUNT(*)::int
  INTO remaining_active_supers
  FROM wewed_admin."BusinessAccountMember" bam
  JOIN wewed_admin."BusinessAccount" ba
    ON ba.id = bam."businessAccountId"
  JOIN public."User" u ON u.id = bam."userId"
  WHERE bam."userId" <> OLD.id
    AND ba.type = 'wewed_internal'
    AND bam.role = 'wewed_super_admin'
    AND bam.status = 'active'
    AND u."isActive" = TRUE;

  IF remaining_active_supers = 0 THEN
    RAISE EXCEPTION 'The final active Super Admin identity cannot be deactivated or deleted.'
      USING ERRCODE = '23514';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS protect_last_super_admin_identity
  ON public."User";
CREATE TRIGGER protect_last_super_admin_identity
BEFORE UPDATE OF "isActive" OR DELETE
ON public."User"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.protect_last_super_admin_identity();

REVOKE ALL PRIVILEGES ON FUNCTION
  wewed_admin.protect_last_super_admin_membership()
FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION
  wewed_admin.protect_last_super_admin_identity()
FROM PUBLIC;

DO $revoke_super_guard_functions$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.protect_last_super_admin_membership() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.protect_last_super_admin_identity() FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END;
$revoke_super_guard_functions$;
