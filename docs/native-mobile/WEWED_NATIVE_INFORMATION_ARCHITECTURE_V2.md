# Wewed Native Information Architecture V2

**Document ID:** WW-NATIVE-IA-V2-2026-09-20-01  
**Status:** AUTHORITATIVE NAVIGATION & ROLE TAXONOMY SPECIFICATION  
**Applies to:** iOS SwiftUI + Android Jetpack Compose  
**Scope:** Native mobile and tablet information architecture, role navigation, cross-role utilities, entity ownership, context, deep links, and data-flow boundaries  
**Supersedes for current navigation design:** `NATIVE_INFORMATION_ARCHITECTURE.md` while preserving that document as historical architecture context  
**Governing architecture:** `MASTER_MOBILE_SPRINT_PLAN.md`

---

## 0. Executive mandate

Wewed Native is the mobile expression of the complete Wewed wedding operating platform.

It is not a reduced Wedding Pass application, not a PWA wrapper, and not a collection of unrelated role dashboards.

The native product must let every stakeholder perform the work appropriate to their role while moving through a coherent wedding data graph on a phone or tablet.

The central information-architecture rule is:

> **Bottom navigation exposes 4-5 major workspaces. Depth lives inside those workspaces. Actions do not become navigation. Role permissions determine what exists.**

The desktop/PWA remains the functional benchmark for capability depth. Native mobile reorganizes those capabilities for short sessions, thumb navigation, smaller viewports, offline use, and role-specific journeys.

The current Android Wewed visual language is the approved visual reference implementation for shared native surfaces. iOS and Android must implement the same product contract and design system while preserving platform-native mechanics where appropriate.

---

# 1. Shared principles

## 1.1 Maximum five primary destinations

Every role shell should normally expose **4 or 5 bottom destinations**.

Do not solve product depth by adding 7-10 permanent tabs.

Use four navigation levels:

```text
LEVEL 0 — CONTEXT
Role + current wedding/client + notifications + account

LEVEL 1 — PRIMARY NAVIGATION
4-5 bottom destinations

LEVEL 2 — WORKSPACE NAVIGATION
Sections, worksheets, tabs, chips, cards, or contextual menus

LEVEL 3 — ENTITY DETAIL
Guest, vendor, task, budget item, contract, table, programme item, case, etc.

LEVEL 4 — ACTIONS
Create, edit, import, export, print, scan, assign, approve, message, check in, etc.
```

---

## 1.2 Context must always be unambiguous

Every authenticated role shell must make these concepts discoverable and understandable:

- current role;
- current wedding/client/job;
- current actor/account;
- notification state;
- account/role switch;
- wedding/client switch where the role permits it.

Examples:

```text
My Wedding
Charity & Kudzie
```

```text
Planner Workspace
Charity & Kudzie
Eleven Eleven Testing
```

```text
Gate Team
Charity & Kudzie
Gate A
```

Users must never need developer knowledge to understand which workspace they are in.

---

## 1.3 Role determines navigation

The same app binary may contain many capabilities, but navigation is generated from authorized capabilities.

Never expose a destination merely because its code exists.

A user with one authorized role should enter that role directly.

A user with multiple legitimate roles may receive a simple role chooser showing **only authorized roles**.

Development persona switching must not be presented as production user navigation.

---

## 1.4 Destination is not action

These are destinations:

- Plan;
- Guests;
- Wedding Day;
- Clients;
- Jobs;
- Admissions;
- Audit.

These are actions:

- Add Guest;
- Add Task;
- Scan Pass;
- Import;
- Export;
- Print;
- Send Invitation;
- Create Contract;
- Check In;
- Assign Table;
- Message Vendor.

Actions belong in toolbars, floating actions, contextual menus, action sheets, or detail screens.

Do not consume primary navigation slots with actions.

---

## 1.5 More is not a junk drawer

`More` contains lower-frequency role utilities.

It must not become the place where missing core product domains are hidden.

A feature used frequently in the role's normal work should live in a primary workspace or its Level-2 navigation.

---

## 1.6 Capability parity, not desktop-layout parity

Desktop can use:

- wide sidebars;
- persistent worksheet selectors;
- multi-column dashboards;
- action toolbars;
- dense tables.

Native mobile should translate those capabilities:

```text
desktop sidebar          → primary workspace + nested navigation
desktop submenu          → worksheet selector / chips / nested stack
desktop toolbar          → contextual action sheet
desktop multi-column UI  → vertical cards / grouped lists
desktop context selector → compact top context card / picker
```

The native product should achieve functional parity without copying desktop layout literally.

---

## 1.7 One design system, different role products

Couple, Planner, Guest, Vendor, Gate, Coordinator and Admin are different jobs.

They may have different information architecture.

They must still look and behave like the same Wewed product.

Shared design language includes:

- ivory / champagne / emerald palette;
- Wewed serif hierarchy;
- card geometry;
- border and hairline treatment;
- icon container treatment;
- ornamentation;
- media language;
- bottom-navigation styling;
- status semantics;
- spacing rhythm.

The Android reference implementation remains the current visual authority for shared native surfaces.

---

# 2. Canonical product domains

All navigation should be understood as controlled views into these shared domains.

## 2.1 Wedding planning

- Overview
- Tasks
- Budget
- Contributions
- Vendors
- Seating
- Timeline / Programme
- Documents / Contracts

## 2.2 Guests and invitations

- Guest roster
- Households / parties
- RSVP
- Invitations
- QR / Pass
- Seating assignment
- Guest communication
- Dietary / accessibility information

## 2.3 Wedding Day

- Run sheet
- Programme
- Gate
- Admissions
- Check-in
- Vendor arrivals
- Coordinator tasks
- Incidents
- Notes
- Offline status

## 2.4 Couple wedding content

- Wedding Profile
- Our Story
- Gallery
- Venue
- Maps
- Honeymoon / contribution information
- Public wedding details

## 2.5 Planner operations

- Client weddings
- Client profiles
- Team Hub
- Daily Ops
- Invitations & QR
- Wedding Day
- Intelligence
- Planner Actions

## 2.6 Vendor operations

- Assigned weddings / jobs
- Services
- Deliverables
- Schedule
- Contract
- Payment
- Files
- Communication

## 2.7 Communications

- Messages
- Notifications
- Announcements
- Broadcasts
- Support

## 2.8 Intelligence

- Planning recommendations
- Risk / readiness flags
- Budget insight
- Schedule insight
- Guest / RSVP insight
- Vendor readiness
- Operational exceptions

## 2.9 Administration

- Accounts
- Roles
- Access
- Support cases
- Audit log
- System health
- Configuration
- Integrations

---

# 3. Primary role taxonomy

| Role | Primary bottom navigation |
|---|---|
| **Couple** | **Home · Plan · Guests · Wedding Day · More** |
| **Planner** | **Workspace · Clients · Daily Ops · Wedding Day · More** |
| **Guest** | **Home · Invitation · Pass · Wedding Day · More** |
| **Vendor** | **Home · Jobs · Schedule · Messages · More** |
| **Gate Team / Usher** | **Scan · Admissions · Guests · Incidents · More** |
| **Coordinator** | **Today · Run Sheet · Team · Wedding Day · More** |
| **Support / Admin** | **Dashboard · Cases · Accounts · Audit · More** |

The labels and order must match across Android and iOS for the same role.

Platform glyphs may differ slightly where SF Symbols and Material icons express the same concept.

---

# 4. Couple taxonomy

## 4.1 Primary navigation

```text
Home
Plan
Guests
Wedding Day
More
```

The Couple experience remains wedding-focused, personal, elegant and non-technical.

### Home

Purpose: answer “How is our wedding doing and what needs our attention?”

Contents:

- wedding hero / identity;
- countdown;
- planning progress;
- urgent alerts;
- upcoming tasks;
- budget snapshot;
- guest snapshot;
- vendor snapshot;
- next milestone;
- quick actions;
- announcements.

### Plan

Level-2 taxonomy:

```text
Overview
Tasks
Budget
Contributions
Vendors
Seating
Timeline
Documents
```

Recommended composition:

- worksheet selector;
- planning progress;
- attention items;
- module summaries;
- contextual create/edit actions.

### Guests

Level-2 taxonomy:

```text
Guest List
RSVP
Invitations
Groups / Households
Seating
Messages
Passes / QR
```

Core actions:

- Add Guest
- Import Guests
- Send / Resend Invitation
- Assign Seating
- Message
- View Pass

### Wedding Day

Level-2 taxonomy:

```text
My Pass
Programme
Venue & Maps
Key Contacts
Vendor Status
Announcements
Wedding-day Checklist
```

Wedding Day can increase the prominence of Pass and live operational information as the wedding approaches.

### More

```text
Wedding Profile
Our Story
Gallery
Honeymoon
Documents
Settings
Help & Support
Account
```

Do not expose professional Planner tooling here unless the account also has Planner authorization and explicitly switches role.

---

# 5. Professional Planner taxonomy

## 5.1 Primary navigation

```text
Workspace
Clients
Daily Ops
Wedding Day
More
```

The Planner shell is a professional multi-client workspace, not a renamed Couple shell.

### Workspace

The selected wedding is persistent context.

Level-2 worksheets:

```text
Overview
Tasks
Budget
Guests
Vendors
Contributions
Seating
Timeline
Documents
```

Each worksheet must read and mutate the same selected wedding graph.

No worksheet may silently switch to fixture data or a different wedding.

### Clients

```text
Active Weddings
Upcoming Weddings
Enquiries
Archived Weddings
Client Profiles
Team Assignment
```

Purpose:

- select/switch wedding;
- resolve client status;
- inspect planner engagement;
- manage team assignment;
- enter wedding workspace.

### Daily Ops

```text
Today
Overdue
Approvals
Messages
Upcoming Deadlines
Vendor Follow-ups
Guest Issues
Payments Requiring Attention
Team Activity
```

Purpose: make Wewed useful as the Planner's morning operational dashboard.

### Wedding Day

```text
Run Sheet
Programme
Gate / Admissions
Vendor Arrivals
Coordinator Tasks
Guest Issues
Incidents
Live Notes
Emergency Contacts
Offline Status
```

### More

```text
Team Hub
Client Profile
Invitations & QR
Intelligence
Files / Documents
Planner Actions
Account
Settings
Help & Support
```

### Planner Actions

Planner Actions are contextual operations, not bottom tabs:

```text
Print / Arrange / Select
Refresh
Switch Worksheet
Templates
Export
Import
Recent Imports
Edit Wedding Details
```

Where the native platform offers a better system interaction, use it while preserving the capability.

---

# 6. Guest taxonomy

## 6.1 Primary navigation

```text
Home
Invitation
Pass
Wedding Day
More
```

Guest navigation is deliberately narrow and privacy-preserving.

### Home

- couple identity;
- countdown;
- RSVP status;
- important announcement;
- venue summary;
- quick pass access.

### Invitation

```text
Invitation
RSVP
Party Members
Dietary / Accessibility
Message to Couple
Contribution / Memory
```

### Pass

```text
Wedding Pass
QR
Party Size
Table
Admission State
Open in Maps
```

### Wedding Day

```text
Programme
Venue
Maps
Table
Announcements
Contacts
Gallery / Live Wall (if enabled)
```

### More

```text
Our Story
Gallery
Contribution / Gift Info
Help
Account
Privacy
```

Guest must not gain access to:

- complete guest roster;
- whole-wedding budget;
- Planner Workspace;
- vendor private data;
- administrative controls.

---

# 7. Vendor taxonomy

## 7.1 Primary navigation

```text
Home
Jobs
Schedule
Messages
More
```

### Home

- today's jobs;
- upcoming wedding;
- pending actions;
- outstanding documents;
- payment state;
- new messages.

### Jobs

Each engagement detail may include:

```text
Service Details
Deliverables
Tasks
Client / Planner Contacts
Venue
Contract
Payment
Files
Notes
```

Vendor sees only its own engagement and permitted wedding details.

### Schedule

```text
Calendar
Arrival Time
Setup
Service Window
Breakdown
Dependencies
```

### Messages

Authorized communication with:

- Planner;
- Couple;
- Coordinator.

No unrelated guest or vendor private conversations.

### More

```text
Company Profile
Services
Contracts
Payments
Files
Settings
Support
Account
```

---

# 8. Gate Team / Usher taxonomy

## 8.1 Primary navigation

```text
Scan
Admissions
Guests
Incidents
More
```

### Scan

Primary gate scanner.

Requirements:

- fast camera launch;
- clear result state;
- offline verification;
- duplicate handling;
- party-size handling;
- manual fallback.

### Admissions

```text
Checked In
Not Arrived
Partial Parties
Duplicate Scans
Exceptions
Manual Admission
```

### Guests

Operational lookup only:

- name;
- party size;
- table;
- RSVP;
- admission status.

Do not expose budget, contributions, private planner notes or unrelated PII.

### Incidents

```text
Admission Exception
Lost Pass
Guest Dispute
Accessibility Assistance
Security Note
Coordinator Escalation
```

### More

```text
Gate Assignment
Offline Status
Sync Status
Venue Map
Help
Account
```

---

# 9. Coordinator taxonomy

## 9.1 Primary navigation

```text
Today
Run Sheet
Team
Wedding Day
More
```

### Today

- next programme milestone;
- open tasks;
- late vendors;
- gate issues;
- guest issues;
- alerts.

### Run Sheet

- chronological programme;
- owner;
- location;
- dependencies;
- status;
- delays;
- notes.

### Team

```text
Tasks
Vendors
Ushers
Staff
Assignments
Contacts
```

### Wedding Day

```text
Gate
Admissions
Vendor Arrivals
Venue Zones
Incidents
Announcements
Programme Status
```

### More

```text
Documents
Notes
Maps
Offline
Support
Account
```

---

# 10. Support / Admin taxonomy

## 10.1 Primary navigation

```text
Dashboard
Cases
Accounts
Audit
More
```

Admin/support is privileged and must remain explicitly auditable.

### Dashboard

- system alerts;
- open cases;
- escalations;
- recent changes;
- problem weddings;
- integration failures.

### Cases

- support requests;
- disputes;
- planner/vendor/couple cases;
- wedding-day escalations;
- resolution history.

### Accounts

```text
Couples
Planners
Vendors
Guests
Access
Role Memberships
```

### Audit

```text
Data Changes
Access Events
Payments
Contracts
Check-ins
Admin Actions
```

### More

```text
System Health
Integrations
Templates
Configuration
Announcements
Help
Admin Profile
```

---

# 11. Cross-role utilities

These are shared services, not necessarily bottom destinations.

## 11.1 Notifications

Available from a consistent top-level affordance.

Notifications are role-scoped and context-aware.

## 11.2 Account

Contains:

- signed-in identity;
- authorized roles;
- role switch where applicable;
- security;
- privacy;
- sign out.

## 11.3 Wedding / client context switch

Allowed only for roles with multiple wedding contexts.

Examples:

- Planner: multiple clients;
- Admin: authorized system scope;
- Vendor: assigned jobs;
- Coordinator: assigned weddings.

Couple/Guest typically operate in a single wedding context.

## 11.4 Search

Search scope is role-aware.

Examples:

- Couple: guests, tasks, vendors;
- Planner: clients, guests, tasks, vendors;
- Vendor: jobs/files;
- Gate: guest/admission lookup;
- Admin: cases/accounts.

## 11.5 Messages

Messages must respect wedding, engagement and role boundaries.

## 11.6 Help & Support

Every role needs a predictable support path.

## 11.7 Maps

Venue/directions actions derive from the active wedding/event graph.

## 11.8 Offline / sync status

Visible when the workflow depends on locally cached data or queued mutations.

---

# 12. Entity ownership map

Every important domain entity must have a clear navigation home.

| Entity | Primary home | Secondary access |
|---|---|---|
| Wedding | Couple Home / Planner Workspace | Client picker, Account context |
| PlannerTask | Plan / Workspace → Tasks | Daily Ops / Coordinator Today |
| BudgetItem | Plan / Workspace → Budget | Planner Daily Ops alerts |
| GuestContribution | Plan / Workspace → Contributions | Guest Invitation/More where permitted |
| Guest | Couple Guests / Planner Workspace → Guests | Gate operational lookup |
| Household / Party | Guests | Invitation / Pass |
| Invitation | Guests → Invitations / Guest Invitation | Planner More → Invitations & QR |
| WeddingPass | Wedding Day / Guest Pass | Guests → Passes / QR |
| Vendor | Plan / Workspace → Vendors | Coordinator Team |
| ServiceEngagement | Vendor detail / Planner Vendors | Vendor Jobs |
| Contract | Documents / Vendor engagement | Vendor More → Contracts |
| SeatingTable | Plan / Workspace → Seating | Guest Pass (own table), Gate lookup |
| ProgrammeItem | Plan / Workspace → Timeline | Wedding Day / Run Sheet |
| Incident | Wedding Day | Admin Cases / Audit |
| Planner Client | Planner Clients | Planner Workspace context |
| SupportCase | Admin Cases | Role Help & Support |
| AuditRecord | Admin Audit | Authorized incident/check-in detail |
| Notification | Global utility | Relevant entity detail |
| MessageThread | Messages | Contextual entity detail |

If an entity cannot be assigned a clear home, its navigation design is incomplete.

---

# 13. Context and data-pipeline contract

Navigation must not create disconnected copies of the same data.

## 13.1 Required active context

Every repository-backed screen should resolve from an explicit context envelope such as:

```text
actorId
activeRole
activeWeddingId
activeClientId?       // Planner/Admin contexts
activeEngagementId?   // Vendor context
activeGateId?         // Gate context
environment
```

Not every role uses every field.

## 13.2 Single wedding graph

Within one wedding context:

```text
Wedding
 ├── Tasks
 ├── BudgetItems
 ├── Guests
 │    ├── RSVP
 │    ├── Household/Party
 │    ├── Seating
 │    ├── Invitation
 │    └── Pass
 ├── Vendors
 │    └── ServiceEngagements
 ├── Contributions
 ├── SeatingTables
 ├── ProgrammeItems
 ├── Documents/Contracts
 └── WeddingDay Operations
```

A role navigation transition must preserve the wedding identity.

For example:

```text
Planner Clients
→ select Charity & Kudzie
→ Workspace / Guests
→ open guest
→ seating
```

must never switch to a fixture/sanitized wedding between routes.

## 13.3 Repository rule

A screen must consume the canonical domain repository/view model for its environment.

Do not create a second screen-local fixture merely to populate UI.

## 13.4 Entitlement gate

Every route resolves:

```text
requested route
→ authenticated actor
→ active role
→ active context
→ capability/entitlement check
→ repository request
→ UI state
```

Do not rely on hidden navigation alone as security.

## 13.5 Mutation path

Writes follow:

```text
UI action
→ role/capability validation
→ domain command
→ repository
→ local optimistic/offline state where permitted
→ backend/sandbox adapter
→ result/error
→ shared state refresh
```

No screen should mutate a disconnected local copy and leave sibling workspaces stale.

## 13.6 Shadow safety

During Private Real Shadow qualification:

- production-derived data may be read from the protected snapshot;
- native writes never flow back to production;
- private PII is not committed to Git;
- private screenshots remain local;
- environment provenance must remain testable.

---

# 14. Route and deep-link principles

Deep links should target canonical entities/workspaces, then pass through role and entitlement resolution.

Examples:

```text
wewed://wedding/{weddingId}/plan/tasks
wewed://wedding/{weddingId}/guests
wewed://wedding/{weddingId}/invitation/{token}
wewed://wedding/{weddingId}/pass/{token}
wewed://wedding/{weddingId}/day/programme
wewed://planner/clients/{weddingId}
wewed://vendor/jobs/{engagementId}
wewed://gate/{gateId}/scan
wewed://admin/cases/{caseId}
```

A deep link must never bypass entitlement checks.

If a user is unauthorized:

- explain the access boundary;
- do not leak destination data;
- provide a safe return route.

---

# 15. Mobile and tablet behavior

## 15.1 Phone

Use the full role bottom navigation described above.

Nested workspaces use navigation stacks, chips, sheets and cards.

## 15.2 Tablet

The same taxonomy remains authoritative.

Tablet may promote Level-2 navigation into:

- side rail;
- split view;
- persistent worksheet column.

Do not create a different tablet taxonomy.

The information architecture stays stable while the presentation adapts.

---

# 16. Android / iOS parity contract

For the same role:

- same bottom labels;
- same bottom order;
- same destination semantics;
- same entity ownership;
- same capability gates;
- same workflow outcomes.

Platform-specific differences may include:

- icon glyph geometry;
- native back mechanics;
- sheet behavior;
- share sheets;
- Apple Maps vs Android Maps intents;
- accessibility APIs;
- safe-area/system-bar spacing.

A feature is not cross-platform complete until both native runtimes demonstrate it.

---

# 17. Visual-system relationship

Current visual reference files:

## Android

```text
apps/android/app/src/main/java/pro/wewed/app/theme/WeddingIdentityStyle.kt
apps/android/app/src/main/java/pro/wewed/app/ui/home/WeddingReferenceHomeScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/planner/WeddingReferencePlannerScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/guests/WeddingReferenceGuestsScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/invitation/IvoryInvitationScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/pass/WeddingReferencePassScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/more/WeddingReferenceMoreScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/roles/RoleWorkspaces.kt
```

Primary Android media:

```text
apps/android/app/src/main/res/drawable/hero_wedding.png
apps/android/app/src/main/res/drawable/ornament_frame.png
```

## iOS

```text
apps/ios/Wewed/Theme/WeddingIdentityStyle.swift
apps/ios/Wewed/Views/Home/WeddingReferenceHomeView.swift
apps/ios/Wewed/Views/Planner/WeddingReferencePlannerView.swift
apps/ios/Wewed/Views/Guests/WeddingReferenceGuestsView.swift
apps/ios/Wewed/Views/Invitation/IvoryInvitationView.swift
apps/ios/Wewed/Views/Pass/WeddingReferencePassView.swift
apps/ios/Wewed/Views/Shared/WeddingReferenceMoreView.swift
apps/ios/Wewed/Views/Roles/RoleWorkspaces.swift
```

Primary iOS media:

```text
apps/ios/Wewed/Resources/hero-wedding.png
apps/ios/Wewed/Resources/ornament-frame.png
```

Role taxonomies may differ. The Wewed visual system must not.

---

# 18. Role journey maps

Navigation should support end-to-end journeys, not only pages.

## Couple

```text
Create / join wedding
→ Plan
→ Guests
→ Invitations
→ Vendor / budget progress
→ Wedding Day
→ Post-wedding memories
```

## Planner

```text
Enquiry
→ Client
→ Wedding Workspace
→ Planning
→ Invitations
→ Readiness
→ Wedding Day
→ Closeout
```

## Guest

```text
Invitation
→ RSVP
→ Pre-wedding information
→ Pass
→ Wedding Day
→ Gallery / Memories
```

## Vendor

```text
Booking / assignment
→ Accept service
→ Contract
→ Schedule
→ Deliver
→ Payment
→ Completion
```

## Gate

```text
Load assignment
→ Sync manifest
→ Scan / search
→ admit / partial / exception
→ escalate incident
→ reconcile offline logs
```

## Coordinator

```text
Prepare run sheet
→ assign team
→ monitor arrivals
→ execute programme
→ resolve incidents
→ close operations
```

## Admin

```text
Receive case / alert
→ inspect account/wedding
→ review audit trail
→ perform authorized support action
→ record resolution
```

---

# 19. Accessibility and non-technical-user rules

Every role taxonomy must support:

- 44-48pt/dp practical touch targets;
- clear text labels for important actions;
- text scaling;
- screen-reader semantics;
- no status represented by color alone;
- clear Back/Home behavior;
- plain-language role labels;
- predictable Account/Help access;
- confirmations for destructive or financial operations;
- minimal requirement for users to understand Wewed internal terminology.

---

# 20. Definition of IA complete

A role's native IA is complete only when:

```text
Primary bottom navigation defined
Level-2 workspaces defined
Core entities have homes
Cross-role utilities resolved
Role boundaries tested
Deep links entitlement-gated
Data context preserved across routes
Android runtime navigation verified
iOS runtime navigation verified
Phone layout verified
Tablet adaptation defined
Accessibility verified
No More-junk-drawer regression
No action-as-tab regression
No fixture/data-pipeline leak
```

---

# 21. Migration principle

This V2 is an **upgrade of the existing native mobile application**, not a visual or architectural reset.

Agents must:

- preserve existing working screens;
- preserve approved Android Wewed visual styling;
- preserve iOS functionality already ahead of Android;
- reuse existing repositories/view models;
- move screens into the correct role/workspace taxonomy;
- add missing navigation links and contextual routes;
- expand incomplete workspaces;
- remove role leakage;
- avoid duplicate data pipelines.

Do not rewrite functioning domain logic simply to satisfy a navigation diagram.

---

# 22. Production integration boundary

IA V2 can be fully implemented in Shadow without production writes.

The transition to production remains a separate authorized phase.

Before production integration, require:

- Android/iOS IA parity;
- role-capability closure;
- Private Real Shadow fidelity;
- actual iOS Simulator qualification;
- no role data leaks;
- exact environment provenance;
- clean mobile branch;
- explicit integration readiness report.

---

# 23. Authoritative bottom-navigation summary

```text
COUPLE
Home | Plan | Guests | Wedding Day | More

PLANNER
Workspace | Clients | Daily Ops | Wedding Day | More

GUEST
Home | Invitation | Pass | Wedding Day | More

VENDOR
Home | Jobs | Schedule | Messages | More

GATE TEAM
Scan | Admissions | Guests | Incidents | More

COORDINATOR
Today | Run Sheet | Team | Wedding Day | More

SUPPORT / ADMIN
Dashboard | Cases | Accounts | Audit | More
```

This is the V2 Level-1 navigation contract.

Level-2 and deeper navigation is defined in the role sections above.
