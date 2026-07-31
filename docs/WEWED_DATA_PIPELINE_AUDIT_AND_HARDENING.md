# Wewed Data Pipeline Audit and Hardening

## Purpose

This document is the durable reference for the real-world data-flow audit performed before the Wewed parent-company Admin Console Preview. The work is a targeted hardening of the existing architecture, not a rebuild.

## Stakeholder graph

The governed platform graph is:

`Supabase identity -> UserProfile -> User -> BusinessAccountMember -> BusinessAccount -> BusinessAccountLink -> Couple/Wedding/Vendor -> WeddingMembership -> operational wedding data`

Wewed platform administrators are a separate graph:

`Supabase identity -> UserProfile -> User(admin) -> Wewed internal BusinessAccountMember -> Wewed internal BusinessAccount`

A platform administrator is not a wedding administrator and receives no wedding workspace or wedding API context.

## Verified gaps found

1. Core public tables had direct `anon` and `authenticated` PostgreSQL grants while most tables had no RLS. This allowed a PostgREST path around server-side tenant enforcement.
2. A Wewed platform administrator inherited the legacy global wedding-admin role and could receive all weddings during sign-in.
3. Business-governed wedding access failed open when a business-to-wedding link was missing.
4. Account approval changed lifecycle status but did not create the complete user/member/couple-or-planner/wedding/profile graph required for daily use.
5. Venue and vendor applications could be accepted despite there being no supported venue/vendor dashboard role in the session model.
6. Any active business member could initiate Stripe billing.
7. Stripe webhook idempotency used a read-then-write application check, allowing concurrency races.
8. A failed Stripe invoice record was not updated when a later event reported the invoice as paid.
9. Stripe and billing metadata updates could replace a stale copy of the whole metadata document.
10. The final-Super-Admin safeguard existed only in application code and was susceptible to concurrent updates.
11. Business lifecycle, status, plan, payment and relationship values were insufficiently constrained at the database boundary.

## Controls implemented

### Database boundary

Migration: `20260730224000_harden_wewed_data_pipeline`

- Revokes direct table and sequence privileges in `public` from Supabase `anon` and `authenticated` roles when those roles exist.
- Revokes equivalent default privileges so new server-owned tables are not exposed accidentally.
- Adds allowed-value checks for account, membership, subscription, payment, support and incident states.
- Adds unique source mapping, Stripe payment-reference and Stripe-event indexes.
- Validates polymorphic business links against their source record.
- Enforces owner membership as a deferred database invariant.
- Enforces the account lifecycle transition matrix at the database boundary.
- Synchronizes business membership access after restrictive lifecycle decisions without deleting historical records.
- Blocks public onboarding completion until identity, account, membership, wedding, profile and relationship links form a complete active graph.
- Serializes final-Super-Admin demotion/revocation with a PostgreSQL advisory lock.

### Authentication and authorization

- Wewed platform administrators use a platform-only session scope and receive no active wedding.
- Wedding APIs explicitly reject platform administrators.
- Legacy unmapped users retain existing wedding access.
- Once a user has any business mapping, access fails closed unless the member, account, onboarding and wedding link are all active and complete.

### Approval and internal onboarding

- Public registration remains inactive and pending review.
- Approval and internal onboarding are separate decisions.
- `/admin/onboarding` performs one atomic transaction for supported workspaces.
- Couple onboarding creates the couple, wedding, owner wedding membership, account links and synchronized user/profile roles.
- Planning-company onboarding assigns an existing wedding, creates the planner membership and synchronizes user/profile roles.
- Venue, vendor and generic-client login activation is intentionally blocked until a supported portal role exists; their business record may remain approved and in progress.
- Partial onboarding is rolled back and does not grant access.

### Billing and Stripe

- Billing requires a business owner, billing manager or explicit `billing.manage` permission.
- Billing requires an active, fully onboarded account.
- Stripe webhook events are processed inside an advisory-locked database transaction.
- Supported unmatched events fail and remain retryable.
- Payment records update from failed to paid/refunded rather than being silently skipped.
- Checkout completion stores identifiers but does not prematurely declare a subscription active.
- Metadata is merged at the database boundary rather than replacing a stale document.

## Regression and real-data validation

Completed on the final branch commit:

- Clean PostgreSQL migration deployment.
- Migration status and schema-drift check.
- Stakeholder data-pipeline source contracts.
- Admin governance, registration, RBAC and Stripe contracts.
- Platform-specific lint and full Next.js build.
- Every existing planner Stage 2-10 and Phase 2-6 suite.
- Executable planner Playwright browser release gate.
- Current planner business access comparison under the tightened predicate: all four assigned weddings remain allowed.
- Platform-admin mapping check: the Wewed administrator is identified as platform-only and has no direct wedding membership.
- Rolled-back real-data onboarding graph smoke test.
- Verification that zero smoke-test users, profiles, accounts, couples, weddings or memberships were retained.

## Release boundary

- Production application code remains unchanged until explicit approval.
- The hardening migration is committed and validated but must not be applied to the production database before the reviewed release decision.
- Preview review must use the exact final branch commit.
- Public registration, onboarding and Stripe write tests must not be run against production data during visual review.
- Stripe live processing remains disabled until test-mode secrets, webhook secret and Price IDs are configured and verified.
