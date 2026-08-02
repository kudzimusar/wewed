-- Tighten couple-user shortlist scope and engagement relationship integrity.

ALTER TABLE wewed_admin."PlannerShortlist"
  DROP CONSTRAINT IF EXISTS "PlannerShortlist_wedding_profile_key";

ALTER TABLE wewed_admin."PlannerShortlist"
  ADD CONSTRAINT "PlannerShortlist_wedding_profile_user_key"
  UNIQUE ("weddingId", "plannerProfileId", "createdByUserId");

ALTER TABLE wewed_admin."PlannerEngagement"
  DROP CONSTRAINT IF EXISTS "PlannerEngagement_membershipId_fkey";

ALTER TABLE wewed_admin."PlannerEngagement"
  ADD CONSTRAINT "PlannerEngagement_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES public."WeddingMembership"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wewed_admin.validate_planner_engagement_graph()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, wewed_admin
AS $$
DECLARE
  enquiry_wedding text;
  enquiry_couple_account text;
  enquiry_planner_account text;
BEGIN
  SELECT "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId"
    INTO enquiry_wedding, enquiry_couple_account, enquiry_planner_account
  FROM wewed_admin."PlannerEnquiry"
  WHERE id = NEW."enquiryId";

  IF enquiry_wedding IS DISTINCT FROM NEW."weddingId"
     OR enquiry_couple_account IS DISTINCT FROM NEW."coupleBusinessAccountId"
     OR enquiry_planner_account IS DISTINCT FROM NEW."plannerBusinessAccountId" THEN
    RAISE EXCEPTION 'Planner engagement must match its enquiry stakeholder graph.';
  END IF;

  IF NEW."plannerUserId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM wewed_admin."BusinessAccountMember" bam
    JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
    WHERE bam."businessAccountId" = NEW."plannerBusinessAccountId"
      AND bam."userId" = NEW."plannerUserId"
      AND bam.status = 'active'
      AND ba.type = 'planning_company'
      AND ba.status = 'active'
      AND ba."onboardingStatus" = 'complete'
  ) THEN
    RAISE EXCEPTION 'Engagement planner user must be an active member of the planning business.';
  END IF;

  IF NEW."membershipId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public."WeddingMembership" wm
    WHERE wm.id = NEW."membershipId"
      AND wm."weddingId" = NEW."weddingId"
      AND wm."userId" = NEW."plannerUserId"
  ) THEN
    RAISE EXCEPTION 'Engagement membership must match its planner and wedding.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "PlannerEngagement_graph_guard"
  ON wewed_admin."PlannerEngagement";

CREATE TRIGGER "PlannerEngagement_graph_guard"
BEFORE INSERT OR UPDATE OF
  "enquiryId", "weddingId", "coupleBusinessAccountId",
  "plannerBusinessAccountId", "plannerUserId", "membershipId"
ON wewed_admin."PlannerEngagement"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_planner_engagement_graph();
