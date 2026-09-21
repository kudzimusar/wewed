-- ============================================================================
-- Wedding Day — READ-ONLY production database preflight
--
--   psql "$PRODUCTION_READONLY_URL" -f scripts/wedding-day-production-preflight.sql
--
-- Run this, read the output, and only then decide whether the hardened Wedding
-- Day migration may be applied. Nothing here writes: no INSERT, UPDATE, DELETE,
-- ALTER, CREATE, DROP, TRUNCATE, GRANT or REVOKE appears in this file, and it
-- takes no locks beyond catalog reads.
--
-- Section 0 prints the database's identity. STOP and confirm it is genuinely
-- the Wewed production database before trusting anything below it — the same
-- query set run against the wrong database produces confident, wrong answers.
--
-- Prefer a read-only role. As a belt-and-braces measure the session is set
-- read-only below, so an accidental write in an edited copy of this file is
-- refused by the server rather than by the reader's care.
-- ============================================================================

\set ON_ERROR_STOP on
\pset pager off
\timing off

SET default_transaction_read_only = on;
SET statement_timeout = '60s';
SET lock_timeout = '2s';

BEGIN READ ONLY;

\echo '================================================================'
\echo '0. DATABASE IDENTITY — confirm this is Wewed production'
\echo '================================================================'
SELECT current_database()                     AS database,
       current_user                           AS connected_as,
       session_user                           AS session_user,
       current_setting('is_superuser')        AS is_superuser,
       version()                              AS server_version,
       current_setting('TimeZone')            AS server_timezone,
       pg_size_pretty(pg_database_size(current_database())) AS database_size,
       (SELECT count(*) FROM pg_stat_activity) AS active_backends,
       inet_server_addr()                     AS server_address;

\echo ''
\echo '-- Identity corroboration: row counts of tables only Wewed would have.'
\echo '-- A database without these is not Wewed production. Counts are totals only;'
\echo '-- no guest, couple or wedding row is read by this script.'
SELECT 'Wedding' AS table_name, count(*) AS rows FROM public."Wedding"
UNION ALL SELECT 'Guest', count(*) FROM public."Guest"
UNION ALL SELECT 'RSVP', count(*) FROM public."RSVP"
UNION ALL SELECT 'Couple', count(*) FROM public."Couple"
ORDER BY table_name;

\echo ''
\echo '================================================================'
\echo '1. MIGRATION HISTORY — last 15 applied'
\echo '================================================================'
SELECT migration_name,
       finished_at,
       (rolled_back_at IS NOT NULL) AS rolled_back,
       applied_steps_count
  FROM public._prisma_migrations
 ORDER BY COALESCE(finished_at, started_at) DESC
 LIMIT 15;

\echo ''
\echo '-- Any migration that failed or was rolled back (expect zero rows):'
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
  FROM public._prisma_migrations
 WHERE rolled_back_at IS NOT NULL OR finished_at IS NULL;

\echo ''
\echo '================================================================'
\echo '2. REQUIRED BASE TABLES — all six must be present'
\echo '================================================================'
WITH required(name) AS (
    VALUES ('Wedding'), ('Guest'), ('RSVP'), ('SeatingTable'),
           ('Vendor'), ('ServiceEngagement')
)
SELECT r.name AS required_table,
       (c.oid IS NOT NULL) AS present,
       COALESCE(c.relkind::text, '-') AS relkind,
       COALESCE(pg_size_pretty(pg_total_relation_size(c.oid)), '-') AS total_size
  FROM required r
  LEFT JOIN pg_class c
         ON c.relname = r.name
        AND c.relnamespace = 'public'::regnamespace
 ORDER BY r.name;

\echo ''
\echo '================================================================'
\echo '3. TARGET NAME COLLISIONS — every row here blocks the migration'
\echo '================================================================'
WITH proposed(name) AS (
    VALUES ('WeddingPassKey'), ('WeddingPassCredential'), ('WeddingCheckIn'),
           ('WeddingAnnouncement'), ('WeddingServicePresence')
)
SELECT p.name AS proposed_relation,
       (c.oid IS NOT NULL) AS already_exists,
       COALESCE(c.relkind::text, '-') AS relkind
  FROM proposed p
  LEFT JOIN pg_class c
         ON c.relname = p.name
        AND c.relnamespace = 'public'::regnamespace
 ORDER BY p.name;

\echo ''
\echo '-- Index / constraint name collisions (expect zero rows):'
SELECT c.relname AS existing_index
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relkind = 'i'
   AND c.relname IN (
       'Guest_id_weddingId_key',
       'WeddingPassKey_id_weddingId_key',
       'WeddingPassKey_weddingId_keyId_key',
       'WeddingPassCredential_id_weddingId_guestId_key',
       'WeddingPassCredential_token_key',
       'WeddingPassCredential_weddingId_passSerial_key',
       'WeddingPassCredential_weddingId_guestId_issueSeq_key',
       'WeddingPassCredential_weddingId_guestId_live_key',
       'WeddingCheckIn_weddingId_eventKey_guestId_attendeeKey_key',
       'WeddingCheckIn_weddingId_clientEventId_key',
       'WeddingServicePresence_weddingId_serviceEngagementId_key'
   );

\echo ''
\echo '================================================================'
\echo '4. COMPOSITE UNIQUENESS THE COMPOSITE FOREIGN KEYS DEPEND ON'
\echo '================================================================'
\echo '-- Guest(id, weddingId) is the prerequisite STEP 0 creates. Vendor and'
\echo '-- ServiceEngagement should already have theirs. present=false for Guest is'
\echo '-- expected today; present=false for Vendor/ServiceEngagement is a blocker.'
WITH needed(tbl, cols) AS (
    VALUES ('Guest', ARRAY['id','weddingId']),
           ('Vendor', ARRAY['id','weddingId']),
           ('ServiceEngagement', ARRAY['id','weddingId'])
)
SELECT n.tbl AS table_name,
       array_to_string(n.cols, ', ') AS required_unique_on,
       EXISTS (
           SELECT 1
             FROM pg_index i
             JOIN pg_class ic ON ic.oid = i.indexrelid
            WHERE i.indrelid = format('public.%I', n.tbl)::regclass
              AND i.indisunique
              AND i.indisvalid
              AND (
                  SELECT array_agg(a.attname::text ORDER BY a.attname)
                    FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute a
                      ON a.attrelid = i.indrelid AND a.attnum = k.attnum
              ) = (SELECT array_agg(c ORDER BY c) FROM unnest(n.cols) AS c)
       ) AS present
  FROM needed n
 ORDER BY n.tbl;

\echo ''
\echo '-- Invalid indexes anywhere (a previous CONCURRENTLY build may have failed;'
\echo '-- these must be dropped CONCURRENTLY before retrying). Expect zero rows:'
SELECT c.relname AS invalid_index, c2.relname AS on_table
  FROM pg_index i
  JOIN pg_class c  ON c.oid  = i.indexrelid
  JOIN pg_class c2 ON c2.oid = i.indrelid
 WHERE NOT i.indisvalid
   AND c.relnamespace = 'public'::regnamespace;

\echo ''
\echo '================================================================'
\echo '5. EXISTING CONSTRAINTS ON THE TABLES BEING REFERENCED'
\echo '================================================================'
SELECT conrelid::regclass::text AS table_name,
       conname                  AS constraint_name,
       CASE contype WHEN 'p' THEN 'primary key'
                    WHEN 'u' THEN 'unique'
                    WHEN 'f' THEN 'foreign key'
                    WHEN 'c' THEN 'check'
                    ELSE contype::text END AS kind,
       pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace
   AND conrelid::regclass::text IN
       ('"Guest"', 'public."Guest"', '"Vendor"', 'public."Vendor"',
        '"ServiceEngagement"', 'public."ServiceEngagement"', '"Wedding"', 'public."Wedding"')
 ORDER BY table_name, kind, constraint_name;

\echo ''
\echo '-- Column types must match the proposal (TEXT ids, TIMESTAMP(3)):'
SELECT table_name, column_name, data_type, is_nullable,
       COALESCE(datetime_precision::text, '-') AS datetime_precision
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('Wedding','Guest','Vendor','ServiceEngagement')
   AND column_name IN ('id','weddingId','date')
 ORDER BY table_name, column_name;

\echo ''
\echo '================================================================'
\echo '6. DATA THAT WOULD BREAK THE NEW FOREIGN KEYS'
\echo '================================================================'
\echo '-- Guests whose wedding is missing (orphans). Expect 0:'
SELECT count(*) AS orphan_guests
  FROM public."Guest" g
  LEFT JOIN public."Wedding" w ON w.id = g."weddingId"
 WHERE w.id IS NULL;

\echo '-- RSVPs whose guest is missing. Expect 0:'
SELECT count(*) AS orphan_rsvps
  FROM public."RSVP" r
  LEFT JOIN public."Guest" g ON g.id = r."guestId"
 WHERE g.id IS NULL;

\echo '-- Guests seated at a table belonging to a DIFFERENT wedding. Expect 0.'
\echo '-- Non-zero means cross-wedding references already exist in production and'
\echo '-- must be resolved before composite integrity can be trusted anywhere.'
SELECT count(*) AS cross_wedding_seating
  FROM public."Guest" g
  JOIN public."SeatingTable" t ON t.id = g."seatingTableId"
 WHERE t."weddingId" IS DISTINCT FROM g."weddingId";

\echo '-- Duplicate (id, weddingId) pairs in Guest — must be 0 for STEP 0 to build.'
\echo '-- It is 0 by construction while id is the primary key; verified, not assumed:'
SELECT count(*) AS duplicate_guest_id_wedding_pairs
  FROM (
      SELECT g.id, g."weddingId"
        FROM public."Guest" g
       GROUP BY g.id, g."weddingId"
      HAVING count(*) > 1
  ) duplicates;

\echo ''
\echo '================================================================'
\echo '7. PRIVILEGES, ROLES AND RLS'
\echo '================================================================'
\echo '-- Which role does the application actually connect as? The migration cannot'
\echo '-- claim "server-only" until this is known and matched against the grants below.'
SELECT rolname,
       rolsuper    AS is_superuser,
       rolbypassrls AS bypasses_rls,
       rolcanlogin  AS can_login
  FROM pg_roles
 WHERE rolcanlogin
    OR rolname IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
 ORDER BY rolname;

\echo ''
\echo '-- Existing grants on the referenced tables, including PUBLIC:'
SELECT grantee, table_name, string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('Wedding','Guest','RSVP','SeatingTable','Vendor','ServiceEngagement')
 GROUP BY grantee, table_name
 ORDER BY table_name, grantee;

\echo ''
\echo '-- Schema-level grants on public (USAGE/CREATE for PUBLIC matters here):'
SELECT nspname AS schema, nspacl::text AS acl
  FROM pg_namespace WHERE nspname = 'public';

\echo ''
\echo '-- DEFAULT PRIVILEGES: the usual way a new table silently acquires grants.'
\echo '-- Any row targeting anon/authenticated/PUBLIC means the new Wedding Day'
\echo '-- tables would be granted on creation, and the REVOKEs in the migration are'
\echo '-- load-bearing rather than belt-and-braces. Expect to read this carefully:'
SELECT pg_get_userbyid(d.defaclrole) AS granting_role,
       n.nspname                     AS schema,
       d.defaclobjtype               AS object_type,
       d.defaclacl::text             AS default_acl
  FROM pg_default_acl d
  LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
 ORDER BY granting_role, schema;

\echo ''
\echo '-- RLS posture of comparable existing tables, for reference:'
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relkind = 'r'
   AND c.relname IN ('Wedding','Guest','RSVP','Vendor','ServiceEngagement')
 ORDER BY c.relname;

\echo ''
\echo '================================================================'
\echo '8. BACKUP / RECOVERY READINESS (best effort from catalog)'
\echo '================================================================'
SELECT current_setting('wal_level', true)            AS wal_level,
       current_setting('archive_mode', true)         AS archive_mode,
       pg_is_in_recovery()                           AS in_recovery;

\echo '-- Replication slots / standbys, if visible to this role:'
SELECT slot_name, slot_type, active FROM pg_replication_slots;

\echo ''
\echo '-- NOTE: point-in-time-recovery windows on managed Postgres (Supabase) are a'
\echo '-- platform setting, not a catalog fact. Confirm the PITR window and take an'
\echo '-- explicit pre-migration backup through the provider console. This script'
\echo '-- cannot and does not verify that for you.'

\echo ''
\echo '================================================================'
\echo 'END OF PREFLIGHT — nothing was modified.'
\echo 'Re-read section 0 before acting on anything above.'
\echo '================================================================'

COMMIT;
