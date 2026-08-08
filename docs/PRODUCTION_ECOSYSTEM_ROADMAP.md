# Wewed production ecosystem roadmap

Status: active production-hardening roadmap for `https://wewed.pro`.

## Governing architecture

The canonical external loop is:

**User → `wewed.pro` → Cloudflare DNS/security/routing → Vercel/Wewed → external provider → `wewed.pro` → user**

A production integration is not complete merely because the external provider is configured. Every user-visible success, cancel, confirmation, reply, portal, webhook and recovery path must return through a controlled Wewed origin and be observable in Wewed operations.

## Phase status

### 1. Domain and DNS foundation — COMPLETE

- `wewed.pro` is the canonical production domain.
- Cloudflare is authoritative DNS.
- Vercel continues hosting the application.
- Apex and `www` behavior have been production-tested.
- Legacy public Vercel-host routing returns users to `wewed.pro`.

### 2. Public navigation and trust loop — COMPLETE

- Public Company, Trust, Legal, Developer and Help information architecture is live.
- Canonical metadata, robots and sitemap use `wewed.pro`.
- Public policy/trust documentation is separated from internal APIs and unearned claims.

### 3. Human inbound email — COMPLETE FOR OPERATIONS; STAFF SEPARATION IN PROGRESS

- Cloudflare Email Routing is enabled.
- Root-domain operational aliases are routed explicitly.
- Catch-all is set to `Drop`.
- Inbound canary to `support@wewed.pro` succeeded.
- Staff aliases exist; each becomes private only after it is routed to that staff member's own verified Gmail destination.

### 4. Application transactional email — COMPLETE FOUNDATION

- Application transactional mail uses Resend on `updates.wewed.pro`.
- Production environment variables are configured in Vercel.
- Production outbound canary succeeded.
- Signed Resend webhooks and private delivery audit tables are implemented.
- Application registration callbacks are pinned to canonical Wewed URLs.

### 5. Human staff outbound email — WORKING PATTERN; ROLL OUT PER STAFF

- Root `wewed.pro` is authenticated in Brevo for human SMTP Send-As.
- Gmail Send-As through Brevo SMTP has been validated for a Wewed staff identity.
- Each staff member should use their own Gmail destination and matching Wewed default sender.
- This system is deliberately separate from Resend application mail.

### 6. Wewed communication hub — NOT COMPLETE; KEEP AS A PRODUCT/OPERATIONS PHASE

Wewed already has in-app wedding messaging and now has reliable external email transport, but those are not yet one unified communication system.

Remaining scope:
- decide which conversations belong in Wewed versus ordinary staff email;
- connect support/marketplace/planner communication records to the correct account, wedding or provider where appropriate;
- preserve external email metadata and delivery state where Wewed initiates a message;
- define staff ownership, assignment, read/unread and escalation behavior;
- prevent duplicate sends when a conversation exists both in app and by email;
- keep private staff correspondence out of shared wedding/provider communication records.

This phase should not block basic production infrastructure hardening, but it must not be marked complete merely because Cloudflare, Resend, Brevo and Gmail transport work.

### 7. Authentication and security callbacks — MOSTLY COMPLETE; FINAL AUDIT REQUIRED

Completed:
- registration confirmation returns through `https://wewed.pro`;
- password sign-in itself does not derive a user-facing redirect from the request host;
- production origin helper exists.

Remaining:
- scan all auth/OAuth/reset/invite callback surfaces for request-derived hosts, `VERCEL_URL`, old domains and preview host leakage;
- review Supabase Auth redirect allow-list and production security settings;
- verify password reset/invite flows with production canaries;
- evaluate the Supabase `Leaked Password Protection Disabled` warning before wider public account activation.

### 8. Stripe subscription billing loop — IN PROGRESS

Implemented:
- account-aware Stripe customers, Checkout, Customer Portal and subscription reconciliation;
- strict test/live environment separation;
- signed raw-body Stripe webhook verification;
- event idempotency/audit logging;
- subscription lifecycle and payment-record updates;
- Checkout success/cancel and Customer Portal returns are pinned to canonical `https://wewed.pro` in merged PR #90.

Remaining:
- verify the PR #90 production deployment after Vercel finishes building;
- replace or retire stale Stripe test webhook destinations that point at ephemeral preview deployments;
- establish the canonical live webhook destination only when live Stripe environment variables and webhook secret are intentionally activated;
- run test-mode subscription UAT end-to-end before any live-money activation;
- verify failed payment, cancellation, refund and portal-return handling.

No live charge, subscription, refund or connected-account action should be created as part of infrastructure hardening without an intentional monetisation release decision.

### 9. Social/OAuth/integration return paths — NOT YET QUALIFIED

Next audit after billing/auth:
- inventory all external OAuth/social/integration providers;
- ensure every callback URL is canonical and environment-scoped;
- remove old `.vercel.app`, `wewed.app`, request-origin and uncontrolled return URLs;
- verify state/nonce/CSRF handling where applicable;
- define disconnect/revocation behavior.

### 10. Failure tracking and operational observability — PARTIAL

Already present:
- application audit logs;
- Resend delivery records/webhook events;
- Stripe event audit processing;
- Vercel runtime/build logs.

Remaining:
- define one operator-facing integration health view or runbook covering email, billing, auth and external callbacks;
- record actionable provider failures rather than only console errors where appropriate;
- define retry/replay procedures for failed webhooks;
- document ownership/escalation for `support@`, `billing@`, `privacy@`, `legal@` and `security@`.

### 11. Production ecosystem UAT — FINAL INFRASTRUCTURE RELEASE GATE

Run one controlled UAT matrix covering:

- apex/`www`/legacy-host navigation;
- registration + confirmation;
- sign-in/sign-out/reset/invite;
- operational inbound email;
- staff inbound + Send-As reply;
- application transactional email + delivery webhook;
- Stripe Checkout success/cancel;
- Stripe Portal return;
- Stripe webhook lifecycle/replay/idempotency;
- external OAuth/integration callback(s);
- mobile and desktop return paths;
- failure/recovery behavior.

A phase is only marked complete when both the provider configuration and Wewed's return/observability path have been verified.

### 12. Return to product expansion — AFTER INFRASTRUCTURE GATES STABILISE

The production ecosystem work is infrastructure, not a permanent freeze on product development. Once the remaining callback/billing/UAT gates are stable, resume the product roadmap, including the pending Wedding Architect Phase C work and planner testing, without reopening already-settled email/DNS architecture unless evidence requires it.

## Immediate execution order

1. Verify merged PR #90 reaches READY in Vercel Production and check runtime errors.
2. Finish the auth/reset/invite callback audit and resolve any canonical-origin leaks.
3. Clean up Stripe webhook destinations and complete test-mode billing UAT without live charges.
4. Audit social/integration callbacks and disconnect paths.
5. Add cross-provider failure/replay operational documentation and diagnostics.
6. Run the full production ecosystem UAT matrix.
7. Resume product releases, beginning with already-prepared work rather than creating new infrastructure side quests.
8. Treat the Communication Hub as a scoped product/operations feature after the transport and callback foundations are stable.

## Non-goals during this roadmap

- no paid infrastructure upgrade merely to satisfy a convenience feature;
- no live payment activation without an explicit release decision;
- no replacement of a working provider solely for architectural neatness;
- no staff mailbox migration to a paid suite unless the forwarding + Gmail Send-As pattern becomes operationally insufficient;
- no unrelated infrastructure diversion while an integration release gate is red.
