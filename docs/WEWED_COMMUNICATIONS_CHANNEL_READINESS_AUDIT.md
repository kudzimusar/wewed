# Wewed Communications — Channel Readiness Audit

**Date:** 2026-08-09  
**Status:** Authoritative second-pass implementation gate  
**Base:** production communications foundation merged through PR #101 and migration-governance correction PR #102

## Goal

Close the gap between Wewed's canonical in-app messaging core and a production-ready multi-channel communication system without making an external vendor the owner of conversation history.

The target remains:

**Wewed canonical message -> durable delivery queue -> channel transport -> provider status/inbound event -> Wewed canonical state**

A provider API failure must never roll back or delete the Wewed message.

## Second-pass findings

The first communications foundation is sound for authenticated in-app text messaging, but the external channel names in `CommunicationDelivery` were only placeholders. Before this pass:

1. Only `IN_APP` delivery records were created.
2. There was no authenticated-user endpoint registry for email, WhatsApp, SMS or push.
3. There was no endpoint verification state or one-active-endpoint invariant.
4. There were no per-user channel preferences.
5. There was no durable external delivery retry/backoff state.
6. There was no transport abstraction separating Resend/Meta/SMS/push from canonical messaging.
7. There was no provider-status reconciliation boundary for delivered/failed/bounced provider events.
8. There was no normalized inbound-event boundary for a future webhook to call.
9. `Provider.phone` cannot safely fill this gap because a public marketplace Provider record is not a verified authenticated Wewed user identity.
10. The current authenticated `User` record has an email address but no phone or push-subscription field, so WhatsApp/SMS/push addresses must be explicitly owned by the communications domain.

These are implementation gaps, not optional UI enhancements.

## Required internal architecture

### Canonical layer

`CommunicationMessage` remains the source of truth. Sending a message must commit the message, event and delivery intents in one database transaction before any external network request occurs.

### Endpoint registry

Create a private `CommunicationEndpoint` table owned by authenticated `User.id` with:

- channel: EMAIL / WHATSAPP / SMS / PUSH
- normalized address
- state: PENDING / VERIFIED / DISABLED / BOUNCED
- verification timestamp
- non-secret metadata
- one active VERIFIED endpoint per user/channel for this release

No provider profile phone number is promoted to an authenticated communication endpoint automatically.

### Preferences

Create a private `CommunicationPreference` table keyed by user/channel. External fan-out requires both:

- a VERIFIED endpoint; and
- an enabled preference.

`IN_APP` is always available and cannot be disabled by this external-channel preference layer.

### Delivery queue

Extend `CommunicationDelivery` so queued external work is durable and retryable:

- endpointId
- attemptCount / maxAttempts
- lastAttemptAt / nextAttemptAt
- sentAt / deliveredAt / failedAt
- sanitized metadata

Only one delivery per message/recipient/channel is allowed in this phase.

### Transport boundary

Implement a server-only transport registry. A transport receives an already-committed delivery intent and returns a normalized result. It must never own or mutate canonical conversation data directly.

Initial adapters/readiness:

- **IN_APP:** delivered synchronously inside Wewed.
- **EMAIL:** Resend adapter implementation ready behind environment configuration.
- **WHATSAPP:** Meta WhatsApp Cloud transport implementation ready behind environment configuration, with configurable Graph base/version, phone-number ID, access token and optional approved template name.
- **SMS:** provider-neutral transport slot and endpoint/preference/queue semantics ready; no paid provider selected or hard-coded.
- **PUSH:** provider-neutral transport slot and endpoint/preference/queue semantics ready; no push vendor selected or hard-coded.

A missing external transport must produce a deterministic `SKIPPED`/not-configured outcome, not corrupt the message or masquerade as delivered.

### Dispatch boundary

Provide an authenticated internal dispatch endpoint protected by `WEWED_COMMUNICATIONS_DISPATCH_KEY`. It processes durable queued deliveries after the canonical transaction. A future scheduler, MCP action or provider worker can call this endpoint without changing messaging domain code.

### Provider-event boundary

Implement provider-neutral functions that accept normalized status/inbound events and reconcile them to Wewed delivery/message state. Future Resend/Meta webhook routes should only need to:

1. verify provider signature/challenge;
2. normalize provider payload;
3. call the existing domain function.

Raw provider webhook payloads and message bodies must not be copied into analytics.

## Security and privacy requirements

- Communication tables stay in the private `wewed_communications` schema.
- Supabase `anon` and `authenticated` browser roles remain revoked.
- Endpoint APIs only allow a user to manage their own endpoint/preferences unless an explicit trusted server path is used.
- Adding an endpoint does not automatically verify ownership.
- Secrets/tokens live only in server environment variables.
- Logs and analytics must not contain message bodies, access tokens or full endpoint addresses.
- External delivery failure cannot undo a canonical message.
- Provider/vendor inbox access remains fail-closed until provider authentication yields a verified Wewed user identity.

## External work intentionally left after this pass

After this implementation, the remaining work must be external integration rather than missing Wewed domain code:

1. Add/confirm provider credentials in deployment secrets.
2. For WhatsApp, configure the Meta business/WABA/phone-number assets and approved template(s) where required.
3. Select and bind an SMS provider if SMS is desired.
4. Select/bind push credentials or a push service if push is desired.
5. Register Resend/Meta/provider webhook URLs and signature secrets.
6. Optionally bind an MCP/scheduler to the internal delivery-dispatch endpoint.

Those steps must not require redesigning conversations, endpoints, preferences, queues, retries or provider-event reconciliation.

## Regression and release matrix

The exact candidate head must prove:

- clean PostgreSQL migration from an empty database
- private-schema privilege isolation remains intact
- canonical message persists if external transport is unavailable/fails
- IN_APP delivery remains delivered
- verified + enabled endpoints create queued external deliveries
- unverified, disabled or opted-out endpoints do not fan out
- endpoint normalization and duplicate protection work
- Resend request construction is deterministic and does not log secrets/body
- WhatsApp request construction is deterministic and configurable
- retry state increments and reaches terminal failure without duplicate canonical messages
- provider status reconciliation updates only the matching delivery
- signed-session cross-user authorization remains intact
- staff-only notes remain invisible to non-admin participants
- the legacy public wedding guest-wall Message system remains untouched
- application production build succeeds
- existing Wewed release/regression workflows remain green

## Testing definition

Wewed is ready for tester use when:

1. authenticated couple/planner/admin users can create/read/send canonical conversations;
2. unread state and staff-note visibility remain correct;
3. external endpoints/preferences can be registered and inspected through Wewed APIs;
4. external deliveries queue correctly and can be exercised with mocked/test transports without provider credentials;
5. production database schema contains the new private channel-readiness structures with browser privileges revoked; and
6. the exact application tree has passed release qualification.

Actual WhatsApp/SMS/push/email transmission is only considered live when the corresponding external account/API credentials and provider webhook configuration are present and independently verified.