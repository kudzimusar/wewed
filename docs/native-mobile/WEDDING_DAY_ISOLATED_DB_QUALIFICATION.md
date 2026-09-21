# Wedding Day migration — isolated database qualification

Evidence that the hardened review migration applies cleanly and that the database, not the
application, is what rejects cross-wedding data. Run against a disposable local PostgreSQL 16
cluster. **No production database was contacted.**

## How to reproduce

```bash
# 1. A throwaway cluster. It MUST run in UTC — see "Timezone" below.
initdb -D /tmp/wdpg-data -U wdtest --auth=trust
pg_ctl -D /tmp/wdpg-data -o "-p 55432 -k /tmp/wdpg -c timezone=UTC" -l /tmp/wdpg/pg.log start
createdb -h /tmp/wdpg -p 55432 -U wdtest wdiso

# 2. Supabase's browser roles, so the conditional REVOKE path is exercised as in production.
psql -h /tmp/wdpg -p 55432 -U wdtest -d postgres \
  -c "CREATE ROLE anon; CREATE ROLE authenticated;"

# 3. A representative slice of the pre-migration Wewed schema, then the proposal.
psql -h /tmp/wdpg -p 55432 -U wdtest -d wdiso -v ON_ERROR_STOP=1 -f 00_pre_migration_core.sql
psql -h /tmp/wdpg -p 55432 -U wdtest -d wdiso -v ON_ERROR_STOP=1 \
  -f docs/native-mobile/migration-review/20260921120000_wedding_day_domain_hardened.sql

# 4. Lifecycle tests, against that database.
WEDDING_DAY_TEST_DATABASE_URL="postgresql://wdtest@localhost:55432/wdiso?host=/tmp/wdpg" \
  bun test src/lib/wedding-day-credential-lifecycle.test.ts
```

The fixture schema mirrors production's uniqueness exactly, including the asymmetry that motivates
STEP 0: `Vendor` and `ServiceEngagement` carry `UNIQUE (id, weddingId)`; `Guest` does not.

## Result: migration applies

```
tables: 7
composite FKs: 6
partial live index valid: true
Guest_id_weddingId_key valid: true
RLS forced on credential: true
```

The migration's own post-assertions (4 composite FKs, the partial unique live index, RLS on
`WeddingPassCredential`) passed inside the transaction; a failure there aborts the migration rather
than committing a half-correct shape.

## Result: the database rejects every cross-wedding shape

Each attempt below is a direct `INSERT`, with the application entirely out of the picture.

| # | Attempted row | Outcome |
|---|---|---|
| 1 | Credential in Wedding A referencing a **Guest of Wedding B** | `ERROR: violates foreign key constraint "WeddingPassCredential_guestId_weddingId_fkey"` — `Key (guestId, weddingId)=(guest-b, wed-a) is not present in table "Guest"` |
| 2 | Credential in Wedding A referencing a **PassKey of Wedding B** | `ERROR: violates foreign key constraint "WeddingPassCredential_passKeyId_weddingId_fkey"` — `Key (passKeyId, weddingId)=(key-b, wed-a) is not present in table "WeddingPassKey"` |
| 3 | Check-in in Wedding A referencing a **Guest of Wedding B** | `ERROR: violates foreign key constraint "WeddingCheckIn_guestId_weddingId_fkey"` |
| 4 | Check-in in Wedding B referencing a **Credential of Wedding A** | `ERROR: violates foreign key constraint "WeddingCheckIn_credentialId_weddingId_guestId_fkey"` |
| 5 | Check-in for Guest B using **Guest A's credential** | `ERROR: violates foreign key constraint "WeddingCheckIn_credentialId_weddingId_guestId_fkey"` |
| 6 | A **second live credential** for one guest | `ERROR: duplicate key value violates unique constraint "WeddingPassCredential_weddingId_guestId_live_key"` |

Case 2 was re-run in isolation with a guest holding no credential, because on the first pass the
live-credential index rejected it before the composite key FK was reached — a false pass that would
have left that constraint unproven. Re-run alone it fails on
`WeddingPassCredential_passKeyId_weddingId_fkey` as intended, and the control row using Wedding A's
own key inserts successfully.

## Result: the legitimate path works

`Wedding A → Guest A → WeddingPassKey A → Credential A → CheckIn A` inserts with every constraint
in place. After marking Credential A superseded, a replacement inserts and both rows coexist:

```
   id    | issueSeq | superseded
---------+----------+------------
 cred-a  |        1 | t
 cred-a2 |        2 | f
```

## Result: credential lifecycle, 7/7

```
✓ a live, unexpired credential is reused rather than reissued
✓ a revoked credential is preserved, never reused, and replaced by a distinct one
✓ an expired credential is superseded, not edited, and replaced by a distinct one
✓ old revoked, old expired and superseded tokens all fail verification; the new one passes
✓ concurrent issuance yields one credential, not two        (8 parallel callers → 1 credential)
✓ issuance is refused after the wedding cutoff, and a live pass is still honoured
✓ expiry is anchored to the wedding and does not move with the request time
```

## Findings worth carrying into the production migration

**1. `REVOKE ... FROM anon, authenticated` aborts where those roles do not exist.** The first
application failed with `ERROR: role "anon" does not exist`. Supabase has these roles so production
is unaffected, but a bare `REVOKE` makes the migration unrunnable anywhere else — including the
isolated qualification it has to pass first. The revokes are now wrapped in a `DO` block that skips
absent roles and `RAISE NOTICE`s which it skipped. `REVOKE ... FROM PUBLIC` stays unconditional.

**2. The qualification database must run in UTC.** Three lifecycle tests failed initially with
timestamps off by exactly 18 hours (2 × the cluster's +09:00 offset): `TIMESTAMP(3)` columns carry
no timezone, so a non-UTC cluster stores the local wall-clock and reads it back as UTC. An expired
credential read back as unexpired is a security-relevant misread, and it is purely an artefact of
the test cluster, not of the application — production Supabase runs UTC. Any future isolated
qualification must set `timezone=UTC` or it will draw wrong conclusions about expiry.

**3. `Guest(id, weddingId)` does not exist in production and must be created first.** It is
logically redundant — `id` is already the primary key, so the pair is unique for every row that
exists and the build cannot fail on data — but Postgres still requires a matching unique index as
the target of a composite foreign key. It is therefore STEP 0, run `CONCURRENTLY` and outside a
transaction, so a core table is not held under `ACCESS EXCLUSIVE` while the index builds.
