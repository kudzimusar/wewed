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

### 3. Human inbound email — COMPLETE FOR OPERATIONS; STAFF SEPARATION IS AN OPERATIONS ROLLOUT

- Cloudflare Email Routing is enabled.
- Root-domain operational aliases are routed explicitly.
- Catch-all is set to `Drop`.
- Inbound canary to `support@wewed.pro` succeeded.
- Staff aliases exist; each becomes private when routed to that staff member's own verified Gmail destination.

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

### 6. Wewed communication hub — NOT COMPLETE; PRODUCT/OPERATIONS PHASE

Wewed already has in-app wedding messaging and reliable external email transport, but those are not yet one unified communication system.

Remaining product scope:
- decide which conversations belong in Wewed versus ordinary staff email;
- connect support/marketplace/planner communication records to the correct account, wedding or provider where appropriate;
- preserve external email metadata and delivery state where Wewed initiates a message;
- define staff ownership, assignment, read/unread and escalation behavior;
- prevent duplicate sends when a conversation exists both in app and by email;
- keep private staff correspondence out of shared wedding/provider communication records.

This phase does not block infrastructure hardening.

### 7. Authentication and security callbacks — CODE HARDENING COMPLETE; PROVIDER UAT REMAINS

Completed in application code:
- registration confirmation returns through `https://wewed.pro`;
- password sign-in/sign-out do not derive an external return URL from the request host;
- password recovery now uses `publicUrl('/reset-password')` instead of `window.location.origin`;
- the reset page strips recovery tokens from the visible URL, requires a valid recovery session, enforces the Wewed password floor and globally signs out prior sessions after update;
- administrator invitation acceptance requires a valid Supabase bearer session and does not trust a browser-supplied callback hostname;
- guarded callback surfaces are covered by permanent Production Integration Hardening CI.

Provider-side/manual verification still required:
- Supabase Auth production Site URL and redirect allow-list must contain the canonical `wewed.pro` recovery/confirmation destinations and must not depend on Preview hosts;
- run a real password-recovery email/link canary after provider settings are confirmed.

The Supabase leaked-password-protection advisory is accepted as a free-tier limitation for now; Wewed retains its 12-character password floor rather than upgrading infrastructure solely to clear that advisory.

### 8. Stripe subscription billing loop — CODE COMPLETE; TEST WEBHOOK ENV/UAT GATE REMAINS

Implemented:
- account-aware Stripe customers, Checkout, Customer Portal and subscription reconciliation;
- strict test/live environment separation;
- signed raw-body Stripe webhook verification;
- event idempotency/audit logging;
- subscription lifecycle and payment-record handling;
- Checkout success/cancel and Customer Portal returns are pinned to canonical `https://wewed.pro` in merged PR #90;
- PR #90 is READY in Vercel Production with no post-deploy runtime errors;
- the stale test webhook destination was moved in place to the stable production-integration-hardening Preview branch while preserving its test-only event set and signing-secret identity;
- an existing disposable billing-QA account proves prior `checkout.session.completed` and `customer.subscription.updated` processing in Wewed's test metadata namespace;
- a test refund was issued against the disposable test PaymentIntent to exercise `charge.refunded` delivery without real money.

Current red gate:
- the new stable Preview environment does not currently contain `STRIPE_TEST_WEBHOOK_SECRET`; Wewed therefore correctly rejects incoming Stripe test events instead of accepting unverifiable payloads;
- add the existing test endpoint signing secret to Vercel Preview, then replay/retry the failed test event and finish lifecycle verification.

Still required after that one environment fix:
- verify subscription update/cancellation and refund events are processed on the stable Preview target;
- exercise/verify payment-failure handling in test mode;
- run authenticated Checkout success/cancel and Customer Portal return UAT;
- establish a live production webhook only when live billing activation is intentionally approved.

No live charge, subscription, refund or connected-account action is part of infrastructure hardening.

### 9. External OAuth/social/integration return paths — CURRENT INVENTORY QUALIFIED

Current repository inventory contains no active social-login/OAuth callback flow requiring a provider redirect cutover.

The external callback surface beyond Resend and Stripe is the optional Telegram bot webhook. It is now hardened so that:
- all user-facing Wewed links use the canonical public-origin helper;
- POST requires Telegram's webhook secret header;
- the route fails closed unless both bot token and webhook secret are configured;
- Production currently reports the Telegram bot as unconfigured, so there is no live Telegram migration to perform.

Future OAuth/social providers must pass the same canonical-return, state/nonce/CSRF and disconnect/revocation review before activation.

### 10. Failure tracking and operational observability — IMPLEMENTED FOUNDATION

Already present:
- application audit logs;
- Resend delivery records/webhook events;
- Stripe event audit processing;
- Vercel runtime/build logs;
- public platform `/api/health` readiness diagnostics.

Added by production-integration hardening:
- authenticated `GET /api/admin/integrations/health` for non-secret Resend, Stripe, Telegram and Auth readiness/recent-event diagnostics;
- `docs/INTEGRATION_OPERATIONS.md` with canonical callback inventory, failure triage, replay/idempotency procedure and operational mailbox ownership;
- dedicated Production Integration Hardening CI for canonical callbacks and webhook-security contracts.

### 11. Production ecosystem UAT — FINAL INFRASTRUCTURE RELEASE GATE

Automated/verified evidence already covers:
- apex/`www`/legacy-host navigation;
- production canonical metadata and public routes;
- operational inbound email;
- staff Send-As pattern;
- application transactional outbound canary;
- canonical registration and billing return URLs;
- Stripe signature/environment/idempotency source contracts;
- optional Telegram fail-closed behavior;
- production and Preview deployment/runtime logs.

Final manual/provider-assisted UAT is intentionally small:
- confirm Supabase Site URL / redirect allow-list and click one real recovery email;
- add `STRIPE_TEST_WEBHOOK_SECRET` to Vercel Preview and verify the queued/replayed test lifecycle event reaches Wewed;
- authenticated Stripe Checkout success/cancel and Customer Portal return using the disposable billing QA account;
- route Tony/Charity staff aliases to their individual Gmail destinations when those addresses are available.

A provider configuration is complete only when its Wewed return and observability path are also verified.

### 12. Return to product expansion — AFTER FINAL PROVIDER UAT

Once the small provider-side UAT list above is green, infrastructure hardening is closed. Resume product releases, including the pending Wedding Architect Phase C and planner testing, without reopening settled DNS/email architecture unless new evidence requires it.

## Immediate execution order

1. Qualify and merge the production-integration-hardening PR.
2. Complete the two provider-side manual controls: Supabase redirect settings and Vercel Preview Stripe signing secret.
3. Replay/verify Stripe test lifecycle and run authenticated Checkout/Portal canaries.
4. Run the compact final ecosystem UAT matrix and close infrastructure hardening.
5. Resume product work.

## Non-goals during this roadmap

- no paid infrastructure upgrade merely to satisfy a convenience feature;
- no live payment activation without an explicit release decision;
- no replacement of a working provider solely for architectural neatness;
- no staff mailbox migration to a paid suite unless the forwarding + Gmail Send-As pattern becomes operationally insufficient;
- no unrelated infrastructure diversion while an integration release gate is red.
