-- Phase C Wedding Architect commercial entitlements.
-- Additive governance only: no account is upgraded and no provider becomes eligible
-- unless its existing billing profile actually resolves to an entitled paid offer.

UPDATE wewed_admin."BillingOffer"
SET "entitlements" = CASE
  WHEN "entitlements" @> '["ai_wedding_architect_opportunities"]'::jsonb
    THEN "entitlements"
  ELSE "entitlements" || '["ai_wedding_architect_opportunities"]'::jsonb
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "offerCode" IN ('vendor_growth', 'venue_portfolio')
  AND status = 'active';

UPDATE wewed_admin."BillingOffer"
SET "entitlements" = CASE
  WHEN "entitlements" @> '["ai_wedding_architect_planning"]'::jsonb
    THEN "entitlements"
  ELSE "entitlements" || '["ai_wedding_architect_planning"]'::jsonb
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "offerCode" = 'planner_professional'
  AND status = 'active';

-- Couples are the demand side of the marketplace. The Wedding Architect plan
-- preview remains governed by wedding membership/permissions rather than making
-- vendor referrals dependent on a couple subscription at this phase.
