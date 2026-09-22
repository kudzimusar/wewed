-- WEWED Phase 3 production database catalog preflight
-- Plan: WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01
-- SAFETY: read-only catalog/aggregate inspection only. No DDL/DML.
--
-- Run only after the DATABASE_URL fingerprint has matched the expected Wewed
-- Supabase project ref. The transaction is explicitly read-only and rolled back.

BEGIN;
SET TRANSACTION READ ONLY;

-- 1. Database / session identity
SELECT
  current_database() AS database_name,
  current_user AS current_user,
  session_user AS session_user,
  current_setting('server_version') AS server_version;

-- 2. Current application role capabilities
SELECT
  rolname,
  rolcanlogin,
  rolsuper,
  rolbypassrls,
  rolinherit
FROM pg_roles
WHERE rolname = current_user;

-- 3. Schema existence and USAGE
SELECT
  wanted.schema_name,
  EXISTS (
    SELECT 1 FROM pg_namespace n WHERE n.nspname = wanted.schema_name
  ) AS schema_exists,
  has_schema_privilege(current_user, wanted.schema_name, 'USAGE') AS has_usage
FROM (
  VALUES
    ('public'),
    ('wewed_admin'),
    ('wewed_booking'),
    ('wewed_contributions'),
    ('wewed_planner'),
    ('private')
) AS wanted(schema_name)
ORDER BY wanted.schema_name;

-- 4. Required authority objects: location/type/RLS/owner
WITH wanted(schema_name, relation_name) AS (
  VALUES
    ('public','User'),
    ('public','UserProfile'),
    ('public','Couple'),
    ('public','Wedding'),
    ('public','WeddingMembership'),
    ('public','Guest'),
    ('public','RSVP'),
    ('public','SeatingTable'),
    ('public','Vendor'),
    ('public','ServiceEngagement'),
    ('public','BusinessAccount'),
    ('public','BusinessAccountMember'),
    ('public','BusinessAccountLink'),
    ('public','ProviderProfile'),
    ('wewed_admin','BusinessAccount'),
    ('wewed_admin','BusinessAccountMember'),
    ('wewed_admin','BusinessAccountLink'),
    ('wewed_admin','ProviderProfile'),
    ('wewed_admin','PlatformAdministrator'),
    ('wewed_admin','PlatformAdministratorScope')
)
SELECT
  w.schema_name,
  w.relation_name,
  c.relkind::text AS relation_kind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pg_get_userbyid(c.relowner) AS owner_name
FROM wanted w
LEFT JOIN pg_namespace n ON n.nspname = w.schema_name
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = w.relation_name
ORDER BY w.schema_name, w.relation_name;

-- 5. Public compatibility views for business authority
SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  c.relkind::text AS relation_kind,
  pg_get_viewdef(c.oid, true) AS view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'BusinessAccount',
    'BusinessAccountMember',
    'BusinessAccountLink',
    'ProviderProfile'
  )
ORDER BY c.relname;

-- 6. Policies on authority objects
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname IN ('public','wewed_admin','wewed_booking','private')
  AND tablename IN (
    'BusinessAccount',
    'BusinessAccountMember',
    'BusinessAccountLink',
    'ProviderProfile',
    'PlatformAdministrator',
    'PlatformAdministratorScope',
    'WeddingMembership',
    'ServiceEngagement'
  )
ORDER BY schemaname, tablename, policyname;

-- 7. Current-user table privileges (catalog only)
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = current_user
  AND table_schema IN ('public','wewed_admin','wewed_booking','private')
  AND table_name IN (
    'BusinessAccount',
    'BusinessAccountMember',
    'BusinessAccountLink',
    'ProviderProfile',
    'PlatformAdministrator',
    'PlatformAdministratorScope',
    'WeddingMembership',
    'ServiceEngagement'
  )
ORDER BY table_schema, table_name, privilege_type;

-- 8. Wedding Day / Usher / Gate object discovery without assuming names
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind::text AS relation_kind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND (
    lower(c.relname) LIKE '%usher%'
    OR lower(c.relname) LIKE '%gate%'
    OR lower(c.relname) LIKE '%checkin%'
    OR lower(c.relname) LIKE '%check_in%'
    OR lower(c.relname) LIKE '%weddingpass%'
    OR lower(c.relname) LIKE '%wedding_pass%'
    OR lower(c.relname) LIKE '%servicepresence%'
    OR lower(c.relname) LIKE '%announcement%'
  )
ORDER BY n.nspname, c.relname;

-- 9. Migration ledger summary only
SELECT
  COUNT(*)::int AS migration_rows,
  COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS finished_rows,
  COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS rolled_back_rows,
  COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unresolved_rows,
  MIN(migration_name) AS first_migration,
  MAX(migration_name) AS last_migration
FROM public._prisma_migrations;

ROLLBACK;
