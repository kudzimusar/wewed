-- Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 7 — fixes a defect discovered by
-- this phase's own disposable-database qualification, distinct from carry-forward finding F-4.
--
-- wewed_admin.validate_public_onboarding_completion() (BEFORE UPDATE OF "onboardingStatus" ON
-- wewed_admin."BusinessAccount") unconditionally requires an active, linked wedding before it will
-- let ANY public-registration account reach onboardingStatus = 'complete':
--
--   IF NOT EXISTS (
--     SELECT 1 FROM wewed_admin."BusinessAccountLink" bal
--     JOIN public."WeddingMembership" wm ON wm."weddingId" = bal."entityId" AND wm."userId" = NEW."ownerUserId" AND wm.status = 'active'
--     WHERE bal."businessAccountId" = NEW.id AND bal."entityType" = 'wedding'
--   ) THEN RAISE EXCEPTION 'Public onboarding requires a linked wedding and active wedding membership'; END IF;
--
-- This check runs BEFORE the function's own type-specific branch (couple vs planning_company), so
-- it also applies to a Planning company with zero weddings — a state master plan Phase 2 (and this
-- phase's item 7) explicitly requires to remain a legitimate, completable account: "Planner/
-- planning company can exist with zero weddings... Do not create a placeholder wedding merely to
-- finish onboarding." As written, no zero-wedding planning-company application can ever be marked
-- complete: /api/admin/onboarding's own zero-wedding branch (which never creates a wedding by
-- design) is unconditionally rejected by this trigger with "Public onboarding requires a linked
-- wedding and active wedding membership", reproduced against a disposable database migrated with
-- this repository's own migration chain.
--
-- The wedding-link requirement remains mandatory for `type = 'couple'` (unchanged: a Couple
-- account without a wedding was never a valid completion, and the couple-specific graph-consistency
-- check further down in this function already re-verifies the same link). For
-- `type = 'planning_company'`, the check now only applies when a wedding link actually exists for
-- this business (the one-wedding admin-completion case) — Couple accounts are unaffected because
-- their branch already fails the unconditional couple-graph check with no possible wedding link.
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
  has_wedding_link boolean;
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

  has_wedding_link := EXISTS (
    SELECT 1 FROM wewed_admin."BusinessAccountLink"
    WHERE "businessAccountId" = NEW.id AND "entityType" = 'wedding'
  );

  -- A Couple account always requires its wedding link; a Planning company only requires it when
  -- one is actually being attached (a zero-wedding planning portfolio has none, by design — §7).
  IF (NEW.type = 'couple' OR has_wedding_link) AND NOT EXISTS (
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
