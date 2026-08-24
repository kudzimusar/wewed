-- Close the AutoBook open-commitment TOCTOU race identified during final merge review.
-- The application still performs user-friendly policy checks first, but this private database
-- reservation is the authoritative concurrency boundary. A wedding-scoped advisory lock makes
-- concurrent AI actions account for each other before either action can create a booking draft.

CREATE TABLE wewed_booking."AutoBookBudgetReservation" (
  "id" TEXT PRIMARY KEY,
  "policyId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "bookingId" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMPTZ,
  "releasedAt" TIMESTAMPTZ,
  CONSTRAINT "AutoBookBudgetReservation_policy_fkey"
    FOREIGN KEY ("policyId") REFERENCES wewed_booking."AutoBookPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AutoBookBudgetReservation_booking_fkey"
    FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AutoBookBudgetReservation_amount_check" CHECK ("amountCents" >= 0),
  CONSTRAINT "AutoBookBudgetReservation_status_check" CHECK ("status" IN ('active','consumed','released')),
  CONSTRAINT "AutoBookBudgetReservation_finality_check" CHECK (
    ("status"='active' AND "bookingId" IS NULL AND "consumedAt" IS NULL AND "releasedAt" IS NULL) OR
    ("status"='consumed' AND "bookingId" IS NOT NULL AND "consumedAt" IS NOT NULL AND "releasedAt" IS NULL) OR
    ("status"='released' AND "releasedAt" IS NOT NULL)
  )
);

CREATE INDEX "AutoBookBudgetReservation_wedding_active_idx"
  ON wewed_booking."AutoBookBudgetReservation"("weddingId","expiresAt")
  WHERE "status"='active';
CREATE UNIQUE INDEX "AutoBookBudgetReservation_booking_key"
  ON wewed_booking."AutoBookBudgetReservation"("bookingId")
  WHERE "bookingId" IS NOT NULL;

CREATE OR REPLACE FUNCTION wewed_booking.reserve_autobook_open_budget(
  p_policy_id TEXT,
  p_expected_updated_at TIMESTAMPTZ,
  p_amount_cents BIGINT,
  p_reservation_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
DECLARE
  v_wedding_id TEXT;
  v_user_id TEXT;
  v_max_total INTEGER;
  v_is_active BOOLEAN;
  v_revoked_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
  v_open_total BIGINT;
  v_reserved_total BIGINT;
BEGIN
  -- Prisma binds JavaScript integer parameters as int8/bigint. Keep canonical booking money
  -- storage in INTEGER cents, but reject anything outside that established storage boundary.
  IF p_amount_cents IS NULL OR p_amount_cents < 0 OR p_amount_cents > 2147483647 THEN
    RETURN 'invalid_amount';
  END IF;

  SELECT p."weddingId",p."userId",p."maxTotalOpenCents",p."isActive",p."revokedAt",p."expiresAt",p."updatedAt"
    INTO v_wedding_id,v_user_id,v_max_total,v_is_active,v_revoked_at,v_expires_at,v_updated_at
    FROM wewed_booking."AutoBookPolicy" p
   WHERE p.id=p_policy_id
   FOR UPDATE;

  IF v_wedding_id IS NULL THEN RETURN 'policy_missing'; END IF;
  IF NOT v_is_active OR v_revoked_at IS NOT NULL THEN RETURN 'policy_inactive'; END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at <= CURRENT_TIMESTAMP THEN RETURN 'policy_expired'; END IF;
  IF v_updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN 'policy_changed'; END IF;

  -- Serialize every AutoBook budget authorization for the wedding, including different users/policies.
  PERFORM pg_advisory_xact_lock(hashtextextended('autobook-budget:' || v_wedding_id,0));

  SELECT COALESCE(SUM(b."totalCents"),0)::bigint
    INTO v_open_total
    FROM wewed_booking."Booking" b
   WHERE b."weddingId"=v_wedding_id
     AND b.status NOT IN ('completed','declined','expired','cancelled','refunded');

  SELECT COALESCE(SUM(r."amountCents"),0)::bigint
    INTO v_reserved_total
    FROM wewed_booking."AutoBookBudgetReservation" r
   WHERE r."weddingId"=v_wedding_id
     AND r.status='active'
     AND r."expiresAt">CURRENT_TIMESTAMP;

  IF v_max_total IS NOT NULL AND v_open_total + v_reserved_total + p_amount_cents > v_max_total THEN
    RETURN 'total_limit';
  END IF;

  INSERT INTO wewed_booking."AutoBookBudgetReservation"
    (id,"policyId","weddingId","userId","amountCents",status,"expiresAt")
  VALUES
    (p_reservation_id,p_policy_id,v_wedding_id,v_user_id,p_amount_cents::integer,'active',CURRENT_TIMESTAMP + INTERVAL '10 minutes');

  RETURN 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION wewed_booking.consume_autobook_open_budget(
  p_reservation_id TEXT,
  p_booking_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
DECLARE
  v_wedding_id TEXT;
  v_user_id TEXT;
BEGIN
  SELECT r."weddingId",r."userId"
    INTO v_wedding_id,v_user_id
    FROM wewed_booking."AutoBookBudgetReservation" r
   WHERE r.id=p_reservation_id AND r.status='active'
   FOR UPDATE;

  IF v_wedding_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wewed_booking."Booking" b
     WHERE b.id=p_booking_id AND b."weddingId"=v_wedding_id AND b."createdByUserId"=v_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE wewed_booking."AutoBookBudgetReservation"
     SET status='consumed',"bookingId"=p_booking_id,"consumedAt"=CURRENT_TIMESTAMP
   WHERE id=p_reservation_id AND status='active';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION wewed_booking.release_autobook_open_budget(p_reservation_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  UPDATE wewed_booking."AutoBookBudgetReservation"
     SET status='released',"releasedAt"=CURRENT_TIMESTAMP
   WHERE id=p_reservation_id AND status='active';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON TABLE wewed_booking."AutoBookBudgetReservation" FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.reserve_autobook_open_budget(TEXT,TIMESTAMPTZ,BIGINT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.consume_autobook_open_budget(TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.release_autobook_open_budget(TEXT) FROM PUBLIC;

DO $autobook_budget_roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE wewed_booking."AutoBookBudgetReservation" FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.reserve_autobook_open_budget(TEXT,TIMESTAMPTZ,BIGINT,TEXT) FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.consume_autobook_open_budget(TEXT,TEXT) FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.release_autobook_open_budget(TEXT) FROM %I',role_name);
    END IF;
  END LOOP;
END
$autobook_budget_roles$;