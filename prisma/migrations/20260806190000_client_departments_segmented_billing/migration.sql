-- Add account-type-specific operating departments and billing offers without
-- rewriting or deleting any existing customer, membership, wedding, payment,
-- Stripe, provider, planner, or audit record.

CREATE SCHEMA IF NOT EXISTS wewed_admin;

CREATE TABLE IF NOT EXISTS wewed_admin."ClientDepartmentDefinition" (
  "departmentKey" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  "systemKey" TEXT NOT NULL,
  "dataPoints" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "resourceTools" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "defaultEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientDepartmentDefinition_pkey" PRIMARY KEY ("departmentKey"),
  CONSTRAINT "ClientDepartmentDefinition_key_type_unique"
    UNIQUE ("departmentKey", "accountType"),
  CONSTRAINT "ClientDepartmentDefinition_account_type_check"
    CHECK ("accountType" IN ('couple', 'planning_company', 'venue', 'vendor', 'client')),
  CONSTRAINT "ClientDepartmentDefinition_status_check"
    CHECK (status IN ('active', 'retired')),
  CONSTRAINT "ClientDepartmentDefinition_data_points_array_check"
    CHECK (jsonb_typeof("dataPoints") = 'array'),
  CONSTRAINT "ClientDepartmentDefinition_resource_tools_array_check"
    CHECK (jsonb_typeof("resourceTools") = 'array')
);

CREATE INDEX IF NOT EXISTS "ClientDepartmentDefinition_type_status_idx"
  ON wewed_admin."ClientDepartmentDefinition"("accountType", status, "sortOrder");

CREATE TABLE IF NOT EXISTS wewed_admin."BusinessAccountDepartment" (
  id TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "departmentKey" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled',
  version INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccountDepartment_pkey" PRIMARY KEY (id),
  CONSTRAINT "BusinessAccountDepartment_account_department_unique"
    UNIQUE ("businessAccountId", "departmentKey"),
  CONSTRAINT "BusinessAccountDepartment_businessAccountId_fkey"
    FOREIGN KEY ("businessAccountId")
    REFERENCES wewed_admin."BusinessAccount"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountDepartment_definition_fkey"
    FOREIGN KEY ("departmentKey", "accountType")
    REFERENCES wewed_admin."ClientDepartmentDefinition"("departmentKey", "accountType")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountDepartment_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountDepartment_status_check"
    CHECK (status IN ('enabled', 'disabled', 'pending')),
  CONSTRAINT "BusinessAccountDepartment_version_check" CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS "BusinessAccountDepartment_account_status_idx"
  ON wewed_admin."BusinessAccountDepartment"("businessAccountId", status);
CREATE INDEX IF NOT EXISTS "BusinessAccountDepartment_type_department_idx"
  ON wewed_admin."BusinessAccountDepartment"("accountType", "departmentKey");

CREATE TABLE IF NOT EXISTS wewed_admin."BillingOffer" (
  "offerCode" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  "billingModel" TEXT NOT NULL,
  "legacyPlan" TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  "monthlyCents" INTEGER,
  "annualCents" INTEGER,
  "departmentKeys" JSONB NOT NULL DEFAULT '[]'::jsonb,
  entitlements JSONB NOT NULL DEFAULT '[]'::jsonb,
  "selfService" BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingOffer_pkey" PRIMARY KEY ("offerCode"),
  CONSTRAINT "BillingOffer_offer_type_unique" UNIQUE ("offerCode", "accountType"),
  CONSTRAINT "BillingOffer_account_type_check"
    CHECK ("accountType" IN ('couple', 'planning_company', 'venue', 'vendor', 'client')),
  CONSTRAINT "BillingOffer_billing_model_check"
    CHECK ("billingModel" IN ('free', 'subscription', 'contract')),
  CONSTRAINT "BillingOffer_legacy_plan_check"
    CHECK ("legacyPlan" IN ('free', 'starter', 'professional', 'enterprise')),
  CONSTRAINT "BillingOffer_currency_check" CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT "BillingOffer_monthly_amount_check"
    CHECK ("monthlyCents" IS NULL OR "monthlyCents" >= 0),
  CONSTRAINT "BillingOffer_annual_amount_check"
    CHECK ("annualCents" IS NULL OR "annualCents" >= 0),
  CONSTRAINT "BillingOffer_department_keys_array_check"
    CHECK (jsonb_typeof("departmentKeys") = 'array'),
  CONSTRAINT "BillingOffer_entitlements_array_check"
    CHECK (jsonb_typeof(entitlements) = 'array'),
  CONSTRAINT "BillingOffer_status_check" CHECK (status IN ('active', 'retired')),
  CONSTRAINT "BillingOffer_version_check" CHECK (version > 0),
  CONSTRAINT "BillingOffer_pricing_shape_check" CHECK (
    ("billingModel" = 'free'
      AND COALESCE("monthlyCents", 0) = 0
      AND COALESCE("annualCents", 0) = 0
      AND "selfService" = FALSE)
    OR
    ("billingModel" = 'subscription'
      AND ("monthlyCents" IS NOT NULL OR "annualCents" IS NOT NULL))
    OR
    ("billingModel" = 'contract' AND "selfService" = FALSE)
  )
);

CREATE INDEX IF NOT EXISTS "BillingOffer_type_status_idx"
  ON wewed_admin."BillingOffer"("accountType", status, "selfService");

CREATE TABLE IF NOT EXISTS wewed_admin."BusinessAccountBillingProfile" (
  "businessAccountId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "offerCode" TEXT NOT NULL,
  interval TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  source TEXT NOT NULL DEFAULT 'legacy_backfill',
  currency TEXT NOT NULL DEFAULT 'USD',
  "currentPeriodEndsAt" TIMESTAMP(3),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccountBillingProfile_pkey" PRIMARY KEY ("businessAccountId"),
  CONSTRAINT "BusinessAccountBillingProfile_businessAccountId_fkey"
    FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountBillingProfile_offer_fkey"
    FOREIGN KEY ("offerCode", "accountType")
    REFERENCES wewed_admin."BillingOffer"("offerCode", "accountType")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountBillingProfile_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountBillingProfile_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountBillingProfile_account_type_check"
    CHECK ("accountType" IN ('couple', 'planning_company', 'venue', 'vendor', 'client')),
  CONSTRAINT "BusinessAccountBillingProfile_interval_check"
    CHECK (interval IS NULL OR interval IN ('month', 'year')),
  CONSTRAINT "BusinessAccountBillingProfile_status_check"
    CHECK (status IN (
      'free', 'inactive', 'trialing', 'active', 'past_due', 'unpaid',
      'incomplete', 'incomplete_expired', 'paused', 'cancelled'
    )),
  CONSTRAINT "BusinessAccountBillingProfile_source_check"
    CHECK (source IN ('legacy_backfill', 'checkout', 'stripe_sync', 'manual_contract')),
  CONSTRAINT "BusinessAccountBillingProfile_currency_check"
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT "BusinessAccountBillingProfile_version_check" CHECK (version > 0),
  CONSTRAINT "BusinessAccountBillingProfile_metadata_object_check"
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS "BusinessAccountBillingProfile_offer_status_idx"
  ON wewed_admin."BusinessAccountBillingProfile"("offerCode", status);
CREATE INDEX IF NOT EXISTS "BusinessAccountBillingProfile_type_status_idx"
  ON wewed_admin."BusinessAccountBillingProfile"("accountType", status);

CREATE OR REPLACE FUNCTION wewed_admin.validate_business_department_account_type()
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
    RAISE EXCEPTION 'Department account type does not match the business account.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_business_department_account_type
  ON wewed_admin."BusinessAccountDepartment";
CREATE TRIGGER validate_business_department_account_type
BEFORE INSERT OR UPDATE OF "businessAccountId", "accountType", "departmentKey"
ON wewed_admin."BusinessAccountDepartment"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_business_department_account_type();

CREATE OR REPLACE FUNCTION wewed_admin.validate_business_billing_profile_account_type()
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
    RAISE EXCEPTION 'Billing profile account type does not match the business account.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_business_billing_profile_account_type
  ON wewed_admin."BusinessAccountBillingProfile";
CREATE TRIGGER validate_business_billing_profile_account_type
BEFORE INSERT OR UPDATE OF "businessAccountId", "accountType", "offerCode"
ON wewed_admin."BusinessAccountBillingProfile"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.validate_business_billing_profile_account_type();

INSERT INTO wewed_admin."ClientDepartmentDefinition" (
  "departmentKey", "accountType", name, description, "systemKey",
  "dataPoints", "resourceTools", "defaultEnabled", status, "sortOrder"
) VALUES
  ('couple_wedding_workspace', 'couple', 'Wedding workspace', 'Wedding identity, lifecycle, privacy, venue and workspace controls.', 'wedding_core', '["wedding_identity","event_date","venue","lifecycle","privacy"]', '["wedding_site","couple_dashboard","wedding_settings"]', TRUE, 'active', 10),
  ('couple_guest_experience', 'couple', 'Guest experience', 'Invitations, RSVP, meals, dietary requirements and event check-in.', 'guest_rsvp', '["guest_identity","invitation_status","attendance","meal","dietary","check_in"]', '["guest_list","rsvp_manager","qr_check_in"]', TRUE, 'active', 20),
  ('couple_planning_controls', 'couple', 'Planning controls', 'Tasks, budget, vendor, timeline and seating operations.', 'planner_operations', '["tasks","budget","vendors","timeline","seating"]', '["task_board","budget_manager","vendor_list","timeline","seating_chart"]', TRUE, 'active', 30),
  ('couple_content_memories', 'couple', 'Content and memories', 'Wedding content, revisions, media, messages and guest contributions.', 'wedding_content', '["content_revisions","media","messages","contributions"]', '["content_editor","media_library","moderation"]', TRUE, 'active', 40),
  ('couple_billing_support', 'couple', 'Billing and support', 'Account-aware offer, subscription, billing cadence and support cases.', 'account_commercial', '["billing_offer","subscription_status","billing_interval","support_cases"]', '["billing_portal","customer_portal","support"]', TRUE, 'active', 50),

  ('planner_portfolio_operations', 'planning_company', 'Portfolio operations', 'Planning-company portfolio, active weddings and ownership pipeline.', 'planner_portfolio', '["active_weddings","portfolio_pipeline","account_ownership"]', '["planner_workspace","portfolio_dashboard","analytics"]', TRUE, 'active', 10),
  ('planner_client_delivery', 'planning_company', 'Client delivery', 'Wedding engagements, authority, permissions and delivery status.', 'planner_engagements', '["engagement_status","authority_bundle","permissions","client_workspace"]', '["client_workspaces","approvals","collaboration"]', TRUE, 'active', 20),
  ('planner_templates_resources', 'planning_company', 'Templates and resources', 'Reusable templates, imports, exports and operational worksheets.', 'planner_templates', '["template_versions","imports","exports","worksheets"]', '["template_library","import_export","worksheets"]', TRUE, 'active', 30),
  ('planner_team_governance', 'planning_company', 'Team governance', 'Team members, business roles, access status and audit history.', 'business_membership', '["team_members","roles","membership_status","audit_history"]', '["team_management","permissions","audit_log"]', TRUE, 'active', 40),
  ('planner_commercial_operations', 'planning_company', 'Commercial operations', 'Service packages, enquiries, account offer and subscription state.', 'planner_commercial', '["services","packages","enquiries","billing_offer","subscription_status"]', '["package_manager","enquiry_workflow","billing_portal"]', TRUE, 'active', 50),

  ('vendor_business_profile', 'vendor', 'Business profile', 'Provider identity, service areas, contact information and policies.', 'provider_profile', '["business_identity","service_areas","contact","policies"]', '["profile_editor","listing_preview"]', TRUE, 'active', 10),
  ('vendor_services_packages', 'vendor', 'Services and packages', 'Service categories, inclusions, price ranges and capacity.', 'provider_offerings', '["service_category","inclusions","price_range","capacity"]', '["offering_editor","package_manager"]', TRUE, 'active', 20),
  ('vendor_portfolio', 'vendor', 'Portfolio', 'Published media, links, captions and portfolio ordering.', 'provider_portfolio', '["media","links","captions","publication_status"]', '["portfolio_manager"]', TRUE, 'active', 30),
  ('vendor_enquiries', 'vendor', 'Enquiries', 'Event requirements, budget, response and enquiry lifecycle.', 'provider_enquiries', '["event_date","location","budget","response_status"]', '["enquiry_inbox","response_workflow"]', TRUE, 'active', 40),
  ('vendor_verification_billing', 'vendor', 'Verification and billing', 'Business verification, insurance, permits, offer and subscription state.', 'provider_compliance', '["identity_status","business_status","insurance_status","permit_status","billing_offer"]', '["verification_center","billing_portal"]', TRUE, 'active', 50),

  ('venue_profile_spaces', 'venue', 'Venue profile and spaces', 'Venue identity, spaces, location, contacts and public listing.', 'venue_profile', '["venue_identity","spaces","location","contact"]', '["venue_profile_editor","listing_preview"]', TRUE, 'active', 10),
  ('venue_capacity_availability', 'venue', 'Capacity and availability', 'Capacity ranges, booking notice, accessibility and availability.', 'venue_inventory', '["capacity","availability","booking_notice","accessibility"]', '["availability_manager","space_manager"]', TRUE, 'active', 20),
  ('venue_packages_services', 'venue', 'Packages and event services', 'Venue packages, amenities, inclusions and pricing posture.', 'venue_offerings', '["packages","amenities","inclusions","pricing_model"]', '["package_manager","offering_editor"]', TRUE, 'active', 30),
  ('venue_enquiries_visits', 'venue', 'Enquiries and site visits', 'Wedding enquiries, visit requests and response lifecycle.', 'venue_enquiries', '["event_date","guest_count","visit_request","response_status"]', '["enquiry_inbox","site_visit_calendar"]', TRUE, 'active', 40),
  ('venue_verification_billing', 'venue', 'Verification and billing', 'Venue verification, policies, offer, subscription and support.', 'venue_compliance', '["verification","policies","billing_offer","subscription_status"]', '["verification_center","billing_portal","support"]', TRUE, 'active', 50),

  ('client_account_governance', 'client', 'Account governance', 'Contract account identity, ownership, members and permissions.', 'client_governance', '["account_identity","ownership","members","permissions"]', '["account_admin","team_management","audit_log"]', TRUE, 'active', 10),
  ('client_data_operations', 'client', 'Data operations', 'Contract-defined datasets, integrations and operational reporting.', 'client_data', '["datasets","integrations","reporting"]', '["data_workspace","integration_center","reports"]', TRUE, 'active', 20),
  ('client_resources_support', 'client', 'Resources and support', 'Contract resources, documentation, service cases and incidents.', 'client_support', '["resources","support_cases","incidents"]', '["resource_center","support","incident_status"]', TRUE, 'active', 30),
  ('client_contract_billing', 'client', 'Contract and billing', 'Contract offer, service terms, billing state and renewals.', 'client_commercial', '["contract_offer","service_terms","billing_status","renewal"]', '["contract_center","billing_portal"]', TRUE, 'active', 40)
ON CONFLICT ("departmentKey") DO UPDATE SET
  "accountType" = EXCLUDED."accountType",
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "systemKey" = EXCLUDED."systemKey",
  "dataPoints" = EXCLUDED."dataPoints",
  "resourceTools" = EXCLUDED."resourceTools",
  "defaultEnabled" = EXCLUDED."defaultEnabled",
  status = EXCLUDED.status,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO wewed_admin."BillingOffer" (
  "offerCode", "accountType", name, description, "billingModel",
  "legacyPlan", currency, "monthlyCents", "annualCents", "departmentKeys",
  entitlements, "selfService", status
) VALUES
  ('couple_free', 'couple', 'Couple Free', 'Core wedding site, guest participation and one active wedding workspace.', 'free', 'free', 'USD', 0, 0, '["couple_wedding_workspace","couple_guest_experience","couple_content_memories","couple_billing_support"]', '["wedding_site","guest_list","rsvp_manager","content_editor","support"]', FALSE, 'active'),
  ('couple_canon', 'couple', 'Couple Canon', 'Complete private wedding planning and collaboration workspace for a couple.', 'subscription', 'starter', 'USD', 1500, 15000, '["couple_wedding_workspace","couple_guest_experience","couple_planning_controls","couple_content_memories","couple_billing_support"]', '["wedding_site","guest_list","rsvp_manager","task_board","budget_manager","vendor_list","timeline","seating_chart","template_library","exports","support"]', TRUE, 'active'),
  ('planner_free', 'planning_company', 'Planner Starter', 'Profile and single-workspace foundation for a planning business.', 'free', 'free', 'USD', 0, 0, '["planner_portfolio_operations","planner_client_delivery","planner_commercial_operations"]', '["planner_workspace","client_workspaces","enquiry_workflow"]', FALSE, 'active'),
  ('planner_professional', 'planning_company', 'Planner Professional', 'Multi-wedding operations, templates, team governance and analytics.', 'subscription', 'professional', 'USD', 3900, 39000, '["planner_portfolio_operations","planner_client_delivery","planner_templates_resources","planner_team_governance","planner_commercial_operations"]', '["planner_workspace","portfolio_dashboard","client_workspaces","template_library","import_export","team_management","audit_log","analytics","billing_portal"]', TRUE, 'active'),
  ('vendor_profile', 'vendor', 'Vendor Profile', 'Provider profile, service catalog, portfolio and enquiry foundation.', 'free', 'free', 'USD', 0, 0, '["vendor_business_profile","vendor_services_packages","vendor_portfolio","vendor_enquiries","vendor_verification_billing"]', '["profile_editor","offering_editor","package_manager","portfolio_manager","enquiry_inbox","verification_center"]', FALSE, 'active'),
  ('vendor_growth', 'vendor', 'Vendor Growth', 'Expanded commercial tools for verified vendors; activated under an approved price or contract.', 'contract', 'enterprise', 'USD', NULL, NULL, '["vendor_business_profile","vendor_services_packages","vendor_portfolio","vendor_enquiries","vendor_verification_billing"]', '["profile_editor","offering_editor","package_manager","portfolio_manager","enquiry_inbox","response_workflow","verification_center","analytics","billing_portal"]', FALSE, 'active'),
  ('venue_profile', 'venue', 'Venue Profile', 'Venue listing, spaces, packages, availability and enquiry foundation.', 'free', 'free', 'USD', 0, 0, '["venue_profile_spaces","venue_capacity_availability","venue_packages_services","venue_enquiries_visits","venue_verification_billing"]', '["venue_profile_editor","space_manager","package_manager","availability_manager","enquiry_inbox","verification_center"]', FALSE, 'active'),
  ('venue_portfolio', 'venue', 'Venue Portfolio', 'Expanded multi-space and commercial venue operations under an approved contract.', 'contract', 'enterprise', 'USD', NULL, NULL, '["venue_profile_spaces","venue_capacity_availability","venue_packages_services","venue_enquiries_visits","venue_verification_billing"]', '["venue_profile_editor","space_manager","package_manager","availability_manager","site_visit_calendar","analytics","billing_portal"]', FALSE, 'active'),
  ('client_custom', 'client', 'Business Custom', 'Contract-defined systems, data operations, resources and support.', 'contract', 'enterprise', 'USD', NULL, NULL, '["client_account_governance","client_data_operations","client_resources_support","client_contract_billing"]', '["account_admin","data_workspace","integration_center","reports","resource_center","support","contract_center","billing_portal"]', FALSE, 'active')
ON CONFLICT ("offerCode") DO UPDATE SET
  "accountType" = EXCLUDED."accountType",
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "billingModel" = EXCLUDED."billingModel",
  "legacyPlan" = EXCLUDED."legacyPlan",
  currency = EXCLUDED.currency,
  "monthlyCents" = EXCLUDED."monthlyCents",
  "annualCents" = EXCLUDED."annualCents",
  "departmentKeys" = EXCLUDED."departmentKeys",
  entitlements = EXCLUDED.entitlements,
  "selfService" = EXCLUDED."selfService",
  status = EXCLUDED.status,
  version = wewed_admin."BillingOffer".version + 1,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO wewed_admin."BusinessAccountDepartment" (
  id, "businessAccountId", "departmentKey", "accountType", status
)
SELECT
  'account-department-' || md5(ba.id || ':' || definition."departmentKey"),
  ba.id,
  definition."departmentKey",
  ba.type,
  'enabled'
FROM wewed_admin."BusinessAccount" ba
JOIN wewed_admin."ClientDepartmentDefinition" definition
  ON definition."accountType" = ba.type
 AND definition.status = 'active'
 AND definition."defaultEnabled" = TRUE
WHERE ba.type IN ('couple', 'planning_company', 'venue', 'vendor', 'client')
ON CONFLICT ("businessAccountId", "departmentKey") DO NOTHING;

INSERT INTO wewed_admin."BusinessAccountBillingProfile" (
  "businessAccountId", "accountType", "offerCode", interval, status, source,
  currency, "currentPeriodEndsAt", metadata
)
SELECT
  ba.id,
  ba.type,
  CASE
    WHEN ba.type = 'couple' AND ba."subscriptionPlan" = 'starter'
      THEN 'couple_canon'
    WHEN ba.type = 'couple'
      THEN 'couple_free'
    WHEN ba.type = 'planning_company'
      AND ba."subscriptionPlan" IN ('professional', 'enterprise')
      THEN 'planner_professional'
    WHEN ba.type = 'planning_company'
      THEN 'planner_free'
    WHEN ba.type = 'vendor' AND ba."subscriptionPlan" <> 'free'
      THEN 'vendor_growth'
    WHEN ba.type = 'vendor'
      THEN 'vendor_profile'
    WHEN ba.type = 'venue' AND ba."subscriptionPlan" <> 'free'
      THEN 'venue_portfolio'
    WHEN ba.type = 'venue'
      THEN 'venue_profile'
    ELSE 'client_custom'
  END,
  CASE
    WHEN COALESCE(
      ba.metadata->>'stripeBillingInterval',
      ba.metadata->>'stripeTestBillingInterval'
    ) IN ('month', 'year')
    THEN COALESCE(
      ba.metadata->>'stripeBillingInterval',
      ba.metadata->>'stripeTestBillingInterval'
    )
    ELSE NULL
  END,
  CASE
    WHEN ba."subscriptionStatus" IN (
      'free', 'trialing', 'active', 'past_due', 'unpaid', 'incomplete',
      'incomplete_expired', 'paused', 'cancelled'
    ) THEN ba."subscriptionStatus"
    ELSE 'inactive'
  END,
  'legacy_backfill',
  'USD',
  ba."currentPeriodEndsAt",
  jsonb_build_object(
    'legacyPlanAtBackfill', ba."subscriptionPlan",
    'legacyStatusAtBackfill', ba."subscriptionStatus",
    'backfilledAt', CURRENT_TIMESTAMP
  )
FROM wewed_admin."BusinessAccount" ba
WHERE ba.type IN ('couple', 'planning_company', 'venue', 'vendor', 'client')
ON CONFLICT ("businessAccountId") DO NOTHING;

ALTER TABLE wewed_admin."ClientDepartmentDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE wewed_admin."BusinessAccountDepartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE wewed_admin."BillingOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE wewed_admin."BusinessAccountBillingProfile" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  wewed_admin."ClientDepartmentDefinition",
  wewed_admin."BusinessAccountDepartment",
  wewed_admin."BillingOffer",
  wewed_admin."BusinessAccountBillingProfile"
FROM PUBLIC;

REVOKE ALL PRIVILEGES ON FUNCTION
  wewed_admin.validate_business_department_account_type(),
  wewed_admin.validate_business_billing_profile_account_type()
FROM PUBLIC;

DO $revoke_client_department_billing_roles$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'ClientDepartmentDefinition', role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'BusinessAccountDepartment', role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'BillingOffer', role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'BusinessAccountBillingProfile', role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.validate_business_department_account_type() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.validate_business_billing_profile_account_type() FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END;
$revoke_client_department_billing_roles$;
