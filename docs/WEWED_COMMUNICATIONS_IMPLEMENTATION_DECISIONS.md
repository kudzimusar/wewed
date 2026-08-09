# Wewed Communications — Implementation Decisions

**Date:** 2026-08-09  
**Status:** Authoritative implementation addendum  
**Applies to:** `docs/WEWED_COMMUNICATIONS_PLATFORM_PLAN.md`

## Decision 1 — Private PostgreSQL schema, not public Prisma models

The Phase A implementation uses migration-managed tables in the private PostgreSQL schema `wewed_communications` and parameterized server-side SQL through the existing Prisma connection.

This decision **supersedes the preliminary sentence in section 7 of `WEWED_COMMUNICATIONS_PLATFORM_PLAN.md` that says the implementation uses additive Prisma models**. The logical `Communication*` data model described in that section remains authoritative; only its physical access pattern changes.

### Why

Wewed already has a production precedent for sensitive server-only data in a private PostgreSQL schema. Private conversations contain substantially more sensitive information than the public wedding guest-wall `Message` model, so they should not become browser-queryable merely because the project uses Prisma for the public application schema.

The migration therefore:

- creates `wewed_communications`
- revokes schema/table access from `PUBLIC`
- explicitly revokes access from Supabase `anon` and `authenticated` roles when those roles exist
- keeps all authorization in Wewed's authenticated server routes
- uses parameterized `Prisma.sql` queries rather than interpolated SQL strings
- preserves the existing public `Message` model and `/api/messages` route unchanged

### Consequences

1. Prisma schema validation and generation continue to cover the existing public application schema.
2. The reviewed SQL remains stored under `prisma/migrations` so clean-database CI exercises it with the repository's complete migration history.
3. Communication tables are intentionally absent from `schema.prisma`; application access goes through `src/lib/communications.ts`.
4. Browser/Supabase clients cannot bypass the Wewed communication permission layer to query private messages directly.
5. Future schema changes to communications must be reviewed, migration-managed and matched by server-domain changes.

## Decision 2 — Canonical write precedes every delivery adapter

A Wewed message is successful when its canonical message transaction commits. External delivery is secondary.

Phase A creates an `IN_APP` delivery record. Future email, push, WhatsApp and SMS adapters must execute after the canonical write and update `CommunicationDelivery` independently. An external-provider failure must never delete or roll back the Wewed conversation or message.

## Decision 3 — Polling is the Phase A realtime mechanism

The initial Inbox uses visibility-aware low-frequency polling and manual refresh rather than introducing a paid or separately operated realtime dependency.

This keeps incremental infrastructure cost at effectively zero and leaves the canonical domain independent from any future Cloudflare WebSocket/Durable Object, Supabase Realtime or third-party chat transport.

## Decision 4 — Provider access remains fail-closed

The current verified application session contract provides `admin`, `couple` and `planner` identities. Public provider/vendor profile records are not treated as authenticated users.

Therefore:

- provider/vendor conversation context is supported by the domain taxonomy and entity-link design
- provider-facing inbox access is **not** enabled until Wewed has a verified provider account/session identity
- no public provider ID, email address or profile token may be used as a substitute for authenticated membership

This is a deliberate security boundary.

## Decision 5 — Existing email tooling is not reimplemented speculatively

The repository does not currently expose a reusable, verified application-level Resend/Brevo sender abstraction in the inspected source tree. Phase A therefore does not add a second email stack, duplicate secrets or invent provider configuration.

The connected Resend account does have the verified sending domain `updates.wewed.pro`, so the transport side is ready for a later adapter. The deployed application still needs one approved reusable sender abstraction and a verified runtime credential before Wewed communication fan-out is enabled.

The email bridge remains an adapter gate. When that sender path is represented in the repository, it can consume `CommunicationDelivery` without changing the conversation schema.

## Decision 6 — Release qualification

The communications branch is not mergeable merely because the UI compiles. The exact tree must pass:

- clean PostgreSQL migration deployment
- communications policy and schema contracts
- signed-session, cross-user authorization integration tests
- application production build
- existing main release/regression workflows
- changed-file review confirming the public wedding `Message` system was not modified

The qualified tree SHA for the initial release was `84295bcacd0173feb22c1f3d87c7fe21fa108863`. The final PR head and the merged `main` commit both resolve to that exact tree.

## Decision 7 — Production DDL authority follows the existing Supabase migration history until Prisma is reconciled

The first merge-time attempt to run `prisma migrate deploy` exposed pre-existing production migration-ledger drift. The production schema has historically been advanced through the Supabase migration system, while `public._prisma_migrations` contains only a small subset of the repository's migration directories.

The failed Prisma run attempted to replay historical migrations against schema that already contained their DDL and stopped at `20260729131000_normalize_planner_metadata` because `Vendor.contact` already existed. This is a migration-history problem, not a communications-schema problem.

Wewed therefore **must not baseline or mark historical Prisma migrations as applied without a separate reconciliation audit**. It must also not automatically replay the repository's historical Prisma migration chain against production.

For the communications release, the reviewed SQL file

`prisma/migrations/20260809090000_wewed_communications_foundation/migration.sql`

was applied through the connected Supabase migration API as `wewed_communications_foundation`. This preserves a production migration record in the system that has historically managed the production DDL while avoiding false Prisma ledger entries.

The generic `Deploy database migrations` workflow is returned to manual-only operation and now fails closed before `prisma migrate deploy` when either:

- an unresolved Prisma migration row exists; or
- the number of successfully recorded Prisma migrations does not match the repository migration directory count.

This prevents another accidental historical replay. A future database-governance task should reconcile Supabase migration history, Prisma migration history and the current production schema before Prisma becomes the sole production migration authority.

## Decision 8 — Production communications schema verification

After applying the communications migration to the Wewed Supabase project `kjigkhjdeymukwradoqu`, verification confirmed:

- `CommunicationConversation` exists
- `CommunicationParticipant` exists
- `CommunicationMessage` exists
- `CommunicationEntityLink` exists
- `CommunicationDelivery` exists
- `CommunicationEvent` exists
- Supabase migration history contains `wewed_communications_foundation`
- `anon` has no `USAGE` privilege on `wewed_communications`
- `authenticated` has no `USAGE` privilege on `wewed_communications`
- neither browser role has `SELECT` privilege on `CommunicationMessage`

The production database foundation is therefore installed and fail-closed independently of application deployment status.

## Decision 9 — Hosting quota is an external release boundary, not a reason to weaken the architecture

The Vercel Hobby account exhausted its deployment build quota during branch qualification. Vercel reported `Deployment rate limited — retry in 24 hours` and did not create a deployment for the communications merge commit.

The active production deployment remains the prior READY `main` deployment until Vercel permits another build. The communications schema is additive, so installing it before the application build is safe; the previous production application does not reference the new private schema.

No paid upgrade is required for the communications architecture. Wewed should retry the normal `main` production deployment after the free-tier build limit clears rather than purchasing capacity solely to complete this release.