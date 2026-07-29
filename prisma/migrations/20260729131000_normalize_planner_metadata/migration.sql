-- Add normalized planner fields without changing legacy source values.
ALTER TABLE "Vendor"
  ADD COLUMN "contact" TEXT,
  ADD COLUMN "contractStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN "planningRating" DOUBLE PRECISION,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "ProgrammeItem"
  ADD COLUMN "duration" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "displayIcon" TEXT;

-- Backfill vendor planner fields from the legacy description sentinel.
-- Vendor.description is intentionally never rewritten by this migration.
DO $$
DECLARE
  vendor_row RECORD;
  metadata JSONB;
  raw_metadata TEXT;
  rating_value DOUBLE PRECISION;
BEGIN
  FOR vendor_row IN
    SELECT "id", "description"
    FROM "Vendor"
    WHERE "description" LIKE '__wewed_meta__:%'
  LOOP
    raw_metadata := split_part(substring(vendor_row."description" FROM 16), '|||', 1);
    BEGIN
      metadata := raw_metadata::JSONB;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    rating_value := NULL;
    BEGIN
      IF metadata ? 'rating' AND jsonb_typeof(metadata->'rating') = 'number' THEN
        rating_value := (metadata->>'rating')::DOUBLE PRECISION;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      rating_value := NULL;
    END;

    UPDATE "Vendor"
    SET
      "contact" = COALESCE(NULLIF(trim(metadata->>'contact'), ''), "contact"),
      "contractStatus" = CASE
        WHEN metadata->>'contractStatus' IN ('signed', 'pending', 'negotiating', 'declined')
          THEN metadata->>'contractStatus'
        ELSE "contractStatus"
      END,
      "paymentStatus" = CASE
        WHEN metadata->>'paymentStatus' IN ('paid', 'deposit', 'unpaid')
          THEN metadata->>'paymentStatus'
        ELSE "paymentStatus"
      END,
      "planningRating" = CASE
        WHEN rating_value BETWEEN 0 AND 5 THEN rating_value
        ELSE "planningRating"
      END,
      "notes" = COALESCE(NULLIF(trim(metadata->>'notes'), ''), "notes")
    WHERE "id" = vendor_row."id";
  END LOOP;
END $$;

-- Backfill timeline planner fields from legacy JSON stored in ProgrammeItem.icon.
-- ProgrammeItem.icon is intentionally never rewritten by this migration.
DO $$
DECLARE
  programme_row RECORD;
  metadata JSONB;
BEGIN
  FOR programme_row IN
    SELECT "id", "icon"
    FROM "ProgrammeItem"
    WHERE "icon" LIKE '{%'
  LOOP
    BEGIN
      metadata := programme_row."icon"::JSONB;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    UPDATE "ProgrammeItem"
    SET
      "duration" = COALESCE(NULLIF(trim(metadata->>'d'), ''), "duration"),
      "location" = COALESCE(NULLIF(trim(metadata->>'l'), ''), "location"),
      "displayIcon" = COALESCE(NULLIF(trim(metadata->>'i'), ''), "displayIcon")
    WHERE "id" = programme_row."id";
  END LOOP;
END $$;
