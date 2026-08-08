-- Canonical wedding requirements shared by couples, planners and Wewed intelligence.
-- These records are private operational data; no direct browser grants/views are created.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

CREATE TABLE IF NOT EXISTS wewed_admin."WeddingRequirementProfile" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "weddingId" TEXT NOT NULL,
  "totalBudgetCents" BIGINT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "contingencyBasisPoints" INTEGER,
  "budgetFlexibilityBasisPoints" INTEGER,
  "guestCount" INTEGER,
  "adultCount" INTEGER,
  "childCount" INTEGER,
  "dateFlexibilityDays" INTEGER,
  "country" TEXT,
  "city" TEXT,
  "locationRadiusKm" INTEGER,
  "ceremonyType" TEXT,
  "receptionType" TEXT,
  "strategy" TEXT NOT NULL DEFAULT 'balanced',
  "styleTags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "culturalRequirements" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "paymentConstraints" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "notes" TEXT,
  "completionScore" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeddingRequirementProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeddingRequirementProfile_weddingId_key" UNIQUE ("weddingId"),
  CONSTRAINT "WeddingRequirementProfile_weddingId_fkey" FOREIGN KEY ("weddingId")
    REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeddingRequirementProfile_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WeddingRequirementProfile_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WeddingRequirementProfile_budget_check" CHECK ("totalBudgetCents" IS NULL OR "totalBudgetCents" >= 0),
  CONSTRAINT "WeddingRequirementProfile_contingency_check" CHECK ("contingencyBasisPoints" IS NULL OR "contingencyBasisPoints" BETWEEN 0 AND 10000),
  CONSTRAINT "WeddingRequirementProfile_flexibility_check" CHECK ("budgetFlexibilityBasisPoints" IS NULL OR "budgetFlexibilityBasisPoints" BETWEEN 0 AND 10000),
  CONSTRAINT "WeddingRequirementProfile_guest_count_check" CHECK (
    ("guestCount" IS NULL OR "guestCount" BETWEEN 0 AND 100000) AND
    ("adultCount" IS NULL OR "adultCount" BETWEEN 0 AND 100000) AND
    ("childCount" IS NULL OR "childCount" BETWEEN 0 AND 100000) AND
    ("guestCount" IS NULL OR "adultCount" IS NULL OR "childCount" IS NULL OR "adultCount" + "childCount" <= "guestCount")
  ),
  CONSTRAINT "WeddingRequirementProfile_date_flexibility_check" CHECK ("dateFlexibilityDays" IS NULL OR "dateFlexibilityDays" BETWEEN 0 AND 3650),
  CONSTRAINT "WeddingRequirementProfile_radius_check" CHECK ("locationRadiusKm" IS NULL OR "locationRadiusKm" BETWEEN 0 AND 50000),
  CONSTRAINT "WeddingRequirementProfile_strategy_check" CHECK ("strategy" IN ('value', 'balanced', 'priority_led')),
  CONSTRAINT "WeddingRequirementProfile_styleTags_array_check" CHECK (jsonb_typeof("styleTags") = 'array'),
  CONSTRAINT "WeddingRequirementProfile_culturalRequirements_array_check" CHECK (jsonb_typeof("culturalRequirements") = 'array'),
  CONSTRAINT "WeddingRequirementProfile_paymentConstraints_object_check" CHECK (jsonb_typeof("paymentConstraints") = 'object'),
  CONSTRAINT "WeddingRequirementProfile_completionScore_check" CHECK ("completionScore" BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS "WeddingRequirementProfile_confirmed_idx"
  ON wewed_admin."WeddingRequirementProfile"("confirmedAt", "updatedAt");

CREATE TABLE IF NOT EXISTS wewed_admin."WeddingCategoryRequirement" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "weddingId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'preferred',
  "requirements" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "notes" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeddingCategoryRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeddingCategoryRequirement_wedding_category_key" UNIQUE ("weddingId", "category"),
  CONSTRAINT "WeddingCategoryRequirement_weddingId_fkey" FOREIGN KEY ("weddingId")
    REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeddingCategoryRequirement_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WeddingCategoryRequirement_priority_check" CHECK (
    "priority" IN ('required', 'strong_preference', 'preferred', 'flexible', 'not_required')
  ),
  CONSTRAINT "WeddingCategoryRequirement_requirements_object_check" CHECK (jsonb_typeof("requirements") = 'object'),
  CONSTRAINT "WeddingCategoryRequirement_category_check" CHECK (
    "category" IN (
      'venue','planning','photography','videography','florals','catering','cakes','entertainment',
      'decor-rentals','beauty','attire','transport','stationery','officiants','jewellery',
      'accommodation-travel','tents-marquees','lighting-av','bar-beverages','photo-booth',
      'content-creation','gifts-favours','choreography','security','childcare','cleaning-sanitation','other'
    )
  )
);

CREATE INDEX IF NOT EXISTS "WeddingCategoryRequirement_wedding_priority_idx"
  ON wewed_admin."WeddingCategoryRequirement"("weddingId", "priority", "category");

DO $wedding_requirement_private_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_admin FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_admin."WeddingRequirementProfile" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_admin."WeddingCategoryRequirement" FROM %I', role_name);
    END IF;
  END LOOP;
END
$wedding_requirement_private_roles$;
