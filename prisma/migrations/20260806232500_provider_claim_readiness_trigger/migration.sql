-- Claimed providers become enquiry-ready only after the owner saves the claimed profile.
-- The claim approval transition itself does not count as owner confirmation.

CREATE OR REPLACE FUNCTION wewed_admin."syncProviderClaimReadiness"()
RETURNS trigger
LANGUAGE plpgsql
AS $provider_claim_readiness$
BEGIN
  IF OLD."listingStatus" IN ('claimed', 'verified')
     AND NEW."listingStatus" IN ('claimed', 'verified')
     AND NEW."isClaimable" = false THEN
    NEW."ownerConfirmedAt" := COALESCE(NEW."ownerConfirmedAt", CURRENT_TIMESTAMP);
    NEW."acceptingEnquiries" := (
      NEW.visibility = 'published' AND NEW."completionScore" >= 60
    );
    IF NEW."acceptingEnquiries" THEN
      NEW."claimNotice" := NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$provider_claim_readiness$;

DROP TRIGGER IF EXISTS "ProviderProfile_claim_readiness" ON wewed_admin."ProviderProfile";
CREATE TRIGGER "ProviderProfile_claim_readiness"
BEFORE UPDATE ON wewed_admin."ProviderProfile"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin."syncProviderClaimReadiness"();

REVOKE ALL ON FUNCTION wewed_admin."syncProviderClaimReadiness"() FROM PUBLIC;
