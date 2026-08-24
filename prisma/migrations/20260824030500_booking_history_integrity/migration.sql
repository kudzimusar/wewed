-- Booking commercial-history hardening.
-- Mirrors Wewed's governed contract evidence principles: commercial snapshots and audit events
-- cannot be destructively rewritten after they become historical evidence.

CREATE OR REPLACE FUNCTION wewed_booking.reject_confirmed_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    -- Bookings are created as drafts first so lines, price provenance, holds/quotes and governed
    -- contract evidence can exist before confirmation. A direct confirmed INSERT would bypass that spine.
    RAISE EXCEPTION 'booking_confirmed_insert_forbidden' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_confirmed_insert_guard"
BEFORE INSERT ON wewed_booking."Booking"
FOR EACH ROW
WHEN (NEW.status='confirmed')
EXECUTE FUNCTION wewed_booking.reject_confirmed_booking_insert();

CREATE OR REPLACE FUNCTION wewed_booking.enforce_booking_identity_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId"
     OR NEW."businessAccountId" IS DISTINCT FROM OLD."businessAccountId"
     OR NEW."offeringId" IS DISTINCT FROM OLD."offeringId"
     OR NEW."customerUserId" IS DISTINCT FROM OLD."customerUserId"
     OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
     OR NEW."bookingMode" IS DISTINCT FROM OLD."bookingMode"
     OR NEW."publicReference" IS DISTINCT FROM OLD."publicReference" THEN
    RAISE EXCEPTION 'booking_identity_is_immutable' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_identity_immutability_guard"
BEFORE UPDATE ON wewed_booking."Booking"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.enforce_booking_identity_immutability();

CREATE OR REPLACE FUNCTION wewed_booking.enforce_booking_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  RAISE EXCEPTION 'booking_events_are_append_only' USING ERRCODE='P0001';
END;
$$;

CREATE TRIGGER "BookingEvent_append_only_guard"
BEFORE UPDATE OR DELETE ON wewed_booking."BookingEvent"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.enforce_booking_event_append_only();

CREATE OR REPLACE FUNCTION wewed_booking.enforce_referral_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  RAISE EXCEPTION 'referral_events_are_append_only' USING ERRCODE='P0001';
END;
$$;

CREATE TRIGGER "ReferralEvent_append_only_guard"
BEFORE UPDATE OR DELETE ON wewed_booking."ReferralEvent"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.enforce_referral_event_append_only();

CREATE OR REPLACE FUNCTION wewed_booking.enforce_booking_quote_finality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'booking_quotes_cannot_be_deleted' USING ERRCODE='P0001';
  END IF;

  IF NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW."subtotalCents" IS DISTINCT FROM OLD."subtotalCents"
     OR NEW."feesCents" IS DISTINCT FROM OLD."feesCents"
     OR NEW."depositCents" IS DISTINCT FROM OLD."depositCents"
     OR NEW."totalCents" IS DISTINCT FROM OLD."totalCents"
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW."proposedByUserId" IS DISTINCT FROM OLD."proposedByUserId"
     OR NEW."proposedAt" IS DISTINCT FROM OLD."proposedAt"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'booking_quote_commercial_snapshot_is_immutable' USING ERRCODE='P0001';
  END IF;

  IF OLD.status <> 'proposed' AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW."acceptedByUserId" IS DISTINCT FROM OLD."acceptedByUserId"
       OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt"
     ) THEN
    RAISE EXCEPTION 'final_booking_quote_cannot_be_rewritten' USING ERRCODE='P0001';
  END IF;

  IF OLD.status='proposed' AND NEW.status NOT IN ('proposed','accepted','rejected','superseded') THEN
    RAISE EXCEPTION 'invalid_booking_quote_transition' USING ERRCODE='P0001';
  END IF;

  IF NEW.status <> 'accepted' AND (
       NEW."acceptedByUserId" IS NOT NULL OR NEW."acceptedAt" IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'quote_acceptance_evidence_requires_accepted_state' USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "BookingQuote_finality_guard"
BEFORE UPDATE OR DELETE ON wewed_booking."BookingQuote"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.enforce_booking_quote_finality();

CREATE OR REPLACE FUNCTION wewed_booking.enforce_booking_amendment_finality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'booking_amendments_cannot_be_deleted' USING ERRCODE='P0001';
  END IF;

  IF NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
     OR NEW."requestedByUserId" IS DISTINCT FROM OLD."requestedByUserId"
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW."beforeSnapshot" IS DISTINCT FROM OLD."beforeSnapshot"
     OR NEW."afterSnapshot" IS DISTINCT FROM OLD."afterSnapshot"
     OR NEW."priceDeltaCents" IS DISTINCT FROM OLD."priceDeltaCents"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'booking_amendment_proposal_is_immutable' USING ERRCODE='P0001';
  END IF;

  IF OLD.status <> 'proposed' AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW."decidedByUserId" IS DISTINCT FROM OLD."decidedByUserId"
       OR NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt"
     ) THEN
    RAISE EXCEPTION 'final_booking_amendment_cannot_be_rewritten' USING ERRCODE='P0001';
  END IF;

  IF OLD.status='proposed' AND NEW.status NOT IN ('proposed','accepted','rejected','withdrawn') THEN
    RAISE EXCEPTION 'invalid_booking_amendment_transition' USING ERRCODE='P0001';
  END IF;

  IF NEW.status IN ('accepted','rejected') AND (NEW."decidedByUserId" IS NULL OR NEW."decidedAt" IS NULL) THEN
    RAISE EXCEPTION 'booking_amendment_decision_evidence_required' USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "BookingAmendment_finality_guard"
BEFORE UPDATE OR DELETE ON wewed_booking."BookingAmendment"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.enforce_booking_amendment_finality();

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

  IF booking_state NOT IN ('draft','held') THEN
    RAISE EXCEPTION 'submitted_booking_lines_cannot_be_rewritten' USING ERRCODE='P0001';
  END IF;

  IF TG_OP='UPDATE' AND NEW."bookingId" IS DISTINCT FROM OLD."bookingId" THEN
    RAISE EXCEPTION 'booking_line_parent_is_immutable' USING ERRCODE='P0001';
  END IF;

  RETURN COALESCE(NEW,OLD);
END;
$$;

CREATE TRIGGER "BookingLine_history_guard"
BEFORE UPDATE OR DELETE ON wewed_booking."BookingLine"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.enforce_booking_line_history();

REVOKE ALL ON FUNCTION wewed_booking.reject_confirmed_booking_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_identity_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_event_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_referral_event_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_quote_finality() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_amendment_finality() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_line_history() FROM PUBLIC;

DO $booking_history_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.reject_confirmed_booking_insert() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_identity_immutability() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_event_append_only() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_referral_event_append_only() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_quote_finality() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_amendment_finality() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_line_history() FROM %I',role_name);
    END IF;
  END LOOP;
END
$booking_history_roles$;
