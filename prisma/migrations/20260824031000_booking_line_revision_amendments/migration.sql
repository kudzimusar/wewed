-- Append-only booking line revision support for governed amendments.
-- Canonical plan: WW-BOOKING-COMMERCE-2026-08-24-01

ALTER TABLE wewed_booking."BookingLine"
  ADD COLUMN IF NOT EXISTS "supersedesLineId" TEXT,
  ADD COLUMN IF NOT EXISTS "supersededAt" TIMESTAMPTZ;

ALTER TABLE wewed_booking."BookingLine"
  ADD CONSTRAINT "BookingLine_supersedes_fkey"
    FOREIGN KEY ("supersedesLineId") REFERENCES wewed_booking."BookingLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "BookingLine_no_self_supersession" CHECK ("supersedesLineId" IS NULL OR "supersedesLineId" <> id);
CREATE UNIQUE INDEX "BookingLine_supersedes_key"
  ON wewed_booking."BookingLine"("supersedesLineId") WHERE "supersedesLineId" IS NOT NULL;
CREATE INDEX "BookingLine_current_booking_idx"
  ON wewed_booking."BookingLine"("bookingId","createdAt") WHERE "supersededAt" IS NULL;

CREATE OR REPLACE FUNCTION wewed_booking.enforce_booking_line_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
DECLARE booking_state text;
BEGIN
  SELECT status INTO booking_state
  FROM wewed_booking."Booking"
  WHERE id=OLD."bookingId";

  IF booking_state IS NULL THEN
    RETURN COALESCE(NEW,OLD);
  END IF;

  IF TG_OP='DELETE' AND booking_state NOT IN ('draft','held') THEN
    RAISE EXCEPTION 'submitted_booking_lines_cannot_be_deleted' USING ERRCODE='P0001';
  END IF;

  IF TG_OP='UPDATE' THEN
    IF NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
       OR NEW."catalogItemId" IS DISTINCT FROM OLD."catalogItemId"
       OR NEW."variantId" IS DISTINCT FROM OLD."variantId"
       OR NEW."packageId" IS DISTINCT FROM OLD."packageId"
       OR NEW."nameSnapshot" IS DISTINCT FROM OLD."nameSnapshot"
       OR NEW."descriptionSnapshot" IS DISTINCT FROM OLD."descriptionSnapshot"
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW."unitPriceCents" IS DISTINCT FROM OLD."unitPriceCents"
       OR NEW."lineTotalCents" IS DISTINCT FROM OLD."lineTotalCents"
       OR NEW."pricingSnapshot" IS DISTINCT FROM OLD."pricingSnapshot"
       OR NEW."selectedOptions" IS DISTINCT FROM OLD."selectedOptions"
       OR NEW."supersedesLineId" IS DISTINCT FROM OLD."supersedesLineId"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'booking_line_commercial_snapshot_is_immutable' USING ERRCODE='P0001';
    END IF;

    IF booking_state NOT IN ('draft','held') THEN
      IF OLD."supersededAt" IS NOT NULL AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt" THEN
        RAISE EXCEPTION 'superseded_booking_line_is_final' USING ERRCODE='P0001';
      END IF;
      IF OLD."supersededAt" IS NULL AND NEW."supersededAt" IS NULL THEN
        RAISE EXCEPTION 'submitted_booking_line_update_requires_supersession' USING ERRCODE='P0001';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW,OLD);
END;
$$;

REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_line_history() FROM PUBLIC;
DO $booking_line_revision_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_line_history() FROM %I',role_name);
    END IF;
  END LOOP;
END
$booking_line_revision_roles$;