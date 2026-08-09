-- The marketplace claim pipeline already owns the canonical open-claim uniqueness index:
-- ProviderClaimRequest_one_open_claim_idx.
-- The hardening migration temporarily recreated the same invariant under a second name;
-- remove only that redundant index so the final schema has one write-maintained structure.

DROP INDEX IF EXISTS wewed_admin."ProviderClaimRequest_open_profile_email_unique";

DO $canonical_open_claim_index$
BEGIN
  IF to_regclass('wewed_admin."ProviderClaimRequest_one_open_claim_idx"') IS NULL THEN
    RAISE EXCEPTION 'Canonical ProviderClaimRequest_one_open_claim_idx is missing';
  END IF;
END
$canonical_open_claim_index$;
