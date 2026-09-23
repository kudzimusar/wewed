# WeWed — Phase 11B Wedding Day / WW2 Non-Production Activation Runbook & Checklist

> **Authorization boundary:** Every production-shaped command in this document is a future execution template only. Phase 11B rehearsal and moderator acceptance do **not** authorize Production database access, migration, key creation/configuration, feature enablement, live Gate admission, deployment, signing or release. The rehearsal evidence for this phase comes only from disposable/non-production environments. A separately approved owner change is required before substituting a Production URL, secret store, host or workload into any command below.


**Document Version:** 1.0.0  
**Phase:** 11B (Non-Production Activation & Readiness Rehearsal)  
**Date:** September 24, 2026  
**Status:** REHEARSAL VERIFIED — AWAITING SEPARATE PRODUCTION AUTHORIZATION  
**Master Plan Reference:** `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01` Checkpoint D-039  

---

> [!CAUTION]
> **STRICT PRODUCTION BOUNDARY MANDATE**  
> This runbook is a non-production qualification and rehearsal artifact. It does **NOT** grant authority to:
> 1. Access, alter, or migrate any Production database.
> 2. Generate, read, or configure real Production private keys.
> 3. Enable `WEWED_WEDDING_DAY_WW2_ENABLED` in any production environment.
> 4. Admit real guests or operate live Gate check-in in Production.
> 5. Merge to `main`, deploy server code to production hosts, or submit mobile apps to Play Store / TestFlight.
>
> Execution against production requires an explicit, separate authorization from the product owner.

---

## 1. Executive Summary & Purpose

Phase 11B qualifies the end-to-end activation, verification, operation, and rollback procedures for the converged Wedding Day (WW2) authority architecture. The rehearsal proves that the system can transition safely from its default dormant state (`WEWED_WEDDING_DAY_WW2_ENABLED=false`) to full operational capability, tolerate offline gate operations, enforce cryptographic signatures, handle credential revocations, and rollback instantaneously without data loss or corruption.

All procedures in this runbook were rehearsed against local PostgreSQL 16 (`127.0.0.1:55432`) and verified across the server backend, Android client, and iOS client test suites.

---

## 2. Production Read-Only Preflight Procedure

Before applying any migration or altering configurations, an operator must run the read-only preflight script. The script performs non-mutating `SELECT` queries to prove the target database is ready for the Wedding Day schema.

### Execution Command
```bash
psql "$DATABASE_URL" -f docs/native-mobile/migration-review/20260924000000_wedding_day_ww2_preflight.sql
```

### Verification Criteria
| Check | Query / Section | Expected Result | Pass Criteria |
|---|---|---|---|
| Database & Role | `pg_roles` | Role name, superuser / RLS status | Role possesses DDL privileges |
| Existing Tables | `to_regclass` | `WeddingGate`, `WeddingGateAssignment` exist; `WeddingPass*` do NOT exist prior to migration | No colliding pre-WW2 tables |
| Migration History | `_prisma_migrations` | `20260923210000_wedding_gate_authority` finished | Phase 10 Gate authority migration applied |
| Composite Unique Candidate | `Guest(id, weddingId)` | `duplicate_count` returns 0 rows | No duplicate tuples prevent composite unique index |
| Unofficial Footprint | `pg_class` for `public` | 0 rows returned | No partial or unmanaged tables exist |

---

## 3. Migration Command Sequence & Rollback Plan

### Forward Migration Application
The migration strictly preserves `WEWED_WEDDING_DAY_WW2_ENABLED=false` during application.

```bash
# 1. Ensure feature flag remains disabled in environment
export WEWED_WEDDING_DAY_WW2_ENABLED="false"

# 2. Apply Prisma schema migration
npx prisma migrate deploy
```

Migration File: `prisma/migrations/20260924000000_wedding_day_ww2_authority/migration.sql`

### Rollback / Emergency Down-Migration
If migration encounters unexpected errors, the rollback rehearsal script safely removes created objects in reverse dependency order while leaving core tables (`Wedding`, `Guest`, `RSVP`, `User`) completely unaffected.

```bash
psql "$DATABASE_URL" -f docs/native-mobile/migration-review/20260924000000_wedding_day_ww2_rollback_rehearsal.sql
```

---

## 4. Production Postflight Procedure

Immediately following migration application, execute the postflight verification script.

### Execution Command
```bash
psql "$DATABASE_URL" -f docs/native-mobile/migration-review/20260924000000_wedding_day_ww2_postflight.sql
```

### Verification Checklist
- [x] **RLS Enabled:** `WeddingPassKey`, `WeddingPassCredential`, and `WeddingCheckIn` report `rls_enabled = t`.
- [x] **Foreign Keys Active:** Exactly 9 foreign key constraints verified with `ON DELETE RESTRICT` and `convalidated = t`:
  - `WeddingPassKey_weddingId_fkey`
  - `WeddingPassCredential_weddingId_fkey`
  - `WeddingPassCredential_guestId_weddingId_fkey`
  - `WeddingPassCredential_passKeyId_weddingId_fkey`
  - `WeddingCheckIn_weddingId_fkey`
  - `WeddingCheckIn_guestId_weddingId_fkey`
  - `WeddingCheckIn_credentialId_weddingId_guestId_fkey`
  - `WeddingCheckIn_gateId_weddingId_fkey`
  - `WeddingCheckIn_admittedByUserId_fkey`
- [x] **Composite Unique Indexes Active:**
  - `Guest_id_weddingId_key`
  - `WeddingPassCredential_weddingId_guestId_live_key` (partial unique: live passes only)
  - `WeddingCheckIn_weddingId_eventKey_guestId_attendeeKey_key`
  - `WeddingCheckIn_weddingId_clientEventId_attendeeKey_key`
- [x] **Cross-Wedding Isolation Audit:** All 4 cross-wedding integrity audit queries return **0 rows**.

---

## 5. Safe Key Configuration Procedure (0 Secret Disclosure)

Wedding Day requires two distinct ECDSA P-256 (`prime256v1`) keypairs:
1. **WW2 Pass Signing Key:** Signs guest pass tokens.
2. **Root Manifest Signing Key:** Signs the gate manifest envelope.

### Key Generation and Storage Protocol
Keys must be generated in an approved secure key-generation environment and stored as PKCS#8 PEM secrets in the deployment platform's secret manager. The current Wedding Day signer reads PEM environment secrets; a non-exportable HSM key is **not** directly compatible without a separately designed signing adapter. Private keys are never logged, checked into version control, pasted into terminal commands/history, tickets, chat, or transmitted over unencrypted channels.

### Required Environment Variables
```env
WEDDING_DAY_WW2_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WEDDING_DAY_WW2_KEY_ID="ww2-prod-20260924-v1"
WEDDING_DAY_ROOT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WEDDING_DAY_ROOT_KEY_ID="root-prod-20260924-v1"
```

### Safe Preflight Verification CLI
The preflight tool validates key syntax, curve adherence, self-signature verification in IEEE P1363 format, and key distinction **without ever outputting private key material**.

```bash
bun scripts/wedding-day-key-preflight.ts
```

**Safe Public Output Example:**
```text
================================================================================
WEDDING DAY SIGNING ENVIRONMENT PREFLIGHT
================================================================================
Passes: 10 / 10 checks
Ready:  YES

CHECKS:
  [PASS] WW2 pass key: present (set)
  [PASS] WW2 pass key: parses (type ec)
  [PASS] WW2 pass key: curve is P-256 (prime256v1)
  [PASS] WW2 pass key: public key derives (SHA256:4a:2e:9c:8b:...)
  [PASS] WW2 pass key: signature is IEEE-P1363 (64 bytes / 128 hex)
  [PASS] WW2 pass key: derived public key verifies its own signature (verified)
  [PASS] WEDDING_DAY_WW2_KEY_ID (ww2-prod-20260924-v1)
  [PASS] Root manifest key: present (set)
  [PASS] Root manifest key: parses (type ec)
  [PASS] Root manifest key: curve is P-256 (prime256v1)
  [PASS] Root manifest key: public key derives (SHA256:d1:8f:33:0a:...)
  [PASS] Root manifest key: signature is IEEE-P1363 (64 bytes / 128 hex)
  [PASS] Root manifest key: derived public key verifies its own signature (verified)
  [PASS] WEDDING_DAY_ROOT_KEY_ID (root-prod-20260924-v1)
  [PASS] WW2 and root keys are distinct (distinct)
================================================================================
```

### Public Key Fingerprint Matching
Operators verify that the public key fingerprint embedded in client builds matches the derived server root fingerprint:
- Client Root Fingerprint: `SHA256:<hex>`
- Server Derived Fingerprint: `SHA256:<hex>`

---

## 6. Controlled Enablement Sequence (7 Ordered Stages)

```mermaid
flowchart TD
    S1["Stage 1: Read-Only Preflight SQL & Env Audit"] --> S2["Stage 2: Database Migration (Flag OFF)"]
    S2 --> S3["Stage 3: Database Postflight SQL Audit"]
    S3 --> S4["Stage 4: Inject Keys into Secret Vault"]
    S4 --> S5["Stage 5: Run Safe Key Preflight CLI"]
    S5 --> S6["Stage 6: Controlled Enable (WEWED_WEDDING_DAY_WW2_ENABLED=true)"]
    S6 --> S7["Stage 7: Live Canary Test (Pass Issue & Gate Check-in)"]
```

1. **Stage 1 — Preflight Audit:** Run `20260924000000_wedding_day_ww2_preflight.sql`. Verify 0 table collisions and 0 duplicate guests.
2. **Stage 2 — Schema Migration:** Execute `npx prisma migrate deploy` while `WEWED_WEDDING_DAY_WW2_ENABLED=false`.
3. **Stage 3 — Postflight Audit:** Run `20260924000000_wedding_day_ww2_postflight.sql`. Confirm 9 foreign keys, 4 indexes, and RLS enabled.
4. **Stage 4 — Key Material Injection (future approved change only):** Populate `WEDDING_DAY_*` through the deployment platform's secret-management interface. Do not paste private PEM values into shell commands, terminal history, CI logs, tickets, or chat.
5. **Stage 5 — Key Preflight Execution:** Run `bun scripts/wedding-day-key-preflight.ts` inside the already-secret-injected workload/environment. Confirm `RESULT: all checks passed.` and record only the complete public SHA-256 fingerprints and non-secret key IDs.
6. **Stage 6 — Canary Activation:** Set `WEWED_WEDDING_DAY_WW2_ENABLED=true` on the canary application container.
7. **Stage 7 — Operational Qualification:** Conduct one synthetic canary test (Issue pass -> Fetch manifest -> Admittance check-in -> Verify RSVP completion).

---

## 7. Production Release-Candidate Server & Native Diff

### Server RC Commit Lineage
- **Base Tip (Phase 11A Accepted):** `22896072f897d52608605127a3f3b3c41e345ef1`
- **Rehearsal Tip (Phase 11B):** `backend/wedding-day-ww2-phase11b-20260924`
- **Key Deliverables Added:**
  - `scripts/wedding-day-key-preflight.ts`: Safe zero-secret CLI inspection tool.
  - `src/app/api/native/gate/wedding-day/pass/revoke/route.ts`: Operational pass revocation endpoint requiring the dedicated `gate.pass.revoke` capability.
  - `src/lib/wedding-day-activation-rehearsal.integration.test.ts`: Complete 11-stage synthetic lifecycle rehearsal suite (100% pass).

### Native Mobile RC Commit Lineage
- **Base Tip (Phase 11A Accepted):** `8105bc91145f1c634258480ea7fb397db22b0089`
- **Rehearsal Tip (Phase 11B):** `native-mobile/wedding-day-ww2-phase11b-20260924`
- **Key Deliverables Added:**
  - Android `WeddingDaySyncService.kt` & `WeddingDayGateOperations.kt`: Added `revokePass` implementation and mock transport unit tests.
  - iOS `WeddingDaySyncService.swift` & `WeddingDayGateOperations.swift`: Added `revokePass` protocol and implementation with `RevokeStubProtocol` tests.

---

## 8. Credential Revocation & Operator Management Workflow

When a guest reports a lost or compromised device at the gate, or when an operator needs to re-issue a credential:

1. **Gate Operator Action:** Operator selects "Revoke Pass" on the Gate mobile interface or calls the revocation API.
2. **API Endpoint:** `POST /api/native/gate/wedding-day/pass/revoke`
   - Headers: `Authorization: Bearer <token>`, `x-wewed-grant-id: <grantId>`
   - Body: `{"passSerial": "WWABC1234-001", "reason": "Lost device reported at North Gate"}`
3. **Authority Enforcement:** Endpoint re-resolves the live operational grant and requires the dedicated `gate.pass.revoke` capability. `gate.checkin.write` alone cannot revoke a credential. Grant this capability only to assignments intended to perform credential-management operations; existing check-in-only assignments remain unable to revoke.
4. **Database Mutation:**
   - `WeddingPassCredential.revokedAt = now()`
   - `WeddingPassCredential.revocationReason = <reason>`
   - `WeddingPassCredential.supersededAt = now()`
5. **Revocation propagation:** Any subsequent online server presentation of the old token or serial fails closed with `PASS_REVOKED_OR_EXPIRED`. The revoking device must mark its cached credential revoked immediately after server success. Other disconnected Gate devices cannot learn a new revocation until they refresh a signed manifest, so operational procedure must require a manifest refresh after revocation before relying on that revocation at another offline Gate.
6. **Isolated Re-issuance:** Re-issuing for the guest (`ensureWeddingPassCredential`) creates a new record with `issueSeq = 2` and a new random nonce and serial (`WW...-002`). The revoked record remains permanently in the database for audit integrity.

---

## 9. Full Synthetic Flow Rehearsal Evidence

The full synthetic lifecycle rehearsal was executed and verified end-to-end:

| Stage | Operation | Result | Execution Details |
|---|---|---|---|
| Stage 1 | Safe Key Preflight | PASS | Validated 10/10 checks; 0 secret disclosure |
| Stage 2 | Database Schema Preflight | PASS | Verified 5 required tables and 0 pre-existing passes |
| Stage 3 | Feature Flag OFF Gate | PASS | Verified 503 across all 4 HTTP routes & core library |
| Stage 4 & 5 | Pass Issuance & Dot Format | PASS | `WW2.<shortId>.<serial>.<maskHex>.<nonce>.<sigHex>` |
| Stage 6 | Signed Manifest & Verification | PASS | Root signature verified with DER public key (IEEE P1363) |
| Stage 7 | Offline Token Verification | PASS | Verified offline pass signature with cached manifest key |
| Stage 8 | Reconnect Sync & Idempotency | PASS | Admitted primary; duplicate event deduplicated |
| Stage 9 | Household RSVP Completion | PASS | Admitted plus-one; `RSVP.checkedIn` updated to `true` |
| Stage 10 | Revocation & Reissue | PASS | Revoked pass rejected; new serial issued with `issueSeq=2` |
| Stage 11 | Feature Flag OFF Rollback | PASS | Immediate 503 shutdown; all DB rows preserved intact |

### Automated Test Suite Results
- **Server:** 31 tests passed across 4 test files (`bun test src/lib/wedding-day*`).
- **Android:** 25 actionable tasks executed; unit tests passed (`./gradlew testDebugUnitTest`).
- **iOS:** 428 tests passed; 0 unexpected failures (`swift test`).

---

## 10. Rollback & Containment Criteria

### Rollback Threshold Triggers
An operator must immediately execute containment if any of the following occur during or after activation:
1. Public key fingerprint mismatch between server and native clients.
2. Unhandled `500 Internal Server Error` on manifest or check-in endpoints.
3. Cryptographic signature verification failure on valid newly-issued passes.
4. Duplicate check-in event creating orphaned or duplicate admission records.
5. Database connection pool exhaustion or lock timeout during guest pass issuance.

### Containment Procedure (Immediate Fail-Closed)
```bash
# 1. Flip feature flag to false in server environment
export WEWED_WEDDING_DAY_WW2_ENABLED="false"

# 2. Restart application container instances
docker compose restart web
```

### Containment Guarantees
- All Wedding Day endpoints immediately return `503 Service Unavailable` with code `WEDDING_DAY_DISABLED`.
- Zero database rows are deleted or cascaded.
- All check-in timestamps and pass credentials remain preserved for audit and post-mortem analysis.

---

## 11. Explicit GO / NO-GO Production Checklist

To be completed by the Release Commander and Database Administrator prior to production enablement:

### Pre-Migration
- [ ] Production read-only preflight script executed (`20260924000000_wedding_day_ww2_preflight.sql`).
- [ ] Verified zero colliding tables or unmanaged `WeddingPass*` objects.
- [ ] Confirmed composite candidate `Guest(id, weddingId)` has 0 duplicate tuples.
- [ ] Current database backup confirmed restorable in staging.

### Migration & Postflight
- [ ] `WEWED_WEDDING_DAY_WW2_ENABLED` confirmed **OFF** during migration.
- [ ] `npx prisma migrate deploy` executed with 0 errors.
- [ ] Production postflight script executed (`20260924000000_wedding_day_ww2_postflight.sql`).
- [ ] Exactly 9 foreign keys confirmed valid with `ON DELETE RESTRICT`.
- [ ] All 4 integrity check queries returned 0 cross-wedding rows.
- [ ] Row Level Security confirmed active on all 3 Wedding Day tables.

### Key Configuration & Preflight
- [ ] ECDSA P-256 keys generated in an approved secure key-generation environment and stored as PKCS#8 PEM in the deployment secret manager. A non-exportable HSM key requires a separate signing-adapter implementation.
- [ ] Keys injected into environment secrets with strict access controls.
- [ ] `bun scripts/wedding-day-key-preflight.ts` executed on server host.
- [ ] Key preflight report outputs `RESULT: all checks passed.`; complete public SHA-256 fingerprints and non-secret key IDs are cross-checked without exposing PEM.
- [ ] Public key fingerprints cross-checked against native build configuration.
- [ ] Confirmed zero private key bytes present in logs or CI output.

### Controlled Activation & Verification
- [ ] Canary Gate assignment intended to exercise revocation explicitly includes `gate.pass.revoke`; ordinary check-in-only assignments do not gain it implicitly.
- [ ] Set `WEWED_WEDDING_DAY_WW2_ENABLED="true"` on canary host.
- [ ] Synthetic canary pass issued and validated (dot format confirmed).
- [ ] Signed manifest fetched and cryptographically verified.
- [ ] One test check-in completed and confirmed in database audit trail.
- [ ] Final sign-off from Release Commander.

**DECISION:** `[ ] GO` / `[ ] NO-GO`  
**Release Commander Signature:** ___________________________  
**Date & UTC Timestamp:** __________________________________  
