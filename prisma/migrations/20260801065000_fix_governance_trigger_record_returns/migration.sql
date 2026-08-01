-- PostgreSQL trigger records are PL/pgSQL pseudo-records, not SQL columns.
-- Using COALESCE(NEW, OLD) causes PostgreSQL to resolve NEW as a column and
-- fail deferred registration transactions with: column "new" does not exist.

CREATE OR REPLACE FUNCTION wewed_admin.validate_business_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_id text;
  owner_id text;
BEGIN
  IF TG_TABLE_NAME = 'BusinessAccount' THEN
    IF TG_OP = 'DELETE' THEN
      account_id := OLD.id;
    ELSE
      account_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      account_id := OLD."businessAccountId";
    ELSE
      account_id := NEW."businessAccountId";
    END IF;
  END IF;

  SELECT "ownerUserId" INTO owner_id
  FROM wewed_admin."BusinessAccount"
  WHERE id = account_id;

  IF owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccountMember"
    WHERE "businessAccountId" = account_id
      AND "userId" = owner_id
      AND status <> 'revoked'
  ) THEN
    RAISE EXCEPTION 'Business account % owner % has no governed membership', account_id, owner_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION wewed_admin.protect_final_super_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  remaining integer;
  internal_account boolean;
BEGIN
  IF OLD.role <> 'wewed_super_admin' OR OLD.status <> 'active' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'DELETE'
     AND NEW.role = 'wewed_super_admin'
     AND NEW.status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccount"
    WHERE id = OLD."businessAccountId"
      AND type = 'wewed_internal'
  ) INTO internal_account;

  IF NOT internal_account THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('wewed-final-super-admin', 0));

  SELECT COUNT(*) INTO remaining
  FROM wewed_admin."BusinessAccountMember" bam
  JOIN wewed_admin."BusinessAccount" ba
    ON ba.id = bam."businessAccountId"
  WHERE ba.type = 'wewed_internal'
    AND bam.role = 'wewed_super_admin'
    AND bam.status = 'active'
    AND bam.id <> OLD.id;

  IF remaining < 1 THEN
    RAISE EXCEPTION 'At least one active Wewed Super Admin must remain';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
