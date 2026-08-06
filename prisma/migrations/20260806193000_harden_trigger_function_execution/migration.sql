-- Harden existing trigger functions without changing table data or trigger logic.
-- Trigger invocation continues through the database trigger manager; direct RPC
-- execution by PUBLIC, anon, or authenticated is not required.

ALTER FUNCTION wewed_admin.validate_business_account_link()
  SET search_path TO wewed_admin, public, pg_temp;
ALTER FUNCTION wewed_admin.validate_business_owner_membership()
  SET search_path TO wewed_admin, public, pg_temp;
ALTER FUNCTION wewed_admin.validate_business_lifecycle()
  SET search_path TO wewed_admin, public, pg_temp;
ALTER FUNCTION wewed_admin.sync_business_lifecycle_access()
  SET search_path TO wewed_admin, public, pg_temp;
ALTER FUNCTION wewed_admin.validate_public_onboarding_completion()
  SET search_path TO wewed_admin, public, pg_temp;
ALTER FUNCTION wewed_admin.protect_final_super_admin()
  SET search_path TO wewed_admin, public, pg_temp;
ALTER FUNCTION public.preserve_planner_task_text_assignee()
  SET search_path TO public, pg_temp;
ALTER FUNCTION public.wewed_enforce_new_wedding_link_only()
  SET search_path TO public, pg_temp;

REVOKE ALL PRIVILEGES ON FUNCTION
  wewed_admin.validate_business_account_link(),
  wewed_admin.validate_business_owner_membership(),
  wewed_admin.validate_business_lifecycle(),
  wewed_admin.sync_business_lifecycle_access(),
  wewed_admin.validate_public_onboarding_completion(),
  wewed_admin.protect_final_super_admin(),
  public.preserve_planner_task_text_assignee(),
  public.wewed_enforce_new_wedding_link_only(),
  public.wewed_audit_budget_item_change()
FROM PUBLIC;

DO $revoke_trigger_function_client_execution$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.validate_business_account_link() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.validate_business_owner_membership() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.validate_business_lifecycle() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.sync_business_lifecycle_access() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.validate_public_onboarding_completion() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'wewed_admin.protect_final_super_admin() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'public.preserve_planner_task_text_assignee() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'public.wewed_enforce_new_wedding_link_only() FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION '
        || 'public.wewed_audit_budget_item_change() FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END;
$revoke_trigger_function_client_execution$;
