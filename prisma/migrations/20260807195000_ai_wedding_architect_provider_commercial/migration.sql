-- Wewed AI Wedding Architect provider commercial foundation.
-- Additive only: existing provider profiles, offerings, packages, wedding vendors,
-- enquiries, subscriptions and planner authority remain intact.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

ALTER TABLE wewed_admin."ProviderServiceOffering"
  ADD COLUMN IF NOT EXISTS "pricingVisibility" TEXT NOT NULL DEFAULT 'quote_only',
  ADD COLUMN IF NOT EXISTS "commercialTerms" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "priceComponents" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "priceValidFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "priceValidUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ownerConfirmedCommercialAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiReadinessScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiReadinessStatus" TEXT NOT NULL DEFAULT 'not_ready',
  ADD COLUMN IF NOT EXISTS "aiReadinessMissing" JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $offering_commercial_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_pricingVisibility_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_pricingVisibility_check"
      CHECK ("pricingVisibility" IN ('exact', 'from', 'range', 'quote_only'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_commercialTerms_object_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_commercialTerms_object_check"
      CHECK (jsonb_typeof("commercialTerms") = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_priceComponents_array_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_priceComponents_array_check"
      CHECK (jsonb_typeof("priceComponents") = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_aiReadinessScore_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_aiReadinessScore_check"
      CHECK ("aiReadinessScore" BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_aiReadinessStatus_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_aiReadinessStatus_check"
      CHECK ("aiReadinessStatus" IN ('not_ready', 'needs_review', 'ready'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_aiReadinessMissing_array_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_aiReadinessMissing_array_check"
      CHECK (jsonb_typeof("aiReadinessMissing") = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_priceValidity_check') THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_priceValidity_check"
      CHECK ("priceValidFrom" IS NULL OR "priceValidUntil" IS NULL OR "priceValidFrom" <= "priceValidUntil");
  END IF;
END
$offering_commercial_constraints$;

CREATE INDEX IF NOT EXISTS "ProviderServiceOffering_ai_ready_category_idx"
  ON wewed_admin."ProviderServiceOffering"("aiReadinessStatus", "category", "status")
  WHERE "aiReadinessStatus" = 'ready';
CREATE INDEX IF NOT EXISTS "ProviderServiceOffering_price_validity_idx"
  ON wewed_admin."ProviderServiceOffering"("priceValidUntil")
  WHERE "priceValidUntil" IS NOT NULL;

ALTER TABLE wewed_admin."ProviderPackage"
  ADD COLUMN IF NOT EXISTS "minimumQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "maximumQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "includedQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "additionalUnitPriceCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "exclusions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "requiredAddOns" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "optionalAddOns" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "commercialTerms" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "priceComponents" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "priceValidFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "priceValidUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completionScore" INTEGER NOT NULL DEFAULT 0;

DO $package_commercial_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_quantity_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_quantity_check"
      CHECK (
        ("minimumQuantity" IS NULL OR "minimumQuantity" >= 0) AND
        ("maximumQuantity" IS NULL OR "maximumQuantity" >= 0) AND
        ("includedQuantity" IS NULL OR "includedQuantity" >= 0) AND
        ("minimumQuantity" IS NULL OR "maximumQuantity" IS NULL OR "minimumQuantity" <= "maximumQuantity")
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_additionalUnitPrice_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_additionalUnitPrice_check"
      CHECK ("additionalUnitPriceCents" IS NULL OR "additionalUnitPriceCents" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_commercialTerms_object_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_commercialTerms_object_check"
      CHECK (jsonb_typeof("commercialTerms") = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_priceComponents_array_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_priceComponents_array_check"
      CHECK (jsonb_typeof("priceComponents") = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_exclusions_array_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_exclusions_array_check"
      CHECK (jsonb_typeof("exclusions") = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_requiredAddOns_array_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_requiredAddOns_array_check"
      CHECK (jsonb_typeof("requiredAddOns") = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_optionalAddOns_array_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_optionalAddOns_array_check"
      CHECK (jsonb_typeof("optionalAddOns") = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_completionScore_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_completionScore_check"
      CHECK ("completionScore" BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_priceValidity_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_priceValidity_check"
      CHECK ("priceValidFrom" IS NULL OR "priceValidUntil" IS NULL OR "priceValidFrom" <= "priceValidUntil");
  END IF;
END
$package_commercial_constraints$;

CREATE INDEX IF NOT EXISTS "ProviderPackage_price_validity_idx"
  ON wewed_admin."ProviderPackage"("priceValidUntil")
  WHERE "priceValidUntil" IS NOT NULL;

-- Views use SELECT * and must be recreated after adding base-table columns so the
-- application sees the same commercial contract through the governed public views.
CREATE OR REPLACE VIEW public."ProviderServiceOffering" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderServiceOffering";
CREATE OR REPLACE VIEW public."ProviderPackage" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderPackage";

REVOKE ALL PRIVILEGES ON TABLE public."ProviderServiceOffering" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."ProviderPackage" FROM PUBLIC;

DO $provider_commercial_view_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_admin FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."ProviderServiceOffering" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."ProviderPackage" FROM %I', role_name);
    END IF;
  END LOOP;
END
$provider_commercial_view_roles$;

-- Existing offerings remain visible and usable in the ordinary marketplace.
-- They are intentionally NOT declared AI-ready until owners provide and confirm
-- calculation-ready commercial information.
UPDATE wewed_admin."ProviderServiceOffering"
SET
  "pricingVisibility" = CASE
    WHEN "startingPriceCents" IS NOT NULL AND "maximumPriceCents" IS NOT NULL THEN 'range'
    WHEN "startingPriceCents" IS NOT NULL THEN 'from'
    ELSE 'quote_only'
  END,
  "aiReadinessScore" = 0,
  "aiReadinessStatus" = 'not_ready',
  "aiReadinessMissing" = '["Confirm structured commercial pricing for AI Wedding Architect"]'::jsonb
WHERE "ownerConfirmedCommercialAt" IS NULL;
