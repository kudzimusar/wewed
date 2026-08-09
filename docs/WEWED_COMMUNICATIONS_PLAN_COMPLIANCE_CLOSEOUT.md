# Wewed Communications — Original Plan Compliance Closeout

**Date:** 2026-08-09  
**Base:** `main` at `80c81206914dba29e3ff7966521c3a10edeb5ce8`  
**Purpose:** Close the last release-level gap found by a fresh audit of `WEWED_COMMUNICATIONS_PLATFORM_PLAN.md` before real UAT.

## Authoritative scope

The original communications platform plan remains authoritative. Its Phase A/session Definition of Done requires the private Wewed-owned conversation core, authenticated APIs, server-enforced authorization, `/messages`, event instrumentation without raw-body analytics leakage, separation from the public wedding guest-wall `Message`, exact-head regression qualification, and safe deployment gates.

The plan also states that request-rate limiting may reuse existing Wewed patterns, but endpoint-level guards must be added **before external-channel fanout is enabled**. PR #103 made external fanout real, so that guard is now a release requirement rather than a deferred optimization.

Later roadmap items remain intentionally later unless they are required to preserve the safety of the current release: attachments/scanning, block/mute/report, content moderation, richer staff operations, Wedding Rooms, advanced analytics/AI, and fully bidirectional external-channel bridges.

## Gap being closed

Current communications mutation routes authenticate and authorize correctly but do not enforce a distributed communications-specific request/fanout budget. That leaves a signed-in account able to create/send enough messages to amplify external delivery attempts and consume provider quota.

## Required implementation

1. Add a private `wewed_communications` rate-limit bucket with no browser-role privileges.
2. Use hashed scope/user keys only; never store raw message bodies, email addresses, phone numbers, provider tokens, or other endpoint values in rate-limit state.
3. Enforce server-side distributed limits for:
   - conversation creation;
   - message mutation/send;
   - recipient fanout proportional to the number of recipient deliveries a mutation can generate;
   - user-managed channel endpoint/preference mutations where they could otherwise be abused.
4. Return `429` plus `Retry-After` when a budget is exhausted.
5. Fail closed if the rate-limit backend cannot make an authoritative decision.
6. Do not rate-limit the trusted internal delivery dispatcher with the user-mutation limiter.
7. Preserve the invariant that canonical Wewed message persistence is independent of later provider transport success.

## Regression gates

The exact candidate head must prove:

- clean migration on an empty PostgreSQL database;
- no schema drift in CI;
- `anon` / `authenticated` cannot read/write the private rate-limit table;
- allowance, rejection, window reset, fanout accounting and `Retry-After` behavior;
- unauthenticated/non-member authorization remains unchanged;
- staff-only content remains private and cannot externally fan out to ordinary participants;
- public `/api/messages` guest-wall behavior remains untouched;
- channel endpoint/preference/queue/retry/provider-event tests remain green;
- canonical messages remain safe if external transport is unavailable;
- no raw body/endpoint/provider secret logging or rate-limit key storage;
- production build and the full existing Wewed release matrix remain green.

## Production deployment rule

Merge only the exact fully qualified head. Because the production Prisma migration ledger is intentionally fail-closed, apply only this reviewed additive communications migration through the already-established Supabase production migration path, then independently verify structure/privileges. Do not replay unrelated historical Prisma migrations.

## UAT readiness decision

Real UAT is approved only when this closeout is merged, the production communications schema contains the rate guard, the exact application tree is qualified, and the current tester target is serving that qualified tree. External provider credentials/account approvals may remain separate only where the original plan explicitly treats them as adapter prerequisites rather than core messaging requirements.
