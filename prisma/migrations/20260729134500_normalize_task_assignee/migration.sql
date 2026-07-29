-- Keep the original free-text PlannerTask.assignee as display/domain data.
-- Team-member assignment is stored independently in assigneeUserId.
ALTER TABLE "PlannerTask"
  ADD COLUMN "assigneeUserId" TEXT;

CREATE INDEX "PlannerTask_assigneeUserId_idx"
  ON "PlannerTask"("assigneeUserId");

ALTER TABLE "PlannerTask"
  ADD CONSTRAINT "PlannerTask_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill only from the authoritative Phase 3 assignment sidecar.
-- Do not infer users from free-text names such as Couple, Coordinator, or Family.
DO $$
DECLARE
  assignment_row RECORD;
  assignment_data JSONB;
  assigned_user_id TEXT;
BEGIN
  FOR assignment_row IN
    SELECT DISTINCT ON (revision."weddingId", revision."fieldKey")
      revision."weddingId",
      revision."fieldKey" AS task_id,
      revision."value"
    FROM "ContentRevision" revision
    WHERE revision."section" = 'planner_task_assignment'
      AND revision."status" = 'active'
    ORDER BY revision."weddingId", revision."fieldKey", revision."updatedAt" DESC
  LOOP
    BEGIN
      assignment_data := assignment_row."value"::JSONB;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    assigned_user_id := NULLIF(trim(assignment_data->>'assigneeUserId'), '');
    IF assigned_user_id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "User" user_record
      JOIN "WeddingMembership" membership
        ON membership."userId" = user_record."id"
       AND membership."weddingId" = assignment_row."weddingId"
       AND membership."status" = 'active'
      WHERE user_record."id" = assigned_user_id
        AND user_record."isActive" = TRUE
    ) THEN
      UPDATE "PlannerTask"
      SET "assigneeUserId" = assigned_user_id
      WHERE "id" = assignment_row.task_id
        AND "weddingId" = assignment_row."weddingId";
    END IF;
  END LOOP;
END $$;

-- Transitional protection for the retained Phase 3 action. That action still
-- writes the selected member's name into PlannerTask.assignee before it upserts
-- the assignment sidecar. At transaction end, restore the original free text and
-- persist only the normalized user relation. Ordinary later manual text edits are
-- unaffected because the sidecar timestamp will be older than the task update.
CREATE FUNCTION "preserve_planner_task_text_assignee"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_row RECORD;
  assignment_data JSONB;
  assigned_user_id TEXT;
  assigned_name TEXT;
BEGIN
  IF NEW."assignee" IS NOT DISTINCT FROM OLD."assignee" THEN
    RETURN NULL;
  END IF;

  SELECT revision."value", revision."updatedAt"
  INTO assignment_row
  FROM "ContentRevision" revision
  WHERE revision."weddingId" = NEW."weddingId"
    AND revision."section" = 'planner_task_assignment'
    AND revision."fieldKey" = NEW."id"
    AND revision."status" = 'active'
    AND revision."updatedAt" >= NEW."updatedAt"
  ORDER BY revision."updatedAt" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  BEGIN
    assignment_data := assignment_row."value"::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  assigned_user_id := NULLIF(trim(assignment_data->>'assigneeUserId'), '');
  assigned_name := NULLIF(trim(assignment_data->>'assigneeName'), '');

  IF NOT (
    (assigned_name IS NULL AND NEW."assignee" IS NULL)
    OR NEW."assignee" = assigned_name
  ) THEN
    RETURN NULL;
  END IF;

  IF assigned_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "User" user_record
    JOIN "WeddingMembership" membership
      ON membership."userId" = user_record."id"
     AND membership."weddingId" = NEW."weddingId"
     AND membership."status" = 'active'
    WHERE user_record."id" = assigned_user_id
      AND user_record."isActive" = TRUE
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE "PlannerTask"
  SET
    "assignee" = OLD."assignee",
    "assigneeUserId" = assigned_user_id
  WHERE "id" = NEW."id";

  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "preserve_planner_task_text_assignee_trigger"
AFTER UPDATE OF "assignee" ON "PlannerTask"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "preserve_planner_task_text_assignee"();
