-- Final merge-review correction: a reversal negates the economic sign of the fact it reverses.
-- PAYMENT = +amount, REFUND = -amount, reversal-of-payment = -amount,
-- reversal-of-refund = +amount. This keeps deposit satisfaction factual and append-only.

CREATE OR REPLACE FUNCTION wewed_booking.booking_deposit_is_satisfied(p_booking_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, wewed_booking, wewed_contracts
AS $$
DECLARE
  v_deposit_cents INTEGER;
  v_engagement_id TEXT;
  v_paid NUMERIC(14,2);
BEGIN
  SELECT b."depositCents", b."serviceEngagementId"
    INTO v_deposit_cents, v_engagement_id
  FROM wewed_booking."Booking" b
  WHERE b.id=p_booking_id;

  IF v_deposit_cents IS NULL OR v_deposit_cents <= 0 THEN
    RETURN TRUE;
  END IF;
  IF v_engagement_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN m."entryType"='PAYMENT' THEN m.amount
    WHEN m."entryType"='REFUND' THEN -m.amount
    WHEN m."entryType"='REVERSAL' AND original."entryType"='PAYMENT' THEN -m.amount
    WHEN m."entryType"='REVERSAL' AND original."entryType"='REFUND' THEN m.amount
    ELSE 0 END),0)
    INTO v_paid
  FROM wewed_contracts."PaymentMilestone" pm
  LEFT JOIN wewed_contracts."ManagedPaymentRecord" m ON m."milestoneId"=pm.id
  LEFT JOIN wewed_contracts."ManagedPaymentRecord" original ON original.id=m."reversesPaymentId"
  WHERE pm."bookingId"=p_booking_id
    AND pm."serviceEngagementId"=v_engagement_id
    AND pm."milestoneType"='DEPOSIT'
    AND pm.status='PLANNED';

  RETURN COALESCE(v_paid,0) >= (v_deposit_cents::numeric / 100.0);
END;
$$;

REVOKE ALL ON FUNCTION wewed_booking.booking_deposit_is_satisfied(TEXT) FROM PUBLIC;

DO $deposit_fix_roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.booking_deposit_is_satisfied(TEXT) FROM %I',role_name);
    END IF;
  END LOOP;
END
$deposit_fix_roles$;