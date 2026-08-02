-- Planner profiles, discovery, enquiries and secure appointment.
-- Additive only. Billing, Stripe metadata and PaymentRecord are intentionally untouched.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

CREATE TABLE IF NOT EXISTS wewed_admin."PlannerProfile" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "headline" TEXT,
  "bio" TEXT,
  "yearsExperience" INTEGER,
  "serviceAreas" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "services" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "weddingStyles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "languages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "priceBand" TEXT NOT NULL DEFAULT 'contact',
  "minimumGuestCount" INTEGER,
  "maximumGuestCount" INTEGER,
  "availabilityStatus" TEXT NOT NULL DEFAULT 'accepting',
  "portfolio" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "reviewNotes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlannerProfile_businessAccountId_key" UNIQUE ("businessAccountId"),
  CONSTRAINT "PlannerProfile_slug_key" UNIQUE ("slug"),
  CONSTRAINT "PlannerProfile_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlannerProfile_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlannerProfile_status_check" CHECK ("status" IN ('draft','submitted','changes_requested','published','rejected','suspended','archived')),
  CONSTRAINT "PlannerProfile_availability_check" CHECK ("availabilityStatus" IN ('accepting','limited','unavailable')),
  CONSTRAINT "PlannerProfile_price_check" CHECK ("priceBand" IN ('contact','budget','standard','premium','luxury')),
  CONSTRAINT "PlannerProfile_experience_check" CHECK ("yearsExperience" IS NULL OR "yearsExperience" BETWEEN 0 AND 80),
  CONSTRAINT "PlannerProfile_guest_range_check" CHECK (
    ("minimumGuestCount" IS NULL OR "minimumGuestCount" >= 0) AND
    ("maximumGuestCount" IS NULL OR "maximumGuestCount" >= 0) AND
    ("minimumGuestCount" IS NULL OR "maximumGuestCount" IS NULL OR "minimumGuestCount" <= "maximumGuestCount")
  ),
  CONSTRAINT "PlannerProfile_arrays_check" CHECK (
    jsonb_typeof("serviceAreas") = 'array' AND
    jsonb_typeof("services") = 'array' AND
    jsonb_typeof("weddingStyles") = 'array' AND
    jsonb_typeof("languages") = 'array' AND
    jsonb_typeof("portfolio") = 'array'
  )
);

CREATE INDEX IF NOT EXISTS "PlannerProfile_status_availability_idx"
  ON wewed_admin."PlannerProfile"("status", "availabilityStatus");
CREATE INDEX IF NOT EXISTS "PlannerProfile_serviceAreas_gin_idx"
  ON wewed_admin."PlannerProfile" USING GIN ("serviceAreas");
CREATE INDEX IF NOT EXISTS "PlannerProfile_services_gin_idx"
  ON wewed_admin."PlannerProfile" USING GIN ("services");
CREATE INDEX IF NOT EXISTS "PlannerProfile_styles_gin_idx"
  ON wewed_admin."PlannerProfile" USING GIN ("weddingStyles");

CREATE TABLE IF NOT EXISTS wewed_admin."PlannerShortlist" (
  "id" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "plannerProfileId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerShortlist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlannerShortlist_wedding_profile_key" UNIQUE ("weddingId", "plannerProfileId"),
  CONSTRAINT "PlannerShortlist_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlannerShortlist_plannerProfileId_fkey" FOREIGN KEY ("plannerProfileId") REFERENCES wewed_admin."PlannerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlannerShortlist_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlannerShortlist_user_wedding_idx"
  ON wewed_admin."PlannerShortlist"("createdByUserId", "weddingId");

CREATE TABLE IF NOT EXISTS wewed_admin."PlannerEnquiry" (
  "id" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "coupleBusinessAccountId" TEXT NOT NULL,
  "plannerBusinessAccountId" TEXT NOT NULL,
  "plannerProfileId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "weddingDate" TIMESTAMP(3) NOT NULL,
  "location" TEXT NOT NULL,
  "guestCountMin" INTEGER,
  "guestCountMax" INTEGER,
  "budgetBand" TEXT NOT NULL DEFAULT 'not_sure',
  "weddingStyles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "services" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "message" TEXT,
  "sharedSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "plannerResponse" TEXT,
  "respondedByUserId" TEXT,
  "respondedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerEnquiry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlannerEnquiry_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlannerEnquiry_coupleAccount_fkey" FOREIGN KEY ("coupleBusinessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEnquiry_plannerAccount_fkey" FOREIGN KEY ("plannerBusinessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEnquiry_profile_fkey" FOREIGN KEY ("plannerProfileId") REFERENCES wewed_admin."PlannerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEnquiry_createdBy_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEnquiry_respondedBy_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlannerEnquiry_status_check" CHECK ("status" IN ('submitted','viewed','responded','consultation_requested','accepted_interest','declined','withdrawn','appointed','closed')),
  CONSTRAINT "PlannerEnquiry_budget_check" CHECK ("budgetBand" IN ('not_sure','under_10k','10k_25k','25k_50k','50k_100k','over_100k')),
  CONSTRAINT "PlannerEnquiry_guest_range_check" CHECK (
    ("guestCountMin" IS NULL OR "guestCountMin" >= 0) AND
    ("guestCountMax" IS NULL OR "guestCountMax" >= 0) AND
    ("guestCountMin" IS NULL OR "guestCountMax" IS NULL OR "guestCountMin" <= "guestCountMax")
  ),
  CONSTRAINT "PlannerEnquiry_json_check" CHECK (
    jsonb_typeof("weddingStyles") = 'array' AND
    jsonb_typeof("services") = 'array' AND
    jsonb_typeof("sharedSummary") = 'object'
  )
);
CREATE INDEX IF NOT EXISTS "PlannerEnquiry_planner_status_idx"
  ON wewed_admin."PlannerEnquiry"("plannerBusinessAccountId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PlannerEnquiry_wedding_status_idx"
  ON wewed_admin."PlannerEnquiry"("weddingId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PlannerEnquiry_open_duplicate_key"
  ON wewed_admin."PlannerEnquiry"("weddingId", "plannerProfileId")
  WHERE "status" IN ('submitted','viewed','responded','consultation_requested','accepted_interest');

CREATE TABLE IF NOT EXISTS wewed_admin."PlannerEngagement" (
  "id" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "coupleBusinessAccountId" TEXT NOT NULL,
  "plannerBusinessAccountId" TEXT NOT NULL,
  "plannerUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "authorityBundle" TEXT,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "membershipId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "authorizedByUserId" TEXT,
  "endedByUserId" TEXT,
  "endReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "authorizedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerEngagement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlannerEngagement_enquiryId_key" UNIQUE ("enquiryId"),
  CONSTRAINT "PlannerEngagement_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES wewed_admin."PlannerEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_coupleAccount_fkey" FOREIGN KEY ("coupleBusinessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_plannerAccount_fkey" FOREIGN KEY ("plannerBusinessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_plannerUserId_fkey" FOREIGN KEY ("plannerUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_requestedBy_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_acceptedBy_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_authorizedBy_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_endedBy_fkey" FOREIGN KEY ("endedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlannerEngagement_status_check" CHECK ("status" IN ('requested','planner_accepted','active','paused','completed','revoked','cancelled')),
  CONSTRAINT "PlannerEngagement_bundle_check" CHECK ("authorityBundle" IS NULL OR "authorityBundle" IN ('consultation','planning','coordination','full_coordination')),
  CONSTRAINT "PlannerEngagement_permissions_check" CHECK (jsonb_typeof("permissions") = 'array')
);
CREATE INDEX IF NOT EXISTS "PlannerEngagement_planner_status_idx"
  ON wewed_admin."PlannerEngagement"("plannerBusinessAccountId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PlannerEngagement_wedding_status_idx"
  ON wewed_admin."PlannerEngagement"("weddingId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PlannerEngagement_one_current_per_wedding"
  ON wewed_admin."PlannerEngagement"("weddingId")
  WHERE "status" IN ('requested','planner_accepted','active','paused');

CREATE OR REPLACE FUNCTION wewed_admin.validate_planner_marketplace_graph()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, wewed_admin
AS $$
DECLARE
  planner_account_type text;
  planner_account_status text;
  planner_onboarding text;
  profile_account text;
  couple_account_type text;
BEGIN
  IF TG_TABLE_NAME = 'PlannerProfile' THEN
    SELECT type, status, "onboardingStatus"
      INTO planner_account_type, planner_account_status, planner_onboarding
    FROM wewed_admin."BusinessAccount"
    WHERE id = NEW."businessAccountId";

    IF planner_account_type IS DISTINCT FROM 'planning_company'
       OR planner_account_status IS DISTINCT FROM 'active'
       OR planner_onboarding IS DISTINCT FROM 'complete' THEN
      RAISE EXCEPTION 'Planner profile requires an active, completely onboarded planning company account.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT type, status, "onboardingStatus"
    INTO planner_account_type, planner_account_status, planner_onboarding
  FROM wewed_admin."BusinessAccount"
  WHERE id = NEW."plannerBusinessAccountId";

  SELECT "businessAccountId" INTO profile_account
  FROM wewed_admin."PlannerProfile"
  WHERE id = NEW."plannerProfileId";

  SELECT type INTO couple_account_type
  FROM wewed_admin."BusinessAccount"
  WHERE id = NEW."coupleBusinessAccountId";

  IF planner_account_type IS DISTINCT FROM 'planning_company'
     OR planner_account_status IS DISTINCT FROM 'active'
     OR planner_onboarding IS DISTINCT FROM 'complete'
     OR profile_account IS DISTINCT FROM NEW."plannerBusinessAccountId"
     OR couple_account_type IS DISTINCT FROM 'couple' THEN
    RAISE EXCEPTION 'Invalid planner marketplace stakeholder graph.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wewed_admin."BusinessAccountLink" bal
    WHERE bal."businessAccountId" = NEW."coupleBusinessAccountId"
      AND bal."entityType" = 'wedding'
      AND bal."entityId" = NEW."weddingId"
      AND bal.relationship = 'owns'
  ) THEN
    RAISE EXCEPTION 'Couple business account does not own the selected wedding.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "PlannerProfile_graph_guard" ON wewed_admin."PlannerProfile";
CREATE TRIGGER "PlannerProfile_graph_guard"
BEFORE INSERT OR UPDATE OF "businessAccountId" ON wewed_admin."PlannerProfile"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_planner_marketplace_graph();

DROP TRIGGER IF EXISTS "PlannerEnquiry_graph_guard" ON wewed_admin."PlannerEnquiry";
CREATE TRIGGER "PlannerEnquiry_graph_guard"
BEFORE INSERT OR UPDATE OF "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId", "plannerProfileId"
ON wewed_admin."PlannerEnquiry"
FOR EACH ROW EXECUTE FUNCTION wewed_admin.validate_planner_marketplace_graph();

CREATE VIEW public."PlannerProfile" WITH (security_invoker = true) AS SELECT * FROM wewed_admin."PlannerProfile";
CREATE VIEW public."PlannerShortlist" WITH (security_invoker = true) AS SELECT * FROM wewed_admin."PlannerShortlist";
CREATE VIEW public."PlannerEnquiry" WITH (security_invoker = true) AS SELECT * FROM wewed_admin."PlannerEnquiry";
CREATE VIEW public."PlannerEngagement" WITH (security_invoker = true) AS SELECT * FROM wewed_admin."PlannerEngagement";

REVOKE ALL PRIVILEGES ON TABLE wewed_admin."PlannerProfile" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE wewed_admin."PlannerShortlist" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE wewed_admin."PlannerEnquiry" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE wewed_admin."PlannerEngagement" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PlannerProfile" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PlannerShortlist" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PlannerEnquiry" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PlannerEngagement" FROM PUBLIC;

DO $wewed_marketplace_roles$
DECLARE
  role_name text;
  object_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_admin FROM %I', role_name);
      FOREACH object_name IN ARRAY ARRAY['PlannerProfile','PlannerShortlist','PlannerEnquiry','PlannerEngagement'] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I', object_name, role_name);
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', object_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END
$wewed_marketplace_roles$;
