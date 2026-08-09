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
6. There was no communications transport abstraction separating external delivery from canonical messaging.
7. There was no communications-level provider-status reconciliation boundary for delivered/failed/bounced provider events.
8. There was no normalized inbound-event boundary for a future webhook to call.
9. `Provider.phone` cannot safely fill this gap because a public marketplace Provider record is not a verified authenticated Wewed user identity.
10. The current authenticated `User` record has an email address but no phone or push-subscription field, so WhatsApp/SMS/push addresses must be explicitly owned by the communications domain.

The second audit also rediscovered an existing production email subsystem that must be reused rather than duplicated:

- `src/lib/email/resend.ts` owns Wewed transactional email sending, idempotency and `wewed_admin.EmailDelivery` audit records.
- `src/lib/email/resend-webhook.ts` verifies Resend/Svix signatures and reconciles lifecycle events.
- `/api/webhooks/resend` is already the registered Wewed Resend webhook endpoint.
- The connected Resend webhook currently receives outbound lifecycle events including sent, delivered, delayed, complained, bounced, failed and suppressed.

Therefore communications email is an integration with that subsystem, not a second Resend stack.

## Implemented internal architecture

### Canonical layer

`CommunicationMessage` remains the source of truth. Sending a message commits the message, event and delivery intents before any external network request occurs.

### Endpoint registry

The private `CommunicationEndpoint` table is owned by authenticated `User.id` and carries:

- channel: EMAIL / WHATSAPP / SMS / PUSH
- normalized address
- state: PENDING / VERIFIED / DISABLED / BOUNCED
- verification timestamp
- non-secret metadata
- one active VERIFIED endpoint per user/channel for this release

No provider profile phone number is promoted to an authenticated communication endpoint automatically.

### Preferences

The private `CommunicationPreference` table is keyed by user/channel. External fan-out requires both:

- a VERIFIED endpoint; and
- an enabled preference.

`IN_APP` is always available and cannot be disabled by this external-channel preference layer. Disabling a preference or endpoint also prevents still-queued work from being dispatched.

### Delivery queue

`CommunicationDelivery` now provides durable retryable external work with:

- endpointId
- attemptCount / maxAttempts
- lastAttemptAt / nextAttemptAt
- sentAt / deliveredAt / failedAt
- PROCESSING state
- sanitized metadata

Only one delivery per message/recipient/channel is allowed in this phase.

### Transport boundary

The server-only channel registry receives an already-committed delivery intent and returns a normalized result. It never owns canonical conversation data.

Adapters/readiness:

- **IN_APP:** delivered synchronously inside Wewed.
- **EMAIL:** reuses `sendTransactionalEmail`, including the existing Wewed EmailDelivery audit and Resend idempotency key. Communications email adds a `communication_delivery_id` provider tag so the existing signed Resend webhook can reconcile the private communication delivery.
- **WHATSAPP:** Meta WhatsApp Cloud transport is implemented behind environment configuration, with configurable Graph base/version, phone-number ID, access token and optional approved template name.
- **SMS:** provider-neutral HTTP gateway transport plus endpoint/preference/queue/retry semantics are implemented; no paid provider is selected or hard-coded.
- **PUSH:** provider-neutral HTTP gateway transport plus endpoint/preference/queue/retry semantics are implemented; no push vendor is selected or hard-coded.

A missing external transport produces a deterministic `SKIPPED`/not-configured outcome, not a false delivery and not a failed canonical message.

### Dispatch boundary

A protected internal dispatch endpoint uses `WEWED_COMMUNICATIONS_DISPATCH_KEY`. It processes durable queued deliveries after the canonical transaction. A scheduler, MCP action or trusted worker can call this endpoint later without changing messaging domain code.

### Provider-event boundary

Provider-neutral domain functions accept normalized status/inbound events and reconcile them to Wewed delivery/message state.

For Resend, the existing signed webhook now also maps communications-tagged sent/delivered/failure events into `CommunicationDelivery`. Delivered state is monotonic so a late lower-priority event cannot downgrade a confirmed delivery.

For Meta WhatsApp, SMS and push, future webhook routes only need to:

1. verify provider signature/challenge;
2. normalize the provider payload;
3. call the existing provider-status or inbound-reply domain function.

Inbound reply ingestion resolves the sender through a VERIFIED Wewed endpoint, requires active conversation membership, and calls the same canonical message send path. Provider-event metadata stores a body hash rather than copying the raw reply body into analytics/event metadata.

### Tester settings surface

`/messages/settings` allows an authenticated user to:

- register email, WhatsApp, SMS or push endpoints;
- see pending/verified/disabled state;
- enable or disable each external channel;
- disable an endpoint.

Registration never self-verifies ownership. Verification is exposed only through the protected internal verification boundary so the eventual provider verification flow can call it safely.

## Security and privacy requirements

- Communication tables stay in the private `wewed_communications` schema.
- Supabase `anon` and `authenticated` browser roles remain revoked.
- Endpoint APIs only allow a user to manage their own endpoint/preferences unless an explicit trusted server path is used.
- Adding an endpoint does not automatically verify ownership.
- Secrets/tokens live only in server environment variables.
- Channel transport code does not log message bodies, endpoint addresses or provider tokens.
- Analytics does not copy raw message bodies.
- External delivery failure cannot undo a canonical message.
- `STAFF_ONLY` notes cannot fan out externally to non-admin participants.
- Provider/vendor inbox access remains fail-closed until provider authentication yields a verified Wewed user identity.

## External work intentionally left after this pass

After this implementation, the remaining work is provider/account integration rather than missing Wewed domain architecture:

1. Add/confirm provider credentials in deployment secrets.
2. For WhatsApp, configure the Meta business/WABA/phone-number assets and approved template(s) where required.
3. Register the Meta webhook and map its verified status/inbound payloads into the existing Wewed provider-event functions.
4. Select and bind an SMS provider to the generic gateway if SMS is desired.
5. Select/bind push credentials or a push service to the generic gateway if push is desired.
6. Enable Resend inbound `email.received` only when the Receiving API fetch/normalization adapter is bound to `ingestInboundCommunicationReply`; outbound Resend lifecycle webhook handling is already connected.
7. Optionally bind an MCP/scheduler to the internal delivery-dispatch endpoint.

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
- communications email content is deterministic and uses the existing transactional email subsystem
- WhatsApp request construction is deterministic and configurable
- retry state increments and reaches terminal failure without duplicate canonical messages
- provider status reconciliation updates only the matching delivery and does not downgrade delivered state
- signed-session cross-user authorization remains intact
- staff-only notes remain invisible to non-admin participants and are not externally fanned out
- the legacy public wedding guest-wall Message system remains untouched
- changes to the shared Resend sender/webhook are inside the Communications CI trigger surface
- application production build succeeds
- existing Wewed release/regression workflows remain green

## Testing definition

Wewed is ready for tester use when:

1. authenticated couple/planner/admin users can create/read/send canonical conversations;
2. unread state and staff-note visibility remain correct;
3. external endpoints/preferences can be registered and inspected through the Wewed UI/API;
4. external deliveries queue correctly and can be exercised with mocked/test transports without provider credentials;
5. production database schema contains the new private channel-readiness structures with browser privileges revoked; and
6. the exact application tree has passed release qualification.

Actual WhatsApp/SMS/push transmission is only considered live when the corresponding external account/API credentials are present and independently verified. Outbound email uses Wewed's existing Resend sender when its production credentials are configured; inbound email replies require the remaining Resend Receiving API/webhook adapter.