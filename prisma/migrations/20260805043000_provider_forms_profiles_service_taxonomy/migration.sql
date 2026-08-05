-- Additive provider marketplace data layer.
-- Existing wedding-scoped Vendor records, planner authority, invitations and wedding data are unchanged.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderProfile" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "headline" TEXT,
  "description" TEXT,
  "country" TEXT,
  "city" TEXT,
  "serviceAreas" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "languages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "publicEmail" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "socialLinks" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "yearsOperating" INTEGER,
  "teamSize" INTEGER,
  "responseTime" TEXT,
  "minimumBookingNotice" TEXT,
  "travelRadiusKm" INTEGER,
  "paymentMethods" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "depositPolicy" TEXT,
  "cancellationPolicy" TEXT,
  "refundPolicy" TEXT,
  "travelPolicy" TEXT,
  "accessibilitySupport" TEXT,
  "culturalExperience" TEXT,
  "coverImageUrl" TEXT,
  "faq" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "verificationBadges" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "visibility" TEXT NOT NULL DEFAULT 'draft',
  "completionScore" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "lastProfileUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderProfile_businessAccountId_key" UNIQUE ("businessAccountId"),
  CONSTRAINT "ProviderProfile_slug_key" UNIQUE ("slug"),
  CONSTRAINT "ProviderProfile_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderProfile_visibility_check" CHECK ("visibility" IN ('draft', 'published')),
  CONSTRAINT "ProviderProfile_completionScore_check" CHECK ("completionScore" BETWEEN 0 AND 100),
  CONSTRAINT "ProviderProfile_yearsOperating_check" CHECK ("yearsOperating" IS NULL OR "yearsOperating" BETWEEN 0 AND 300),
  CONSTRAINT "ProviderProfile_teamSize_check" CHECK ("teamSize" IS NULL OR "teamSize" BETWEEN 1 AND 10000),
  CONSTRAINT "ProviderProfile_travelRadiusKm_check" CHECK ("travelRadiusKm" IS NULL OR "travelRadiusKm" BETWEEN 0 AND 50000)
);

CREATE INDEX IF NOT EXISTS "ProviderProfile_visibility_city_idx" ON wewed_admin."ProviderProfile"("visibility", "country", "city");
CREATE INDEX IF NOT EXISTS "ProviderProfile_updatedAt_idx" ON wewed_admin."ProviderProfile"("updatedAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderVerification" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "legalName" TEXT,
  "registrationNumber" TEXT,
  "taxNumber" TEXT,
  "representativeName" TEXT,
  "physicalAddress" TEXT,
  "secondaryContact" TEXT,
  "identityStatus" TEXT NOT NULL DEFAULT 'not_submitted',
  "businessStatus" TEXT NOT NULL DEFAULT 'not_submitted',
  "insuranceStatus" TEXT NOT NULL DEFAULT 'not_submitted',
  "permitStatus" TEXT NOT NULL DEFAULT 'not_applicable',
  "reviewNotes" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderVerification_businessAccountId_key" UNIQUE ("businessAccountId"),
  CONSTRAINT "ProviderVerification_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderVerification_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderServiceOffering" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "startingPriceCents" INTEGER,
  "maximumPriceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "pricingModel" TEXT,
  "minimumCapacity" INTEGER,
  "maximumCapacity" INTEGER,
  "bookingLeadTime" TEXT,
  "serviceAreas" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "inclusions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "completionScore" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderServiceOffering_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderServiceOffering_account_category_key" UNIQUE ("businessAccountId", "category"),
  CONSTRAINT "ProviderServiceOffering_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderServiceOffering_status_check" CHECK ("status" IN ('draft', 'published')),
  CONSTRAINT "ProviderServiceOffering_price_check" CHECK (
    ("startingPriceCents" IS NULL OR "startingPriceCents" >= 0) AND
    ("maximumPriceCents" IS NULL OR "maximumPriceCents" >= 0) AND
    ("startingPriceCents" IS NULL OR "maximumPriceCents" IS NULL OR "startingPriceCents" <= "maximumPriceCents")
  ),
  CONSTRAINT "ProviderServiceOffering_capacity_check" CHECK (
    ("minimumCapacity" IS NULL OR "minimumCapacity" >= 0) AND
    ("maximumCapacity" IS NULL OR "maximumCapacity" >= 0) AND
    ("minimumCapacity" IS NULL OR "maximumCapacity" IS NULL OR "minimumCapacity" <= "maximumCapacity")
  ),
  CONSTRAINT "ProviderServiceOffering_completionScore_check" CHECK ("completionScore" BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS "ProviderServiceOffering_category_status_idx" ON wewed_admin."ProviderServiceOffering"("category", "status");
CREATE INDEX IF NOT EXISTS "ProviderServiceOffering_business_idx" ON wewed_admin."ProviderServiceOffering"("businessAccountId", "updatedAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderPackage" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "pricingUnit" TEXT,
  "inclusions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderPackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderPackage_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES wewed_admin."ProviderServiceOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderPackage_price_check" CHECK ("priceCents" IS NULL OR "priceCents" >= 0)
);

CREATE INDEX IF NOT EXISTS "ProviderPackage_offering_order_idx" ON wewed_admin."ProviderPackage"("offeringId", "sortOrder");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderPortfolioItem" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'image',
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "altText" TEXT,
  "caption" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderPortfolioItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderPortfolioItem_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES wewed_admin."ProviderServiceOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderPortfolioItem_type_check" CHECK ("type" IN ('image', 'video', 'link'))
);

CREATE INDEX IF NOT EXISTS "ProviderPortfolioItem_offering_order_idx" ON wewed_admin."ProviderPortfolioItem"("offeringId", "sortOrder");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderEnquiry" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "providerBusinessAccountId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "coupleBusinessAccountId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "eventDate" TIMESTAMP(3),
  "location" TEXT,
  "guestCount" INTEGER,
  "budgetBand" TEXT,
  "contactPreference" TEXT,
  "structuredAnswers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sharedSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "message" TEXT,
  "providerResponse" TEXT,
  "respondedByUserId" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderEnquiry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderEnquiry_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES wewed_admin."ProviderServiceOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProviderEnquiry_providerBusinessAccountId_fkey" FOREIGN KEY ("providerBusinessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProviderEnquiry_coupleBusinessAccountId_fkey" FOREIGN KEY ("coupleBusinessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProviderEnquiry_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderEnquiry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProviderEnquiry_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderEnquiry_status_check" CHECK ("status" IN ('sent', 'viewed', 'responded', 'declined', 'withdrawn', 'closed')),
  CONSTRAINT "ProviderEnquiry_guestCount_check" CHECK ("guestCount" IS NULL OR "guestCount" BETWEEN 0 AND 100000)
);

CREATE INDEX IF NOT EXISTS "ProviderEnquiry_provider_status_idx" ON wewed_admin."ProviderEnquiry"("providerBusinessAccountId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProviderEnquiry_wedding_status_idx" ON wewed_admin."ProviderEnquiry"("weddingId", "status", "createdAt");

ALTER TABLE wewed_admin."PlannerProfile"
  ADD COLUMN IF NOT EXISTS "completedWeddings" INTEGER,
  ADD COLUMN IF NOT EXISTS "teamSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "profileDetails" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "packages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "faq" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "verificationBadges" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "lastProfileUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $provider_planner_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlannerProfile_completedWeddings_check') THEN
    ALTER TABLE wewed_admin."PlannerProfile"
      ADD CONSTRAINT "PlannerProfile_completedWeddings_check" CHECK ("completedWeddings" IS NULL OR "completedWeddings" BETWEEN 0 AND 100000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlannerProfile_teamSize_check') THEN
    ALTER TABLE wewed_admin."PlannerProfile"
      ADD CONSTRAINT "PlannerProfile_teamSize_check" CHECK ("teamSize" IS NULL OR "teamSize" BETWEEN 1 AND 10000);
  END IF;
END
$provider_planner_constraints$;

CREATE OR REPLACE VIEW public."PlannerProfile" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."PlannerProfile";

CREATE OR REPLACE VIEW public."ProviderProfile" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderProfile";
CREATE OR REPLACE VIEW public."ProviderServiceOffering" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderServiceOffering";
CREATE OR REPLACE VIEW public."ProviderPackage" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderPackage";
CREATE OR REPLACE VIEW public."ProviderPortfolioItem" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderPortfolioItem";
CREATE OR REPLACE VIEW public."ProviderEnquiry" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderEnquiry";

REVOKE ALL PRIVILEGES ON TABLE public."ProviderProfile" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."ProviderServiceOffering" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."ProviderPackage" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."ProviderPortfolioItem" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."ProviderEnquiry" FROM PUBLIC;

DO $provider_view_roles$
DECLARE
  role_name text;
  view_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_admin FROM %I', role_name);
      FOREACH view_name IN ARRAY ARRAY[
        'ProviderProfile',
        'ProviderServiceOffering',
        'ProviderPackage',
        'ProviderPortfolioItem',
        'ProviderEnquiry'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', view_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END
$provider_view_roles$;

-- Seed draft normalized records from currently stored legacy provider metadata.
INSERT INTO wewed_admin."ProviderProfile" (
  "id", "businessAccountId", "slug", "displayName", "headline", "description",
  "serviceAreas", "phone", "website", "coverImageUrl", "visibility", "publishedAt", "lastProfileUpdate"
)
SELECT
  'provider-profile-' || ba.id,
  ba.id,
  ba.slug,
  COALESCE(NULLIF(ba.metadata->'publicProfile'->>'displayName', ''), ba.name),
  NULLIF(ba.metadata->'publicProfile'->>'headline', ''),
  NULLIF(ba.metadata->'publicProfile'->>'description', ''),
  CASE WHEN jsonb_typeof(ba.metadata->'publicProfile'->'serviceAreas') = 'array' THEN ba.metadata->'publicProfile'->'serviceAreas' ELSE '[]'::jsonb END,
  NULLIF(ba.metadata->'publicProfile'->>'phone', ''),
  NULLIF(ba.metadata->'publicProfile'->>'website', ''),
  NULLIF(ba.metadata->'publicProfile'->>'imageUrl', ''),
  CASE WHEN ba.metadata->'publicProfile'->>'visibility' = 'published' THEN 'published' ELSE 'draft' END,
  CASE WHEN ba.metadata->'publicProfile'->>'visibility' = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END,
  CURRENT_TIMESTAMP
FROM wewed_admin."BusinessAccount" ba
WHERE ba.type IN ('venue', 'vendor')
  AND ba.metadata ? 'publicProfile'
ON CONFLICT ("businessAccountId") DO NOTHING;

INSERT INTO wewed_admin."ProviderServiceOffering" (
  "id", "businessAccountId", "category", "displayName", "description", "status",
  "serviceAreas", "inclusions", "details", "publishedAt"
)
SELECT
  'provider-offering-' || ba.id || '-' || COALESCE(NULLIF(ba.metadata->'publicProfile'->>'category', ''), CASE WHEN ba.type = 'venue' THEN 'venue' ELSE 'other' END),
  ba.id,
  COALESCE(NULLIF(ba.metadata->'publicProfile'->>'category', ''), CASE WHEN ba.type = 'venue' THEN 'venue' ELSE 'other' END),
  COALESCE(NULLIF(ba.metadata->'publicProfile'->>'displayName', ''), ba.name),
  NULLIF(ba.metadata->'publicProfile'->>'description', ''),
  CASE WHEN ba.metadata->'publicProfile'->>'visibility' = 'published' THEN 'published' ELSE 'draft' END,
  CASE WHEN jsonb_typeof(ba.metadata->'publicProfile'->'serviceAreas') = 'array' THEN ba.metadata->'publicProfile'->'serviceAreas' ELSE '[]'::jsonb END,
  CASE WHEN jsonb_typeof(ba.metadata->'publicProfile'->'services') = 'array' THEN ba.metadata->'publicProfile'->'services' ELSE '[]'::jsonb END,
  '{}'::jsonb,
  CASE WHEN ba.metadata->'publicProfile'->>'visibility' = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END
FROM wewed_admin."BusinessAccount" ba
WHERE ba.type IN ('venue', 'vendor')
  AND ba.metadata ? 'publicProfile'
ON CONFLICT ("businessAccountId", "category") DO NOTHING;
