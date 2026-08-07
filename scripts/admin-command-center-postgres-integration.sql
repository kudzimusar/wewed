\set ON_ERROR_STOP on

DO $admin_command_center_schema$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('AccountSubtypeDefinition'),
    ('BusinessAccountClassification'),
    ('InternalDepartmentDefinition'),
    ('InternalStaffProfile'),
    ('AdminWorkItem'),
    ('AdminSavedView')
  ) expected(table_name)
  WHERE to_regclass(format('wewed_admin.%I', expected.table_name)) IS NULL;

  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'Admin command-centre schema is incomplete: % planned tables are missing.', missing_count;
  END IF;
END
$admin_command_center_schema$;

INSERT INTO wewed_admin."BusinessAccount" (
  id, name, slug, type, status, "onboardingStatus",
  "subscriptionPlan", "subscriptionStatus", metadata
) VALUES (
  'e2e-command-centre-vendor',
  'Command Centre Vendor',
  'command-centre-vendor',
  'vendor',
  'active',
  'not_started',
  'free',
  'free',
  '{"source":"postgres-integration"}'::jsonb
);

DO $admin_default_provisioning$
DECLARE
  classification_subtype TEXT;
  department_count INTEGER;
  expected_department_count INTEGER;
  billing_offer TEXT;
  billing_status TEXT;
BEGIN
  SELECT "subtypeKey" INTO classification_subtype
  FROM wewed_admin."BusinessAccountClassification"
  WHERE "businessAccountId"='e2e-command-centre-vendor';

  IF classification_subtype IS DISTINCT FROM 'vendor_general' THEN
    RAISE EXCEPTION 'Expected vendor_general default classification, got %.', classification_subtype;
  END IF;

  SELECT COUNT(*) INTO department_count
  FROM wewed_admin."BusinessAccountDepartment"
  WHERE "businessAccountId"='e2e-command-centre-vendor'
    AND status='enabled';

  SELECT COUNT(*) INTO expected_department_count
  FROM wewed_admin."ClientDepartmentDefinition"
  WHERE "accountType"='vendor'
    AND status='active'
    AND "defaultEnabled"=TRUE;

  IF department_count <> expected_department_count OR department_count = 0 THEN
    RAISE EXCEPTION 'Vendor default department provisioning mismatch. actual=%, expected=%', department_count, expected_department_count;
  END IF;

  SELECT "offerCode", status INTO billing_offer, billing_status
  FROM wewed_admin."BusinessAccountBillingProfile"
  WHERE "businessAccountId"='e2e-command-centre-vendor';

  IF billing_offer IS DISTINCT FROM 'vendor_profile' OR billing_status IS DISTINCT FROM 'free' THEN
    RAISE EXCEPTION 'Vendor default billing mismatch. offer=%, status=%', billing_offer, billing_status;
  END IF;
END
$admin_default_provisioning$;

INSERT INTO wewed_admin."ProviderServiceOffering" (
  id, "businessAccountId", category, "displayName", status, currency
) VALUES (
  'e2e-command-centre-photography',
  'e2e-command-centre-vendor',
  'photography',
  'Photography',
  'published',
  'USD'
);

DO $admin_system_classification_refresh$
DECLARE
  classification_subtype TEXT;
  classification_source TEXT;
BEGIN
  SELECT "subtypeKey", source
  INTO classification_subtype, classification_source
  FROM wewed_admin."BusinessAccountClassification"
  WHERE "businessAccountId"='e2e-command-centre-vendor';

  IF classification_subtype IS DISTINCT FROM 'photography' OR classification_source IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'System classification did not follow the canonical offering category. subtype=%, source=%', classification_subtype, classification_source;
  END IF;
END
$admin_system_classification_refresh$;

UPDATE wewed_admin."BusinessAccountClassification"
SET source='manual', "subtypeKey"='vendor_general', version=version+1
WHERE "businessAccountId"='e2e-command-centre-vendor';

INSERT INTO wewed_admin."ProviderServiceOffering" (
  id, "businessAccountId", category, "displayName", status, currency
) VALUES (
  'e2e-command-centre-catering',
  'e2e-command-centre-vendor',
  'catering',
  'Catering',
  'published',
  'USD'
);

DO $admin_manual_classification_is_stable$
DECLARE
  classification_subtype TEXT;
  classification_source TEXT;
BEGIN
  SELECT "subtypeKey", source
  INTO classification_subtype, classification_source
  FROM wewed_admin."BusinessAccountClassification"
  WHERE "businessAccountId"='e2e-command-centre-vendor';

  IF classification_subtype IS DISTINCT FROM 'vendor_general' OR classification_source IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'Canonical service changes must not overwrite a manual classification. subtype=%, source=%', classification_subtype, classification_source;
  END IF;
END
$admin_manual_classification_is_stable$;

DO $admin_private_access$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'AccountSubtypeDefinition',
    'BusinessAccountClassification',
    'InternalDepartmentDefinition',
    'InternalStaffProfile',
    'AdminWorkItem',
    'AdminSavedView'
  ]
  LOOP
    IF has_table_privilege('anon', format('wewed_admin.%I', table_name), 'SELECT')
       OR has_table_privilege('anon', format('wewed_admin.%I', table_name), 'INSERT')
       OR has_table_privilege('anon', format('wewed_admin.%I', table_name), 'UPDATE')
       OR has_table_privilege('anon', format('wewed_admin.%I', table_name), 'DELETE')
       OR has_table_privilege('authenticated', format('wewed_admin.%I', table_name), 'SELECT')
       OR has_table_privilege('authenticated', format('wewed_admin.%I', table_name), 'INSERT')
       OR has_table_privilege('authenticated', format('wewed_admin.%I', table_name), 'UPDATE')
       OR has_table_privilege('authenticated', format('wewed_admin.%I', table_name), 'DELETE') THEN
      RAISE EXCEPTION 'Private Admin table % exposes direct API-role privileges.', table_name;
    END IF;
  END LOOP;
END
$admin_private_access$;

SELECT 'Admin command-centre PostgreSQL integration: PASS' AS result;
