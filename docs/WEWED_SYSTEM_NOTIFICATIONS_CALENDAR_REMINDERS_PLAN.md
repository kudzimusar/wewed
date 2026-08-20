# Wewed System Notifications, Calendar, Reminders & Attention Plan

**Status:** AUTHORITATIVE — active implementation record  
**Branch:** `feature/system-notifications-attention`  
**Initial baseline:** `main` at `713e0a59277cdb8629a1a1d2e662c38ada6c3a26`  
**Current reconciliation:** current `main` `657d4a7f3be9e2148167ec4cfcb2ea401c62b73d` was merged into this feature workstream through PR #171; feature reconciliation head `4ac7a410…`.  
**Rule:** Every change in this workstream must map to this document. A phase is not complete merely because code exists: implementation, exact-head build/test, database rollout and cross-role UAT are recorded separately.

## 1. Correct product scope

This is a **Wewed-wide platform capability**, not a Planner-only feature and not a Contributions feature.

First-class authenticated consumers:

- **Admin** — operational, support, governance, delivery-failure and escalation attention.
- **Planner** — portfolio-wide and wedding-specific tasks, dates, vendors, contracts, budgets, communications and wedding-day operations.
- **Couple** — their own wedding tasks, approvals, payments, guest/RSVP milestones, appointments, contracts, communications and wedding-day actions.
- **Vendor** — only their own authorized engagements, service dates, documents/contracts where party authorization is provable, messages and delivery actions.

Guests, contributors and other external contacts can later receive communications generated from Wewed workflows, but they do not need an authenticated Notification Center in the core release.

## 2. Platform architecture

```text
Canonical Wewed source record / system event
                 |
                 v
        event + date/trigger contract
                 |
       +---------+----------+
       |                    |
       v                    v
Unified Calendar      Reminder Scheduler
       |                    |
       +---------+----------+
                 v
        Notification / Attention
                 |
     +-----------+-----------+
     |           |           |
     v           v           v
Notification   Today      Widgets
 Center          |           |
     +-----------+-----------+
                 |
                 v
 Push / email / WhatsApp routing
 only where policy + consent permit
```

### Non-negotiable boundaries

1. Source modules remain canonical. Calendar/notifications link to tasks, payments, engagements, etc.; they do not create duplicate business records.
2. A source date, a reminder and a notification are separate concepts.
3. Notifications and person-to-person communications are separate systems that can invoke one another.
4. Recipient identity alone is insufficient for wedding data; source/wedding authorization must also pass.
5. Admin, Planner, Couple and Vendor use one engine but different role-safe projections.
6. In-app notification history remains canonical even when push/email/WhatsApp delivery fails.

## 3. Shared product surfaces

### Notification Center

Required capabilities:

- read/unread;
- needs-action/upcoming/updates/resolved filtering;
- severity and source context;
- deep links;
- acknowledge and resolve;
- snooze without changing source due dates;
- unread count/badge;
- audit/delivery lifecycle later.

### Unified Calendar

Calendar is a read projection of meaningful dated Wewed records. Sources currently targeted:

- PlannerTask due dates;
- BudgetItem due dates;
- ServiceEngagement service dates;
- Wedding RSVP deadline;
- ProgrammeItem times combined with wedding date;
- Wedding date;
- Admin's own scheduled operational/system attention;
- contract review-grant expiry where `ContractReviewGrant.expiresAt` and exact `EngagementParty` authorization exist;
- future appointment, contribution and standalone-calendar adapters where a reliable source contract exists.

External calendar synchronization later must not make Google/Apple/Outlook the source of truth for Wewed business records.

### Today / Attention

One role-aware daily command surface:

- **Admin:** operational/system attention assigned to that Admin.
- **Planner:** cross-wedding actions and dates from authorized weddings.
- **Couple:** own wedding actions and dates.
- **Vendor:** own engagement/service attention only.

### Widgets

Web/dashboard widgets consume the exact same Today/Notification/Calendar read model. Native device widgets are deferred until core/PWA adoption warrants native investment.

## 4. Taxonomy

Notification categories:

`task`, `budget`, `payment`, `vendor`, `engagement`, `contract`, `rsvp`, `guest`, `programme`, `wedding`, `message`, `communication`, `contribution`, `admin`, `system`.

Severity:

`info`, `normal`, `important`, `action_required`, `urgent`.

Notification lifecycle:

`scheduled`, `queued`, `active`, `read`, `acknowledged`, `resolved`, `dismissed`, `cancelled`, `expired`, `failed`.

Reminder lifecycle:

`scheduled`, `triggered`, `snoozed`, `cancelled`, `completed`, `failed`.

Delivery channels:

`in_app`, `push`, `email`, `whatsapp`.

## 5. Authorization contract

### Admin

Admin receives global operational/system notifications addressed to that Admin. Wedding/private content is not automatically projected into Admin calendar/notifications merely because the user has an Admin role.

### Planner

Active wedding membership/assignment determines wedding scope. Portfolio aggregation may only combine weddings that remain authorized.

### Couple

Only their own active wedding membership and permitted collaboration data are projected. Planner/Admin internal-only content must never leak through titles, body or metadata.

### Vendor

Vendor access is source-party based, not "same wedding" based. Current calendar projection requires an active `EngagementParty` link to the `ServiceEngagement`.

**Contract authorization decision (2026-08-20):** generic `Contract.issuedAt` and `Contract.closedAt` are lifecycle timestamps, not actionable deadlines, so they must not be invented as reminder dates. The first deterministic Vendor contract path is `ContractReviewGrant.expiresAt`, because a review grant is tied to one `EngagementParty`. A Vendor recipient is valid only when that exact party has a `userId`, the grant is not revoked, and the grant has not already expired at projection time. Business-only parties with no mapped user remain fail-closed.

**Guardrail:** broader financial/contract notification delivery to Vendors remains disabled until each source exposes its own deterministic Vendor-party authorization path. Do not infer Vendor access from the existence of another engagement in the same wedding.

## 6. Existing reminder compatibility

Wewed already has a Planner-only RSVP email reminder flow under `src/app/api/planner/reminders`, stored as `ContentRevision(section='planner_reminder')`, plus the existing Resend delivery path and `/api/cron/reminders` cron.

Rules:

- preserve it unchanged during the shared-engine rollout;
- do not turn `ContentRevision` into the system-wide notification database;
- the new scheduler uses a separate `/api/cron/system-reminders` path and does **not** require Resend;
- migrate/adapt legacy reminders only after regression coverage proves parity;
- later communications routing may reuse existing Resend capability rather than duplicating provider code.

## 7. Implementation phases

### Phase 0 — Baseline and authoritative plan

**Status: COMPLETE**

- [x] Branch from exact current `main` after Contributions merge.
- [x] Commit this plan before feature code.
- [x] Review signed AppSession role model and wedding-access layer.
- [x] Review legacy Planner RSVP reminders and preserve them.
- [x] Reconcile later `main` changes into the feature branch before continuing source-adapter expansion (PR #171).

**Exit:** PASSED.

### Phase 1 — Core notification/reminder foundation

**Status: IMPLEMENTED; EXACT-HEAD TEST + DATABASE UAT PENDING**

- [x] Add additive SQL storage for `Notification`, `Reminder`, `NotificationPreference`, `NotificationDeliveryAttempt`.
- [x] Add safe indexes/FKs/check constraints and per-recipient dedupe keys.
- [x] Add typed TypeScript contracts and Zod validation.
- [x] Add authorization-safe notification service primitives.
- [x] Add idempotent create/read/unread/acknowledge/resolve/snooze primitives.
- [x] Add lifecycle and fail-closed visibility unit tests.
- [ ] Apply migrations to an approved test/preview database and run integration tests.
- [ ] Run exact-head full repository test matrix before declaring the phase closed.

**Storage note:** existing Wewed governed-access code already uses typed raw SQL for authorization-sensitive tables. This foundation follows that pattern rather than blocking on a destructive full Prisma-schema rewrite. Prisma schema parity can be added later if repository schema ownership is standardized; the migrations are the current database contract.

### Phase 2 — In-app API + Notification Center

**Status: IMPLEMENTED; CROSS-ROLE UAT PENDING**

- [x] Authenticated role-aware list API.
- [x] unread count API.
- [x] read/unread.
- [x] acknowledge/resolve.
- [x] snooze/reminder creation.
- [x] shared `/notifications` UI.
- [x] shared bell/unread indicator in authenticated workspace navigation.
- [x] Planner shell bell.
- [ ] Admin/Planner/Couple/Vendor UAT against migrated preview data.

### Phase 3 — Unified Calendar

**Status: CORE IMPLEMENTED; CONTRACT REVIEW-EXPIRY ADAPTER IN PROGRESS; EXPANSION + UAT PENDING**

- [x] Shared calendar projection contract.
- [x] Project canonical records rather than copy them.
- [x] Task due dates.
- [x] Budget/payment due dates.
- [x] Service engagement dates.
- [x] RSVP deadline.
- [x] Wedding date.
- [x] Programme/timeline projection with conservative time parsing.
- [x] Vendor projection restricted to own active EngagementParty records.
- [x] Admin projection restricted to own scheduled admin/system attention.
- [x] category/date/wedding filtering at API layer.
- [x] source deep links.
- [x] month and agenda views.
- [x] Prove first safe contract date/party source: `ContractReviewGrant.expiresAt` + exact `EngagementParty`.
- [ ] Project authorized contract review-grant expiry without treating `issuedAt`/`closedAt` as deadlines.
- [ ] week and day visual views.
- [ ] standalone calendar event model only if a real no-source-record use case is approved.
- [ ] appointment/contribution adapters when source fields are proven.
- [ ] cross-role UAT.

**Invariant:** the source record remains the only editable due/service/deadline date.

### Phase 4 — Reminder scheduler and source adapters

**Status: CORE IMPLEMENTED; CONTRACT REVIEW-EXPIRY ADAPTER IN PROGRESS; LEGACY ADAPTER + UAT PENDING**

- [x] Separate system reminder cron protected by `CRON_SECRET`.
- [x] one-shot snooze wake-up.
- [x] conditional scheduler claim to prevent duplicate processing.
- [x] task due-soon/overdue adapter.
- [x] financial due/overdue adapter for BudgetItem.
- [x] RSVP 7-day adapter.
- [x] ServiceEngagement 24-hour adapter for planning recipients and engagement parties.
- [x] Admin delivery-failure adapter.
- [x] task/payment/engagement source completion auto-resolution.
- [x] dedupe keys on generated notifications.
- [x] Prove `ContractReviewGrant.expiresAt` as the only current deterministic contract-reminder date with exact engagement-party authorization.
- [ ] Add contract review-expiry reminder only for the exact mapped Vendor user; keep generic contract notifications fail-closed.
- [ ] legacy Planner RSVP adapter/migration (legacy flow intentionally remains intact now).
- [ ] enforce user quiet-hour/timezone policy in channel scheduling.
- [ ] write scheduler actions into the broader audit-event layer.
- [ ] integration/UAT proving repeated cron execution does not spam.

### Phase 5 — Today / role-aware attention dashboards

**Status: CORE IMPLEMENTED; UAT PENDING**

- [x] common attention-ranking model.
- [x] Admin Today projection.
- [x] Planner Today projection.
- [x] Couple Today projection.
- [x] Vendor Today projection.
- [x] urgency/action-required ordering.
- [x] source deep links.
- [x] dedupe calendar items when an active notification already represents the same source.
- [ ] cross-role UAT and prioritization tuning.

### Phase 6 — Dashboard widgets

**Status: CORE IMPLEMENTED; EXPANSION PENDING**

- [x] reusable Today widget read model.
- [x] action/today/upcoming counts.
- [x] role-aware spotlight items.
- [x] shared desktop workspace widget dock mounted once at root.
- [x] widget consumes Today API rather than duplicate domain logic.
- [ ] dedicated wedding-countdown widget.
- [ ] user-configurable dashboard widget layout.
- [ ] native iOS/Android widgets deferred to Phase 9.

### Phase 7 — Push, badges and multi-channel delivery

**Status: IN PROGRESS**

- [x] global user notification preference storage/API.
- [x] channel intent flags, timezone, quiet hours and digest preference UI.
- [x] provider-neutral `PushSubscription` storage.
- [x] authenticated per-device subscription API.
- [x] contextual push permission page (no automatic permission prompt on app load).
- [x] service-worker `push` and `notificationclick` handling with safe Wewed deep links.
- [x] installed-app badge synchronization where browser support exists.
- [ ] encrypted Web Push sender/provider integration.
- [ ] create/update `NotificationDeliveryAttempt` records during actual push delivery.
- [ ] channel-router integration with Wewed email/WhatsApp communications.
- [ ] enforce quiet hours/channel preferences during delivery.
- [ ] delivery retry/failure policy.

**Important:** checking `pushEnabled` does not itself prove a device is subscribed; device subscription is tracked separately. Push cannot be considered production-ready until the sender and delivery-attempt path exist.

### Phase 8 — Digests and advanced automation

**Status: NOT STARTED**

- [ ] recurring reminders.
- [ ] `repeat until condition complete`.
- [ ] daily/weekly digest generation and aggregation.
- [ ] RSVP/message burst aggregation.
- [ ] wedding-relative template reminders.
- [ ] deterministic fallback when AI is unavailable.
- [ ] AI may prioritize/draft but must not silently authorize external communication.

### Phase 9 — External calendars + native/live widgets

**Status: DEFERRED UNTIL CORE ADOPTION**

- [ ] Google Calendar synchronization.
- [ ] Apple/Outlook calendar strategy.
- [ ] native iOS/Android widgets if native-app strategy warrants it.
- [ ] Wedding Day live/lock-screen activity concept if platform strategy warrants it.

Wewed remains canonical for wedding business records in all cases.

## 8. Initial role/source matrix

| Source | Admin | Planner | Couple | Vendor |
| --- | --- | --- | --- | --- |
| Task | support only when explicitly authorized | yes | permitted wedding | not enabled until task-party rule exists |
| Budget/payment | operational/support only | yes | permitted wedding | not enabled until vendor-payment source authorization exists |
| Service engagement | support only when explicitly authorized | yes | permitted wedding | own active engagement only |
| Contract | support/governance | party/manager | party | only exact active review grant tied to own `EngagementParty.userId`; broader contract delivery remains fail-closed |
| RSVP/guest deadline | support only when authorized | yes | yes | no |
| Programme/timeline | support only when authorized | yes | yes | no general projection; own engagement dates only |
| Messages/communications | own/support boundary | own threads | own threads | own threads |
| System/admin operations | own assigned operations | relevant account notices later | relevant account notices later | relevant account notices later |
| Contributions | support/governance | later adapter | later adapter | only explicit direct-to-vendor action when source authorization exists |

## 9. Mandatory UAT matrix

Test independently as:

1. Admin
2. Planner
3. Couple
4. Vendor

Negative tests are mandatory:

- Vendor cannot see unrelated or overall wedding budget notification/calendar data.
- Vendor cannot see another Vendor's engagement.
- Vendor cannot see another Vendor's contract review grant or a contract merely because both Vendors participate in the same wedding.
- Business-only contract review parties with no mapped Vendor user do not produce a Vendor notification recipient.
- Couple cannot see Admin operational notifications.
- Planner cannot see another Planner's wedding without active authority.
- Admin does not automatically receive private wedding data merely because role is Admin.
- one recipient marking read/resolved cannot change another recipient's state.
- snooze does not mutate the source due date.
- completion/payment/service closure resolves redundant attention.
- repeated scheduler execution does not create duplicate notifications.
- push/channel failure does not remove the in-app notification.

## 10. Engineering guardrails

- additive migrations only during foundation;
- no production migration until exact-head build/test and approved cross-role UAT staging path;
- preserve legacy RSVP reminder behavior until a tested adapter replaces it;
- no external provider required for core in-app notification/calendar functionality;
- minimum necessary information in notification body/metadata;
- deep-link access is rechecked by the destination source module;
- scheduler/adapters are idempotent;
- timestamps stored as timezone-aware database timestamps; user timezone controls rendering/scheduling policy;
- provider delivery failures are observable rather than silently swallowed once delivery is enabled;
- merge current `main` into this feature workstream whenever material drift would invalidate exact-head/regression assumptions;
- no production merge/deployment merely because a preview build is READY.

## 11. Implementation log

- **2026-08-20 — Baseline:** branch created from `main` `713e0a59277cdb8629a1a1d2e662c38ada6c3a26`; plan committed before feature code.
- **2026-08-20 — Legacy discovery:** existing Planner RSVP/Resend reminder path documented and preserved.
- **2026-08-20 — Foundation:** additive Notification/Reminder/Preference/DeliveryAttempt migrations, contracts, service, API and isolation tests added.
- **2026-08-20 — Notification Center:** shared bell, unread count, role-neutral `/notifications`, read/acknowledge/resolve/snooze added.
- **2026-08-20 — Calendar:** canonical projections plus `/calendar` month/agenda UI added; Vendor and Admin projections hardened separately.
- **2026-08-20 — Scheduler:** independent `/api/cron/system-reminders` plus task/budget/RSVP/engagement/Admin failure adapters added.
- **2026-08-20 — Today/widgets:** shared role-aware Today read model/UI and desktop workspace widget added.
- **2026-08-20 — Push foundation:** preferences, PushSubscription storage/API, contextual enrollment, service-worker push handling and app badging added. Sender/provider delivery remains deliberately incomplete.
- **2026-08-20 — Main reconciliation:** the feature branch had drifted 55 commits behind `main`; PR #171 merged current `main` `657d4a7f3be9e2148167ec4cfcb2ea401c62b73d` into the feature workstream at merge head `4ac7a410…`. This was not a production/main merge.
- **2026-08-20 — Contract source decision:** schema review proved `ContractReviewGrant.expiresAt` + exact `EngagementParty` as a deterministic Vendor contract-review date/party path. `Contract.issuedAt` and `Contract.closedAt` remain lifecycle timestamps and are not treated as reminder deadlines.
- **Validation:** multiple intermediate Vercel previews have reached READY. The exact final head still requires validation after all changes in this workstream are committed.
- **Production:** no database migration, feature-to-main merge or production rollout has been performed by this workstream.

## 12. Workstream definition of done

Core workstream cannot be called done until:

- Admin, Planner, Couple and Vendor have passed positive and negative access UAT;
- database migrations are proven on the approved non-production/test path before production;
- exact branch head passes build/tests;
- Notification Center, Calendar, Today and widget counts/state agree;
- scheduler dedupe and source auto-resolution are proven with real test records;
- legacy RSVP reminder behavior is regression-tested;
- push, if enabled for release, has a real sender + delivery-attempt observability; otherwise it remains explicitly beta/deferred;
- this document records the exact release head, UAT evidence and any deferred Phase 8/9 items before merge.