# Wewed WhatsApp Productization and Expansion Plan

## Purpose

Wewed uses WhatsApp as an accessibility and convenience channel while keeping Wewed as the canonical conversation record. This is especially important for Zimbabwe and wider African markets where WhatsApp is often the lowest-friction communication channel for couples, planners, providers and marketplace enquiries.

This document records the qualified production behavior, the current role coverage, the controlled Couple qualification plan, and the work required to extend communications to providers, guests and marketplace enquiry analytics.

## Production behavior already qualified

The following behavior is live for supported Wewed users (admin, planner and couple) once the receiving user has a verified WhatsApp endpoint and WhatsApp delivery enabled:

1. Wewed always stores the canonical message and in-app delivery.
2. If the recipient has an active WhatsApp customer-service window for the same Wewed conversation, Wewed sends the actual canonical message text through Meta Cloud API.
3. If no active service window exists, Wewed sends the approved `wewed_new_message_v1` utility notification template without exposing the private message body.
4. A quoted WhatsApp reply can establish exact correlation to a Wewed conversation.
5. Once a safe active conversation is established, a normal non-quoted WhatsApp text can be accepted when exactly one eligible Wewed conversation can be resolved.
6. If correlation is ambiguous, Wewed fails closed rather than guessing.
7. External delivery status is reconciled back into Wewed through Meta webhook events (sent, delivered, read/failure).
8. The automatic communications dispatcher runs through Supabase cron and does not require a manual queue trigger.

## Current role coverage

| Role | Wewed -> WhatsApp | WhatsApp -> Wewed | Current status |
| --- | --- | --- | --- |
| Admin | Yes | Yes | Qualified core path |
| Planner | Yes | Yes | Qualified core path |
| Couple | Supported by the same communications foundation; production qualification pending | Supported by the same communications foundation; production qualification pending | Test next |
| Provider | No user-safe identity binding yet | No user-safe identity binding yet | Deliberately excluded until provider identity is hardened |
| Guest | Not implemented in this communications system | Not implemented | Future scoped capability |

## Couple production qualification

Goal: prove that a real Couple account can use the same experience already qualified for planner/admin without privileged operator behavior in the conversation itself.

Test sequence:

1. Use an active Couple account attached to a real Wewed wedding.
2. Use a WhatsApp number that is different from every other Wewed test user's verified WhatsApp endpoint.
3. Add the Couple's test WhatsApp number to Meta's allowed test recipients while the Wewed Meta test sender is still in use.
4. Couple signs in to Wewed and opens `Messages -> Channels`.
5. Couple saves their WhatsApp number as an endpoint.
6. Verify ownership through the controlled endpoint-verification process and enable WhatsApp delivery.
7. Admin or planner sends the Couple a Wewed message while no service window exists. Expect the approved Wewed notification template.
8. Couple replies to that WhatsApp notification to establish the safe Wewed conversation binding.
9. Send a normal, non-quoted WhatsApp message. Expect it in the same Wewed conversation once only.
10. Admin/planner sends a fresh Wewed message inside the active window. Expect the exact message text on the Couple's WhatsApp.
11. Verify SENT -> DELIVERED -> READ where Meta supplies those statuses, one provider attempt, no duplicate canonical message, and no private message body in logs/provider metadata.

Pass condition: Couple can move naturally between Wewed and WhatsApp with the same safety rules already qualified for the planner path.

## Self-service onboarding gap

The current Channels page allows a user to save a WhatsApp endpoint and enable the channel, but endpoint ownership verification is still an operator/internal step. Before broad user launch, Wewed should provide a self-service verification journey:

- add WhatsApp number;
- consent/opt-in acknowledgement;
- send verification challenge or use provider-supported verification flow;
- verify ownership;
- enable/disable delivery;
- show status such as Pending, Verified, Disabled, Bounced/Unavailable;
- allow number replacement without creating duplicate verified endpoints;
- retain audit history without exposing phone numbers in logs.

### Endpoint identity collision rule

Production currently enforces only one verified endpoint per user/channel, not global uniqueness of a WhatsApp number across different Wewed users. Until that is hardened, controlled tests must not reuse the same WhatsApp number for Planner, Couple, Admin or future Provider identities.

Before broad launch Wewed should enforce an explicit ownership rule for verified WhatsApp addresses. Default recommendation: one verified WhatsApp address maps to one active Wewed user identity unless a deliberate shared-business-number model is introduced for provider organisations. Verification should fail closed on cross-user collisions rather than allowing inbound identity ambiguity.

## Provider communications expansion

Provider communications are intentionally excluded today because provider authentication does not yet guarantee the same verified Wewed user identity used by the communications participant model.

Required sequence:

1. Establish one authoritative provider identity -> Wewed user mapping for claimed provider accounts.
2. Bind provider staff/users to a provider organisation with explicit roles and permissions.
3. Reuse the private communications participant model only after the provider user's Wewed identity is verified.
4. Add provider WhatsApp/email endpoints at user or business-channel level with clear ownership rules.
5. Define who can read provider conversations: provider staff, assigned planner/couple and explicitly authorised Wewed staff only.
6. Keep staff-only notes and moderation/audit data separate from participant-visible messages.
7. Qualify outbound notification-template, active-window text, normal inbound reply, ambiguity handling, opt-out and account deactivation.

Providers should not be enabled by weakening the existing fail-closed provider boundary.

## Guest communications expansion

Guest messaging should be narrower than full planner/couple communications. Recommended initial scope:

- wedding-specific guest support and operational updates;
- RSVP reminders and confirmations;
- logistics such as venue, transport, accommodation, timing and emergency changes;
- no automatic access to internal planner/couple/provider conversations;
- explicit guest identity/phone ownership and wedding association;
- configurable consent and opt-out;
- strong bulk-send/rate-limit controls.

Guest WhatsApp should begin as wedding-scoped notification/reply flows, not a general Wewed inbox role.

## Marketplace WhatsApp enquiries

Marketplace listings should be able to expose a Wewed-managed WhatsApp enquiry action because it is familiar and accessible to users in Zimbabwe and across Africa. The preferred design is not a raw untracked `wa.me` link as the only path.

Recommended flow:

`Marketplace listing -> Wewed enquiry intent -> analytics/event record -> WhatsApp or Wewed conversation -> provider/planner/admin follow-up`

For every WhatsApp enquiry CTA Wewed should capture, where lawful and consented:

- listing/provider ID;
- wedding/user context when signed in;
- source page and placement;
- campaign/referral attribution;
- timestamp;
- selected channel (WhatsApp/email/in-app/etc.);
- enquiry/conversation ID when created;
- whether the user opened WhatsApp;
- whether a provider response was received through a Wewed-controlled channel;
- downstream marketplace outcomes such as qualified lead, quote, booking or no response.

Do not treat an external-link click as proof that a message was actually sent. Separate `cta_clicked`, `conversation_created`, `message_sent`, `provider_replied` and conversion events.

Where a provider supplies a public WhatsApp number before claiming their profile, Wewed may display or route an enquiry CTA, but analytics and privacy controls must distinguish public directory contact from a verified Wewed provider endpoint.

## Channel architecture and analytics parity

Wewed should treat Email, WhatsApp, SMS and Push as delivery channels over one canonical communications model rather than four separate messaging products.

Common lifecycle to preserve:

`canonical Wewed message -> recipient/channel preference -> verified endpoint -> queued delivery -> provider -> status webhook -> Wewed delivery state`

Common analytics fields should include:

- canonical message/conversation ID;
- recipient user/role where authorised;
- provider/listing/wedding/entity links;
- channel;
- delivery provider;
- queued/sent/delivered/read/failed timestamps;
- attempt count and sanitised error code;
- campaign/source/placement where relevant;
- opt-in/endpoint state;
- no raw secret, access token, webhook body or private phone number in logs.

Email currently uses the existing transactional sender while WhatsApp uses Meta Cloud API. Both should eventually report into one communications analytics view so Wewed can compare channel usage, delivery, engagement and marketplace conversion without duplicating canonical conversations.

## Productisation priorities

### Phase 1 - Couple qualification and self-service readiness

- qualify Couple path end-to-end;
- build user-facing WhatsApp endpoint verification;
- enforce verified WhatsApp ownership/collision rules;
- improve Channels status/help copy;
- add safe service-window/conversation status where useful;
- retain approved-template fallback and fail-closed ambiguity handling.

### Phase 2 - Admin and multi-user regression

- second Admin receive/reply test;
- planner <-> couple qualification;
- admin <-> couple qualification;
- multiple active conversations for one WhatsApp user;
- explicit handling when non-quoted inbound is ambiguous;
- opt-out, disabled endpoint and inactive-user regression tests.

### Phase 3 - Provider identity and provider inbox

- authoritative provider user identity;
- provider organisation membership/permissions;
- provider communications participant support;
- verified provider WhatsApp/email channels;
- provider/couple/planner marketplace enquiry conversations;
- support/admin escalation rules.

### Phase 4 - Marketplace enquiry layer

- Wewed-managed WhatsApp enquiry CTA on provider listings;
- channel/source attribution;
- enquiry intent and lead lifecycle events;
- provider response and conversion metrics;
- follow-up reminders for unanswered enquiries;
- email/WhatsApp/in-app channel comparison dashboard.

### Phase 5 - Guest operational messaging

- guest identity and phone verification;
- wedding-scoped guest communications;
- RSVP/logistics/reminder templates;
- bulk/rate limits and consent controls;
- guest reply routing to an authorised wedding operational conversation.

## Production launch dependencies

Before broad public WhatsApp rollout:

- replace/graduate from Meta's test sender to a Wewed production WhatsApp number;
- complete required Meta business/onboarding/billing steps for production scale;
- retain approved utility templates for business-initiated messages outside the service window;
- maintain channel consent/opt-in records;
- monitoring and alerting for queue backlog, webhook failures, provider rejection and delivery failure;
- document support/opt-out process;
- ensure marketplace/public WhatsApp use complies with Wewed privacy, consent and analytics policies.

## Product principle

WhatsApp should make Wewed easier to reach, not move the business record outside Wewed. Conversation history, identity, permissions, enquiry attribution, delivery state and analytics should remain under Wewed control wherever technically and legally possible.