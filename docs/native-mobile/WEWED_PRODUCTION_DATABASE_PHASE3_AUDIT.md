# WEWED PRODUCTION DATABASE — PHASE 3 AUDIT

**Plan ID:** WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01  
**Phase:** 3 — Global read-only production database audit  
**Branch:** `backend/production-database-audit-phase3-20260922`  
**Status:** IN PROGRESS — database identity gate not yet closed

## 1. Safety boundary

This phase is read-only.

No production INSERT, UPDATE, DELETE, UPSERT, DDL, migration application, GRANT/REVOKE, secret rotation, or data repair is permitted.

Any production SQL must execute only after the live Vercel `DATABASE_URL` has been fingerprinted to the expected Wewed Supabase project reference:

`kjigkhjdeymukwradoqu`

The temporary Preview audit route:
- exists only on the exact Phase-3 branch;
- returns 404 in Production;
- parses `DATABASE_URL` in memory only;
- never returns or logs the password, query string, or full URL;
- refuses all SQL if the project reference does not match Wewed;
- runs only hardcoded catalog/identity SELECTs under `SET TRANSACTION READ ONLY`;
- deliberately rolls the transaction back.

It must be removed after Phase 3.

## 2. Independently verified non-secret deployment facts

- Vercel team: Eleven-11-Tech / `11-11`
- Vercel team id: `team_InL2Jmsg4dbG0rFY8nxriTha`
- Vercel project: `wewed`
- Vercel project id: `prj_JSSaBHv2CIhJIeHxep6YigJoObFX`
- Production alias `wewed.pro` currently resolves to the `main` deployment.
- Repository guard `scripts/check-supabase-project.sh` expects project ref `kjigkhjdeymukwradoqu`.

These facts do not, by themselves, prove that the live Prisma `DATABASE_URL` points to that project.

## 3. Current blocker

The Vercel `DATABASE_URL` is marked Sensitive. Vercel does not return its value to CLI/API reads. The currently connected Supabase account does not have access to project `kjigkhjdeymukwradoqu`.

Therefore the live deployment-to-database binding must be proved from inside an environment where the sensitive value is already injected.

A temporary Preview-only fingerprint/preflight route has been added for that purpose.

## 4. Phase-3 artifacts

- `src/lib/phase3-database-fingerprint.ts`
- `src/lib/phase3-database-fingerprint.test.ts`
- `src/app/api/uat/phase3/database-audit/route.ts`
- `scripts/production-authority-catalog-preflight.sql`

The catalog SQL is intentionally SELECT/catalog-only and wrapped in an explicit read-only transaction.

## 5. Identity gate evidence — pending

Record only sanitized values:

| Field | Result |
| --- | --- |
| DATABASE_URL fingerprint matches expected project | PENDING |
| Supabase project ref | PENDING |
| database host | PENDING |
| database name | PENDING |
| connection username | PENDING |
| current_user | PENDING |
| session_user | PENDING |
| PostgreSQL version | PENDING |
| SUPERUSER | PENDING |
| BYPASSRLS | PENDING |

No password or full connection string may be copied into this document.

## 6. Catalog audit — pending

After the identity gate is proved, complete:
- physical location/type of BusinessAccount / Member / Link / ProviderProfile;
- public compatibility-view definitions and security-invoker posture;
- RLS and application-role privileges;
- platform-admin registry readability/parity;
- business member role/status/permission shapes;
- WeddingMembership role/status/permission shapes;
- BusinessAccountLink relationship distributions;
- Vendor → ServiceEngagement integrity;
- multi-business and multi-wedding distributions;
- UserProfile ↔ auth identity assumption;
- subscription-status integrity;
- global wedding/guest/RSVP/seating/vendor relationship integrity;
- mature PWA domain catalog health;
- Usher/Gate production-authority discovery;
- Wedding Day partial-object discovery.

## 7. Exit gate

Phase 3 remains **NOT ACCEPTED** until:
1. the real Wewed production database is positively identified;
2. the application DB role is known;
3. the global read-only audit is completed;
4. production mutation remains zero;
5. the independent reviewer inspects and, where needed, patches branch-level audit defects before acceptance.
