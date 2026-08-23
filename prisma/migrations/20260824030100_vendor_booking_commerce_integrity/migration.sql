-- Booking-domain cross-scope integrity hardening.
-- Ensure a Booking cannot reference an offering or ServiceEngagement owned by a different business/wedding.

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderServiceOffering_id_businessAccountId_key"
  ON wewed_admin."ProviderServiceOffering"("id", "businessAccountId");

ALTER TABLE wewed_booking."Booking"
  DROP CONSTRAINT IF EXISTS "Booking_offering_fkey",
  DROP CONSTRAINT IF EXISTS "Booking_engagement_fkey";

ALTER TABLE wewed_booking."Booking"
  ADD CONSTRAINT "Booking_offering_business_fkey"
    FOREIGN KEY ("offeringId", "businessAccountId")
    REFERENCES wewed_admin."ProviderServiceOffering"("id", "businessAccountId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Booking_engagement_wedding_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId")
    REFERENCES public."ServiceEngagement"("id", "weddingId")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wewed_booking.guard_referral_catalog_business()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking, wewed_admin
AS $$
DECLARE
  item_business TEXT;
BEGIN
  IF NEW."catalogItemId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o."businessAccountId"
    INTO item_business
  FROM wewed_booking."ProviderCatalogItem" i
  JOIN wewed_admin."ProviderServiceOffering" o ON o.id = i."offeringId"
  WHERE i.id = NEW."catalogItemId";

  IF item_business IS DISTINCT FROM NEW."businessAccountId" THEN
    RAISE EXCEPTION 'referral_catalog_business_mismatch' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReferralLink_catalog_business_guard"
BEFORE INSERT OR UPDATE OF "catalogItemId", "businessAccountId"
ON wewed_booking."ReferralLink"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.guard_referral_catalog_business();

REVOKE ALL ON FUNCTION wewed_booking.guard_referral_catalog_business() FROM anon, authenticated, PUBLIC;
