-- Wewed marketplace population, provenance, provisional listing, claim and correction pipeline.
-- Additive only: existing provider, account, wedding and billing data is preserved.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

ALTER TABLE wewed_admin."ProviderProfile"
  ADD COLUMN IF NOT EXISTS "listingStatus" TEXT NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS "isClaimable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "acceptingEnquiries" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sourceSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "dataProvenance" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "fieldConfidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "lastSourceCheckAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ownerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "provisionalPublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimNotice" TEXT;

DO $provider_profile_claim_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProviderProfile_listingStatus_check'
  ) THEN
    ALTER TABLE wewed_admin."ProviderProfile"
      ADD CONSTRAINT "ProviderProfile_listingStatus_check"
      CHECK ("listingStatus" IN (
        'unclaimed', 'claim_pending', 'claimed', 'verified', 'suspended', 'removed'
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProviderProfile_provenance_array_check'
  ) THEN
    ALTER TABLE wewed_admin."ProviderProfile"
      ADD CONSTRAINT "ProviderProfile_provenance_array_check"
      CHECK (jsonb_typeof("dataProvenance") = 'array');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProviderProfile_fieldConfidence_object_check'
  ) THEN
    ALTER TABLE wewed_admin."ProviderProfile"
      ADD CONSTRAINT "ProviderProfile_fieldConfidence_object_check"
      CHECK (jsonb_typeof("fieldConfidence") = 'object');
  END IF;
END
$provider_profile_claim_constraints$;

CREATE INDEX IF NOT EXISTS "ProviderProfile_listing_visibility_location_idx"
  ON wewed_admin."ProviderProfile"("listingStatus", "visibility", "country", "city");
CREATE INDEX IF NOT EXISTS "ProviderProfile_claimable_idx"
  ON wewed_admin."ProviderProfile"("isClaimable", "listingStatus")
  WHERE "isClaimable" = true;

ALTER TABLE wewed_admin."ProviderServiceOffering"
  ADD COLUMN IF NOT EXISTS "sourceConfidence" INTEGER,
  ADD COLUMN IF NOT EXISTS "dataProvenance" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "ownerConfirmedAt" TIMESTAMP(3);

DO $provider_offering_source_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_sourceConfidence_check'
  ) THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_sourceConfidence_check"
      CHECK ("sourceConfidence" IS NULL OR "sourceConfidence" BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProviderServiceOffering_provenance_array_check'
  ) THEN
    ALTER TABLE wewed_admin."ProviderServiceOffering"
      ADD CONSTRAINT "ProviderServiceOffering_provenance_array_check"
      CHECK (jsonb_typeof("dataProvenance") = 'array');
  END IF;
END
$provider_offering_source_constraints$;

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderDiscoveryJob" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "country" TEXT NOT NULL DEFAULT 'Zimbabwe',
  "categories" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "places" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sourceTypes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  "reviewedCount" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderDiscoveryJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderDiscoveryJob_status_check" CHECK (
    "status" IN ('draft', 'running', 'paused', 'review', 'completed', 'cancelled', 'failed')
  ),
  CONSTRAINT "ProviderDiscoveryJob_counts_check" CHECK (
    "targetCount" >= 0 AND "discoveredCount" >= 0 AND "reviewedCount" >= 0 AND
    "importedCount" >= 0 AND "duplicateCount" >= 0 AND "rejectedCount" >= 0 AND
    "errorCount" >= 0
  ),
  CONSTRAINT "ProviderDiscoveryJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProviderDiscoveryJob_status_created_idx"
  ON wewed_admin."ProviderDiscoveryJob"("status", "createdAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderDiscoveryCandidate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "jobId" TEXT,
  "displayName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "primaryCategory" TEXT NOT NULL,
  "additionalCategories" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "country" TEXT NOT NULL DEFAULT 'Zimbabwe',
  "province" TEXT,
  "district" TEXT,
  "city" TEXT,
  "serviceAreas" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "website" TEXT,
  "publicEmail" TEXT,
  "phone" TEXT,
  "socialLinks" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "headline" TEXT,
  "description" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataProvenance" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "fieldConfidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "aggregateConfidence" INTEGER NOT NULL DEFAULT 0,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'discovered',
  "rightsStatus" TEXT NOT NULL DEFAULT 'facts_only',
  "importedBusinessAccountId" TEXT,
  "reviewedByUserId" TEXT,
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderDiscoveryCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderDiscoveryCandidate_jobId_fkey" FOREIGN KEY ("jobId")
    REFERENCES wewed_admin."ProviderDiscoveryJob"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderDiscoveryCandidate_importedBusinessAccountId_fkey" FOREIGN KEY ("importedBusinessAccountId")
    REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderDiscoveryCandidate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderDiscoveryCandidate_dedupeKey_key" UNIQUE ("dedupeKey"),
  CONSTRAINT "ProviderDiscoveryCandidate_confidence_check" CHECK ("aggregateConfidence" BETWEEN 0 AND 100),
  CONSTRAINT "ProviderDiscoveryCandidate_status_check" CHECK (
    "status" IN ('discovered', 'enriched', 'needs_review', 'approved', 'duplicate', 'rejected', 'imported')
  ),
  CONSTRAINT "ProviderDiscoveryCandidate_rights_check" CHECK (
    "rightsStatus" IN ('facts_only', 'licensed_media', 'owner_authorised_media', 'blocked')
  ),
  CONSTRAINT "ProviderDiscoveryCandidate_provenance_array_check" CHECK (jsonb_typeof("dataProvenance") = 'array'),
  CONSTRAINT "ProviderDiscoveryCandidate_confidence_object_check" CHECK (jsonb_typeof("fieldConfidence") = 'object')
);

CREATE INDEX IF NOT EXISTS "ProviderDiscoveryCandidate_category_location_status_idx"
  ON wewed_admin."ProviderDiscoveryCandidate"("primaryCategory", "province", "city", "status");
CREATE INDEX IF NOT EXISTS "ProviderDiscoveryCandidate_job_status_idx"
  ON wewed_admin."ProviderDiscoveryCandidate"("jobId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderDiscoverySource" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "candidateId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceName" TEXT,
  "accessMethod" TEXT NOT NULL DEFAULT 'public_web',
  "termsStatus" TEXT NOT NULL DEFAULT 'review_required',
  "robotsStatus" TEXT NOT NULL DEFAULT 'not_applicable',
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "contentHash" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "mediaReuseAllowed" BOOLEAN NOT NULL DEFAULT false,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderDiscoverySource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderDiscoverySource_candidateId_fkey" FOREIGN KEY ("candidateId")
    REFERENCES wewed_admin."ProviderDiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderDiscoverySource_candidate_url_key" UNIQUE ("candidateId", "sourceUrl"),
  CONSTRAINT "ProviderDiscoverySource_type_check" CHECK (
    "sourceType" IN (
      'official_website', 'facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok',
      'google_business', 'licensed_directory', 'company_registry', 'association',
      'planner_referral', 'owner_submission', 'public_search', 'other'
    )
  ),
  CONSTRAINT "ProviderDiscoverySource_access_check" CHECK (
    "accessMethod" IN ('official_api', 'licensed_feed', 'public_web', 'manual_research', 'owner_submission')
  ),
  CONSTRAINT "ProviderDiscoverySource_terms_check" CHECK (
    "termsStatus" IN ('approved', 'review_required', 'restricted', 'prohibited')
  ),
  CONSTRAINT "ProviderDiscoverySource_robots_check" CHECK (
    "robotsStatus" IN ('allowed', 'disallowed', 'not_applicable', 'unknown')
  ),
  CONSTRAINT "ProviderDiscoverySource_confidence_check" CHECK ("confidence" BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS "ProviderDiscoverySource_type_checked_idx"
  ON wewed_admin."ProviderDiscoverySource"("sourceType", "lastCheckedAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderClaimRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerProfileId" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "claimantUserId" TEXT,
  "claimantName" TEXT NOT NULL,
  "claimantEmail" TEXT NOT NULL,
  "claimantPhone" TEXT,
  "relationship" TEXT NOT NULL,
  "verificationMethod" TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "message" TEXT,
  "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "verificationEvidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reviewNotes" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderClaimRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderClaimRequest_providerProfileId_fkey" FOREIGN KEY ("providerProfileId")
    REFERENCES wewed_admin."ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderClaimRequest_businessAccountId_fkey" FOREIGN KEY ("businessAccountId")
    REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderClaimRequest_claimantUserId_fkey" FOREIGN KEY ("claimantUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderClaimRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderClaimRequest_status_check" CHECK (
    "status" IN ('pending', 'verification_required', 'approved', 'rejected', 'withdrawn')
  ),
  CONSTRAINT "ProviderClaimRequest_method_check" CHECK (
    "verificationMethod" IN ('domain_email', 'business_phone', 'social_account', 'registration_document', 'manual_review')
  ),
  CONSTRAINT "ProviderClaimRequest_declaration_check" CHECK ("declarationAccepted" = true)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderClaimRequest_one_open_claim_idx"
  ON wewed_admin."ProviderClaimRequest"("providerProfileId", lower("claimantEmail"))
  WHERE "status" IN ('pending', 'verification_required');
CREATE INDEX IF NOT EXISTS "ProviderClaimRequest_status_created_idx"
  ON wewed_admin."ProviderClaimRequest"("status", "createdAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ProviderCorrectionRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerProfileId" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "reporterName" TEXT,
  "reporterEmail" TEXT,
  "fieldKey" TEXT,
  "currentValue" TEXT,
  "suggestedValue" TEXT,
  "reason" TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewNotes" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderCorrectionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderCorrectionRequest_providerProfileId_fkey" FOREIGN KEY ("providerProfileId")
    REFERENCES wewed_admin."ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderCorrectionRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProviderCorrectionRequest_type_check" CHECK (
    "requestType" IN ('correction', 'duplicate', 'privacy', 'removal', 'closed_business', 'other')
  ),
  CONSTRAINT "ProviderCorrectionRequest_status_check" CHECK (
    "status" IN ('pending', 'reviewing', 'resolved', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS "ProviderCorrectionRequest_status_created_idx"
  ON wewed_admin."ProviderCorrectionRequest"("status", "createdAt");

CREATE TABLE IF NOT EXISTS wewed_admin."ZimbabweMarketplacePlace" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT,
  "placeType" TEXT NOT NULL,
  "aliases" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sourceType" TEXT NOT NULL DEFAULT 'curated_seed',
  "sourceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ZimbabweMarketplacePlace_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ZimbabweMarketplacePlace_slug_key" UNIQUE ("slug"),
  CONSTRAINT "ZimbabweMarketplacePlace_type_check" CHECK (
    "placeType" IN ('city', 'town', 'municipality', 'local_board', 'growth_point', 'rural_service_centre', 'tourism_area', 'district')
  ),
  CONSTRAINT "ZimbabweMarketplacePlace_aliases_array_check" CHECK (jsonb_typeof("aliases") = 'array')
);

CREATE INDEX IF NOT EXISTS "ZimbabweMarketplacePlace_active_priority_idx"
  ON wewed_admin."ZimbabweMarketplacePlace"("active", "priority", "province", "name");

INSERT INTO wewed_admin."ZimbabweMarketplacePlace"
  ("id", "slug", "name", "province", "district", "placeType", "aliases", "priority", "sourceReference")
VALUES
  ('zw-place-harare', 'harare', 'Harare', 'Harare', 'Harare', 'city', '[]', 1, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-chitungwiza', 'chitungwiza', 'Chitungwiza', 'Harare', 'Chitungwiza', 'city', '[]', 5, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-epworth', 'epworth', 'Epworth', 'Harare', 'Harare', 'local_board', '[]', 20, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-bulawayo', 'bulawayo', 'Bulawayo', 'Bulawayo', 'Bulawayo', 'city', '[]', 2, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mutare', 'mutare', 'Mutare', 'Manicaland', 'Mutare', 'city', '[]', 3, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-rusape', 'rusape', 'Rusape', 'Manicaland', 'Makoni', 'town', '[]', 15, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-chipinge', 'chipinge', 'Chipinge', 'Manicaland', 'Chipinge', 'town', '[]', 18, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-nyanga', 'nyanga', 'Nyanga', 'Manicaland', 'Nyanga', 'town', '[]', 12, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-birchenough-bridge', 'birchenough-bridge', 'Birchenough Bridge', 'Manicaland', 'Buhera', 'growth_point', '[]', 40, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-murambinda', 'murambinda', 'Murambinda', 'Manicaland', 'Buhera', 'growth_point', '[]', 35, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-hauna', 'hauna', 'Hauna', 'Manicaland', 'Mutasa', 'growth_point', '[]', 45, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-gweru', 'gweru', 'Gweru', 'Midlands', 'Gweru', 'city', '[]', 4, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-kwekwe', 'kwekwe', 'Kwekwe', 'Midlands', 'Kwekwe', 'city', '[]', 6, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-redcliff', 'redcliff', 'Redcliff', 'Midlands', 'Kwekwe', 'town', '[]', 25, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-shurugwi', 'shurugwi', 'Shurugwi', 'Midlands', 'Shurugwi', 'town', '[]', 22, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-zvishavane', 'zvishavane', 'Zvishavane', 'Midlands', 'Zvishavane', 'town', '[]', 16, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mvuma', 'mvuma', 'Mvuma', 'Midlands', 'Chirumhanzu', 'town', '[]', 28, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-gokwe-centre', 'gokwe-centre', 'Gokwe Centre', 'Midlands', 'Gokwe South', 'town', '["Gokwe"]', 24, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-gokwe-nembudziya', 'nembudziya', 'Nembudziya', 'Midlands', 'Gokwe North', 'growth_point', '[]', 45, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mberengwa', 'mberengwa', 'Mberengwa', 'Midlands', 'Mberengwa', 'growth_point', '[]', 42, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-masvingo', 'masvingo', 'Masvingo', 'Masvingo', 'Masvingo', 'city', '[]', 5, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-chiredzi', 'chiredzi', 'Chiredzi', 'Masvingo', 'Chiredzi', 'town', '[]', 14, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-triangle', 'triangle', 'Triangle', 'Masvingo', 'Chiredzi', 'town', '[]', 25, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mashava', 'mashava', 'Mashava', 'Masvingo', 'Masvingo', 'town', '[]', 35, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-gutu', 'gutu', 'Gutu', 'Masvingo', 'Gutu', 'growth_point', '[]', 30, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-jerera', 'jerera', 'Jerera', 'Masvingo', 'Zaka', 'growth_point', '[]', 40, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-nyika', 'nyika', 'Nyika', 'Masvingo', 'Bikita', 'growth_point', '[]', 40, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-rutenga', 'rutenga', 'Rutenga', 'Masvingo', 'Mwenezi', 'growth_point', '[]', 42, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-victoria-falls', 'victoria-falls', 'Victoria Falls', 'Matabeleland North', 'Hwange', 'city', '["Vic Falls"]', 3, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-hwange', 'hwange', 'Hwange', 'Matabeleland North', 'Hwange', 'town', '[]', 15, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-lupane', 'lupane', 'Lupane', 'Matabeleland North', 'Lupane', 'town', '[]', 22, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-binga', 'binga', 'Binga', 'Matabeleland North', 'Binga', 'growth_point', '[]', 30, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-nkayi', 'nkayi', 'Nkayi', 'Matabeleland North', 'Nkayi', 'growth_point', '[]', 38, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-tsholotsho', 'tsholotsho', 'Tsholotsho', 'Matabeleland North', 'Tsholotsho', 'growth_point', '[]', 38, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-plumtree', 'plumtree', 'Plumtree', 'Matabeleland South', 'Bulilima', 'town', '[]', 18, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-gwanda', 'gwanda', 'Gwanda', 'Matabeleland South', 'Gwanda', 'town', '[]', 14, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-beithbridge', 'beitbridge', 'Beitbridge', 'Matabeleland South', 'Beitbridge', 'town', '["Beit Bridge"]', 12, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-filabusi', 'filabusi', 'Filabusi', 'Matabeleland South', 'Insiza', 'growth_point', '[]', 35, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-esigodini', 'esigodini', 'Esigodini', 'Matabeleland South', 'Umzingwane', 'growth_point', '["Essexvale"]', 28, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-kezi', 'kezi', 'Kezi', 'Matabeleland South', 'Matobo', 'growth_point', '[]', 38, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-bindura', 'bindura', 'Bindura', 'Mashonaland Central', 'Bindura', 'city', '[]', 8, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-shamva', 'shamva', 'Shamva', 'Mashonaland Central', 'Shamva', 'town', '[]', 25, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mazowe', 'mazowe', 'Mazowe', 'Mashonaland Central', 'Mazowe', 'town', '[]', 18, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-centenary', 'centenary', 'Centenary', 'Mashonaland Central', 'Muzarabani', 'growth_point', '[]', 38, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mount-darwin', 'mount-darwin', 'Mount Darwin', 'Mashonaland Central', 'Mount Darwin', 'town', '["Mt Darwin"]', 25, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mvurwi', 'mvurwi', 'Mvurwi', 'Mashonaland Central', 'Mazowe', 'town', '[]', 25, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-guruve', 'guruve', 'Guruve', 'Mashonaland Central', 'Guruve', 'growth_point', '[]', 32, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-chinhoyi', 'chinhoyi', 'Chinhoyi', 'Mashonaland West', 'Makonde', 'city', '[]', 7, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-kadoma', 'kadoma', 'Kadoma', 'Mashonaland West', 'Kadoma', 'city', '[]', 8, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-chegutu', 'chegutu', 'Chegutu', 'Mashonaland West', 'Chegutu', 'town', '[]', 15, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-kariba', 'kariba', 'Kariba', 'Mashonaland West', 'Kariba', 'town', '[]', 10, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-karoi', 'karoi', 'Karoi', 'Mashonaland West', 'Hurungwe', 'town', '[]', 18, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-norton', 'norton', 'Norton', 'Mashonaland West', 'Chegutu', 'town', '[]', 10, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-murombedzi', 'murombedzi', 'Murombedzi', 'Mashonaland West', 'Zvimba', 'growth_point', '[]', 35, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-banket', 'banket', 'Banket', 'Mashonaland West', 'Zvimba', 'town', '[]', 28, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-marondera', 'marondera', 'Marondera', 'Mashonaland East', 'Marondera', 'city', '[]', 7, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-ruwa', 'ruwa', 'Ruwa', 'Mashonaland East', 'Goromonzi', 'town', '[]', 8, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-murehwa', 'murehwa', 'Murehwa', 'Mashonaland East', 'Murehwa', 'growth_point', '["Murewa"]', 25, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-mudzi', 'mutoko', 'Mutoko', 'Mashonaland East', 'Mutoko', 'growth_point', '[]', 28, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-wedza', 'wedza', 'Wedza', 'Mashonaland East', 'Wedza', 'growth_point', '["Hwedza"]', 32, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-juru', 'juru', 'Juru', 'Mashonaland East', 'Goromonzi', 'growth_point', '[]', 40, 'Wewed curated Zimbabwe coverage seed'),
  ('zw-place-nyamapanda', 'nyamapanda', 'Nyamapanda', 'Mashonaland East', 'Mudzi', 'growth_point', '[]', 40, 'Wewed curated Zimbabwe coverage seed')
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "province" = EXCLUDED."province",
  "district" = EXCLUDED."district",
  "placeType" = EXCLUDED."placeType",
  "aliases" = EXCLUDED."aliases",
  "priority" = EXCLUDED."priority",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE wewed_admin."ProviderProfile"
SET
  "listingStatus" = CASE
    WHEN "listingStatus" IS NULL OR "listingStatus" = '' THEN 'claimed'
    ELSE "listingStatus"
  END,
  "isClaimable" = false,
  "acceptingEnquiries" = true
WHERE "ownerConfirmedAt" IS NOT NULL OR "listingStatus" IN ('claimed', 'verified');

CREATE OR REPLACE VIEW public."ProviderProfile" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderProfile";
CREATE OR REPLACE VIEW public."ProviderServiceOffering" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderServiceOffering";

REVOKE ALL PRIVILEGES ON TABLE public."ProviderProfile" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."ProviderServiceOffering" FROM PUBLIC;

DO $marketplace_private_privileges$
DECLARE
  role_name text;
  object_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_admin FROM %I', role_name);
      FOREACH object_name IN ARRAY ARRAY[
        'ProviderDiscoveryJob',
        'ProviderDiscoveryCandidate',
        'ProviderDiscoverySource',
        'ProviderClaimRequest',
        'ProviderCorrectionRequest',
        'ZimbabweMarketplacePlace'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I', object_name, role_name);
      END LOOP;
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."ProviderProfile" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."ProviderServiceOffering" FROM %I', role_name);
    END IF;
  END LOOP;
END
$marketplace_private_privileges$;
