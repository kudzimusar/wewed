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
2. Prisma migrations still apply the private communications DDL because the SQL migration is part of `prisma/migrations`.
3. Communication tables are intentionally absent from `schema.prisma`; application access goes through `src/lib/communications.ts`.
4. Browser/Supabase clients cannot bypass the Wewed communication permission layer to query private messages directly.
5. Future schema changes to communications must be made through reviewed migrations and matching server-domain changes.

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

The email bridge remains an adapter gate. When the existing production sender/webhook path is represented in the repository (or a single approved abstraction is added), it can consume `CommunicationDelivery` without changing the conversation schema.

## Decision 6 — Release qualification

The communications branch is not mergeable merely because the UI compiles. The exact head must pass:

- clean PostgreSQL migration deployment
- migration status/diff checks used by Wewed CI
- communications policy and schema contracts
- application production build
- existing main release/regression workflows
- changed-file review confirming the public wedding `Message` system was not modified

Production database migration is performed only after merge through Wewed's existing protected production migration path.