-- ============================================================================
-- Wedding Day domain — HARDENED REVIEW PROPOSAL (supersedes
-- 20260917114500_wedding_day_domain.sql)
--
-- REVIEW ONLY. NOT an active Prisma migration. Do not place under
-- prisma/migrations/ and do not execute against production until the read-only
-- preflight (scripts/wedding-day-production-preflight.sql) has been run against
-- the real Wewed production database and its output reviewed.
--
-- What changed versus the 20260917 proposal, and why:
--
--   1. Cross-wedding integrity is now enforced by the database through COMPOSITE
--      foreign keys. The previous proposal used parallel single-column FKs
--      (weddingId -> Wedding.id, guestId -> Guest.id), which each hold
--      individually while still permitting a credential in Wedding A that points
--      at a Guest of Wedding B. Every relationship that carries a weddingId now
--      references a (id, weddingId) pair, so the wrong-wedding combination is
--      rejected by Postgres regardless of what the application believes.
--
--   2. A guest may hold at most ONE live credential, enforced by a partial
--      unique index rather than by an application read-then-write.
--
--   3. Credentials gain "issueSeq" and "supersededAt" so reissue after
--      revocation or expiry creates a new, distinct, immutable identity instead
--      of colliding with the dead row it replaces.
--
-- PREREQUISITE ON AN EXISTING TABLE — READ THIS FIRST
--
--   Vendor and ServiceEngagement already carry @@unique([id, weddingId]); Guest
--   does NOT. Composite FKs onto Guest therefore require adding that unique
--   index to a large, live, core table. Because "id" is already the primary key,
--   (id, weddingId) is trivially unique for every row that exists, so this can
--   never fail on data — but it does build an index on Guest.
--
--   Step 0 must therefore run OUTSIDE the main transaction, using
--   CREATE UNIQUE INDEX CONCURRENTLY, which cannot run inside a transaction
--   block. Running it inline would hold an ACCESS EXCLUSIVE lock on Guest for
--   the duration of the build and stall every RSVP in flight.
-- ============================================================================


-- ============================================================================
-- STEP 0 — prerequisite index on Guest. RUN ALONE, OUTSIDE A TRANSACTION.
-- ============================================================================
-- psql: \set ON_ERROR_STOP on
-- Run with autocommit ON. Do not wrap in BEGIN/COMMIT.
--
-- If this is interrupted it can leave an INVALID index behind; check with the
-- preflight's invalid-index query and DROP INDEX CONCURRENTLY before retrying.

SET lock_timeout = '5s';
SET statement_timeout = '0';          -- a concurrent build must not be cut short

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Guest_id_weddingId_key"
    ON public."Guest" ("id", "weddingId");

-- Verify it built cleanly before continuing to STEP 1:
--   SELECT indisvalid FROM pg_index
--    WHERE indexrelid = '"Guest_id_weddingId_key"'::regclass;   -- expect true


-- ============================================================================
-- STEP 1 — the Wedding Day domain. Single transaction; all or nothing.
-- ============================================================================
BEGIN;

-- Fail fast rather than queue behind a long-running transaction. Every statement
-- below touches either brand-new tables or takes a brief lock on Guest/Wedding
-- to validate a foreign key, so a short lock_timeout is the safe setting.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

-- ── Preflight collision checks ──────────────────────────────────────────────
-- Refuse to proceed if any target name is already taken by something we did not
-- create. Cheaper to abort here than to discover a half-applied migration.
DO $preflight$
DECLARE
    collision TEXT;
BEGIN
    SELECT string_agg(c.relname, ', ')
      INTO collision
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'v', 'm', 'p')
       AND c.relname IN (
           'WeddingPassKey', 'WeddingPassCredential', 'WeddingCheckIn',
           'WeddingAnnouncement', 'WeddingServicePresence'
       );
    IF collision IS NOT NULL THEN
        RAISE EXCEPTION 'Wedding Day migration aborted: relation(s) already exist: %', collision;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'Guest_id_weddingId_key'
    ) THEN
        RAISE EXCEPTION 'Wedding Day migration aborted: STEP 0 (Guest_id_weddingId_key) has not been applied.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
         WHERE i.indexrelid = '"Guest_id_weddingId_key"'::regclass
           AND i.indisvalid
    ) THEN
        RAISE EXCEPTION 'Wedding Day migration aborted: Guest_id_weddingId_key exists but is INVALID.';
    END IF;
END
$preflight$;


-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE "WeddingPassKey" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'ECDSA_P256_SHA256',
    "publicKeyPem" TEXT NOT NULL,
    "publicKeyDerBase64" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingPassKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingPassCredential" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "passKeyId" TEXT NOT NULL,
    "weddingShortId" TEXT NOT NULL,
    "passSerial" TEXT NOT NULL,
    -- Monotonic per (weddingId, guestId). Each reissue is a new immutable identity.
    "issueSeq" INTEGER NOT NULL DEFAULT 1,
    "tokenVersion" TEXT NOT NULL DEFAULT 'WW2',
    "eventBitmask" INTEGER NOT NULL,
    "nonce" TEXT NOT NULL,
    "signatureHex" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    -- Replaced by a later issue. Distinct from revocation: nobody withdrew this
    -- credential, it simply is no longer the current one. Kept for audit; never
    -- cleared. A superseded credential is dead at the gate exactly like a
    -- revoked one.
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingPassCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingPassCredential_issueSeq_positive" CHECK ("issueSeq" >= 1)
);

CREATE TABLE "WeddingCheckIn" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "credentialId" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT 'wedding-day',
    "attendeeKey" TEXT NOT NULL,
    "attendeeKind" TEXT NOT NULL DEFAULT 'primary',
    "attendeeName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'qr',
    "gateId" TEXT,
    "deviceId" TEXT,
    "clientEventId" TEXT,
    "admittedByUserId" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingAnnouncement" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingServicePresence" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceEngagementId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "changedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingServicePresence_pkey" PRIMARY KEY ("id")
);


-- ── Uniqueness these tables are referenced BY ───────────────────────────────
-- Composite targets. A composite FK can only point at a unique constraint that
-- covers exactly its column list, so each referenced pair needs its own index.

CREATE UNIQUE INDEX "WeddingPassKey_id_weddingId_key"
    ON "WeddingPassKey"("id", "weddingId");
CREATE UNIQUE INDEX "WeddingPassCredential_id_weddingId_guestId_key"
    ON "WeddingPassCredential"("id", "weddingId", "guestId");


-- ── Domain uniqueness ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX "WeddingPassKey_weddingId_keyId_key"
    ON "WeddingPassKey"("weddingId", "keyId");
CREATE INDEX "WeddingPassKey_weddingId_status_idx"
    ON "WeddingPassKey"("weddingId", "status");

CREATE UNIQUE INDEX "WeddingPassCredential_token_key"
    ON "WeddingPassCredential"("token");
CREATE UNIQUE INDEX "WeddingPassCredential_weddingId_passSerial_key"
    ON "WeddingPassCredential"("weddingId", "passSerial");
CREATE UNIQUE INDEX "WeddingPassCredential_weddingId_guestId_issueSeq_key"
    ON "WeddingPassCredential"("weddingId", "guestId", "issueSeq");

-- THE concurrency guarantee: at most one live credential per guest per wedding.
-- Both predicates are plain NULL tests, so the index is IMMUTABLE-safe (an
-- expiry-aware predicate would need now() and is not indexable). Expiry is
-- therefore retired explicitly by setting supersededAt, which is what frees this
-- slot — see ensureWeddingPassCredential.
CREATE UNIQUE INDEX "WeddingPassCredential_weddingId_guestId_live_key"
    ON "WeddingPassCredential"("weddingId", "guestId")
    WHERE "revokedAt" IS NULL AND "supersededAt" IS NULL;

CREATE INDEX "WeddingPassCredential_weddingId_guestId_revokedAt_idx"
    ON "WeddingPassCredential"("weddingId", "guestId", "revokedAt");
CREATE INDEX "WeddingPassCredential_passKeyId_weddingId_idx"
    ON "WeddingPassCredential"("passKeyId", "weddingId");

CREATE UNIQUE INDEX "WeddingCheckIn_weddingId_eventKey_guestId_attendeeKey_key"
    ON "WeddingCheckIn"("weddingId", "eventKey", "guestId", "attendeeKey");
CREATE UNIQUE INDEX "WeddingCheckIn_weddingId_clientEventId_key"
    ON "WeddingCheckIn"("weddingId", "clientEventId");
CREATE INDEX "WeddingCheckIn_weddingId_eventKey_admittedAt_idx"
    ON "WeddingCheckIn"("weddingId", "eventKey", "admittedAt");
CREATE INDEX "WeddingCheckIn_guestId_weddingId_idx"
    ON "WeddingCheckIn"("guestId", "weddingId");
CREATE INDEX "WeddingCheckIn_credentialId_weddingId_guestId_idx"
    ON "WeddingCheckIn"("credentialId", "weddingId", "guestId");

CREATE INDEX "WeddingAnnouncement_weddingId_status_publishedAt_idx"
    ON "WeddingAnnouncement"("weddingId", "status", "publishedAt");

CREATE UNIQUE INDEX "WeddingServicePresence_weddingId_serviceEngagementId_key"
    ON "WeddingServicePresence"("weddingId", "serviceEngagementId");
CREATE INDEX "WeddingServicePresence_weddingId_state_idx"
    ON "WeddingServicePresence"("weddingId", "state");
CREATE INDEX "WeddingServicePresence_vendorId_weddingId_idx"
    ON "WeddingServicePresence"("vendorId", "weddingId");


-- ── Foreign keys: composite wherever a weddingId travels with an id ─────────

ALTER TABLE "WeddingPassKey"
    ADD CONSTRAINT "WeddingPassKey_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeddingPassCredential"
    ADD CONSTRAINT "WeddingPassCredential_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- The guest must belong to THIS wedding, not merely exist.
ALTER TABLE "WeddingPassCredential"
    ADD CONSTRAINT "WeddingPassCredential_guestId_weddingId_fkey"
    FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- The signing key must belong to THIS wedding.
ALTER TABLE "WeddingPassCredential"
    ADD CONSTRAINT "WeddingPassCredential_passKeyId_weddingId_fkey"
    FOREIGN KEY ("passKeyId", "weddingId") REFERENCES "WeddingPassKey"("id", "weddingId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WeddingCheckIn"
    ADD CONSTRAINT "WeddingCheckIn_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeddingCheckIn"
    ADD CONSTRAINT "WeddingCheckIn_guestId_weddingId_fkey"
    FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- The credential must belong to THIS wedding AND to THIS guest. This is the one
-- that makes "admitted Guest A on Guest B's pass" unrepresentable.
--
-- ON DELETE RESTRICT, and emphatically not SET NULL. A credential is security
-- evidence: it records which pass admitted which person to which wedding. The
-- application never deletes one — it revokes or supersedes — so nothing
-- legitimate is blocked by refusing the delete outright.
--
-- SET NULL was not merely ambiguous here, it was wrong. On a composite foreign
-- key Postgres nulls EVERY referencing column, not just the one that names the
-- parent: deleting a credential emits
--     UPDATE "WeddingCheckIn" SET "credentialId"=NULL, "weddingId"=NULL, "guestId"=NULL
-- which erases the check-in's wedding and guest identity outright. Today that is
-- caught only because both columns happen to be NOT NULL, so the attempt fails
-- with a confusing not-null violation rather than a deliberate refusal — and if
-- either column were ever relaxed it would succeed and silently orphan the
-- admission record. Verified against PostgreSQL 16; see
-- WEDDING_DAY_ISOLATED_DB_QUALIFICATION.md.
--
-- Whole-wedding deletion still works: the cascade from "Wedding" removes the
-- referencing check-ins before this constraint is evaluated, which was tested
-- rather than assumed.
ALTER TABLE "WeddingCheckIn"
    ADD CONSTRAINT "WeddingCheckIn_credentialId_weddingId_guestId_fkey"
    FOREIGN KEY ("credentialId", "weddingId", "guestId")
    REFERENCES "WeddingPassCredential"("id", "weddingId", "guestId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WeddingAnnouncement"
    ADD CONSTRAINT "WeddingAnnouncement_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeddingServicePresence"
    ADD CONSTRAINT "WeddingServicePresence_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingServicePresence"
    ADD CONSTRAINT "WeddingServicePresence_vendorId_weddingId_fkey"
    FOREIGN KEY ("vendorId", "weddingId") REFERENCES "Vendor"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingServicePresence"
    ADD CONSTRAINT "WeddingServicePresence_serviceEngagementId_weddingId_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId")
    REFERENCES "ServiceEngagement"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Privilege posture ───────────────────────────────────────────────────────
-- Server-only domain: no browser role reaches these tables directly. RLS is
-- enabled with no permissive policy, so even a role that somehow retained
-- SELECT sees nothing.
--
-- NOTE ON PUBLIC: revoking from anon/authenticated alone is not sufficient.
-- Postgres grants nothing on new tables by default, but privileges can arrive
-- via GRANT ... ON ALL TABLES IN SCHEMA or ALTER DEFAULT PRIVILEGES, both of
-- which commonly target PUBLIC. PUBLIC is revoked explicitly for that reason.
-- The owning/migration role and the application role retain access by ownership
-- and by explicit grant respectively.
--
-- The application's production database role is NOT yet known. Until the
-- preflight identifies it, this file must not claim the domain is server-only
-- in production — it can only claim that no client role is granted here.

ALTER TABLE "WeddingPassKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingPassCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingCheckIn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingAnnouncement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingServicePresence" ENABLE ROW LEVEL SECURITY;

-- FORCE applies RLS to the table owner too, so a mistaken query as the owner
-- cannot quietly bypass the policy set.
ALTER TABLE "WeddingPassKey" FORCE ROW LEVEL SECURITY;
ALTER TABLE "WeddingPassCredential" FORCE ROW LEVEL SECURITY;
ALTER TABLE "WeddingCheckIn" FORCE ROW LEVEL SECURITY;

-- ── The server role, which MUST be decided before this migration runs ───────
--
-- Read this even if you skim everything else. RLS enabled with no policy does
-- not raise an error for a role that lacks BYPASSRLS — it silently returns zero
-- rows. Verified on PostgreSQL 16: an ordinary role holding SELECT on
-- "WeddingPassCredential" reads 0 of 2 existing rows, with no warning. If the
-- Wewed server connects as such a role, Wedding Day does not fail loudly; it
-- finds no credential for any guest and the gate admits nobody, which is the
-- worst possible way for this to be wrong.
--
-- Three supported postures. Choose deliberately; do not leave it to chance:
--
--   1. The server role has BYPASSRLS (Supabase's `postgres` does). RLS then
--      constrains browser roles only, and the policies below are belt-and-braces.
--   2. The server role is an ordinary role. It NEEDS the policies below, or the
--      domain is silently unreadable.
--   3. The server role owns the tables but lacks BYPASSRLS. FORCE above means it
--      is still subject to RLS, so it also NEEDS the policies below.
--
-- Set the role before running, e.g.
--     psql -v wedding_day_server_role=wewed_app ...
-- The guard refuses to proceed if it is unset or does not exist, because the
-- alternative is committing a domain nobody can read.

\if :{?wedding_day_server_role}
\else
\echo '!! ABORT: -v wedding_day_server_role=<role> is required. See the note above.'
\quit 1
\endif

-- psql does not interpolate :variables inside dollar-quoted bodies, so the role
-- is handed to the block through a session setting instead.
SELECT set_config('wewed.wedding_day_server_role', :'wedding_day_server_role', true);

DO $server_policies$
DECLARE
    server_role TEXT := current_setting('wewed.wedding_day_server_role', true);
    target      TEXT;
BEGIN
    IF server_role IS NULL OR btrim(server_role) = '' THEN
        RAISE EXCEPTION 'wedding_day_server_role must name the role the Wewed server connects as';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = server_role) THEN
        RAISE EXCEPTION 'wedding_day_server_role % does not exist in this database', server_role;
    END IF;

    FOREACH target IN ARRAY ARRAY[
        'WeddingPassKey', 'WeddingPassCredential', 'WeddingCheckIn',
        'WeddingAnnouncement', 'WeddingServicePresence'
    ] LOOP
        -- Full access for the server, and only for the server. This is not a
        -- weakening of RLS: no browser role is named here, and PUBLIC/anon/
        -- authenticated remain revoked below.
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL TO %I USING (true) WITH CHECK (true)',
            target || '_server_all', target, server_role
        );
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO %I', target, server_role
        );
    END LOOP;

    RAISE NOTICE 'Wedding Day server access granted to role %', server_role;
END
$server_policies$;

REVOKE ALL ON TABLE "WeddingPassKey", "WeddingPassCredential", "WeddingCheckIn",
  "WeddingAnnouncement", "WeddingServicePresence" FROM PUBLIC;

-- anon/authenticated are Supabase's browser roles. They are revoked by name, but
-- conditionally: a bare REVOKE aborts the whole transaction with "role does not
-- exist", which would make this migration unrunnable against any non-Supabase
-- database — including the isolated one it must be qualified on first.
DO $revoke_client_roles$
DECLARE
    client_role TEXT;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format(
                'REVOKE ALL ON TABLE "WeddingPassKey", "WeddingPassCredential", '
                '"WeddingCheckIn", "WeddingAnnouncement", "WeddingServicePresence" FROM %I',
                client_role
            );
            RAISE NOTICE 'Revoked Wedding Day table access from %', client_role;
        ELSE
            RAISE NOTICE 'Role % absent; nothing to revoke (expected outside Supabase)', client_role;
        END IF;
    END LOOP;
END
$revoke_client_roles$;


-- ── Post-migration assertions ───────────────────────────────────────────────
-- Fail the transaction rather than commit a half-correct shape.
DO $assert$
DECLARE
    composite_fks INTEGER;
    live_index    INTEGER;
BEGIN
    SELECT count(*) INTO composite_fks
      FROM pg_constraint
     WHERE contype = 'f'
       AND conname IN (
           'WeddingPassCredential_guestId_weddingId_fkey',
           'WeddingPassCredential_passKeyId_weddingId_fkey',
           'WeddingCheckIn_guestId_weddingId_fkey',
           'WeddingCheckIn_credentialId_weddingId_guestId_fkey'
       )
       AND cardinality(conkey) >= 2;
    IF composite_fks <> 4 THEN
        RAISE EXCEPTION 'Post-migration assertion failed: expected 4 composite FKs, found %', composite_fks;
    END IF;

    SELECT count(*) INTO live_index
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'WeddingPassCredential_weddingId_guestId_live_key'
       AND i.indisunique
       AND i.indpred IS NOT NULL;
    IF live_index <> 1 THEN
        RAISE EXCEPTION 'Post-migration assertion failed: partial unique live-credential index missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'WeddingPassCredential' AND relrowsecurity
    ) THEN
        RAISE EXCEPTION 'Post-migration assertion failed: RLS not enabled on WeddingPassCredential';
    END IF;

    -- confdeltype 'r' = RESTRICT. Anything else here (notably 'n' = SET NULL)
    -- would put the check-in's wedding/guest identity at risk; refuse to commit.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'WeddingCheckIn_credentialId_weddingId_guestId_fkey'
           AND confdeltype = 'r'
    ) THEN
        RAISE EXCEPTION 'Post-migration assertion failed: check-in credential FK is not ON DELETE RESTRICT';
    END IF;

    -- The failure this catches is silent by nature, so it is asserted rather
    -- than trusted: every Wedding Day table must carry a policy for the server
    -- role. Without one an ordinary role reads zero rows and reports no error.
    IF (
        SELECT count(DISTINCT polrelid) FROM pg_policy
         WHERE polrelid IN (
             '"WeddingPassKey"'::regclass, '"WeddingPassCredential"'::regclass,
             '"WeddingCheckIn"'::regclass, '"WeddingAnnouncement"'::regclass,
             '"WeddingServicePresence"'::regclass)
    ) <> 5 THEN
        RAISE EXCEPTION 'Post-migration assertion failed: a Wedding Day table has no server policy; the domain would read as empty';
    END IF;
END
$assert$;

COMMIT;


-- ============================================================================
-- ROLLBACK — reverse dependency order. Run only with explicit approval.
-- ============================================================================
-- Disable the feature first (WEDDING_DAY_GUEST_API_ENABLED=false) and redeploy
-- BEFORE running any of this, so nothing is mid-write.
--
-- Dropping these tables destroys admissions history. If any credential or
-- check-in row was ever issued, take an approved backup first and prefer
-- leaving the tables in place with the feature disabled.
--
-- BEGIN;
--   SET LOCAL lock_timeout = '5s';
--   DROP TABLE IF EXISTS "WeddingCheckIn";            -- references credential, guest, wedding
--   DROP TABLE IF EXISTS "WeddingPassCredential";     -- references passKey, guest, wedding
--   DROP TABLE IF EXISTS "WeddingPassKey";            -- references wedding
--   DROP TABLE IF EXISTS "WeddingServicePresence";
--   DROP TABLE IF EXISTS "WeddingAnnouncement";
-- COMMIT;
--
-- STEP 0 is deliberately NOT reversed by default: "Guest_id_weddingId_key" is
-- harmless, cheap to keep, and dropping it is another concurrent index operation
-- on a core table. Drop it only if a reviewer explicitly asks:
--   DROP INDEX CONCURRENTLY IF EXISTS "Guest_id_weddingId_key";   -- outside a transaction
