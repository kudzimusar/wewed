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

-- Phase 3 still has a transitional legacy vendor write path. Keep normalized
-- columns synchronized until that duplicate surface is integrated into Vendors.
CREATE FUNCTION "sync_vendor_planner_metadata"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  metadata JSONB;
  raw_metadata TEXT;
  rating_value DOUBLE PRECISION;
BEGIN
  IF NEW."description" IS NULL OR NEW."description" NOT LIKE '__wewed_meta__:%' THEN
    RETURN NEW;
  END IF;

  raw_metadata := split_part(substring(NEW."description" FROM 16), '|||', 1);
  BEGIN
    metadata := raw_metadata::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  NEW."contact" := COALESCE(NULLIF(trim(metadata->>'contact'), ''), NEW."contact");
  IF metadata->>'contractStatus' IN ('signed', 'pending', 'negotiating', 'declined') THEN
    NEW."contractStatus" := metadata->>'contractStatus';
  END IF;
  IF metadata->>'paymentStatus' IN ('paid', 'deposit', 'unpaid') THEN
    NEW."paymentStatus" := metadata->>'paymentStatus';
  END IF;
  NEW."notes" := COALESCE(NULLIF(trim(metadata->>'notes'), ''), NEW."notes");

  BEGIN
    IF metadata ? 'rating' AND jsonb_typeof(metadata->'rating') = 'number' THEN
      rating_value := (metadata->>'rating')::DOUBLE PRECISION;
      IF rating_value BETWEEN 0 AND 5 THEN
        NEW."planningRating" := rating_value;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END $$;

CREATE TRIGGER "sync_vendor_planner_metadata_trigger"
BEFORE INSERT OR UPDATE OF "description" ON "Vendor"
FOR EACH ROW
EXECUTE FUNCTION "sync_vendor_planner_metadata"();

-- Keep normalized timeline fields synchronized if an older import or workflow
-- still writes the JSON payload to ProgrammeItem.icon during the transition.
CREATE FUNCTION "sync_programme_item_metadata"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  metadata JSONB;
BEGIN
  IF NEW."icon" IS NULL OR NEW."icon" NOT LIKE '{%' THEN
    RETURN NEW;
  END IF;

  BEGIN
    metadata := NEW."icon"::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  NEW."duration" := COALESCE(NULLIF(trim(metadata->>'d'), ''), NEW."duration");
  NEW."location" := COALESCE(NULLIF(trim(metadata->>'l'), ''), NEW."location");
  NEW."displayIcon" := COALESCE(NULLIF(trim(metadata->>'i'), ''), NEW."displayIcon");
  RETURN NEW;
END $$;

CREATE TRIGGER "sync_programme_item_metadata_trigger"
BEFORE INSERT OR UPDATE OF "icon" ON "ProgrammeItem"
FOR EACH ROW
EXECUTE FUNCTION "sync_programme_item_metadata"();
