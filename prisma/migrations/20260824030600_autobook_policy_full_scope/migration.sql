-- Expand AutoBook from a coarse action ceiling to the canonical explicit authorization policy.
-- New execution permissions default FALSE so a migration never silently grants AI new authority.

ALTER TABLE wewed_booking."AutoBookPolicy"
  ADD COLUMN "maxDepositCents" INTEGER,
  ADD COLUMN "allowedBookingModes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "allowedProviderSlugs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "allowedRiskClasses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "excludedCatalogItemIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "allowHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowRequestSubmission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowInstantConfirmation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "expiresAt" TIMESTAMPTZ,
  ADD COLUMN "approvedAt" TIMESTAMPTZ,
  ADD COLUMN "revokedAt" TIMESTAMPTZ,
  ADD COLUMN "exclusions" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE wewed_booking."AutoBookPolicy"
  ADD CONSTRAINT "AutoBookPolicy_deposit_limit_check"
    CHECK ("maxDepositCents" IS NULL OR "maxDepositCents" >= 0),
  ADD CONSTRAINT "AutoBookPolicy_policy_json_check"
    CHECK (
      jsonb_typeof("allowedCategories")='array' AND
      jsonb_typeof("allowedBookingModes")='array' AND
      jsonb_typeof("allowedProviderSlugs")='array' AND
      jsonb_typeof("allowedRiskClasses")='array' AND
      jsonb_typeof("excludedCatalogItemIds")='array' AND
      jsonb_typeof("exclusions")='object'
    ),
  ADD CONSTRAINT "AutoBookPolicy_revocation_check"
    CHECK ("revokedAt" IS NULL OR "isActive"=false);

-- Existing policies are intentionally forced back to explicit-action approval. The user may keep
-- suggestion/preparation authority, but execution permissions must be re-saved consciously.
UPDATE wewed_booking."AutoBookPolicy"
SET "allowHold"=false,
    "allowRequestSubmission"=false,
    "allowInstantConfirmation"=false,
    "approvedAt"=CASE WHEN "isActive" THEN CURRENT_TIMESTAMP ELSE "approvedAt" END,
    "revokedAt"=CASE WHEN "isActive" THEN NULL ELSE COALESCE("revokedAt",CURRENT_TIMESTAMP) END;

CREATE INDEX "AutoBookPolicy_active_expiry_idx"
  ON wewed_booking."AutoBookPolicy"("weddingId","userId","expiresAt")
  WHERE "isActive"=true;
