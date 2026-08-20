# Wewed System Notifications, Calendar, Reminders & Attention Plan

**Status:** AUTHORITATIVE — implementation complete; final exact-head qualification in progress  
**Branch:** `feature/system-notifications-attention`  
**Qualification PR:** #172 (draft; DO NOT MERGE until the final gates below pass)  
**Initial baseline:** `main` at `713e0a59277cdb8629a1a1d2e662c38ada6c3a26`  
**Current reconciliation:** `main` `657d4a7f3be9e2148167ec4cfcb2ea401c62b73d` was merged into this feature workstream through PR #171; feature reconciliation head `4ac7a410…`.  
**Current certification work:** the implementation now includes four-role API/browser UAT, scheduler replay/resolution UAT, legacy RSVP regression coverage, cron deployment wiring, desktop widget collision repair, and delivery-time authorization rechecks. The next gate is the complete exact-head repository matrix and READY preview.  
**Rule:** A phase is not complete merely because code exists. Implementation, exact-head build/test, database qualification and cross-role UAT are tracked separately.

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
3. Notifications and person-to-person communications are separate systems that can invoke/reuse one another without conflating records.
4. Recipient identity alone is insufficient for wedding data; source/wedding authorization must also pass.
5. Admin, Planner, Couple and Vendor use one engine but different role-safe projections.
6. In-app notification history remains canonical even when push/email/WhatsApp delivery fails.
7. Consequential external delivery rechecks current authorization immediately before queueing and immediately before transport.

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
- delivery-attempt observability for external channels.

### Unified Calendar

Calendar is a read projection of meaningful dated Wewed records. Current sources:

- PlannerTask due dates;
- BudgetItem due dates;
- ServiceEngagement service dates;
- Wedding RSVP deadline;
- ProgrammeItem times combined with wedding date;
- Wedding date;
- Admin's own **global** scheduled operational/system attention only;
- contract review-grant expiry where `ContractReviewGrant.expiresAt` and exact `EngagementParty` authorization exist.

External calendar synchronization later must not make Google/Apple/Outlook the source of truth for Wewed business records.

### Today / Attention

One role-aware daily command surface:

- **Admin:** global operational/system attention assigned to that Admin.
- **Planner:** cross-wedding actions and dates from authorized weddings.
- **Couple:** own wedding actions and dates.
- **Vendor:** own source-authorized engagement/service/contract-review attention only.

### Widgets

Web/dashboard widgets consume the same Today/Notification/Calendar read model. The desktop Today widget is an in-flow summary rather than a fixed overlay, so it cannot cover Planner task/budget/vendor action controls.

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

Admin receives global operational/system notifications addressed to that Admin. Wedding/private content is not automatically projected into Admin Notification Center, Calendar or Today merely because the user has an Admin role. Both Notification visibility and Admin Calendar now fail closed on wedding-scoped Admin attention.

### Planner

Active wedding membership/assignment determines wedding scope. Portfolio aggregation may only combine weddings that remain authorized.

### Couple

Only their own active wedding membership and permitted collaboration data are projected. Planner/Admin internal-only content must never leak through titles, body or metadata.

### Vendor

Vendor access is source-party based, not "same wedding" based. Notification Center, Calendar, Scheduler and external delivery all require the same source-party identity: an active `EngagementParty` with `partyRole='SERVICE_PROVIDER'`, `partyKind='VENDOR'`, the mapped Vendor `userId`, and the exact `ServiceEngagement` or review grant being projected.

**Contract authorization decision (2026-08-20):** generic `Contract.issuedAt` and `Contract.closedAt` are lifecycle timestamps, not actionable deadlines. The first deterministic Vendor contract path is `ContractReviewGrant.expiresAt`, because a review grant is tied to one `EngagementParty`. A Vendor recipient is valid only when that exact service-provider Vendor party has a `userId`, the grant is active/not revoked, the version remains reviewable and the grant has not expired. Business-only parties with no mapped user remain fail-closed.

**Guardrail:** broader financial/contract notification delivery to Vendors remains disabled until each source exposes its own deterministic Vendor-party authorization path. Do not infer Vendor access from another engagement in the same wedding.

### External delivery re-authorization

The router does not trust authorization captured when the Notification row was created. Before an email, WhatsApp or push attempt is queued—and again before transport—it rechecks the recipient's current role/wedding/source authorization. Revoked Planner/Couple membership, revoked Vendor service-provider mapping, expired/revoked contract grant or malformed Admin/private scope is rejected before transport.

## 6. Existing reminder compatibility

Wewed already has a Planner-only RSVP email reminder flow under `src/app/api/planner/reminders`, stored as `ContentRevision(section='planner_reminder')`, plus the existing Resend delivery path and `/api/cron/reminders` cron.

Rules:

- preserve it unchanged during the shared-engine rollout;
- do not turn `ContentRevision` into the system-wide notification database;
- the new scheduler uses `/api/cron/system-reminders` and does **not** require Resend;
- legacy Planner reminders have dedicated CRUD + dry-run browser regression coverage in the final release suite;
- communications routing may reuse existing Resend/WhatsApp controls rather than duplicating provider code.

## 7. Implementation phases

### Phase 0 — Baseline and authoritative plan

**Status: COMPLETE**

- [x] Branch from exact current `main` after Contributions merge.
- [x] Commit this plan before feature code.
- [x] Review signed AppSession role model and wedding-access layer.
- [x] Review legacy Planner RSVP reminders and preserve them.
- [x] Reconcile later `main` changes into the feature branch before continuing source-adapter expansion (PR #171).

### Phase 1 — Core notification/reminder foundation

**Status: IMPLEMENTED; DATABASE CONTRACT PROVEN; FINAL EXACT-HEAD MATRIX PENDING**

- [x] Add additive SQL storage for `Notification`, `Reminder`, `NotificationPreference`, `NotificationDeliveryAttempt`.
- [x] Add safe indexes/FKs/check constraints and per-recipient dedupe keys.
- [x] Add typed TypeScript contracts and Zod validation.
- [x] Add authorization-safe notification service primitives.
- [x] Add idempotent create/read/unread/acknowledge/resolve/snooze primitives.
- [x] Add lifecycle and fail-closed visibility unit tests.
- [x] Add matching Prisma models/relations so migration/schema parity is enforced by repository CI.
- [x] Apply migrations to clean PostgreSQL in PR qualification and run existing DB integration, including Vendor review-attention and dedupe proof.
- [ ] Freeze and pass the complete final exact-head repository matrix.

### Phase 2 — In-app API + Notification Center

**Status: IMPLEMENTED; EXECUTABLE FOUR-ROLE UAT ADDED; FINAL RUN PENDING**

- [x] Authenticated role-aware list API and unread count.
- [x] read/unread, acknowledge/resolve, snooze/reminder creation.
- [x] shared `/notifications` UI and bell/unread indicator.
- [x] Vendor notification reads re-check exact source-party authorization.
- [x] Admin wedding-scoped attention and non-Admin `admin` category records fail closed.
- [x] Executable Admin/Planner/Couple/Vendor positive + negative API/browser UAT added.
- [ ] Final exact-head execution must pass.

### Phase 3 — Unified Calendar

**Status: CORE + CONTRACT REVIEW ADAPTER IMPLEMENTED; EXECUTABLE ROLE UAT ADDED; FINAL RUN PENDING**

- [x] Shared calendar projection contract; canonical records remain source of truth.
- [x] Task, budget/payment, ServiceEngagement, RSVP, wedding and programme dates.
- [x] Vendor projection restricted to exact active `SERVICE_PROVIDER` / `VENDOR` EngagementParty records.
- [x] Admin projection restricted to own global scheduled admin/system attention (`weddingId IS NULL`).
- [x] category/date/wedding filtering and source deep links.
- [x] month and agenda views.
- [x] authorized contract review-grant expiry projection without treating lifecycle timestamps as deadlines.
- [x] Executable role UAT covers Admin private-scope denial, Planner revoked wedding, Couple isolation, Vendor exact engagement/grant and same-wedding cross-vendor denial.
- [ ] Final exact-head execution must pass.
- [ ] week/day views, standalone events, appointment/contribution adapters remain enhancements after core certification.

**Invariant:** the source record remains the only editable due/service/deadline date.

### Phase 4 — Reminder scheduler and source adapters

**Status: IMPLEMENTED; EXECUTABLE REPLAY/RESOLUTION UAT ADDED; FINAL RUN PENDING**

- [x] Separate system reminder cron protected by `CRON_SECRET`.
- [x] one-shot snooze wake-up and conditional claim.
- [x] task due-soon/overdue, BudgetItem due/overdue, RSVP 7-day, ServiceEngagement 24-hour and Admin failure adapters.
- [x] Vendor ServiceEngagement and contract review-expiry recipients use exact service-provider Vendor identity.
- [x] task/payment/engagement source completion auto-resolution.
- [x] dedupe keys on generated notifications.
- [x] quiet hours/timezone/digest/channel policy enforced by external delivery policy.
- [x] Vercel schedules legacy reminders daily, system reminders hourly, and external notification delivery every 15 minutes; preview deployment validation accepted all schedules.
- [x] Isolated browser UAT calls the real protected cron route, proves unauthorized calls fail, snooze wake-up does not mutate source date, replay does not duplicate, and completed task/payment/engagement sources resolve attention.
- [ ] Final exact-head execution must pass.
- [ ] broader audit-event mirroring remains an observability enhancement; Notification/Reminder/DeliveryAttempt records are authoritative for this release.

### Phase 5 — Today / role-aware attention dashboards

**Status: IMPLEMENTED; FOUR-ROLE UAT ADDED; FINAL RUN PENDING**

- [x] common attention-ranking model.
- [x] Admin, Planner, Couple and Vendor Today projections.
- [x] urgency/action-required ordering and source deep links.
- [x] dedupe calendar items when an active notification represents the same source.
- [x] four-role API/browser UAT asserts negative records do not reappear through Today.
- [ ] final exact-head execution and later prioritization tuning.

### Phase 6 — Dashboard widgets

**Status: CORE IMPLEMENTED; RELEASE BLOCKER FIXED; FINAL BROWSER RUN PENDING**

- [x] reusable Today widget read model, counts and spotlight items.
- [x] widget consumes Today API rather than duplicate domain logic.
- [x] desktop widget changed from fixed bottom-right overlay to in-flow desktop summary after browser qualification proved it could intercept Planner task/budget actions.
- [ ] final browser matrix must prove the collision is gone.
- [ ] dedicated countdown/configurable layout/native widgets remain deferred enhancements.

### Phase 7 — Push, badges and multi-channel delivery

**Status: IMPLEMENTED WITH FAIL-CLOSED PROVIDER POLICY; FINAL EXACT-HEAD QUALIFICATION PENDING**

- [x] global user notification preference storage/API.
- [x] channel intent flags, timezone, quiet hours and digest preference UI.
- [x] provider-neutral `PushSubscription` storage and authenticated device API.
- [x] contextual push permission page; service-worker push/click handling and supported app badging.
- [x] provider-neutral Web Push gateway contract supplies the browser subscription to an encrypted Web Push gateway; no configured gateway means unavailable/cancelled, never fake success.
- [x] `NotificationDeliveryAttempt` records queued/sent/failed/cancelled transport attempts.
- [x] email routing reuses Wewed transactional Resend controls and verified communication endpoint/preferences.
- [x] WhatsApp routing reuses Wewed Cloud API/test-mode/template controls and verified endpoint/preferences.
- [x] quiet hours, timezone, digest mode, channel preference, read/snooze/schedule/expiry policy.
- [x] bounded retry/failure policy and PostgreSQL advisory lock for concurrent router runs.
- [x] live recipient/source authorization rechecked before queue and transport.
- [x] protected `/api/cron/notification-deliveries` route scheduled every 15 minutes in Vercel configuration.
- [ ] final exact-head build/release matrix and production configuration verification after merge.

**Release rule:** in-app Notification Center/Calendar/Today is canonical. Email/WhatsApp send only when both Wewed notification preference and existing verified communication endpoint/preference allow it. Push remains fail-closed when no real gateway is configured; a UI intent flag alone is never treated as successful subscription/delivery.

### Phase 8 — Digests and advanced automation

**Status: DEFERRED FROM CORE CERTIFICATION**

- recurring reminders;
- repeat-until-condition workflows;
- actual daily/weekly digest aggregation/delivery;
- burst aggregation;
- wedding-relative template automation;
- AI prioritization/drafting without silent external authorization.

### Phase 9 — External calendars + native/live widgets

**Status: DEFERRED UNTIL CORE ADOPTION**

Google/Apple/Outlook synchronization and native/live widgets remain future work. Wewed remains canonical for wedding business records.

## 8. Initial role/source matrix

| Source | Admin | Planner | Couple | Vendor |
| --- | --- | --- | --- | --- |
| Task | explicit support only; no automatic private projection | yes | permitted wedding | disabled until task-party rule exists |
| Budget/payment | explicit support only | yes | permitted wedding | disabled until vendor-payment source authorization exists |
| Service engagement | explicit support only | yes | permitted wedding | exact active `SERVICE_PROVIDER`/`VENDOR` engagement only |
| Contract | explicit support/governance | party/manager | party | exact active review grant tied to own service-provider party only |
| RSVP/guest deadline | explicit support only | yes | yes | no |
| Programme/timeline | explicit support only | yes | yes | no general projection |
| Messages/communications | own/support boundary | own threads | own threads | own threads |
| System/admin operations | own global assigned operations | relevant account notices later | relevant account notices later | relevant account notices later |
| Contributions | support/governance | later adapter | later adapter | only explicit source-authorized direct-to-vendor action later |

## 9. Mandatory UAT matrix

Executable final tests now cover independently:

1. Admin
2. Planner
3. Couple
4. Vendor

Required negatives:

- [x] Vendor cannot see overall wedding budget notification/calendar data.
- [x] Vendor cannot see another Vendor's engagement in the same wedding.
- [x] Vendor cannot see another Vendor's contract review grant in the same wedding.
- [x] non-`SERVICE_PROVIDER` parties do not inherit Vendor authority (unit/DB authorization contract).
- [x] unmapped business-only review parties do not produce a Vendor recipient (Phase 2 PostgreSQL integration).
- [x] Couple cannot see Admin operational notifications.
- [x] Planner cannot see a wedding after active authority is revoked.
- [x] Admin does not automatically receive private wedding Notification/Calendar/Today data.
- [x] one recipient marking read does not change another recipient's state.
- [x] snooze does not mutate the source due date.
- [x] completion/payment/service closure resolves redundant attention in real scheduler-route UAT.
- [x] repeated scheduler execution is asserted idempotent in real scheduler-route UAT.
- [x] external channel failure/unavailability leaves canonical in-app Notification intact by router design and delivery-attempt model.

**Certification note:** checked items above mean executable evidence exists in the branch. They are not considered release PASS until the final exact-head CI/browser run completes successfully.

## 10. Engineering guardrails

- additive migrations only during foundation;
- no production migration until exact-head build/test and approved cross-role UAT path;
- preserve legacy RSVP reminder behavior until a tested adapter replaces it;
- no external provider required for core in-app notification/calendar functionality;
- minimum necessary information in notification body/metadata;
- destination source module rechecks deep-link access;
- scheduler/adapters are idempotent;
- timestamps are timezone-aware; user timezone controls rendering/delivery policy;
- provider failures are recorded rather than silently swallowed;
- external delivery rechecks live authorization;
- merge current `main` into the feature workstream if material drift invalidates qualification assumptions;
- no production merge/deployment merely because a preview is READY.

## 11. Implementation and certification log

- **2026-08-20 — Baseline:** feature branch created and authoritative plan committed before feature code.
- **2026-08-20 — Foundation:** Notification/Reminder/Preference/DeliveryAttempt storage, Prisma parity, typed contracts, services and lifecycle tests implemented.
- **2026-08-20 — Notification Center/Calendar/Today:** shared role-aware APIs/UIs, bell, month/agenda calendar and Today/widgets implemented.
- **2026-08-20 — Scheduler:** independent protected system-reminder cron with task/budget/RSVP/engagement/Admin adapters and source auto-resolution implemented.
- **2026-08-20 — Push/multi-channel:** notification preferences, PushSubscription, service worker, delivery policy/router and protected delivery cron implemented; email/WhatsApp reuse existing verified communications controls; push is fail-closed without a configured gateway.
- **2026-08-20 — Main reconciliation:** PR #171 reconciled `main` `657d4a7f3be9e2148167ec4cfcb2ea401c62b73d` into the feature branch. This was not a production merge.
- **2026-08-20 — Contract authorization:** `ContractReviewGrant.expiresAt` + exact active service-provider Vendor party chosen; `issuedAt`/`closedAt` are not reminder deadlines.
- **2026-08-20 — Database qualification:** clean PostgreSQL migration application, migration status, schema diff and Phase 2 Vendor review-attention/dedupe integration passed on earlier qualification heads.
- **2026-08-20 — Vendor source hardening:** Notification, Calendar and Scheduler narrowed to exact source-party identity; same-wedding participation is insufficient.
- **2026-08-20 — Widget browser blocker:** exact-head browser run had 75/78 passing with three failures caused by a fixed Today dock intercepting controls; dock was converted to in-flow layout instead of weakening tests.
- **2026-08-20 — Cron deployment wiring:** Vercel configuration now includes legacy daily reminders, hourly system reminders and 15-minute external notification delivery; Vercel preview builds accepted the configuration.
- **2026-08-20 — Admin fail-closed hardening:** Notification visibility rejects wedding-scoped Admin attention and non-Admin `admin` category records; Admin Calendar independently requires `weddingId IS NULL`.
- **2026-08-20 — Consequential delivery recheck:** external delivery now revalidates current role/wedding/source authorization before queue and before transport; Stage 10 source contract locks both checks.
- **2026-08-20 — Four-role executable UAT:** `tests/e2e/system-attention-roles.spec.ts` covers Admin, Planner, Couple and Vendor Notification/Calendar/Today boundaries plus read/acknowledge/resolve/snooze and per-recipient state independence.
- **2026-08-20 — Scheduler executable UAT:** `tests/e2e/system-attention-scheduler.spec.ts` exercises the protected real cron route, replay/dedupe, snooze wake-up, source-date integrity and task/budget/engagement auto-resolution.
- **2026-08-20 — Legacy regression:** `tests/e2e/legacy-planner-reminders-regression.spec.ts` preserves Planner RSVP reminder CRUD and dry-run invitation rendering without external send.
- **Current qualification:** all implementation required for core release has been committed. The complete exact-head CI/browser/preview matrix is now the release gate.
- **Production:** no feature-to-main merge or production rollout has occurred yet. User authorization is to merge only after all final gates are green.

## 12. Workstream definition of done

Core workstream is done only when:

- [ ] final exact head passes Admin/Planner/Couple/Vendor positive + negative UAT;
- [ ] clean database migration/schema qualification passes on that release lineage;
- [ ] exact branch head passes the complete mandatory repository matrix with no mandatory skipped failures;
- [ ] Notification Center, Calendar, Today and widget state remain consistent in executable tests;
- [ ] scheduler replay/dedupe and source auto-resolution pass with real isolated test records;
- [ ] legacy RSVP reminder regression passes;
- [ ] Vercel exact-head preview is READY and proven to correspond to the release candidate;
- [ ] current `main` has not materially drifted; if it has, reconcile and rerun;
- [ ] only then remove draft state and merge PR #172 to `main`;
- [ ] production Vercel deployment is READY on the merged `main` SHA and key production health/runtime checks are clean.

Phase 8/9 enhancements do not block this core release. Push is not represented as delivered unless a configured gateway actually exists; absent provider configuration remains a fail-closed transport state, not an in-app feature failure.

## 13. Final certification protocol

The final candidate is frozen after this plan synchronization and any failure fixes. Certification must then use the same application head for:

1. clean PostgreSQL migration deploy + schema diff;
2. complete repository CI/release matrix;
3. Vercel preview provenance/READY build;
4. Admin positive + negative authority UAT;
5. Planner positive + negative wedding-scope UAT;
6. Couple positive + negative private/admin boundary UAT;
7. Vendor exact-engagement + exact-review-grant positive UAT and same-wedding cross-vendor negative UAT;
8. Notification lifecycle proof: unread/read/acknowledge/resolve/snooze without source-date mutation;
9. scheduler replay/dedupe and source-completion auto-resolution;
10. legacy Planner RSVP reminder regression;
11. independent re-check of consequential authorization claims and current `main` drift;
12. production merge only if 1–11 are green; then production deployment/health verification.

A READY preview cannot compensate for a failed authorization, database or browser gate. A green unit suite cannot compensate for missing cross-role UAT. The PR remains draft until these gates are evidenced.
