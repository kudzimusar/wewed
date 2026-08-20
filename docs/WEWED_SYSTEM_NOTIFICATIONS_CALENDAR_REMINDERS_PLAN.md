# Wewed System Notifications, Calendar, Reminders & Attention Plan

**Status:** Authoritative implementation plan  
**Branch:** `feature/system-notifications-attention`  
**Baseline:** `main` at `713e0a59277cdb8629a1a1d2e662c38ada6c3a26`  
**Rule:** Every implementation change in this workstream must map back to a phase and acceptance criterion in this document. Update this document as phases are completed or scope is deliberately deferred.

## 1. Product correction and scope

This is a **system-wide Wewed platform capability**, not a Planner-only feature and not a Contributions feature.

The first-class audiences are:

- **Admin** — Wewed operational, support, governance, approval, delivery-failure and escalation attention.
- **Planner** — portfolio-wide and wedding-specific tasks, meetings, deadlines, vendors, contracts, budgets, communications and wedding-day operations.
- **Couple** — their wedding tasks, approvals, payments, contracts, RSVP/guest milestones, appointments, communications and wedding-day actions.
- **Vendor** — assigned engagements, appointments, service dates, documents, contracts, payment milestones, messages, approvals and wedding-day delivery actions.

Other actors such as contributors, guests, invitees and external contacts may receive communications generated from Wewed workflows, but they are not required to have an authenticated Notification Center in the first system release.

## 2. Core product model

Wewed should use one shared attention architecture:

```text
Domain record / system event
        |
        v
Wewed event + date/trigger contract
        |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
Unified Calendar      Reminder Scheduler   Notification Rules
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                    Attention / Notification
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
 Notification Center      Today              Widgets
        |                                       |
        +-------------------+-------------------+
                            |
                            v
                 Push / email / WhatsApp routing
                     when policy requires it
```

### Product boundaries

1. **Source modules remain canonical.** A task remains a task; a contract remains a contract; a payment remains a payment. Calendar and notifications point back to source data rather than duplicating business records.
2. **Calendar and reminders are different.** A due date belongs to the source record. A reminder is a scheduled attention instruction. A notification is the surfaced/delivered result.
3. **Notifications and communications are different.** Notifications tell a Wewed user that something needs attention. Communications are person-to-person/business messages. A notification may offer a `Message` or `Send reminder` action that uses the communications layer.
4. **Role visibility is fail-closed.** Notifications must never disclose information the recipient could not access by opening the source record directly.
5. **One engine, role-specific projections.** Admin, Planner, Couple and Vendor use the same notification/reminder/calendar primitives but receive different source types, filters, actions and escalation policies.

## 3. Shared surfaces

### 3.1 Notification Center

Every authenticated Admin, Planner, Couple and Vendor should receive a notification inbox with:

- unread/read state;
- `needs_action`, `upcoming`, `updates`, `messages`, `resolved` grouping;
- source context and deep link;
- role/wedding context;
- priority/severity;
- mark read/unread;
- acknowledge/resolve when appropriate;
- snooze;
- filters by category, wedding, role context and status;
- audit-safe lifecycle history.

### 3.2 Unified Calendar

The Wewed calendar is a projection of meaningful dated records across the platform. It should support:

- month, week, day and agenda views;
- wedding-specific and portfolio/all-weddings filtering where authorized;
- category filters;
- deep links to canonical records;
- explicit user-created calendar items where no other domain record exists;
- relative-to-wedding-date events/templates later;
- external calendar synchronization later without making Google/Apple/Outlook canonical.

Initial calendar-capable sources include:

- Planner tasks and assignments;
- budget/payment due dates;
- service engagement/service dates;
- programme/wedding timeline items;
- contract review/signature/expiry milestones where represented;
- RSVP deadline;
- meetings/appointments when represented;
- future Contributions due/target dates;
- admin operational deadlines;
- vendor engagement dates and required actions.

### 3.3 Today / Attention view

A role-aware command surface should prioritize what matters now rather than merely listing recent notifications.

- **Admin:** approvals, support/governance exceptions, failed deliveries, urgent operational events.
- **Planner:** portfolio conflicts, overdue/high-priority tasks, due payments, contracts, vendor confirmations, appointments and wedding-day actions.
- **Couple:** approvals, tasks, payments, guest/RSVP milestones, meetings and wedding countdown actions.
- **Vendor:** upcoming service dates, contract/document actions, appointments, payment events, messages and delivery confirmations.

### 3.4 Widgets

Widgets consume the same read model as Today/Calendar/Notifications.

**Web/dashboard widgets first:**

- Today;
- Upcoming;
- Wedding countdown;
- Tasks/action required;
- Payments/budget deadlines;
- Contracts;
- RSVP/guest milestone;
- Vendor service schedule;
- Admin operational alerts.

**Device widgets later:** native iOS/Android widgets after PWA/web push adoption validates the need. Do not build separate widget business logic.

## 4. Event and attention taxonomy

### Event classes

- `task.*`
- `budget.*`
- `payment.*`
- `vendor.*`
- `engagement.*`
- `contract.*`
- `rsvp.*`
- `guest.*`
- `programme.*`
- `wedding.*`
- `message.*`
- `communication.*`
- `contribution.*`
- `admin.*`
- `system.*`

### Severity

- `info`
- `normal`
- `important`
- `action_required`
- `urgent`

Severity affects ordering, push/escalation policy and visual treatment. It must not be used to bypass authorization or quiet-hour policy except where the user/platform policy explicitly allows urgent exceptions.

### Lifecycle

Notifications should support at least:

`scheduled -> queued -> active -> read -> acknowledged/actioned -> resolved`

with terminal/supporting states:

`dismissed`, `cancelled`, `expired`, `failed`.

Channel delivery attempts are tracked separately from notification state.

## 5. Shared data contract

The foundation should support these concepts without forcing each module to reinvent them:

### Notification

- recipient user;
- optional wedding scope;
- actor when applicable;
- source type/id;
- event type;
- category;
- severity;
- title/body/metadata;
- deep-link/action target;
- requires-action flag;
- lifecycle state;
- read/acknowledged/resolved timestamps;
- deduplication key;
- expiry;
- audit timestamps.

### Reminder

- owner/creator;
- target recipient;
- source type/id;
- optional wedding scope;
- trigger time;
- recurrence definition later;
- delivery/surface policy;
- cancellation condition/state;
- snooze relationship;
- timezone;
- generated notification link.

### Notification preference

- user;
- category or global scope;
- in-app/push/email/WhatsApp preference flags;
- quiet hours/timezone;
- digest preference later;
- wedding-specific overrides later.

### Delivery attempt

- notification;
- channel;
- provider/message reference when available;
- queued/sent/delivered/read/failed state;
- timestamps/error metadata.

### Calendar item

Prefer a **read projection** over canonical source records. Add a persistent calendar record only for explicit standalone events that have no natural source object.

## 6. Authorization and recipient resolution

All reads and writes must be role-aware and source-aware.

### Admin

- system/admin operational notifications;
- wedding/user/vendor notifications only where Admin authority permits access;
- no accidental private-wedding data leakage through notification text.

### Planner

- wedding membership/assignment determines scope;
- portfolio view may combine only weddings the planner is authorized to access;
- task assignee and wedding membership are both relevant signals.

### Couple

- notifications are restricted to the couple's own wedding(s) and permitted collaboration data;
- planner/admin internal-only notes must never leak through notification metadata.

### Vendor

- restricted to engagements/contracts/messages/actions in which the vendor is a party;
- no visibility of overall couple budget, unrelated vendors, guest private data or planner/admin internal operations.

Recipient resolution must be deterministic and testable. Role names are not sufficient by themselves; source-record authorization is required.

## 7. Reminder behavior

- source due date does not change when a notification is snoozed;
- completion of the source action should resolve/cancel future redundant reminders;
- reminder creation must be idempotent;
- repeated jobs must not create duplicate notifications;
- reminders use the recipient's effective timezone;
- automated person-to-person messages require explicit policy/consent; default external-message behavior is draft/approve where applicable;
- recurring reminders and `until condition is complete` are a later phase after one-shot reminders are proven.

## 8. Delivery channels

### Phase-one surface

- in-app Notification Center;
- Today/read model;
- calendar projection.

### Later channels

- Web/PWA push;
- desktop/browser notification;
- email;
- WhatsApp through the existing Wewed communications layer;
- native push when native apps exist.

Channel failures must not delete or invalidate the canonical in-app notification.

### Existing reminder compatibility discovered during baseline review

Wewed already has a Planner-only RSVP reminder flow under `src/app/api/planner/reminders`. It stores email reminder definitions in `ContentRevision` with `section = 'planner_reminder'` and has an existing Resend delivery path. This is **legacy-compatible functionality**, not the new system-wide reminder model.

Rules for this workstream:

- do not delete or break the existing Planner RSVP reminder flow while the shared engine is introduced;
- do not make `ContentRevision` the system-wide notification database;
- add the shared engine additively, then introduce an adapter/migration path in Phase 4;
- existing scheduled RSVP reminders must retain their current behavior until explicitly migrated and regression-tested;
- the shared communications router may later reuse the existing Resend delivery capability rather than duplicating provider code.

## 9. Implementation phases and acceptance criteria

### Phase 0 — Baseline and authoritative plan

**Status:** COMPLETE

- [x] Branch from current `main` after Contributions merge.
- [x] Establish this document as the authoritative plan.
- [x] Record implementation status here after every completed phase.
- [x] Review existing identity/access foundation and legacy Planner reminder implementation before feature code.

**Exit:** plan committed before feature code. **PASSED.**

### Phase 1 — Core notification/reminder data foundation

**Status:** IN PROGRESS

- [ ] Add database/Prisma models, relations and indexes for notifications, reminders, preferences and delivery attempts.
- [ ] Add migration matching the model.
- [ ] Add shared TypeScript taxonomy/contracts and validation.
- [ ] Add authorization-safe notification service primitives.
- [ ] Add idempotent create/read/mark-read/resolve/snooze primitives.
- [ ] Add tests for dedupe, lifecycle and fail-closed recipient access.

**Exit:** foundation builds/tests without changing existing feature behavior.

### Phase 2 — In-app API + Notification Center

**Status:** NOT STARTED

- [ ] Authenticated list endpoint with role-aware filtering.
- [ ] unread count endpoint/read model.
- [ ] mark read/unread.
- [ ] acknowledge/resolve.
- [ ] snooze/reminder creation.
- [ ] role-aware Notification Center UI.
- [ ] bell/unread indicator in authenticated role shells where a stable shell exists.

**Exit:** Admin, Planner, Couple and Vendor can only see their authorized notification records and can manage their own attention state.

### Phase 3 — Unified Calendar

**Status:** NOT STARTED

- [ ] shared calendar projection contract;
- [ ] project existing dated records without copying canonical business data;
- [ ] support task due dates, budget due dates, engagement service dates, RSVP deadline and programme/wedding timeline dates that can be safely normalized;
- [ ] role/wedding/portfolio filters;
- [ ] deep links;
- [ ] month/week/day/agenda starting with the simplest reliable views;
- [ ] standalone calendar events only where no source object exists.

**Exit:** the same source date is not independently edited in two places.

### Phase 4 — Reminder scheduler and source adapters

**Status:** NOT STARTED

- [ ] one-shot scheduled reminders;
- [ ] source completion cancellation;
- [ ] overdue/due-soon adapters for tasks and at least one financial/date source;
- [ ] contract/vendor/RSVP adapters as their source fields permit;
- [ ] adapt the legacy Planner RSVP reminder flow without breaking existing scheduled reminders;
- [ ] timezone handling;
- [ ] idempotent scheduler execution;
- [ ] audit events.

**Exit:** repeated scheduler execution cannot spam duplicates and completed items do not keep reminding users.

### Phase 5 — Today / role-aware attention dashboards

**Status:** NOT STARTED

- [ ] common attention-ranking model;
- [ ] Admin Today;
- [ ] Planner portfolio + wedding Today;
- [ ] Couple Today;
- [ ] Vendor Today;
- [ ] urgency/action-required ordering;
- [ ] source deep links.

**Exit:** every first-class role has a useful prioritized daily view from the same underlying contracts.

### Phase 6 — Dashboard widgets

**Status:** NOT STARTED

- [ ] reusable widget read models;
- [ ] Today/Upcoming widget;
- [ ] role-relevant action widget;
- [ ] wedding countdown widget where wedding context exists;
- [ ] no widget-specific duplicate business logic.

**Exit:** dashboard widgets agree with Notification Center/Today counts and source state.

### Phase 7 — Push, badges and multi-channel delivery

**Status:** NOT STARTED

- [ ] web/PWA push subscription model;
- [ ] contextual permission UX;
- [ ] badges where supported;
- [ ] push delivery attempts;
- [ ] communications-router integration for email/WhatsApp policies;
- [ ] quiet hours and channel preferences;
- [ ] delivery failure observability.

**Exit:** channel failure is observable and does not lose the in-app notification.

### Phase 8 — Automation, digests and advanced scheduling

**Status:** NOT STARTED

- [ ] recurring reminders;
- [ ] `repeat until condition complete`;
- [ ] daily/weekly digests;
- [ ] notification aggregation to prevent RSVP/message spam;
- [ ] wedding-relative template reminders;
- [ ] AI prioritization/drafting only with deterministic fallback;
- [ ] explicit approval/automation policy for external communications.

### Phase 9 — External calendar + native widgets/live wedding surfaces

**Status:** NOT STARTED / DEFERRED UNTIL CORE ADOPTION

- [ ] Google/Apple/Outlook sync design;
- [ ] Wewed remains source of truth for wedding business records;
- [ ] native widgets if native application strategy warrants it;
- [ ] live Wedding Day operational surface/Live Activities where platform support warrants it.

## 10. Initial source-to-role matrix

| Source | Admin | Planner | Couple | Vendor |
| --- | --- | --- | --- | --- |
| Planner task | support/authorized only | yes | assigned/permitted | assigned/permitted only |
| Budget/payment | governance/support only | yes | yes | own engagement/payment only |
| Service engagement | governance/support | yes | yes | own engagement |
| Contract | governance/support | party/manager | party | party |
| RSVP/guest deadline | support only when authorized | yes | yes | normally no |
| Programme/timeline | support only when authorized | yes | yes | own service-relevant items later |
| Message/communication | support boundary | own threads | own threads | own threads |
| System/admin operations | yes | relevant account/system notices | relevant account/system notices | relevant account/system notices |
| Contributions | governance/support | yes | yes | only direct-to-vendor/own action where authorized |

This matrix is a product rule, not an authorization implementation by itself.

## 11. UAT matrix

Every phase that surfaces data must test at least these four identities independently:

1. **Admin**
2. **Planner**
3. **Couple**
4. **Vendor**

Cross-role negative tests are mandatory. Examples:

- Vendor cannot see unrelated wedding budget notification.
- Couple cannot see Admin internal operational notification.
- Planner cannot see another planner's wedding without membership/authority.
- Admin support access follows existing authority boundaries rather than receiving all wedding content by default.
- Marking a notification read by one user cannot mark another recipient's notification read.
- Snoozing does not change the canonical source due date.
- Resolving/completing a source cancels redundant future reminders.

## 12. Engineering guardrails

- additive changes first; no destructive schema changes in the foundation;
- migrations must be safe for existing production data;
- existing Planner RSVP reminders must continue to work until a tested adapter/migration replaces their storage path;
- no external provider is required for core in-app functionality;
- deterministic templates/fallbacks must exist even when AI is unavailable;
- notification content must contain the minimum information needed to prompt action;
- source access is rechecked when opening a deep link;
- all scheduler/adaptor jobs are idempotent;
- indexes must support recipient + unread/status + scheduled-time queries;
- timestamps stored in UTC; render using effective user timezone;
- production rollout only after exact-head CI and cross-role UAT are green.

## 13. Definition of done for the workstream

The workstream is complete when:

- Admin, Planner, Couple and Vendor use one shared notification model;
- each role has a secure Notification Center;
- meaningful dated Wewed records can appear in a unified calendar without duplicate sources of truth;
- users can create/snooze reminders without mutating canonical deadlines;
- source completion resolves/cancels redundant reminders;
- Today/widgets consume the same read model and agree on counts/state;
- push/channel delivery is optional and observable;
- role isolation, deduplication, lifecycle, calendar projection and scheduler behavior are covered by CI/UAT;
- this document records final implementation status and any deliberately deferred Phase 8/9 work.
