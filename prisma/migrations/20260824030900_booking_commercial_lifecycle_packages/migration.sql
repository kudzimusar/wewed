-- Wewed booking commercial lifecycle, package-resource and availability hardening.
-- Canonical plan: WW-BOOKING-COMMERCE-2026-08-24-01
-- Additive only: no existing booking, payment, contribution or contract evidence is rewritten.

ALTER TABLE wewed_booking."ProviderCatalogItem"
  ADD COLUMN IF NOT EXISTS "minNoticeMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "bookingHorizonDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "minDurationMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxDurationMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "operatingTimezone" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceAreaPolicy" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE wewed_booking."ProviderCatalogItem"
  ADD CONSTRAINT "ProviderCatalogItem_min_notice_check" CHECK ("minNoticeMinutes" IS NULL OR "minNoticeMinutes" >= 0),
  ADD CONSTRAINT "ProviderCatalogItem_booking_horizon_check" CHECK ("bookingHorizonDays" IS NULL OR "bookingHorizonDays" BETWEEN 0 AND 3650),
  ADD CONSTRAINT "ProviderCatalogItem_min_duration_check" CHECK ("minDurationMinutes" IS NULL OR "minDurationMinutes" > 0),
  ADD CONSTRAINT "ProviderCatalogItem_max_duration_check" CHECK ("maxDurationMinutes" IS NULL OR "maxDurationMinutes" > 0),
  ADD CONSTRAINT "ProviderCatalogItem_duration_order_check" CHECK ("minDurationMinutes" IS NULL OR "maxDurationMinutes" IS NULL OR "maxDurationMinutes" >= "minDurationMinutes"),
  ADD CONSTRAINT "ProviderCatalogItem_timezone_check" CHECK ("operatingTimezone" IS NULL OR char_length(btrim("operatingTimezone")) BETWEEN 1 AND 100),
  ADD CONSTRAINT "ProviderCatalogItem_service_area_shape_check" CHECK (jsonb_typeof("serviceAreaPolicy")='object');

CREATE TABLE wewed_booking."ProviderCatalogComponent" (
  "id" TEXT PRIMARY KEY,
  "parentCatalogItemId" TEXT NOT NULL,
  "childCatalogItemId" TEXT NOT NULL,
  "childVariantId" TEXT,
  "componentKind" TEXT NOT NULL,
  "selectionKey" TEXT,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "priceDeltaCents" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderCatalogComponent_kind_check" CHECK ("componentKind" IN ('package','addon')),
  CONSTRAINT "ProviderCatalogComponent_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "ProviderCatalogComponent_price_check" CHECK ("priceDeltaCents" IS NULL OR "priceDeltaCents" >= 0),
  CONSTRAINT "ProviderCatalogComponent_status_check" CHECK ("status" IN ('active','inactive','retired')),
  CONSTRAINT "ProviderCatalogComponent_no_self_reference" CHECK ("parentCatalogItemId" <> "childCatalogItemId"),
  CONSTRAINT "ProviderCatalogComponent_addon_selection_key_check" CHECK ("componentKind" <> 'addon' OR ("selectionKey" IS NOT NULL AND char_length(btrim("selectionKey")) BETWEEN 1 AND 160)),
  CONSTRAINT "ProviderCatalogComponent_parent_fkey" FOREIGN KEY ("parentCatalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderCatalogComponent_child_fkey" FOREIGN KEY ("childCatalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProviderCatalogComponent_variant_child_fkey" FOREIGN KEY ("childVariantId","childCatalogItemId") REFERENCES wewed_booking."ProviderCatalogVariant"("id","catalogItemId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProviderCatalogComponent_identity_key"
  ON wewed_booking."ProviderCatalogComponent"("parentCatalogItemId","componentKind","childCatalogItemId",COALESCE("childVariantId",''),COALESCE("selectionKey",''));
CREATE INDEX "ProviderCatalogComponent_parent_status_idx" ON wewed_booking."ProviderCatalogComponent"("parentCatalogItemId","status","componentKind");
CREATE INDEX "ProviderCatalogComponent_child_idx" ON wewed_booking."ProviderCatalogComponent"("childCatalogItemId","childVariantId");

CREATE TRIGGER "ProviderCatalogComponent_updatedAt"
BEFORE UPDATE ON wewed_booking."ProviderCatalogComponent"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();

ALTER TABLE wewed_booking."BookingAmendment"
  ADD COLUMN IF NOT EXISTS "impactSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "contractAmendmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "effectiveAt" TIMESTAMPTZ;

ALTER TABLE wewed_booking."BookingAmendment"
  ADD CONSTRAINT "BookingAmendment_contract_amendment_fkey"
    FOREIGN KEY ("contractAmendmentId") REFERENCES wewed_contracts."ContractAmendment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "BookingAmendment_effective_shape_check" CHECK ((status='accepted' AND "effectiveAt" IS NOT NULL) OR (status<>'accepted' AND "effectiveAt" IS NULL));
CREATE UNIQUE INDEX "BookingAmendment_contract_amendment_key"
  ON wewed_booking."BookingAmendment"("contractAmendmentId") WHERE "contractAmendmentId" IS NOT NULL;

ALTER TABLE wewed_contracts."PaymentMilestone"
  ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
ALTER TABLE wewed_contracts."PaymentMilestone"
  ADD CONSTRAINT "PaymentMilestone_booking_fkey"
    FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "PaymentMilestone_booking_type_sequence_key"
  ON wewed_contracts."PaymentMilestone"("bookingId","milestoneType",sequence) WHERE "bookingId" IS NOT NULL;
CREATE INDEX "PaymentMilestone_booking_status_idx"
  ON wewed_contracts."PaymentMilestone"("bookingId",status,"dueAt") WHERE "bookingId" IS NOT NULL;

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
     OR NEW."impactSnapshot" IS DISTINCT FROM OLD."impactSnapshot"
     OR NEW."priceDeltaCents" IS DISTINCT FROM OLD."priceDeltaCents"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'booking_amendment_proposal_is_immutable' USING ERRCODE='P0001';
  END IF;

  IF OLD.status <> 'proposed' AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW."decidedByUserId" IS DISTINCT FROM OLD."decidedByUserId"
       OR NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt"
       OR NEW."contractAmendmentId" IS DISTINCT FROM OLD."contractAmendmentId"
       OR NEW."effectiveAt" IS DISTINCT FROM OLD."effectiveAt"
     ) THEN
    RAISE EXCEPTION 'final_booking_amendment_cannot_be_rewritten' USING ERRCODE='P0001';
  END IF;

  IF OLD.status='proposed' AND NEW.status NOT IN ('proposed','accepted','rejected','withdrawn') THEN
    RAISE EXCEPTION 'invalid_booking_amendment_transition' USING ERRCODE='P0001';
  END IF;

  IF NEW.status IN ('accepted','rejected') AND (NEW."decidedByUserId" IS NULL OR NEW."decidedAt" IS NULL) THEN
    RAISE EXCEPTION 'booking_amendment_decision_evidence_required' USING ERRCODE='P0001';
  END IF;

  IF NEW.status='accepted' AND NEW."effectiveAt" IS NULL THEN
    RAISE EXCEPTION 'accepted_booking_amendment_requires_effective_time' USING ERRCODE='P0001';
  END IF;

  IF NEW.status<>'accepted' AND NEW."effectiveAt" IS NOT NULL THEN
    RAISE EXCEPTION 'only_accepted_booking_amendments_may_be_effective' USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$$;

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
    WHEN m."entryType" IN ('REFUND','REVERSAL') THEN -m.amount
    ELSE 0 END),0)
    INTO v_paid
  FROM wewed_contracts."PaymentMilestone" pm
  LEFT JOIN wewed_contracts."ManagedPaymentRecord" m ON m."milestoneId"=pm.id
  WHERE pm."bookingId"=p_booking_id
    AND pm."serviceEngagementId"=v_engagement_id
    AND pm."milestoneType"='DEPOSIT'
    AND pm.status='PLANNED';

  RETURN COALESCE(v_paid,0) >= (v_deposit_cents::numeric / 100.0);
END;
$$;

CREATE OR REPLACE FUNCTION wewed_booking.guard_booking_deposit_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking, wewed_contracts
AS $$
BEGIN
  IF NEW.status='confirmed'
     AND OLD.status IS DISTINCT FROM 'confirmed'
     AND NOT wewed_booking.booking_deposit_is_satisfied(NEW.id) THEN
    RAISE EXCEPTION 'booking_deposit_not_satisfied' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_deposit_confirmation_guard"
BEFORE UPDATE OF status ON wewed_booking."Booking"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.guard_booking_deposit_confirmation();

REVOKE ALL ON TABLE wewed_booking."ProviderCatalogComponent" FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.booking_deposit_is_satisfied(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.guard_booking_deposit_confirmation() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_amendment_finality() FROM PUBLIC;

DO $booking_commercial_roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE wewed_booking."ProviderCatalogComponent" FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.booking_deposit_is_satisfied(TEXT) FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.guard_booking_deposit_confirmation() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.enforce_booking_amendment_finality() FROM %I',role_name);
    END IF;
  END LOOP;
END
$booking_commercial_roles$;