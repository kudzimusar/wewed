-- Wewed booking quote acceptance and governed contract-effectivity gate.
-- Quote-only bookings require an explicit customer acceptance record.
-- Contract-required catalogue items cannot become confirmed until the canonical
-- Wewed contract version has an append-only effectivity record.

ALTER TABLE wewed_booking."Booking" DROP CONSTRAINT IF EXISTS "Booking_status_check";
ALTER TABLE wewed_booking."Booking"
  ADD CONSTRAINT "Booking_status_check" CHECK ("status" IN (
    'draft','held','requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms',
    'awaiting_deposit','confirmed','preparing','ready','in_progress','return_due','inspection',
    'completed','declined','expired','cancelled','refunded','disputed'
  ));

ALTER TABLE wewed_booking."Booking"
  ADD COLUMN IF NOT EXISTS "acceptedQuoteId" TEXT,
  ADD COLUMN IF NOT EXISTS "termsSatisfiedAt" TIMESTAMPTZ;

CREATE TABLE wewed_booking."BookingQuote" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "currency" TEXT NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "feesCents" INTEGER NOT NULL DEFAULT 0,
  "depositCents" INTEGER,
  "totalCents" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "notes" TEXT,
  "proposedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "proposedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingQuote_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingQuote_proposer_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingQuote_acceptor_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingQuote_status_check" CHECK ("status" IN ('proposed','accepted','rejected','superseded')),
  CONSTRAINT "BookingQuote_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "BookingQuote_money_check" CHECK (
    "subtotalCents" >= 0 AND "feesCents" >= 0 AND "totalCents" >= 0 AND
    ("depositCents" IS NULL OR ("depositCents" >= 0 AND "depositCents" <= "totalCents")) AND
    "totalCents" = "subtotalCents" + "feesCents"
  ),
  CONSTRAINT "BookingQuote_acceptance_check" CHECK (
    ("status"='accepted' AND "acceptedByUserId" IS NOT NULL AND "acceptedAt" IS NOT NULL) OR
    ("status"<>'accepted' AND "acceptedAt" IS NULL)
  )
);
CREATE INDEX "BookingQuote_booking_status_created_idx" ON wewed_booking."BookingQuote"("bookingId","status","createdAt" DESC);
CREATE UNIQUE INDEX "BookingQuote_one_accepted_per_booking_idx" ON wewed_booking."BookingQuote"("bookingId") WHERE "status"='accepted';

ALTER TABLE wewed_booking."Booking"
  ADD CONSTRAINT "Booking_accepted_quote_fkey" FOREIGN KEY ("acceptedQuoteId") REFERENCES wewed_booking."BookingQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wewed_booking.guard_booking_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, wewed_booking, wewed_contracts
AS $$
DECLARE
  requires_contract BOOLEAN;
  terms_effective BOOLEAN;
  accepted_quote_valid BOOLEAN;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF NEW."bookingMode" = 'quote' THEN
    SELECT EXISTS (
      SELECT 1
      FROM wewed_booking."BookingQuote" q
      WHERE q.id=NEW."acceptedQuoteId" AND q."bookingId"=NEW.id AND q.status='accepted'
    ) INTO accepted_quote_valid;
    IF NOT accepted_quote_valid THEN
      RAISE EXCEPTION 'booking_quote_acceptance_required' USING ERRCODE='P0001';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM wewed_booking."BookingLine" l
    JOIN wewed_booking."ProviderCatalogItem" i ON i.id=l."catalogItemId"
    WHERE l."bookingId"=NEW.id AND i."requiresContract"=true
  ) INTO requires_contract;

  IF requires_contract THEN
    SELECT EXISTS (
      SELECT 1
      FROM public."Contract" c
      JOIN wewed_contracts."ContractVersionEffectivity" e ON e."contractId"=c.id
      WHERE c."serviceEngagementId"=NEW."serviceEngagementId"
        AND c."weddingId"=NEW."weddingId"
        AND c.status IN ('EFFECTIVE','COMPLETED')
    ) INTO terms_effective;

    IF NOT terms_effective THEN
      RAISE EXCEPTION 'booking_effective_contract_required' USING ERRCODE='P0001';
    END IF;
    NEW."termsSatisfiedAt" = COALESCE(NEW."termsSatisfiedAt", CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_confirmation_governance_guard"
BEFORE UPDATE OF status ON wewed_booking."Booking"
FOR EACH ROW
WHEN (NEW.status='confirmed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION wewed_booking.guard_booking_confirmation();

REVOKE ALL ON wewed_booking."BookingQuote" FROM PUBLIC;
DO $booking_quote_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON wewed_booking."BookingQuote" FROM %I', role_name);
    END IF;
  END LOOP;
END
$booking_quote_roles$;
