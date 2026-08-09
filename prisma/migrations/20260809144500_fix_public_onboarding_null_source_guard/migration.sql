-- Close the nullable sourceType edge case in the public onboarding completion guard.
--
-- sourceType is nullable for canonical/non-public BusinessAccount rows. PostgreSQL
-- evaluates NULL <> 'public_registration' as NULL, so the previous early-return
-- condition could fall through and incorrectly apply public-registration invariants
-- to a non-public account. IS DISTINCT FROM preserves the intended fail-closed
-- public-registration validation while safely excluding NULL/non-public sources.

CREATE OR REPLACE FUNCTION wewed_admin.validate_public_onboarding_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'wewed_admin', 'public', 'pg_temp'
AS $function$
DECLARE
  owner_email text;
  owner_role text;
  owner_active boolean;
  owner_couple_id text;
  auth_user_id text;
BEGIN
  IF NEW."sourceType" IS DISTINCT FROM 'public_registration'
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
END
$function$;
