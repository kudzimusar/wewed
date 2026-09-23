-- Phase 11A Wedding Day / WW2 migration POST-FLIGHT (SELECT-only).
-- Intended for disposable rehearsal now and a separately authorized production migration later.

SELECT current_database() AS database_name,
       current_user AS database_role,
       r.rolsuper AS role_is_superuser,
       r.rolbypassrls AS role_bypasses_rls
  FROM pg_roles r
 WHERE r.rolname = current_user;

SELECT migration_name, finished_at, rolled_back_at
  FROM public."_prisma_migrations"
 WHERE migration_name = '20260924000000_wedding_day_ww2_authority';

SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('WeddingPassKey','WeddingPassCredential','WeddingCheckIn')
 ORDER BY c.relname;

SELECT schemaname, tablename, policyname, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('WeddingPassKey','WeddingPassCredential','WeddingCheckIn')
 ORDER BY tablename, policyname;

SELECT conname, contype, convalidated
  FROM pg_constraint
 WHERE conname IN (
   'Guest_id_weddingId_key',
   'WeddingPassKey_weddingId_fkey',
   'WeddingPassCredential_weddingId_fkey',
   'WeddingPassCredential_guestId_weddingId_fkey',
   'WeddingPassCredential_passKeyId_weddingId_fkey',
   'WeddingCheckIn_weddingId_fkey',
   'WeddingCheckIn_guestId_weddingId_fkey',
   'WeddingCheckIn_credentialId_weddingId_guestId_fkey',
   'WeddingCheckIn_gateId_weddingId_fkey',
   'WeddingCheckIn_admittedByUserId_fkey'
 )
 ORDER BY conname;

SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN (
     'WeddingPassCredential_weddingId_guestId_live_key',
     'WeddingCheckIn_weddingId_eventKey_guestId_attendeeKey_key',
     'WeddingCheckIn_weddingId_clientEventId_attendeeKey_key'
   )
 ORDER BY indexname;

-- Every query below must return zero rows.
SELECT c.id, c."weddingId", c."guestId", g."weddingId" AS guest_wedding
  FROM public."WeddingPassCredential" c
  JOIN public."Guest" g ON g.id = c."guestId"
 WHERE g."weddingId" <> c."weddingId";

SELECT c.id, c."weddingId", c."passKeyId", k."weddingId" AS key_wedding
  FROM public."WeddingPassCredential" c
  JOIN public."WeddingPassKey" k ON k.id = c."passKeyId"
 WHERE k."weddingId" <> c."weddingId";

SELECT ci.id, ci."weddingId", ci."gateId", g."weddingId" AS gate_wedding
  FROM public."WeddingCheckIn" ci
  JOIN public."WeddingGate" g ON g.id = ci."gateId"
 WHERE g."weddingId" <> ci."weddingId";

SELECT ci.id, ci."weddingId", ci."credentialId", c."weddingId" AS credential_wedding
  FROM public."WeddingCheckIn" ci
  JOIN public."WeddingPassCredential" c ON c.id = ci."credentialId"
 WHERE c."weddingId" <> ci."weddingId"
    OR c."guestId" <> ci."guestId";
