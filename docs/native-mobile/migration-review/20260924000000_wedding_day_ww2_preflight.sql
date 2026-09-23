-- Phase 11A Wedding Day / WW2 migration PRE-FLIGHT (SELECT-only).
-- Safe for review. Phase 11A does NOT authorize running this against Production.
-- Never prints key material or secrets.

SELECT current_database() AS database_name,
       current_user AS database_role,
       r.rolsuper AS role_is_superuser,
       r.rolbypassrls AS role_bypasses_rls
  FROM pg_roles r
 WHERE r.rolname = current_user;

SELECT to_regclass('public."WeddingGate"') AS wedding_gate,
       to_regclass('public."WeddingGateAssignment"') AS wedding_gate_assignment,
       to_regclass('public."WeddingPassKey"') AS wedding_pass_key,
       to_regclass('public."WeddingPassCredential"') AS wedding_pass_credential,
       to_regclass('public."WeddingCheckIn"') AS wedding_check_in;

SELECT migration_name, finished_at, rolled_back_at
  FROM public."_prisma_migrations"
 WHERE migration_name IN (
   '20260923210000_wedding_gate_authority',
   '20260924000000_wedding_day_ww2_authority'
 )
 ORDER BY migration_name;

SELECT conname, contype, convalidated
  FROM pg_constraint
 WHERE conname IN (
   'WeddingGate_id_weddingId_key',
   'Guest_id_weddingId_key',
   'WeddingPassKey_id_weddingId_key',
   'WeddingPassCredential_id_weddingId_guestId_key'
 )
 ORDER BY conname;

-- Guest.id is already globally unique, but this proves the requested composite key has no
-- pre-existing duplicate tuples and can be added without a data rewrite.
SELECT id, "weddingId", COUNT(*) AS duplicate_count
  FROM public."Guest"
 GROUP BY id, "weddingId"
HAVING COUNT(*) > 1;

-- Detect an unexpected partial/hand-created Wedding Day footprint before migration.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       c.relkind AS object_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('WeddingPassKey','WeddingPassCredential','WeddingCheckIn')
 ORDER BY c.relname;
