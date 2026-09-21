# Wedding Day production migration review — NO GO

Migration safe as-is: **NO** — but for a shorter list of reasons than before. No migration, no
signing-key change and no production query has been executed. The proposal is a review artefact
under `migration-review/`, not an active Prisma migration; moving it into deployment migrations
requires explicit approval.

## What changed in this round

The 20260917 proposal has been superseded by
`migration-review/20260921120000_wedding_day_domain_hardened.sql`, which closes the integrity and
lifecycle gaps an independent review found. Every claim below is now backed by an isolated-database
run recorded in `WEDDING_DAY_ISOLATED_DB_QUALIFICATION.md`, not by reading the SQL.

### Cross-wedding integrity is enforced by the database

The previous proposal used parallel single-column foreign keys: `weddingId → Wedding.id` and
`guestId → Guest.id`. Both hold individually while still permitting a credential in Wedding A that
points at a Guest of Wedding B — the relationship nobody checked was the one *between* them. Every
Wedding Day relationship that carries a `weddingId` now references a composite `(id, weddingId)`
pair, so the wrong-wedding combination is rejected by Postgres regardless of application state.
Five distinct cross-wedding shapes were attempted against a real database and all five were
refused; see the qualification document for the exact constraint each one hit.

This requires `UNIQUE (id, weddingId)` on `Guest`, which production does not have.
`Vendor` and `ServiceEngagement` already do, which is how `WeddingServicePresence` already used
composite keys. Creating it is STEP 0 of the migration: `CREATE UNIQUE INDEX CONCURRENTLY`, outside
a transaction. It cannot fail on data (`id` is already the primary key), but it does build an index
on a large live table and must not hold `ACCESS EXCLUSIVE` while doing so.

### WW2 credential lifecycle

The old `passSerial` was derived from `(weddingId, guestId)` alone and the table was unique on
`(weddingId, passSerial)`, with issuance doing `ON CONFLICT ... DO UPDATE ... RETURNING *`. After a
revocation the "new" credential collided with the revoked row and the caller was handed back the
dead credential it was trying to replace — a guest whose pass was revoked could never be issued
another one. The lifecycle is now:

- a **live, unexpired** credential is reused;
- a **revoked** credential is preserved, never un-revoked, never reused, and a fresh credential is
  issued alongside it with its own id, nonce, serial and token;
- an **expired** credential is marked `supersededAt` — retired, not edited or deleted — which frees
  the single live slot for the replacement;
- `issueSeq` gives every issue an immutable identity and makes the serial per-issue rather than
  per-guest.

A superseded credential is dead at the gate: `verifyWeddingPassToken` refuses it, `guestPassForRequest`
refuses it, and both manifest projections publish `COALESCE(revokedAt, supersededAt)` so every
offline device that already honours revocation honours supersession with no client change.

### Concurrency model

Two devices asking for a pass at the same moment must not mint two live credentials. This is
enforced by the database, not by check-then-insert:

1. the live credential is selected `FOR UPDATE`, so a second caller blocks rather than racing;
2. `WeddingPassCredential_weddingId_guestId_live_key`, a **partial unique index** over
   `(weddingId, guestId) WHERE revokedAt IS NULL AND supersededAt IS NULL`, makes a second live
   credential impossible even if the lock is bypassed;
3. a caller that loses re-reads and returns the winner's credential rather than erroring.

The whole sequence is one transaction, so a crash between retiring the old credential and inserting
the new one cannot strand a guest with no live pass. The predicate uses only `IS NULL` tests because
an expiry-aware predicate would need `now()` and is not indexable — which is precisely why expiry is
retired explicitly via `supersededAt` rather than inferred.

### Pass issuance and expiry policy

Previously implicit in one expression: `max(weddingDate + 36h, now + 12h)`. Now stated once, in
`weddingPassIssuanceWindow`, anchored to the wedding date and never to the request:

| Bound | Rule |
|---|---|
| Issuance opens | wedding date − **14 days** |
| Issuance cutoff | wedding date + **24 hours** — past this, no new credential is issued at all |
| Credential expires | wedding date + **36 hours**, whatever time it was issued |

Reuse of an already-live credential is *not* gated by the window; only minting a new one is. The
old formula's defect was reachable only past the cutoff: at the latest permitted request the
`now + 12h` term reaches exactly wedding + 36h, so inside the window the two agree, and beyond it
the old behaviour issued a pass that outlived the celebration. That request is now refused. Boundary
behaviour (open, one ms before/after each bound, exactly at the cutoff, long after) is pinned in
`wedding-pass-issuance-window.test.ts`.

### Transaction, lock and timeout strategy

- **STEP 0** runs alone, autocommit, `lock_timeout = 5s`, `statement_timeout = 0` (a concurrent
  index build must not be cut short mid-way).
- **STEP 1** is a single `BEGIN … COMMIT`: all tables, indexes, foreign keys and grants, or nothing.
  `lock_timeout = 5s` so it fails fast rather than queueing behind a long transaction;
  `statement_timeout = 60s`; `idle_in_transaction_session_timeout = 60s`.
- Preflight collision checks abort before any DDL if a target relation exists or STEP 0 is missing
  or invalid.
- Post-migration assertions verify 4 composite FKs, the partial unique index and RLS, and abort the
  transaction if the resulting shape is wrong.

### Privileges

RLS is enabled on all five tables and `FORCE`d on the three that carry credentials and admissions,
so even the table owner cannot bypass the empty policy set. `REVOKE ... FROM PUBLIC` is
unconditional — revoking from `anon`/`authenticated` alone is insufficient, because privileges
commonly arrive via `GRANT ... ON ALL TABLES IN SCHEMA` or `ALTER DEFAULT PRIVILEGES` targeting
PUBLIC, and the preflight reads `pg_default_acl` precisely to find those. The `anon`/`authenticated`
revokes are conditional on the roles existing, so the migration is runnable outside Supabase.

**This file still does not claim the domain is server-only in production.** It claims no client role
is granted here. The application's production database role is unknown until the read-only preflight
identifies it, and "server-only" cannot be asserted before then.

### Rollback

Ordered reverse of dependency, in the migration file: disable `WEDDING_DAY_GUEST_API_ENABLED` and
redeploy *first* so nothing is mid-write, then `WeddingCheckIn` → `WeddingPassCredential` →
`WeddingPassKey` → `WeddingServicePresence` → `WeddingAnnouncement`. Dropping these destroys
admissions history; if any credential or check-in was ever issued, take an approved backup and
prefer leaving the tables in place with the feature disabled. STEP 0's index is deliberately not
reversed by default — it is harmless, and dropping it is another concurrent operation on a core
table.

## Still outstanding before this may be applied

1. **Production catalog comparison: NOT DONE.** The read-only preflight
   (`scripts/wedding-day-production-preflight.sql`) is written and has been executed end-to-end
   against the isolated database with zero errors, but never against production: the Supabase
   connector available to this workspace exposes only an unrelated project (`church-os-dev`), which
   was not queried. Production identity and read-only access must be established first. The
   preflight refuses to be useful without it — section 0 prints database identity, connected role,
   version and corroborating row counts precisely so an operator can confirm what they are looking
   at before trusting anything below.
2. **Application database role unknown**, so the privilege posture above is unverified against
   reality.
3. **Signing keys not configured.** `scripts/wedding-day-key-preflight.ts` reports all four
   `WEDDING_DAY_*` variables ABSENT in every environment checked. It validates P-256, public-key
   derivation, IEEE-P1363 encoding (64 bytes / 128 hex) and self-verification, prints only a
   public-key fingerprint, and exits non-zero until the environment is ready. No production key has
   been generated, uploaded, rotated or activated.
4. **`WEDDING_DAY_GUEST_API_ENABLED` remains unset**, and both endpoints fail closed with 503
   `WEDDING_DAY_NOT_ENABLED`. Unchanged by this work.
5. **Migration not promoted.** No file under `prisma/migrations/`; `prisma/` is untouched on this
   branch.

## Distance to Shadreck UAT

Unchanged in order, and this round advances only the first item: the data model is now internally
safe and proven so on a real database. Still ahead: read-only production inspection → migration
approval → secret and key configuration → migration → deployment → signed Android/iOS
qualification → controlled UAT.
