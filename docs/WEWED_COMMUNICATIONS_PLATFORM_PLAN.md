# Wewed Communications & Collaboration Platform

**Status:** Approved for implementation  
**Date:** 2026-08-09  
**Owner:** Wewed  
**Implementation branch:** `codex/wewed-communications-platform`  
**Supersedes/extends:** `agent-ctx/5-a-social-messaging.md`

## 1. Executive decision

Wewed will build an owned communication core and use external providers only as optional delivery/notification channels.

> **Wewed owns the conversation. External services transport or notify.**

The Wewed database is the canonical system of record for Wewed conversations, participants, messages, read state, context, audit activity and analytics events. Resend, Brevo, WhatsApp, SMS, push, Cloudflare realtime and future providers must not become the canonical owner of a Wewed relationship.

The first release is deliberately **free-first**. It must provide useful in-app communication without introducing a paid chat SaaS, paid realtime dependency, WhatsApp spend or SMS spend. Polling is acceptable for the initial realtime experience. External channels are adapters that can be enabled later without rewriting the communication domain.

## 2. Business goals

The platform must:

1. Keep communication inside the Wewed ecosystem wherever practical.
2. Support two-way collaboration between couples, planners, vendors/providers and Wewed staff.
3. Give Wewed operational visibility into communication health without normalizing unrestricted staff reading of private user content.
4. Attach conversations to business context such as a wedding, provider, task, booking, budget item, support issue or future payment.
5. Create structured analytics for response time, unanswered enquiries, service quality, workload, conversion and operational friction.
6. Reduce dependency on external email inboxes and allow external delivery systems to fail without losing the canonical Wewed conversation.
7. Preserve existing public wedding guest-wall messaging and comments without semantic or schema collision.
8. Remain additive to the existing Wewed ecosystem and safe to roll out behind server-side permissions and UI gates.

## 3. Communication graph

The platform is designed to support these relationships:

- Couple ↔ Couple/partner
- Couple ↔ Planner
- Couple ↔ Provider/vendor
- Couple ↔ Wewed support/admin
- Planner ↔ Couple
- Planner ↔ Provider/vendor
- Planner ↔ Planner
- Planner ↔ Wewed staff/admin
- Provider/vendor ↔ Couple
- Provider/vendor ↔ Planner
- Provider/vendor ↔ Wewed staff/admin
- Wewed staff ↔ Wewed staff
- Admin ↔ Admin
- System/AI → permitted conversation participants
- Multi-party wedding operational rooms where membership is explicit

Not every relationship is enabled automatically. Creation and participation are governed by connection context, wedding membership, platform role and conversation type.

## 4. Important existing-system constraint

Wewed already has a Prisma `Message` model and `/api/messages` route used by the public wedding guest-wall experience. That model is not the new private communications system and must remain unchanged.

The collaboration platform therefore uses the explicit `Communication*` namespace so public wedding messages, comments and private platform conversations cannot be confused in code, migrations, analytics or permissions.

## 5. Product surfaces

### 5.1 Wewed Inbox

Authenticated users receive a `/messages` inbox containing conversations they are allowed to participate in. The inbox provides:

- conversation list
- unread state
- contextual title and participant summary
- latest-message preview
- message thread
- composer
- mark-read behavior
- empty/loading/error states
- manual refresh plus low-cost polling in v1

### 5.2 Contextual entry points

The communication engine is not limited to the Inbox. Future/iterative entry points may include:

- `Message planner`
- `Message couple`
- `Message provider`
- `Discuss task`
- `Open wedding conversation`
- `Contact Wewed`
- `Discuss booking`
- `Discuss quote`

All entry points resolve to the same canonical conversation service.

### 5.3 Staff console

The same engine supports staff conversations but with different permissions. Staff-only notes and internal threads are never exposed to ordinary participants.

## 6. Conversation taxonomy

Initial types:

- `DIRECT` — normal 1:1 user communication
- `GROUP` — explicit multi-party conversation
- `WEDDING` — wedding-scoped collaboration
- `PLANNER_CLIENT` — planner/couple relationship
- `MARKETPLACE` — provider enquiry/relationship
- `SUPPORT` — Wewed support interaction
- `INTERNAL` — Wewed staff-only communication
- `OPERATIONS` — operational coordination
- `BILLING` — billing/payment support context
- `SYSTEM` — platform-generated informational thread where appropriate

A conversation also has a lifecycle such as `OPEN`, `ARCHIVED` or `CLOSED`.

## 7. Canonical data model

The implementation uses additive Prisma models.

### 7.1 `CommunicationConversation`

Canonical thread container. Important fields:

- id
- kind/type
- title
- weddingId when scoped to a wedding
- createdByUserId
- status
- lastMessageAt
- createdAt / updatedAt

### 7.2 `CommunicationParticipant`

Explicit membership and per-user state:

- conversationId
- userId
- participant role (`MEMBER` / `ADMIN`)
- joinedAt
- leftAt
- lastReadAt
- archivedAt/muted state when implemented

Membership is unique per conversation/user.

### 7.3 `CommunicationMessage`

Canonical message content:

- conversationId
- senderUserId, nullable for trusted system messages
- message type (`USER`, `SYSTEM`, `SUGGESTED`, `INTERNAL_NOTE`)
- visibility (`PARTICIPANTS`, `STAFF_ONLY`)
- body
- reply/reference field when required
- createdAt
- edited/deleted metadata when later enabled

Internal notes must be excluded from normal participant reads at the query boundary, not merely hidden in the UI.

### 7.4 `CommunicationEntityLink`

Connects a conversation to Wewed business context without hard-coding every future domain relationship into the conversation table.

Candidate entity types include:

- wedding
- provider profile / vendor
- planner task
- budget item
- booking/enquiry when available
- support case
- invoice/payment when available

### 7.5 `CommunicationDelivery`

Tracks attempts to deliver or notify through channels:

- `IN_APP`
- `EMAIL`
- `WHATSAPP`
- `SMS`
- `PUSH`

Delivery status is distinct from message persistence. Failure to send an email must not delete or roll back the canonical Wewed message.

### 7.6 `CommunicationEvent`

Analytics/audit event stream for structured events such as:

- `conversation_created`
- `participant_added`
- `message_sent`
- `message_read`
- `delivery_queued`
- `delivery_sent`
- `delivery_failed`
- `conversation_closed`
- `conversation_escalated`

**Message bodies are not copied into analytics events.**

## 8. Permission model

Security is server-enforced.

Baseline rules:

1. A user can list/read only conversations in which they have active membership, except specifically authorized staff workflows.
2. A user can send only to a conversation in which they have active membership and which is open for replies.
3. Conversation creation validates all participant IDs and the permitted relationship/context.
4. An ordinary participant cannot add arbitrary users to a protected wedding/internal/support conversation.
5. `INTERNAL_NOTE` and `STAFF_ONLY` content is available only to authorized Wewed staff participants.
6. Staff access to customer conversation content must be purposeful and auditable. Platform analytics should prefer metadata/event data over unrestricted content access.
7. System messages can only be created by trusted server-side code.
8. The public wedding `Message`/comments system remains a separate permission domain.

## 9. Privacy and trust

Wewed should have custody of the communication record while preserving user trust.

Operational analytics may include:

- participant roles
- timestamps
- sent/read/delivery status
- response latency
- conversation type/context
- escalation/resolution state

Private message content is not a general analytics payload. Staff content access should be limited by role/use case and represented in audit records where an intervention path is implemented.

Retention/deletion/export rules must ultimately align with Wewed privacy policies and applicable data-protection obligations. The data model must be able to support retention and user-data export without depending on an external chat provider.

## 10. Free-first channel strategy

### Phase-1 channels

- **In-app:** canonical and primary; zero paid chat dependency.
- **Polling:** initial freshness mechanism; avoids paid realtime infrastructure and extra deployment complexity.
- **Existing email infrastructure:** adapter-ready, enabled only when current credentials/configuration support it safely.

### Deferred until usage justifies it

- WhatsApp bidirectional transport
- SMS
- paid chat SaaS
- paid realtime services
- paid notification orchestration

Cloudflare realtime/Durable Objects can be evaluated later; v1 must not depend on them.

## 11. External channel architecture

External channels follow this flow:

`Wewed message → canonical DB commit → delivery/notification adapter → provider → recipient`

Inbound bridges follow:

`provider webhook/reply → authenticated Wewed webhook → resolve conversation → canonical CommunicationMessage → analytics/delivery state`

No provider webhook may trust a user-supplied conversation ID without signature/authentication and membership/address mapping validation.

## 12. Email bridge

The existing Wewed email stack (Cloudflare/domain routing plus Resend/Brevo where configured) can become a transport layer.

Desired future behavior:

1. New in-app message persists first.
2. If the recipient has email notification enabled, Wewed sends a notification containing a safe link back to the conversation.
3. Later, a reply-address token can route inbound email replies back into the correct conversation.
4. Provider message IDs and failure status are stored in `CommunicationDelivery`.
5. Bounce/delivery failure changes delivery metadata only; it does not remove the Wewed message.

V1 should prefer **email notification + open Wewed** over fully bidirectional email if inbound-domain/webhook configuration would require risky manual production changes.

## 13. WhatsApp/SMS strategy

WhatsApp and SMS are not required for initial launch. They should be adapters, not the core.

First integration should be notification/deep-link oriented so users are brought back into Wewed. Full bidirectional bridging can follow when volume, provider approval and economics justify it.

## 14. AI strategy

AI is an optional intelligence layer over conversations, not a separate message store.

Future capabilities:

- summarize thread
- extract action items
- draft reply
- translate
- classify support topic
- identify urgency
- detect unanswered/high-risk conversations
- suggest task/budget/timeline updates

AI must respect the same conversation permissions as the requesting user. Content sent to an AI provider must follow Wewed privacy/provider-data rules.

## 15. Analytics

The communications layer should make these metrics possible without reading raw message bodies for routine reporting:

- first-response time
- median response time
- unread/unanswered conversation count
- response rate
- messages per relationship/context
- enquiry → response → later booking conversion when booking data is linked
- support resolution time
- escalation volume
- delivery failure rate
- planner workload indicators
- provider responsiveness indicators
- wedding-stage communication patterns

Analytics should be based primarily on `CommunicationEvent`, participant/context metadata and timestamps.

## 16. Rollout phases

### Phase A — Foundation (this implementation)

- authoritative plan
- additive communication schema + migration
- permission/service layer
- conversation APIs
- message APIs
- read state/unread counts
- event instrumentation
- `/messages` inbox/thread UI
- tests
- no paid provider dependency

### Phase B — Contextual collaboration

- conversation creation from planner/couple workflows
- provider/marketplace context after provider authentication is verified
- task/wedding context linking
- group/wedding-room creation controls

### Phase C — Staff operations

- support/internal conversation views
- internal notes
- assignments/escalation
- audited staff intervention

### Phase D — Delivery adapters

- email notifications via existing configured channel
- inbound email reply bridge when safe/configured
- push
- WhatsApp/SMS when commercially justified

### Phase E — Intelligence

- communications dashboard/analytics
- AI summaries/routing/action extraction
- quality/service signals

## 17. Current authentication constraint

The current application session contract exposes `admin`, `couple` and `planner` dashboard roles. Provider/vendor communication must not be faked by treating an unauthenticated public provider profile as a user.

The communication core is therefore provider-ready, but provider-facing message access is enabled only once the existing provider-account/authentication path can yield a cryptographically verified Wewed user identity. Until then, marketplace provider context can be represented without granting a public provider record inbox access.

This is a security boundary, not a feature omission.

## 18. API design for Phase A

Initial authenticated endpoints:

- `GET /api/communications/conversations`
- `POST /api/communications/conversations`
- `GET /api/communications/conversations/:id/messages`
- `POST /api/communications/conversations/:id/messages`
- `POST /api/communications/conversations/:id/read`
- `GET /api/communications/unread`

All responses are private/no-store. All mutation payloads are validated and capped. Conversation/message IDs are opaque CUIDs.

## 19. Abuse/safety controls for Phase A

- authenticated session required
- membership authorization on every read/write
- server-side message length cap
- participant count cap
- duplicate direct-conversation reuse where appropriate
- system/internal-note creation restricted
- no HTML rendering from message body
- no analytics copy of message body
- mutation audit/event records
- rate limiting can reuse existing Wewed request-limit patterns where available; otherwise endpoint-level guards are added before external-channel fanout is enabled

Later controls:

- block/mute/report
- attachment scanning
- content moderation
- spam heuristics
- account trust/risk signals

## 20. Attachments

Attachments are intentionally not required for the first safe release unless the repository already has an approved authenticated upload/storage path that can be reused without weakening access control.

The schema/API should remain attachment-ready. A message attachment must inherit conversation authorization and must never become public merely because the existing wedding media system supports public assets.

## 21. Cost guardrails

The initial release must keep incremental infrastructure cost effectively at $0 under current project/free-tier usage.

Rules:

1. No paid chat SDK/service is required.
2. No WhatsApp/SMS traffic is enabled by default.
3. No mandatory paid realtime system.
4. External email notification must be optional and quota-aware.
5. The canonical system continues functioning if every external adapter is disabled.
6. A future paid provider must be replaceable without migrating canonical conversation ownership out of Wewed.

## 22. Migration and compatibility

The database change is additive.

- Do not rename/remove the existing public `Message` model.
- Do not change public wedding message semantics.
- Do not require destructive backfills.
- Add indexes for participant inbox lookup, message pagination, unread/last-message calculations and analytics event scans.
- Production migration must be deployable through the existing Prisma migration process.

## 23. Test/release matrix

Before merge, the exact branch head must prove:

### Schema
- Prisma validation/generation succeeds.
- Migration is additive and deterministic.

### Authorization
- unauthenticated list/read/send is rejected
- non-member cannot read thread
- non-member cannot send
- member can read/send
- staff-only content is not returned to ordinary participant
- system-message creation cannot be forged by normal client payload

### Behavior
- create direct conversation
- duplicate direct conversation does not create unnecessary duplicate where reuse applies
- list inbox
- send message
- mark read
- unread count changes correctly
- conversation last-message metadata updates
- analytics event created without body leakage

### Regression
- public `/api/messages` guest-wall route remains intact
- planner/couple/admin authentication remains intact
- build/lint/unit tests pass
- existing release-critical test suites remain green

### UI
- `/messages` loads only for authenticated dashboard user
- empty/loading/error states work
- selected thread loads
- send appends/persists
- unread clears when thread is read
- responsive baseline works

## 24. Deployment gates

1. Document plan first.
2. Implement only on isolated branch.
3. Keep branch current with `main` before final qualification.
4. Run repository CI/test matrix on exact head.
5. Review migration and changed-file diff.
6. Merge only if exact head is green.
7. Apply production migration through the existing deployment path.
8. Verify authenticated `/messages` behavior plus public wedding-message regression in production.
9. Do not enable external paid channels merely because the core ships.

## 25. Definition of done for this session

The session is complete when, without unnecessary manual user work:

- this plan is committed before implementation
- owned communication core exists in schema/database migration
- authenticated conversation/message/read APIs exist
- permissions are server-enforced
- `/messages` is usable for currently authenticated Wewed roles
- analytics events are recorded without raw-message analytics leakage
- existing public wedding `Message` behavior remains separate
- automated tests/build checks for the exact head pass
- PR is merged/deployed only if release gates permit it
- any genuinely external manual prerequisite (for example third-party account approval/domain verification unavailable to automation) is documented separately rather than blocking the free in-app core

## 26. Architectural invariant

If there is ever ambiguity about where a communication feature belongs, use this rule:

> **Persist and authorize the relationship in Wewed first. Deliver it elsewhere second.**

That invariant protects Wewed's data ownership, analytics capability, user continuity, provider independence and long-term collaboration model.