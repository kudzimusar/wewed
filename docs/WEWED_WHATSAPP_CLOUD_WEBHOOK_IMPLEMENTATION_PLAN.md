# Wewed WhatsApp Cloud Webhook Implementation Plan

**Date:** 2026-08-10  
**Status:** Authoritative implementation and release gate  
**Base:** `main` at `47aa816382d998c6d91b825676d0a9ba333e86af`

## Goal

Bind the already-implemented Wewed communications channel domain to Meta WhatsApp Cloud API without making Meta the canonical owner of conversation state.

The target flow is:

**Wewed canonical message -> durable WhatsApp delivery -> Meta Cloud API -> signed Meta webhook -> normalized Wewed provider event -> canonical Wewed delivery/message state**

Inbound WhatsApp replies may become canonical Wewed messages only when Wewed can safely and deterministically resolve the reply to an existing Wewed conversation.

## Verified external assets

The integration is being qualified against:

- WABA ID: `1052651633933852`
- Cloud API Phone Number ID: `1262607510266445`
- Graph API version: `v26.0`
- notification template: `wewed_new_message_v1`
- template language: `en_US`

Secrets are deployment-only and must never be committed. The production System User access token and Meta App Secret remain outside the repository.

## Implementation phases

### 1. Harden proactive outbound WhatsApp notifications

Update the WhatsApp transport so the approved notification template receives the sender display name as `{{1}}`, never a private message body. Proactive notification fanout must fail closed when the approved template configuration is absent instead of silently falling back to free-form text.

This preserves the Wewed privacy boundary: the WhatsApp notification says that a new Wewed message exists, while the private message content remains inside Wewed.

### 2. Add the Meta webhook route

Create `/api/webhooks/whatsapp` with two public provider-facing operations:

- `GET` handles Meta verification using `hub.mode`, `hub.verify_token`, and `hub.challenge`.
- `POST` reads the raw request body, validates `X-Hub-Signature-256` with HMAC-SHA256 and the Meta App Secret, and only then parses or processes the payload.

Rejected signatures must not reach communications domain functions.

### 3. Normalize delivery status events

Normalize Meta statuses into the existing provider-neutral Wewed delivery boundary:

- `sent` -> `SENT`
- `delivered` -> `DELIVERED`
- `read` -> `DELIVERED`, while retaining the provider-level `read` marker in sanitized event metadata because the current Wewed delivery enum has no separate READ state
- `failed` -> `FAILED`

Provider event IDs must be deterministic so webhook retries are idempotent. Raw message bodies, access tokens and endpoint addresses must not be logged or copied into analytics metadata.

### 4. Normalize safe inbound contextual replies

For inbound WhatsApp text messages, ingest a canonical Wewed reply only when Meta supplies `context.id` for the outbound WhatsApp message being replied to. That provider message ID is already the safe route into `ingestInboundCommunicationReply`.

If an inbound message has no `context.id`, do not guess which Wewed conversation it belongs to. A user may participate in more than one conversation, so unscoped inbound messages stay fail closed until a later explicit conversation-selection or routing feature exists.

Media and attachment messages remain outside this release because attachment ingestion/scanning is a separately deferred communications phase.

### 5. Deployment configuration and operations

Document the required environment contract:

- `WHATSAPP_CLOUD_ACCESS_TOKEN`
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
- `WHATSAPP_CLOUD_GRAPH_VERSION`
- `WHATSAPP_CLOUD_GRAPH_BASE_URL` (optional override)
- `WEWED_WHATSAPP_NOTIFICATION_TEMPLATE`
- `WEWED_WHATSAPP_TEMPLATE_LANGUAGE`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_WEBHOOK_APP_SECRET`

After the exact code head is qualified and the callback is deployed on a public HTTPS Wewed URL, configure Meta callback verification and only then subscribe the Wewed app to WABA `1052651633933852`.

## Security invariants

- Meta webhook payload processing is signature-gated.
- Verification token and App Secret are server-only deployment secrets.
- Provider webhook handlers never authenticate as end users.
- A provider event cannot choose an arbitrary Wewed user or conversation.
- Unscoped inbound messages do not create or mutate conversations.
- `STAFF_ONLY` notes remain ineligible for external fanout.
- Provider event retries remain idempotent through the existing provider-event ledger.
- External delivery failure never rolls back a canonical Wewed message.
- The legacy public wedding guest-wall `Message` system is untouched.
- No new database migration is required for this integration.

## Qualification matrix

The exact candidate head must prove:

1. WhatsApp template payload uses `senderName`, not private message body.
2. Missing proactive WhatsApp template configuration fails closed.
3. Correct Meta GET verification returns the challenge; wrong verification token is rejected.
4. Valid `X-Hub-Signature-256` is accepted; invalid or missing signature is rejected before payload processing.
5. `sent`, `delivered`, `read`, and `failed` webhook statuses normalize correctly.
6. Duplicate status webhook delivery remains idempotent through deterministic provider event IDs.
7. A contextual inbound text reply routes through the existing verified-endpoint/member-checked canonical inbound boundary.
8. An inbound text without `context.id` is ignored safely rather than guessed.
9. Unsupported inbound media is ignored by this release and does not create canonical text.
10. No raw inbound/outbound message body is logged by the webhook layer.
11. Existing communication authorization, external fanout, rate-limit, Resend, provider security, planner marketplace, budget integrity and legacy guest-wall regressions remain green.
12. Production application build succeeds on the exact candidate head.

## Release order

1. Commit this plan before implementation.
2. Implement outbound hardening and signed webhook normalization.
3. Add focused tests and operations documentation/environment examples.
4. Run focused tests, lint/type/build checks, then the complete existing release matrix on the exact head.
5. Open a PR and merge only after the exact PR head is green.
6. Configure deployment secrets without exposing them in GitHub or chat.
7. Deploy the exact merged tree to `wewed.pro`.
8. Configure Meta webhook callback verification.
9. Subscribe the Wewed app to the WABA.
10. Perform outbound status and inbound contextual-reply round-trip qualification using the Meta test number before attaching a real production WhatsApp number.
