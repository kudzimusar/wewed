# Wewed Native Shadow Integration & Real-Wedding Parity Plan

**Plan ID:** WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01  
**Governing Status:** AUTHORITATIVE NEXT-SPRINT MANUAL  
**Reference Wedding:** Charity & Kudzie  
**Reference Planner Context:** Eleven Eleven Testing planner account  
**Production Reference:** main @ 2be25d724b51539f4677f2f15050e0deb873922e  
**Native Shell Reference:** native-mobile/whole-product-shell-20260917 @ 731ba0c48219d8d2712f6851e60c6df908bfd444  
**Planning Branch:** native-mobile/shadow-real-wedding-plan-20260918  
**Production Integration Status:** NOT AUTHORIZED  
**Production Write Status:** PROHIBITED  
**Purpose:** Turn the isolated dual-native Wewed shell into a realistic, interconnected Wewed application by safely mirroring one current real wedding into a non-production mobile shadow environment, beginning with the full Planner domain and carrying the same wedding graph through Invitations, Wedding Pass, Wedding Day, Guests, Vendors, Contributions, Seating, Timeline, Live, and role-specific workspaces.

---

## 0. Why this plan exists

The current dual-native shell has proven several important things:

- iOS can be implemented as true SwiftUI.
- Android can be implemented as true Jetpack Compose.
- role-specific shells and deterministic persona switching work.
- the Wedding Pass and Wedding Day gate workflow are the strongest complete native vertical slice.
- dual-platform unit and Maestro qualification can be executed while the live Wewed product remains untouched.

However, the current shell still behaves too much like a collection of representative screens. It does not yet express the full depth and interconnectedness of the active Wewed product.

The clearest example is Planner. A real Wewed planner manages a connected operating system of tasks, budgets, contributions, vendors, guests, seating, timeline, bookings, contracts, messages, documents, and day-of readiness. The current native Planner shell can represent these areas visually, but it is not yet driven by the same realistic relationship graph that makes the production product useful.

This plan corrects that by using the current Charity & Kudzie wedding, managed through the Eleven Eleven Testing planner account, as the primary real-world reference scenario.

The core principle is:

> Production is the source of truth for product behavior and real wedding data shape.  
> The mobile shadow environment is the safe place where native development reads, writes, resets, breaks, and learns.

The native app must not become a second independent product with invented workflows. It must become a native expression of Wewed.

---

# 1. Non-negotiable outcome

At the end of the shadow-real-wedding phase, an agent should be able to open the native app and select the Charity & Kudzie shadow wedding, then observe one coherent wedding graph across roles.

A Planner should see the same underlying wedding as the Couple. A Vendor should see their own engagement from that wedding. A Guest should see the invitation, RSVP state, pass, programme, seating and live experience that flow from the same data. An Usher should scan the pass issued from that same guest record. Wedding Day attendance must update the same shadow wedding state.

The target is not:

> many native screens containing plausible sample text.

The target is:

> one realistic Wewed wedding moving through planning, invitation, RSVP, Wedding Pass, Wedding Day, attendance and live operations.

---

# 2. Scope of this plan

This plan governs the next native-mobile sprint across five layers:

1. Real wedding discovery and read-only audit.
2. Safe production snapshot and privacy classification.
3. Local sanitized snapshot fixtures.
4. Mobile Shadow database and backend.
5. Native Planner-first integration and subsequent whole-wedding expansion.

This plan does not authorize production mutation, production database access from the native app, production deployment changes, or merging native work into main.

---

# 3. Mandatory repository Gate 0

Every agent and every session starts here before analysis, coding, test interpretation, or verdict.

Required sequence:

    FETCH
    → LOCAL HEAD
    → REMOTE HEAD
    → DIVERGENCE
    → WORKTREE
    → BRANCH
    → SCOPE CHECK
    → ONLY THEN CONTINUE

Expected active implementation base for this plan:

    native-mobile/whole-product-shell-20260917
    731ba0c48219d8d2712f6851e60c6df908bfd444

Production functional reference:

    main
    2be25d724b51539f4677f2f15050e0deb873922e

Protected active working directory:

    /Users/shadreckmusarurwa/Project AI/wewed

Isolated native working directory:

    /Users/shadreckmusarurwa/Project AI/wewed-native-mobile

No agent may assume local and remote are aligned. The agent must prove it.

Any divergence, dirty worktree, unexpected branch, or unclassified file change is a STOP condition until reconciled.

---

# 4. Hard isolation boundaries

## 4.1 Production is read-only during this sprint

The Charity & Kudzie wedding may be inspected and exported only through an authorized read-only path.

During this sprint there must be:

- no direct native writes to production;
- no test edits to the live wedding;
- no production task mutation;
- no production seating mutation;
- no production RSVP mutation;
- no production contribution mutation;
- no production budget mutation;
- no production vendor state mutation;
- no production booking mutation;
- no production contract action;
- no production notification or message sends;
- no production payment attempts;
- no production invitation sends.

If a tool or workflow cannot guarantee read-only behavior, it must not be used against the live wedding.

## 4.2 Native clients never connect directly to the production database

The final architecture is:

    Production Wewed
        │
        │ one-way authorized snapshot / later controlled read comparison
        ▼
    Mobile Shadow Import Boundary
        │
        ▼
    Mobile Shadow Database
        │
        ▼
    Mobile Shadow Backend
        │
        ├── iOS SwiftUI
        └── Android Compose

The native clients communicate with a backend or local fixture adapter, never directly with production Postgres/Prisma.

## 4.3 No reverse synchronization

Shadow changes are disposable development changes.

There is no automatic or manual "push shadow changes back to production" function in this phase.

The import direction is always:

    production → snapshot → shadow

Never:

    shadow → production

---

# 5. Real-wedding reference scenario

The real-world reference is:

- Couple: Charity & Kudzie.
- Planner context: Eleven Eleven Testing.
- Wedding state: active/current running wedding.
- Purpose: provide the realistic data relationships, edge cases, incomplete records, counts, planner activity, financial relationships, guest state and operational context that synthetic fixtures cannot reproduce faithfully.

The exact production identifiers must be resolved during read-only discovery and must not be guessed or hard-coded from chat.

The plan intentionally uses the human-readable names as the project reference while requiring machine IDs to be discovered from authoritative production records.

---

# 6. Data graph to discover

The read-only audit must map the Charity & Kudzie wedding into a graph, not a set of independent exports.

At minimum discover:

## 6.1 Identity and context

- wedding/project record;
- couple account(s);
- planner account;
- Eleven Eleven Testing planner organization/profile;
- memberships;
- roles;
- permissions;
- wedding lifecycle state;
- wedding date;
- venue;
- timezone;
- locale/currency;
- public wedding slug/domain where applicable.

## 6.2 Planner core

- overview/readiness data;
- tasks;
- task categories;
- priorities;
- due dates;
- assignees;
- status including blocked state;
- planner activity;
- reminders;
- decisions/approvals.

## 6.3 Budget and contributions

- budget categories;
- line items;
- estimate;
- actual;
- allocated;
- paid;
- outstanding;
- due dates;
- funding source;
- contribution linkage;
- contributor relationship;
- direct vendor payment linkage;
- cash/in-kind classification;
- verification state;
- evidence/document relationships.

## 6.4 Vendors and service engagements

- vendor records;
- contacts;
- service categories;
- engagement/booking relationship;
- contract state;
- quote state;
- payment state;
- funding context;
- linked tasks;
- timeline obligations;
- wedding-day call times;
- documents where safely representable.

## 6.5 Guests and invitations

- households;
- guest members;
- party size;
- RSVP state;
- dietary state;
- plus-one/kids where supported;
- invitation state;
- invitation token relationship without copying live secrets;
- table assignment;
- attendance/check-in state;
- Wedding Pass eligibility.

## 6.6 Seating

- tables;
- table types;
- zones;
- capacity;
- current occupancy;
- assignments;
- unassigned guests;
- over-capacity or attention cases.

## 6.7 Timeline and Wedding Day

- planner timeline;
- ceremony/reception programme;
- venues/locations;
- duration;
- sequence;
- vendor call times;
- operational issues;
- announcements;
- attendance state.

## 6.8 Communication and shared context

Where needed to understand the workflow:

- message thread metadata;
- unread/action state;
- booking/contract/task context links;
- notification categories.

Private message bodies should not be copied by default. Only copy content when it is explicitly necessary for a tested workflow and privacy review permits it.

---

# 7. Data classification and privacy rules

Every field entering the shadow pipeline must be classified.

## Class A — safe operational structure

Examples:

- entity type;
- foreign-key relationship;
- status;
- counts;
- category;
- non-sensitive timestamps;
- table capacity;
- task priority;
- generic venue zone;
- generic service category.

May be copied into private shadow and may be transformed into sanitized Git fixtures.

## Class B — personal data

Examples:

- real guest names;
- phone numbers;
- email;
- physical address;
- dietary requirements;
- household membership;
- personal notes.

May enter the private shadow only when authorized and necessary.

Must not be committed to Git in identifiable form.

Repository fixtures must pseudonymize or synthesize these fields.

## Class C — sensitive financial/business data

Examples:

- contribution amounts tied to named people;
- payments;
- vendor commercial terms;
- contracts;
- bank/payment references;
- billing records.

Private shadow access only.

Git fixtures must retain useful structure and edge cases while removing identifiers and sensitive references.

## Class D — secrets and authentication material

Never copied.

Includes:

- passwords;
- password hashes;
- refresh tokens;
- access tokens;
- session cookies;
- API keys;
- production signing private keys;
- OTP secrets;
- webhook secrets;
- live invitation access secrets;
- live payment credentials.

These fields must be dropped at export time.

## Class E — private content

Examples:

- private messages;
- contracts;
- internal notes;
- uploaded identity/evidence documents.

Default policy: metadata only.

Payload/content is copied only when a specific test requires it and approval is explicit.

---

# 8. Production snapshot strategy

The first bridge away from fictional fixtures is a controlled production snapshot.

## 8.1 Read-only extraction

The extraction mechanism must have read-only credentials or a read-only query path.

The export should be scoped by the discovered Charity & Kudzie wedding/project ID.

It must include only data needed to build and validate native flows.

It must not export the entire Wewed database.

## 8.2 Snapshot manifest

Every export produces a manifest containing:

- snapshot ID;
- source environment;
- source wedding ID;
- source production commit/deployment identifier if available;
- exported domain families;
- excluded domain families;
- export timestamp;
- schema version;
- sanitization version;
- row counts by entity;
- checksum;
- operator/agent;
- confirmation that no writes were performed.

## 8.3 Two snapshot forms

### Private operational snapshot

Used only for the private Mobile Shadow environment.

May preserve authorized real relationship data.

Never committed to Git.

### Sanitized repository snapshot

Derived from the private snapshot.

Preserves:

- relationships;
- realistic counts;
- status distribution;
- edge cases;
- domain complexity;
- chronology;
- dependency graph.

Replaces private identities with stable pseudonyms.

This becomes the deterministic test fixture dataset.

---

# 9. Sanitized fixture rules

The repository fixture should feel like the real wedding without being a copy of private wedding records.

Rules:

- preserve row cardinality where useful;
- preserve status distribution;
- preserve relationship topology;
- preserve overdue/blocked/attention cases;
- preserve partial payment/funding relationships;
- preserve seating occupancy patterns;
- preserve RSVP distribution;
- preserve vendor/task/budget/contribution linkage;
- preserve timeline ordering conflicts where useful;
- replace names, emails, phones and addresses;
- replace attachment payloads with local test assets;
- replace production tokens with deterministic test tokens;
- replace payment/contract identifiers;
- never commit authentication secrets.

Fixture namespace should clearly indicate shadow/sanitized origin.

---

# 10. Mobile Shadow environment architecture

The shadow environment is a non-production Wewed runtime specifically for native development.

Recommended components:

    Mobile Shadow Postgres
    Mobile Shadow Prisma schema / migration-compatible model
    Mobile Shadow API/backend
    Shadow authentication adapter
    Shadow file/document adapter
    Shadow notification adapter
    Shadow communication adapter
    Shadow payment adapter
    Shadow contract-signing adapter
    Shadow webhook adapter
    Shadow analytics sink

The intent is to reproduce Wewed behavior while removing all real-world side effects.

---

# 11. Side-effect firewall

This is mandatory before any agent receives write access to Shadow.

## Email

- disabled or redirected to a test inbox;
- never deliver to production guest/vendor addresses.

## WhatsApp / SMS

- disabled;
- no Meta/telephony production credentials;
- test event logged locally instead.

## Push notifications

- sandbox tokens only;
- no production APNs/FCM token reuse.

## Payments

- test/simulated adapter only;
- no live Stripe/payment gateway mutation;
- no live mobile-money transaction.

## Contract signing

- simulated signatures only;
- clearly marked NON-BINDING SHADOW;
- no production signing links.

## Booking

- creates shadow bookings only;
- no external vendor notification.

## Webhooks

- disabled or routed to shadow-only endpoints.

## AI

- may use fixture context where permitted;
- must not send private shadow PII to external providers unless separately approved.

## Files

- use shadow bucket/local object storage;
- never overwrite production documents.

Any real external side effect discovered during testing is an immediate STOP condition.

---

# 12. Shadow refresh model

Shadow is intentionally mutable, so production refreshes must be controlled.

Supported refresh modes:

## Manual full reset

- archive current shadow run;
- import latest production snapshot;
- regenerate shadow identities;
- reset side-effect adapters;
- re-run integrity checks.

## Manual domain refresh

Example: refresh guests/RSVP only, preserving experimental planner task changes.

Must be explicit and logged.

## Scheduled refresh

May be introduced later, but not during early integration unless it preserves test-run determinism.

Default rule for this sprint:

> No silent nightly overwrite of a working shadow test environment.

---

# 13. Native repository architecture

Do not expand a monolithic WeddingRepository until it owns the entire platform.

Use domain repositories.

Recommended interfaces:

- IdentityRepository
- WeddingContextRepository
- PlannerRepository
- TaskRepository
- BudgetRepository
- ContributionRepository
- VendorRepository
- BookingRepository
- ContractRepository
- GuestRepository
- SeatingRepository
- TimelineRepository
- InvitationRepository
- PassRepository
- WeddingDayRepository
- MessageRepository
- NotificationRepository
- CalendarRepository
- VaultRepository
- SettingsRepository
- AdminRepository

Each domain can have implementations such as:

    FixturePlannerRepository
    ShadowPlannerRepository
    ProductionPlannerRepository   [future, not enabled in this sprint]

The UI must depend on protocols/interfaces, not environment-specific code.

Environment switching must be centralized and explicit.

---

# 14. Planner is the proving ground

Planner is the first real-data vertical slice.

Do not begin by shadow-wiring every domain.

The first connected native surface must make the Charity & Kudzie planning experience visibly more realistic than the current shell.

Planner must contain:

1. Overview
2. Tasks
3. Budget
4. Contributions
5. Vendors
6. Guests bridge
7. Seating
8. Timeline

The modules must use one shared wedding graph.

---

# 15. Planner Overview target

The Overview should answer:

> What needs attention in this wedding right now?

Representative structure:

    Wedding Planner
    Charity & Kudzie
    <current wedding date / lifecycle>

    PLANNING HEALTH
    <computed readiness>

    Needs Attention
    • overdue tasks
    • pending RSVPs
    • unseated guests
    • vendor decisions
    • contracts needing action
    • payments due
    • timeline conflicts

    Planning Areas
    Tasks
    Budget
    Contributions
    Vendors
    Guests
    Seating
    Timeline

    Recent Activity
    planner update
    contribution recorded
    payment recorded
    RSVP change
    seating change
    vendor/contract change

The exact counts must come from the shadow dataset, not hard-coded screenshot text.

---

# 16. Planner module requirements

## 16.1 Tasks

Must represent:

- title;
- description;
- category;
- priority;
- status;
- blocked state;
- assignee;
- due date;
- linked vendor where applicable;
- linked milestone;
- create/edit/complete behavior in Shadow;
- search/filter.

## 16.2 Budget

Must represent:

- estimate;
- actual;
- allocated;
- paid;
- outstanding;
- category;
- due date;
- vendor link;
- funding attribution;
- contribution link;
- document/evidence metadata.

Changing a shadow contribution or payment must change the relevant budget projection.

## 16.3 Contributions

Must represent:

- contributor identity in private shadow;
- pseudonymized identity in repository fixture;
- cash;
- direct vendor payment;
- in-kind;
- pledge;
- received;
- partial;
- verified;
- allocation;
- thank-you state;
- linked budget/vendor/task.

## 16.4 Vendors

Must represent:

- vendor;
- category;
- contact metadata;
- service engagement;
- booking;
- contract status;
- payment/funding state;
- linked tasks;
- wedding-day call time;
- day-of presence where applicable.

## 16.5 Guests bridge

Plan should summarize and deep-link rather than duplicate the entire Guest workspace.

Must show:

- invited;
- attending;
- pending;
- declined;
- unseated;
- dietary/attention counts;
- household party size.

## 16.6 Seating

Must represent:

- tables;
- capacity;
- zone/type;
- assigned households;
- available seats;
- unassigned guests;
- over-capacity state;
- move/assign/unassign in Shadow.

## 16.7 Timeline

Must represent:

- time;
- event;
- duration;
- location;
- notes;
- linked vendors;
- operational state;
- day-of handoff.

Changes here must later feed Wedding Day.

---

# 17. Lifecycle-aware Home

The current native Home over-emphasizes Wedding Day even while planning is still underway.

The shadow phase should use the real wedding lifecycle to validate Home.

## Before wedding

Home emphasizes:

- wedding identity/countdown;
- needs attention;
- next planning milestone;
- task pressure;
- RSVP pulse;
- budget/payment pulse;
- vendor decisions;
- messages;
- invitation readiness;
- Wedding Day readiness summary.

## Wedding week

Home shifts toward:

- final confirmations;
- run of show;
- vendor arrival readiness;
- guest/seating readiness;
- pass readiness;
- announcements;
- operational risk.

## Wedding day

Home becomes:

- next event;
- attendance;
- gate status;
- vendor presence;
- timeline status;
- announcements;
- issues;
- Pass;
- Live.

Wedding Day is therefore a lifecycle mode of Wewed, not the definition of the entire app.

---

# 18. Ivory Floral Gold Invitation — canonical guest sequence

The invitation experience is part of the core wedding lifecycle and must be understood by every agent.

The intended sequence is:

    Guest opens Wewed invite / app / universal link
        ↓
    Wewed animated splash
        ↓
    Wewed brand payoff / identity moment
        ↓
    Customized Ivory Floral Gold invitation appears immediately
        ↓
    Guest ceremonially opens the invitation
        ↓
    Invitation displays couple, guest/household, date, venue and key details
        ↓
    RSVP action is presented before the general wedding experience
        ↓
    Guest accepts / declines according to permitted RSVP workflow
        ↓
    If attending:
        RSVP is confirmed
        ↓
        Wewed Wedding Pass is issued / becomes available
        ↓
        Guest enters the interactive wedding experience
        ↓
        Pass remains available from Guest Home / Pass
        ↓
        Programme, venue, seating and announcements remain visible
        ↓
    Wedding Day:
        guest presents Pass
        ↓
        usher scans WW2 ECDSA credential
        ↓
        signature and event entitlement validated
        ↓
        household/party capacity checked
        ↓
        attendance/check-in recorded
        ↓
        seating/table callout shown
        ↓
        attendance state becomes available to Wedding Day operations
        ↓
        guest proceeds to seating / next event / Live experience

Important UX rules:

1. The splash is not a dead waiting screen. It should feel like the start of a premium Wewed experience.
2. The customized invitation must appear before a generic couple/wedding Home for a guest who has not completed the invitation flow.
3. RSVP is the gate into the guest wedding experience, unless the guest has already responded.
4. The Wedding Pass is issued or activated from the confirmed attending relationship.
5. The Pass remains available later without forcing the guest to replay the invitation.
6. Declined/pending guests do not receive the same admission state as confirmed attending guests.
7. The interactive wedding experience and the Pass use the same guest/wedding shadow graph.
8. The Pass credential remains WW2 asymmetric ECDSA P-256/SHA-256. Do not reintroduce HMAC as the canonical scanner architecture.
9. Guest-access flows should continue to support low-friction universal links and should not require an app installation where the product allows web access.
10. Native invitation visuals should preserve the premium Ivory Floral Gold identity while using platform-native motion and accessibility.

---

# 19. Invitation shadow tests

The shadow environment must support at least these scenarios:

- invited guest opens invitation first time;
- returning guest resumes before RSVP;
- guest accepts;
- guest declines;
- guest changes allowed RSVP state if the product permits;
- household party RSVP;
- confirmed guest obtains pass;
- pass reflects table after seating assignment;
- table change updates guest experience without reissuing the invitation;
- date/venue/programme updates propagate to living experience;
- invalid/expired invitation link;
- already-confirmed invitation resumes directly to appropriate state;
- guest enters Wedding Day with pass;
- scanner accepts valid pass;
- duplicate scan is blocked;
- partial household arrival;
- capacity exceeded;
- offline gate verification;
- reconnect and audit sync.

---

# 20. First shadow write workflows

Once Planner reads are correct, the first shadow mutations should prove cross-domain behavior.

## Workflow A — Task

Planner creates or changes a task.

Expected:

- Planner list updates;
- Overview attention/readiness updates;
- Couple sees relevant task state where permitted;
- activity feed records the mutation.

## Workflow B — Contribution and budget

Contribution is recorded or allocated.

Expected:

- Contribution module updates;
- Budget funding attribution changes;
- linked vendor/item reflects the relationship;
- Couple and Planner agree.

## Workflow C — Seating

Planner assigns household to a table.

Expected:

- Seating occupancy changes;
- unassigned count changes;
- Guest view shows table;
- Wedding Pass/table callout reflects current assignment.

## Workflow D — RSVP

Guest changes RSVP in Shadow.

Expected:

- Guest record changes;
- Planner guest totals change;
- seating readiness changes;
- Pass eligibility changes.

## Workflow E — Vendor

Vendor status or service relationship changes in Shadow.

Expected:

- Planner vendor state changes;
- Vendor workspace changes;
- Wedding Day presence changes where applicable.

## Workflow F — Timeline

Planner changes timeline.

Expected:

- Planner timeline changes;
- Couple relevant schedule changes;
- Vendor/Coordinator view changes;
- Wedding Day "Next Up" changes when appropriate.

---

# 21. Role consistency qualification

The same shadow wedding must be tested through all relevant personas.

## Couple

Sees:

- planning health;
- tasks;
- budget;
- contributions;
- vendors;
- guests;
- seating;
- invitation readiness;
- Wedding Pass / Wedding Day when applicable.

## Planner

Sees:

- portfolio/wedding context;
- complete planner workspace;
- operational attention;
- client data permitted to planner;
- wedding-day command tools.

## Coordinator

Sees:

- timeline;
- operations;
- gate;
- vendor readiness;
- issues/messages.

## Vendor

Sees only permitted service/booking/job-day context.

## Usher

Sees:

- scanner;
- manifest;
- guest search;
- seating lookup;
- admission/audit state.

## Guest

Sees only their authorized invitation/wedding experience.

## Admin

Sees mobile-safe operational/governance surfaces, not an uncontrolled clone of every web-admin capability.

Cross-role assertion:

> A mutation by one authorized role must appear consistently to other authorized roles that observe the same domain.

---

# 22. Expansion order after Planner

Do not expand randomly.

After Planner proves the shadow architecture, proceed in this dependency order:

    1. Planner Overview + Tasks
    2. Budget
    3. Contributions
    4. Vendors / service engagement
    5. Guests
    6. Seating
    7. Timeline
    8. Invitation / RSVP
    9. Wedding Pass
    10. Wedding Day / Gate
    11. Live / announcements
    12. Messages
    13. Calendar / notifications
    14. Bookings
    15. Contracts
    16. Vault/documents
    17. AI / Notebook / Wedding Brief where approved
    18. Admin mobile operations

This preserves the wedding narrative and shared dependencies.

---

# 23. Whole-product shell policy

The existing shell is preserved.

Do not throw it away.

Its purpose now becomes:

- navigation skeleton;
- role resolver;
- native visual system;
- fixture-state harness;
- test harness;
- destination inventory.

As shadow integration proceeds, replace fictional screen-local values with domain repository data.

Do not rewrite a qualified screen solely because the data source changes.

Do redesign a screen when the real wedding demonstrates that its information architecture is wrong.

---

# 24. Network environment contract

Native builds must have explicit environment configuration.

Recommended values:

- fixture
- shadow
- production-read-verify [future, restricted]
- production [disabled during this plan]

Development/debug UI should show the active environment clearly.

Shadow builds must never silently fall back to production.

If Shadow is unavailable, the app should show a clear Shadow connectivity error rather than query production.

---

# 25. Shadow authentication model

Do not clone production passwords or sessions.

Recommended:

- shadow-only accounts;
- role mappings generated from snapshot membership;
- test authentication provider or shadow identity service;
- deterministic persona shortcuts available only in development/test builds;
- no production session token reuse.

Charity & Kudzie / Eleven Eleven Testing relationships may be represented by shadow identities tied to imported records.

---

# 26. Data integrity checks after import

Every snapshot import must validate:

- wedding exists;
- couple membership exists;
- planner membership exists;
- no dangling foreign keys;
- guest/household counts;
- seating capacity consistency;
- task counts/status distribution;
- budget totals reconcile;
- contributions reconcile to imported allocation data;
- vendor engagements have valid vendor references;
- timeline items ordered;
- invitation records reference valid guest/wedding;
- pass eligibility can be derived;
- no production secrets present;
- external side-effect adapters disabled.

Import failure blocks native testing.

---

# 27. Security requirements

## Pass security

Canonical pass remains:

- WW2;
- ECDSA P-256;
- SHA-256;
- scanner verifies using public material only;
- no private signing key on usher scanners.

## Shadow secrets

Shadow has independent credentials.

Never copy production private keys.

## PII

Sanitized fixtures contain no unnecessary real PII.

## Logs

Logs must not print:

- production tokens;
- private guest contact details;
- contract contents;
- payment secrets.

## Environment mistakes

Add a hard environment guard so a shadow/debug build cannot write to a production hostname.

A hostname/tenant allowlist is preferred.

---

# 28. Testing ladder

Every domain moves through the following evidence ladder:

    DISCOVERED
    → SNAPSHOT-MAPPED
    → SANITIZED-FIXTURE
    → SHADOW-READ
    → SHADOW-WRITE
    → CROSS-DOMAIN-CONSISTENT
    → NATIVE-TESTED
    → E2E-QUALIFIED
    → PRODUCTION-READ-VERIFIED [later]
    → PARITY-PASS [later production integration/release gate]

A rendered screen never earns PARITY-PASS.

---

# 29. Acceptance gates by phase

## Phase 0 — repository governance

PASS requires:

- local/remote aligned;
- correct branch;
- clean worktree;
- protected active workspace untouched;
- production integration still closed.

## Phase 1 — live discovery

PASS requires:

- Charity & Kudzie wedding positively identified;
- Eleven Eleven Testing planner relationship confirmed;
- domains mapped;
- no production write performed;
- unresolved data gaps documented.

## Phase 2 — privacy/snapshot contract

PASS requires:

- field classification completed;
- secret exclusion list completed;
- snapshot manifest format defined;
- read-only export tested.

## Phase 3 — sanitized fixture

PASS requires:

- fixture derived from real relationship topology;
- no prohibited PII/secrets in Git;
- iOS and Android can load it;
- Planner summary reflects snapshot-derived structure.

## Phase 4 — Shadow backend

PASS requires:

- separate database;
- separate auth;
- side-effect firewall;
- no production write credentials;
- import integrity checks;
- explicit environment indicator;
- reset mechanism.

## Phase 5 — Planner shadow reads

PASS requires:

- Overview;
- Tasks;
- Budget;
- Contributions;
- Vendors;
- Guests bridge;
- Seating;
- Timeline;

all render from Shadow on both platforms.

## Phase 6 — Planner shadow writes

PASS requires:

- safe mutations;
- cross-module consistency;
- audit trail;
- resetability;
- no external side effect.

## Phase 7 — Invitation / Pass journey

PASS requires:

- splash;
- Ivory Floral Gold invitation;
- RSVP;
- Pass issuance;
- Pass presentation;
- valid gate scan;
- duplicate handling;
- household handling;
- seating callout;
- attendance update;

all use the same shadow wedding graph.

## Phase 8 — multi-role consistency

PASS requires:

- Couple;
- Planner;
- Coordinator;
- Vendor;
- Usher;
- Guest;
- Admin;

exercise appropriate shadow surfaces and observe consistent state.

## Phase 9 — whole-product expansion

PASS is domain-by-domain, not global by assumption.

## Phase 10 — production-read comparison

Not part of initial implementation.

Requires separate authorization.

---

# 30. Stop conditions

Stop immediately if any of the following occurs:

- production write detected;
- shadow attempts to call real guest/vendor communications;
- payment gateway in live mode;
- live contract-signing action triggered;
- production secret appears in exported data;
- real private data committed to Git;
- native client is configured with direct production DB credentials;
- reverse sync path exists;
- local/remote repository divergence is discovered mid-task;
- active /wewed workspace is modified during isolated mobile work;
- pass verification regresses to canonical HMAC;
- agent cannot prove which environment it is testing;
- fixture/shadow data becomes inconsistent across iOS and Android;
- test result is being claimed from an uncommitted/unpushed tree.

---

# 31. Required evidence for every completed shadow milestone

Every report must include:

- branch;
- local HEAD;
- remote HEAD;
- divergence;
- worktree state;
- production main reference SHA;
- snapshot ID;
- shadow environment ID;
- domains imported;
- privacy/sanitization confirmation;
- side-effect firewall confirmation;
- iOS test result;
- Android test result;
- iOS Maestro result;
- Android Maestro result;
- production workspace touched: YES/NO;
- production write performed: YES/NO;
- known blockers;
- exact next phase.

Screenshots are useful, but screenshots alone are not evidence of data parity.

---

# 32. Manual agent workflow

Any future agent taking over this sprint should do the following in order:

1. Read this document completely.
2. Read MASTER_MOBILE_SPRINT_PLAN.md.
3. Read NATIVE_PRODUCT_AUTHORITY_LEDGER.md.
4. Read NATIVE_ROLE_CAPABILITY_MATRIX.md.
5. Read NATIVE_INFORMATION_ARCHITECTURE.md.
6. Read NATIVE_CONTRACT_GAP_REGISTER.md.
7. Align local and remote repository state.
8. Confirm current phase and last accepted gate.
9. Inspect the current Charity & Kudzie shadow snapshot manifest.
10. Continue only from the first incomplete acceptance gate.
11. Never jump to production integration because a native screen looks complete.
12. Preserve evidence and exact tested commit before reporting PASS.

---

# 33. Relationship to existing plans

This plan extends, not replaces, the permanent architecture rules in MASTER_MOBILE_SPRINT_PLAN.md.

The Master Plan still governs:

- true native implementation;
- iOS/Android parity;
- isolation;
- release qualification;
- Wedding Pass security;
- production integration gate.

This plan specifically governs the transition from:

    fixture-only whole-product shell

to:

    realistic shadow-backed native Wewed

using one active wedding as the reference scenario.

Where an older document conflicts with this plan on the shadow-real-wedding sequence, this plan governs the current sprint.

Where an older document proposes HMAC as the canonical Wedding Pass verifier, the WW2 ECDSA architecture governs.

---

# 34. Immediate implementation sequence after plan approval

The next implementation task after this documentation is accepted is not "connect native to production."

It is:

## Task A — Read-only real wedding discovery

Inspect the Charity & Kudzie / Eleven Eleven Testing production relationship and produce a structured discovery report containing:

- authoritative wedding ID;
- planner organization/profile ID;
- couple membership IDs;
- domain counts;
- available planner modules;
- relationship graph;
- sensitive-data classification;
- extraction feasibility;
- missing/ambiguous records.

No production writes.

## Task B — Snapshot and sanitization design

Create the export query/API plan and sanitization mapping.

No native UI changes required unless the discovery exposes a clear missing capability.

## Task C — Private production snapshot

Execute read-only export with manifest.

## Task D — Sanitized repository fixture

Generate private-to-sanitized derivative and load it on both native platforms.

## Task E — Planner real-shape redesign

Refine Planner Overview and modules based on the real snapshot.

Stop for visual/product-owner review.

## Task F — Shadow environment

Only after that review, create the mutable shadow backend/database and connect Planner repositories.

---

# 35. Sprint success definition

This sprint succeeds when Wewed Native stops feeling like:

> Wedding Day plus representative Wewed screens

and begins to feel like:

> the real Wewed wedding operating system, rendered natively and safely against a current realistic wedding graph.

The Charity & Kudzie wedding is the reference scenario, not a production playground.

The Eleven Eleven Testing planner account is the real-world planner context, not an excuse to test against live records.

The shell remains valuable, but the next level of quality comes from data relationships, lifecycle behavior, and cross-role consistency.

The desired end state is a native application that can later be plugged into production with minimal product redesign because its screens, repositories, domain relationships and role behavior have already been validated against a realistic Wewed wedding in Shadow.

---

# 36. Current authorization boundary

Authorized now:

- documentation;
- read-only production discovery after explicit task start;
- export design;
- sanitized fixture design;
- shadow architecture;
- isolated native implementation;
- isolated tests.

Not authorized now:

- production database writes;
- production API writes;
- live guest/vendor contact;
- live payment;
- live contract signing;
- native production release;
- merge of native work into main.

Production integration remains a later, separately approved milestone.
