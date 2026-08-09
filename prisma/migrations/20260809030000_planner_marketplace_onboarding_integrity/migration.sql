-- Planner marketplace onboarding integrity.
-- Every active, completely onboarded planning company must have a private draft
-- PlannerProfile. Public discovery remains published-only.

CREATE OR REPLACE FUNCTION wewed_admin.ensure_planner_profile_for_business()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, wewed_admin
AS $$
DECLARE
  profile_slug text;
  profile_id text;
BEGIN
  IF NEW.type = 'planning_company'
     AND NEW.status = 'active'
     AND NEW."onboardingStatus" = 'complete'
     AND NOT EXISTS (
       SELECT 1
       FROM wewed_admin."PlannerProfile" p
       WHERE p."businessAccountId" = NEW.id
     ) THEN
    profile_slug := NEW.slug;

    IF EXISTS (
      SELECT 1
      FROM wewed_admin."PlannerProfile" p
      WHERE p.slug = profile_slug
        AND p."businessAccountId" <> NEW.id
    ) THEN
      profile_slug := left(NEW.slug, 55) || '-' || substr(md5(NEW.id), 1, 8);
    END IF;

    profile_id := 'planner-profile-' || NEW.id;

    INSERT INTO wewed_admin."PlannerProfile" (
      id,
      "businessAccountId",
      slug,
      "displayName",
      status
    ) VALUES (
      profile_id,
      NEW.id,
      profile_slug,
      NEW.name,
      'draft'
    )
    ON CONFLICT ("businessAccountId") DO NOTHING;

    IF FOUND THEN
      INSERT INTO wewed_admin."BusinessAuditLog" (
        id,
        "actorUserId",
        "businessAccountId",
        action,
        "resourceType",
        "resourceId",
        details
      ) VALUES (
        'audit-' || md5('planner-profile-provisioned:' || NEW.id),
        NULL,
        NEW.id,
        'planner_profile.provisioned',
        'planner_profile',
        profile_id,
        jsonb_build_object(
          'source', 'planning_company_onboarding',
          'status', 'draft'
        )
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "BusinessAccount_planner_profile_provision" ON wewed_admin."BusinessAccount";
CREATE TRIGGER "BusinessAccount_planner_profile_provision"
AFTER INSERT OR UPDATE OF type, status, "onboardingStatus"
ON wewed_admin."BusinessAccount"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.ensure_planner_profile_for_business();

-- Backfill only the safe modern lifecycle: active + complete planning companies.
-- Legacy planner users without a planning-company BusinessAccount are deliberately
-- excluded because a business identity must not be fabricated from a user role.
WITH candidates AS (
  SELECT
    ba.id AS "businessAccountId",
    'planner-profile-' || ba.id AS "profileId",
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM wewed_admin."PlannerProfile" existing
        WHERE existing.slug = ba.slug
          AND existing."businessAccountId" <> ba.id
      )
      THEN left(ba.slug, 55) || '-' || substr(md5(ba.id), 1, 8)
      ELSE ba.slug
    END AS "profileSlug",
    ba.name AS "displayName"
  FROM wewed_admin."BusinessAccount" ba
  WHERE ba.type = 'planning_company'
    AND ba.status = 'active'
    AND ba."onboardingStatus" = 'complete'
    AND NOT EXISTS (
      SELECT 1
      FROM wewed_admin."PlannerProfile" p
      WHERE p."businessAccountId" = ba.id
    )
), inserted AS (
  INSERT INTO wewed_admin."PlannerProfile" (
    id,
    "businessAccountId",
    slug,
    "displayName",
    status
  )
  SELECT
    "profileId",
    "businessAccountId",
    "profileSlug",
    "displayName",
    'draft'
  FROM candidates
  ON CONFLICT ("businessAccountId") DO NOTHING
  RETURNING id, "businessAccountId"
)
INSERT INTO wewed_admin."BusinessAuditLog" (
  id,
  "actorUserId",
  "businessAccountId",
  action,
  "resourceType",
  "resourceId",
  details
)
SELECT
  'audit-' || md5('planner-profile-provisioned:' || inserted."businessAccountId"),
  NULL,
  inserted."businessAccountId",
  'planner_profile.provisioned',
  'planner_profile',
  inserted.id,
  jsonb_build_object(
    'source', 'planner_profile_integrity_backfill',
    'status', 'draft'
  )
FROM inserted
ON CONFLICT (id) DO NOTHING;
