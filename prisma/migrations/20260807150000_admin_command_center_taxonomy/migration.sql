-- Admin Command Centre, Taxonomy, and Responsive Operations Plan
-- Phase 1: additive taxonomy/productivity schema and central BusinessAccount provisioning.
--
-- Safety contract:
-- - no existing BusinessAccount, User, Wedding, provider, planner, payment, support,
--   membership, billing-profile, department-assignment, or audit row is updated/deleted;
-- - existing department/billing rows are protected by ON CONFLICT DO NOTHING;
-- - the only writes to pre-existing tables are missing default department assignments and
--   missing billing profiles identified by the Phase 0 audit;
-- - all new structures stay inside wewed_admin with no direct anon/authenticated access.

CREATE SCHEMA IF NOT EXISTS wewed_admin;

CREATE TABLE IF NOT EXISTS wewed_admin."AccountSubtypeDefinition" (
  "subtypeKey" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountSubtypeDefinition_pkey" PRIMARY KEY ("subtypeKey", "accountType"),
  CONSTRAINT "AccountSubtypeDefinition_account_type_check"
    CHECK ("accountType" IN ('couple','planning_company','venue','vendor','client','wewed_internal')),
  CONSTRAINT "AccountSubtypeDefinition_status_check"
    CHECK (status IN ('active','retired'))
);

CREATE INDEX IF NOT EXISTS "AccountSubtypeDefinition_type_status_idx"
  ON wewed_admin."AccountSubtypeDefinition"("accountType", status, "sortOrder");

CREATE TABLE IF NOT EXISTS wewed_admin."BusinessAccountClassification" (
  "businessAccountId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "subtypeKey" TEXT,
  segment TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  "assignedByUserId" TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccountClassification_pkey" PRIMARY KEY ("businessAccountId"),
  CONSTRAINT "BusinessAccountClassification_businessAccountId_fkey"
    FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountClassification_subtype_fkey"
    FOREIGN KEY ("subtypeKey", "accountType")
    REFERENCES wewed_admin."AccountSubtypeDefinition"("subtypeKey", "accountType")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountClassification_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountClassification_account_type_check"
    CHECK ("accountType" IN ('couple','planning_company','venue','vendor','client','wewed_internal')),
  CONSTRAINT "BusinessAccountClassification_source_check"
    CHECK (source IN ('system','manual','import')),
  CONSTRAINT "BusinessAccountClassification_version_check" CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS "BusinessAccountClassification_type_subtype_idx"
  ON wewed_admin."BusinessAccountClassification"("accountType", "subtypeKey");
CREATE INDEX IF NOT EXISTS "BusinessAccountClassification_segment_idx"
  ON wewed_admin."BusinessAccountClassification"(segment)
  WHERE segment IS NOT NULL;

CREATE TABLE IF NOT EXISTS wewed_admin."InternalDepartmentDefinition" (
  "departmentKey" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalDepartmentDefinition_pkey" PRIMARY KEY ("departmentKey"),
  CONSTRAINT "InternalDepartmentDefinition_status_check"
    CHECK (status IN ('active','retired'))
);

CREATE TABLE IF NOT EXISTS wewed_admin."InternalStaffProfile" (
  "userId" TEXT NOT NULL,
  "departmentKey" TEXT,
  "jobTitle" TEXT,
  "employmentType" TEXT NOT NULL DEFAULT 'employee',
  "employmentStatus" TEXT NOT NULL DEFAULT 'active',
  "managerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalStaffProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "InternalStaffProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternalStaffProfile_departmentKey_fkey"
    FOREIGN KEY ("departmentKey") REFERENCES wewed_admin."InternalDepartmentDefinition"("departmentKey")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InternalStaffProfile_managerUserId_fkey"
    FOREIGN KEY ("managerUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InternalStaffProfile_employment_type_check"
    CHECK ("employmentType" IN ('employee','contractor','advisor')),
  CONSTRAINT "InternalStaffProfile_employment_status_check"
    CHECK ("employmentStatus" IN ('active','leave','suspended','left')),
  CONSTRAINT "InternalStaffProfile_manager_self_check"
    CHECK ("managerUserId" IS NULL OR "managerUserId" <> "userId")
);

CREATE INDEX IF NOT EXISTS "InternalStaffProfile_department_status_idx"
  ON wewed_admin."InternalStaffProfile"("departmentKey", "employmentStatus");
CREATE INDEX IF NOT EXISTS "InternalStaffProfile_manager_idx"
  ON wewed_admin."InternalStaffProfile"("managerUserId")
  WHERE "managerUserId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS wewed_admin."AdminWorkItem" (
  id TEXT NOT NULL,
  "businessAccountId" TEXT,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  "assignedToUserId" TEXT,
  "departmentKey" TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminWorkItem_pkey" PRIMARY KEY (id),
  CONSTRAINT "AdminWorkItem_businessAccountId_fkey"
    FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkItem_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES wewed_admin."PlatformAdministrator"("userId")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkItem_departmentKey_fkey"
    FOREIGN KEY ("departmentKey") REFERENCES wewed_admin."InternalDepartmentDefinition"("departmentKey")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkItem_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminWorkItem_priority_check"
    CHECK (priority IN ('low','normal','high','critical')),
  CONSTRAINT "AdminWorkItem_status_check"
    CHECK (status IN ('open','in_progress','blocked','resolved','dismissed')),
  CONSTRAINT "AdminWorkItem_source_check"
    CHECK (source IN ('manual','account','onboarding','billing','support','provider_claim','provider_verification','planner_relationship'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminWorkItem_resource_open_unique"
  ON wewed_admin."AdminWorkItem"("resourceType", "resourceId", category)
  WHERE status IN ('open','in_progress','blocked');
CREATE INDEX IF NOT EXISTS "AdminWorkItem_assignee_status_idx"
  ON wewed_admin."AdminWorkItem"("assignedToUserId", status, priority, "createdAt");
CREATE INDEX IF NOT EXISTS "AdminWorkItem_account_status_idx"
  ON wewed_admin."AdminWorkItem"("businessAccountId", status, "createdAt");
CREATE INDEX IF NOT EXISTS "AdminWorkItem_department_status_idx"
  ON wewed_admin."AdminWorkItem"("departmentKey", status, priority);

CREATE TABLE IF NOT EXISTS wewed_admin."AdminSavedView" (
  id TEXT NOT NULL,
  "administratorUserId" TEXT NOT NULL,
  name TEXT NOT NULL,
  screen TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSavedView_pkey" PRIMARY KEY (id),
  CONSTRAINT "AdminSavedView_administratorUserId_fkey"
    FOREIGN KEY ("administratorUserId") REFERENCES wewed_admin."PlatformAdministrator"("userId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminSavedView_filters_object_check" CHECK (jsonb_typeof(filters)='object'),
  CONSTRAINT "AdminSavedView_sort_object_check" CHECK (jsonb_typeof(sort)='object'),
  CONSTRAINT "AdminSavedView_columns_array_check" CHECK (jsonb_typeof(columns)='array'),
  CONSTRAINT "AdminSavedView_screen_check" CHECK (screen IN ('accounts','queue','commercial','people'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSavedView_admin_screen_name_unique"
  ON wewed_admin."AdminSavedView"("administratorUserId", screen, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSavedView_one_default_per_screen"
  ON wewed_admin."AdminSavedView"("administratorUserId", screen)
  WHERE "isDefault" = TRUE;

INSERT INTO wewed_admin."InternalDepartmentDefinition" (
  "departmentKey", name, description, status, "sortOrder"
) VALUES
  ('management', 'Management', 'Parent-company leadership, governance, and cross-functional decision ownership.', 'active', 10),
  ('operations', 'Operations', 'Account lifecycle, onboarding, service delivery, and operational coordination.', 'active', 20),
  ('marketplace', 'Marketplace', 'Planner, vendor, venue, discovery, claim, and verification operations.', 'active', 30),
  ('customer_support', 'Customer Support', 'Customer assistance, cases, incidents, and service recovery.', 'active', 40),
  ('billing_finance', 'Billing & Finance', 'Billing operations, payment review, commercial controls, and reconciliation.', 'active', 50),
  ('compliance', 'Compliance', 'Identity, provider verification, policy, and governance review.', 'active', 60),
  ('product_engineering', 'Product & Engineering', 'Product delivery, systems, reliability, data, and engineering operations.', 'active', 70),
  ('sales_partnerships', 'Sales & Partnerships', 'Commercial partnerships, business development, and contract relationships.', 'active', 80)
ON CONFLICT ("departmentKey") DO NOTHING;

INSERT INTO wewed_admin."AccountSubtypeDefinition" (
  "subtypeKey", "accountType", name, description, status, "sortOrder"
) VALUES
  ('couple_household','couple','Couple household','Direct couple/client wedding account.','active',10),
  ('planning_business','planning_company','Planning business','Wedding planning company or professional practice.','active',10),
  ('solo_planner','planning_company','Solo planner','Independent wedding planner operating a personal practice.','active',20),
  ('planning_studio','planning_company','Planning studio','Small planning studio or coordination team.','active',30),
  ('full_service_agency','planning_company','Full-service agency','Multi-service wedding planning agency.','active',40),
  ('coordination_only','planning_company','Coordination only','Business focused primarily on event-day or short-term coordination.','active',50),
  ('destination_planner','planning_company','Destination planner','Planner specialising in destination weddings.','active',60),
  ('venue_general','venue','Venue','General venue business.','active',10),
  ('hotel','venue','Hotel','Hotel or hotel-based wedding venue.','active',20),
  ('lodge','venue','Lodge','Lodge or resort wedding venue.','active',30),
  ('estate','venue','Estate','Estate or manor wedding venue.','active',40),
  ('garden','venue','Garden','Outdoor or garden wedding venue.','active',50),
  ('event_hall','venue','Event hall','Dedicated hall or event-space venue.','active',60),
  ('restaurant','venue','Restaurant','Restaurant or hospitality venue.','active',70),
  ('destination_venue','venue','Destination venue','Destination wedding venue.','active',80),
  ('vendor_general','vendor','Vendor','General wedding-service provider.','active',10),
  ('multi_service','vendor','Multi-service vendor','Provider with multiple active service categories.','active',20),
  ('venue','vendor','Venue services','Vendor-classified account offering venue services.','active',30),
  ('catering','vendor','Catering','Food and catering provider.','active',40),
  ('accommodation_travel','vendor','Accommodation & travel','Accommodation, travel, or guest logistics provider.','active',50),
  ('planning','vendor','Planning services','Provider offering planning or coordination services.','active',60),
  ('decor_rentals','vendor','Décor & rentals','Décor, furniture, styling, or rental provider.','active',70),
  ('photography','vendor','Photography','Wedding photography provider.','active',80),
  ('tents_marquees','vendor','Tents & marquees','Tent, marquee, or temporary-structure provider.','active',90),
  ('videography','vendor','Videography','Wedding videography provider.','active',100),
  ('cleaning_sanitation','vendor','Cleaning & sanitation','Event cleaning or sanitation provider.','active',110),
  ('cakes','vendor','Cakes','Wedding cake or confectionery provider.','active',120),
  ('beauty','vendor','Beauty','Hair, makeup, grooming, or beauty provider.','active',130),
  ('florals','vendor','Florals','Florist or floral design provider.','active',140),
  ('gifts_favours','vendor','Gifts & favours','Guest gifts, favours, or keepsake provider.','active',150),
  ('lighting_av','vendor','Lighting & AV','Lighting, sound, or audiovisual provider.','active',160),
  ('bar_beverages','vendor','Bar & beverages','Bar, beverage, or drinks provider.','active',170),
  ('security','vendor','Security','Event security provider.','active',180),
  ('stationery','vendor','Stationery','Invitation, stationery, or print provider.','active',190),
  ('transport','vendor','Transport','Wedding transport or logistics provider.','active',200),
  ('attire','vendor','Attire','Wedding clothing or attire provider.','active',210),
  ('entertainment','vendor','Entertainment','Music, DJ, live performance, or entertainment provider.','active',220),
  ('other_services','vendor','Other services','Other wedding-service provider.','active',230),
  ('jewellery','vendor','Jewellery','Jewellery or wedding-ring provider.','active',240),
  ('officiants','vendor','Officiants','Celebrant, officiant, or ceremony provider.','active',250),
  ('content_creation','vendor','Content creation','Wedding social/content creation provider.','active',260),
  ('photo_booth','vendor','Photo booth','Photo booth or interactive photo provider.','active',270),
  ('childcare','vendor','Childcare','Wedding or event childcare provider.','active',280),
  ('choreography','vendor','Choreography','Dance instruction or choreography provider.','active',290),
  ('business_client','client','Business client','General contract or partner business client.','active',10),
  ('partner','client','Partner','Strategic or service partner.','active',20),
  ('corporate_client','client','Corporate client','Corporate Wewed service client.','active',30),
  ('affiliate','client','Affiliate','Affiliate or referral relationship.','active',40),
  ('supplier','client','Supplier','Supplier or upstream service relationship.','active',50),
  ('wewed_parent_company','wewed_internal','Wewed parent company','Internal parent-company system account.','active',10)
ON CONFLICT ("subtypeKey", "accountType") DO NOTHING;

CREATE OR REPLACE FUNCTION wewed_admin.validate_business_account_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  actual_account_type TEXT;
BEGIN
  SELECT type INTO actual_account_type
  FROM wewed_admin."BusinessAccount"
  WHERE id = NEW."businessAccountId";

  IF actual_account_type IS NULL OR actual_account_type <> NEW."accountType" THEN
    RAISE EXCEPTION 'Classification account type does not match the business account.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_business_account_classification
  ON wewed_admin."BusinessAccountClassification";
CREATE TRIGGER validate_business_account_classification
BEFORE INSERT OR UPDATE OF "businessAccountId", "accountType", "subtypeKey"
ON wewed_admin."BusinessAccountClassification"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_business_account_classification();

CREATE OR REPLACE FUNCTION wewed_admin.default_business_account_subtype(
  p_business_account_id TEXT,
  p_account_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  service_category_count INTEGER := 0;
  single_category TEXT;
BEGIN
  IF p_account_type = 'couple' THEN RETURN 'couple_household'; END IF;
  IF p_account_type = 'planning_company' THEN RETURN 'planning_business'; END IF;
  IF p_account_type = 'venue' THEN RETURN 'venue_general'; END IF;
  IF p_account_type = 'client' THEN RETURN 'business_client'; END IF;
  IF p_account_type = 'wewed_internal' THEN RETURN 'wewed_parent_company'; END IF;
  IF p_account_type <> 'vendor' THEN RETURN NULL; END IF;

  SELECT COUNT(*), MIN(category_key)
  INTO service_category_count, single_category
  FROM (
    SELECT DISTINCT replace(lower(trim(offering.category)), '-', '_') AS category_key
    FROM wewed_admin."ProviderServiceOffering" offering
    WHERE offering."businessAccountId" = p_business_account_id
      AND trim(COALESCE(offering.category,'')) <> ''
  ) categories;

  IF service_category_count > 1 THEN RETURN 'multi_service'; END IF;
  IF service_category_count = 1 AND EXISTS (
    SELECT 1 FROM wewed_admin."AccountSubtypeDefinition" definition
    WHERE definition."accountType"='vendor'
      AND definition."subtypeKey"=single_category
      AND definition.status='active'
  ) THEN
    RETURN single_category;
  END IF;
  RETURN 'vendor_general';
END;
$function$;

CREATE OR REPLACE FUNCTION wewed_admin.provision_business_account_defaults(
  p_business_account_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  account_row wewed_admin."BusinessAccount"%ROWTYPE;
  selected_offer TEXT;
  selected_interval TEXT;
  selected_status TEXT;
BEGIN
  SELECT * INTO account_row
  FROM wewed_admin."BusinessAccount"
  WHERE id = p_business_account_id;

  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO wewed_admin."BusinessAccountClassification" (
    "businessAccountId", "accountType", "subtypeKey", source
  ) VALUES (
    account_row.id,
    account_row.type,
    wewed_admin.default_business_account_subtype(account_row.id, account_row.type),
    'system'
  )
  ON CONFLICT ("businessAccountId") DO NOTHING;

  IF account_row.type NOT IN ('couple','planning_company','venue','vendor','client') THEN
    RETURN;
  END IF;

  INSERT INTO wewed_admin."BusinessAccountDepartment" (
    id, "businessAccountId", "departmentKey", "accountType", status
  )
  SELECT
    'account-department-' || md5(account_row.id || ':' || definition."departmentKey"),
    account_row.id,
    definition."departmentKey",
    account_row.type,
    'enabled'
  FROM wewed_admin."ClientDepartmentDefinition" definition
  WHERE definition."accountType" = account_row.type
    AND definition.status = 'active'
    AND definition."defaultEnabled" = TRUE
  ON CONFLICT ("businessAccountId", "departmentKey") DO NOTHING;

  selected_offer := CASE
    WHEN account_row.type='couple' AND account_row."subscriptionPlan"='starter' THEN 'couple_canon'
    WHEN account_row.type='couple' THEN 'couple_free'
    WHEN account_row.type='planning_company' AND account_row."subscriptionPlan" IN ('professional','enterprise') THEN 'planner_professional'
    WHEN account_row.type='planning_company' THEN 'planner_free'
    WHEN account_row.type='vendor' AND account_row."subscriptionPlan" <> 'free' THEN 'vendor_growth'
    WHEN account_row.type='vendor' THEN 'vendor_profile'
    WHEN account_row.type='venue' AND account_row."subscriptionPlan" <> 'free' THEN 'venue_portfolio'
    WHEN account_row.type='venue' THEN 'venue_profile'
    ELSE 'client_custom'
  END;

  selected_interval := CASE
    WHEN COALESCE(
      account_row.metadata->>'stripeBillingInterval',
      account_row.metadata->>'stripeTestBillingInterval'
    ) IN ('month','year')
    THEN COALESCE(
      account_row.metadata->>'stripeBillingInterval',
      account_row.metadata->>'stripeTestBillingInterval'
    )
    ELSE NULL
  END;

  selected_status := CASE
    WHEN account_row."subscriptionStatus" IN (
      'free','trialing','active','past_due','unpaid','incomplete',
      'incomplete_expired','paused','cancelled'
    ) THEN account_row."subscriptionStatus"
    ELSE 'inactive'
  END;

  INSERT INTO wewed_admin."BusinessAccountBillingProfile" (
    "businessAccountId", "accountType", "offerCode", interval, status, source,
    currency, "currentPeriodEndsAt", metadata
  ) VALUES (
    account_row.id,
    account_row.type,
    selected_offer,
    selected_interval,
    selected_status,
    'legacy_backfill',
    'USD',
    account_row."currentPeriodEndsAt",
    jsonb_build_object(
      'legacyPlanAtProvisioning', account_row."subscriptionPlan",
      'legacyStatusAtProvisioning', account_row."subscriptionStatus",
      'provisionedBy', 'business_account_default_guard'
    )
  )
  ON CONFLICT ("businessAccountId") DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION wewed_admin.provision_business_account_defaults_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
BEGIN
  PERFORM wewed_admin.provision_business_account_defaults(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS provision_business_account_defaults_after_insert
  ON wewed_admin."BusinessAccount";
CREATE TRIGGER provision_business_account_defaults_after_insert
AFTER INSERT ON wewed_admin."BusinessAccount"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.provision_business_account_defaults_trigger();

CREATE OR REPLACE FUNCTION wewed_admin.refresh_system_vendor_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  target_business_account_id TEXT;
BEGIN
  target_business_account_id := COALESCE(NEW."businessAccountId", OLD."businessAccountId");

  UPDATE wewed_admin."BusinessAccountClassification" classification
  SET "subtypeKey" = wewed_admin.default_business_account_subtype(
        classification."businessAccountId", classification."accountType"
      ),
      version = classification.version + 1,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE classification."businessAccountId" = target_business_account_id
    AND classification."accountType"='vendor'
    AND classification.source='system';

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS refresh_system_vendor_classification_after_offering
  ON wewed_admin."ProviderServiceOffering";
CREATE TRIGGER refresh_system_vendor_classification_after_offering
AFTER INSERT OR UPDATE OF category, "businessAccountId" OR DELETE
ON wewed_admin."ProviderServiceOffering"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.refresh_system_vendor_classification();

-- Backfill classifications for every existing account without changing BusinessAccount rows.
INSERT INTO wewed_admin."BusinessAccountClassification" (
  "businessAccountId", "accountType", "subtypeKey", source
)
SELECT
  ba.id,
  ba.type,
  wewed_admin.default_business_account_subtype(ba.id, ba.type),
  'system'
FROM wewed_admin."BusinessAccount" ba
ON CONFLICT ("businessAccountId") DO NOTHING;

-- Repair only missing department/billing defaults identified in the Phase 0 audit.
DO $backfill_business_account_defaults$
DECLARE
  account_id TEXT;
BEGIN
  FOR account_id IN
    SELECT ba.id
    FROM wewed_admin."BusinessAccount" ba
    WHERE ba.type IN ('couple','planning_company','venue','vendor','client')
      AND (
        NOT EXISTS (
          SELECT 1 FROM wewed_admin."BusinessAccountDepartment" bad
          WHERE bad."businessAccountId" = ba.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM wewed_admin."BusinessAccountBillingProfile" babp
          WHERE babp."businessAccountId" = ba.id
        )
      )
  LOOP
    PERFORM wewed_admin.provision_business_account_defaults(account_id);
  END LOOP;
END;
$backfill_business_account_defaults$;

-- New Admin tables and helper functions are server-only. Keep the same private posture
-- as the existing wewed_admin schema.
REVOKE ALL ON TABLE
  wewed_admin."AccountSubtypeDefinition",
  wewed_admin."BusinessAccountClassification",
  wewed_admin."InternalDepartmentDefinition",
  wewed_admin."InternalStaffProfile",
  wewed_admin."AdminWorkItem",
  wewed_admin."AdminSavedView"
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION wewed_admin.validate_business_account_classification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION wewed_admin.default_business_account_subtype(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION wewed_admin.provision_business_account_defaults(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION wewed_admin.provision_business_account_defaults_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION wewed_admin.refresh_system_vendor_classification() FROM PUBLIC, anon, authenticated;