# Wewed Native IA V2 — Implementation Playbook

**Document ID:** WW-NATIVE-IA-V2-IMPLEMENTATION-2026-09-20-01  
**Companion specification:** `WEWED_NATIVE_INFORMATION_ARCHITECTURE_V2.md`  
**Purpose:** Step-by-step build directive for agents implementing IA V2 without regressing the current native product, role boundaries, design system, or wedding data graph.

---

# 1. Implementation objective

Upgrade the existing Wewed native application so that every authorized role can reach the depth of the Wewed desktop/PWA product through a mobile-native taxonomy.

Do not rebuild the application from scratch.

The current native product already contains significant UI, role, Wedding Pass, Shadow, planning, guest, vendor, seating, timeline and invitation work.

The implementation task is to:

1. preserve those capabilities;
2. organize them under IA V2;
3. connect missing routes;
4. expand incomplete workspaces;
5. preserve one canonical data pipeline;
6. enforce least privilege;
7. verify the same taxonomy on Android and iOS.

---

# 2. Gate 0 — repository and branch alignment

Before code inspection:

```bash
git fetch origin --prune
git branch --show-current
git rev-parse HEAD
git rev-parse <remote tracking ref>
git rev-list --left-right --count HEAD...<remote tracking ref>
git status --short
```

Never discard an active or inherited worktree with:

```bash
git reset --hard
git checkout .
git clean -fd
```

without explicit authorization.

The protected web/PWA workspace remains read-only during this native sprint.

---

# 3. Step 1 — inventory existing role shells

Audit existing Android and iOS role containers.

Primary locations include:

## Android

```text
apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/roles/RoleWorkspaces.kt
apps/android/app/src/main/java/pro/wewed/app/state/
```

## iOS

```text
apps/ios/Wewed/Views/RootView.swift
apps/ios/Wewed/Views/Roles/RoleWorkspaces.swift
apps/ios/Wewed/App/
```

Create an internal matrix:

```text
Role
Current bottom destinations
Existing screens
Missing V2 destinations
Existing data source
Current authorization path
Android status
iOS status
```

Do not modify UI until this inventory is complete.

---

# 4. Step 2 — freeze role navigation contract

Implement the exact V2 primary topology:

```text
Couple:      Home | Plan | Guests | Wedding Day | More
Planner:     Workspace | Clients | Daily Ops | Wedding Day | More
Guest:       Home | Invitation | Pass | Wedding Day | More
Vendor:      Home | Jobs | Schedule | Messages | More
Gate Team:   Scan | Admissions | Guests | Incidents | More
Coordinator: Today | Run Sheet | Team | Wedding Day | More
Admin:       Dashboard | Cases | Accounts | Audit | More
```

Android and iOS must use the same labels, order and semantics for a given role.

Do not yet implement all detail screens; first make role routing deterministic.

---

# 5. Step 3 — define explicit route identifiers

Create/normalize route enums/types rather than stringly-typed navigation scattered through views.

Recommended conceptual structure:

```text
RoleRoute
 ├── CoupleRoute
 ├── PlannerRoute
 ├── GuestRoute
 ├── VendorRoute
 ├── GateRoute
 ├── CoordinatorRoute
 └── AdminRoute
```

Level-2 routes should also be typed.

Examples:

```text
PlannerWorkspaceRoute.overview
PlannerWorkspaceRoute.tasks
PlannerWorkspaceRoute.budget
PlannerWorkspaceRoute.guests
PlannerWorkspaceRoute.vendors
...
```

The exact language-specific representation may differ between Swift and Kotlin.

The product semantics may not.

---

# 6. Step 4 — establish one navigation context envelope

Every route transition should preserve explicit context.

At minimum model:

```text
actor
activeRole
activeWedding
environment
```

Add optional scoped context only where required:

```text
activeClient
activeEngagement
activeGate
```

Do not pass private domain records through unrelated screens as ad-hoc global variables.

Resolve them through canonical state/repositories by ID/context.

---

# 7. Step 5 — wire Couple IA

Upgrade the existing Couple shell instead of replacing its visual design.

Keep the approved Android wedding styling.

Implement:

## Home
Reuse existing hero/dashboard.

## Plan
Map existing planning modules to:

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

## Guests
Wire:

```text
Guest List
RSVP
Invitations
Groups/Households
Seating
Messages
Passes/QR
```

## Wedding Day
Create/compose from existing:

```text
Pass
Programme
Venue/Maps
Contacts
Vendor Status
Announcements
Checklist
```

## More
Wire existing Couple-specific pages:

```text
Wedding Profile
Our Story
Gallery
Honeymoon
Documents
Settings
Help
Account
```

Do not replace Couple More with Planner More.

---

# 8. Step 6 — wire Planner IA

Preserve the richer Planner work already built.

Implement:

## Workspace

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

## Clients

Connect or scaffold around existing planner/client domain:

```text
Active Weddings
Upcoming Weddings
Enquiries
Archived Weddings
Client Profiles
Team Assignment
```

Use honest unsupported/empty states where backend contract does not yet exist.

Never fabricate a PlannerEngagement.

## Daily Ops

Build from real task/vendor/guest/payment attention data where available:

```text
Today
Overdue
Approvals
Messages
Deadlines
Vendor Follow-ups
Guest Issues
Payment Attention
Team Activity
```

## Wedding Day

Reuse existing Wedding Day operations:

```text
Run Sheet
Programme
Gate
Vendor Arrivals
Coordinator Tasks
Guest Issues
Incidents
Live Notes
Emergency Contacts
Offline Status
```

## More

```text
Team Hub
Client Profile
Invitations & QR
Intelligence
Files/Documents
Planner Actions
Account
Settings
Help
```

Planner Actions must include mobile equivalents for:

```text
Print / Arrange / Select
Refresh
Switch Worksheet
Template
Export
Import
Recent Imports
Edit Wedding Details
```

---

# 9. Step 7 — wire Guest IA

Reuse the invitation/pass journey.

Implement:

```text
Home
Invitation
Pass
Wedding Day
More
```

Do not expose:

- whole guest roster;
- whole budget;
- Planner workspace;
- other guests' private details;
- vendor financial data.

Guest routes should resolve from invitation/guest authorization and current wedding.

---

# 10. Step 8 — wire Vendor IA

Implement:

```text
Home
Jobs
Schedule
Messages
More
```

Reuse existing Vendor / ServiceEngagement data.

Never show another vendor's engagement.

Where payment/contract APIs are incomplete, render honest recorded/unrecorded state rather than demo values.

---

# 11. Step 9 — wire Gate IA

Implement:

```text
Scan
Admissions
Guests
Incidents
More
```

Build on the existing gate scanner, offline manifest, QR verification and check-in operations.

Guest lookup must be operationally restricted.

No planning/financial modules.

---

# 12. Step 10 — wire Coordinator IA

Implement:

```text
Today
Run Sheet
Team
Wedding Day
More
```

Build from:

- ProgrammeItem;
- PlannerTask;
- Vendor/ServiceEngagement;
- gate/admission;
- incidents/notes when supported.

Do not invent assignments that do not exist.

---

# 13. Step 11 — wire Admin IA

Implement:

```text
Dashboard
Cases
Accounts
Audit
More
```

Admin navigation is privileged.

Do not infer Admin authorization from a development persona in production logic.

All administrative mutation paths require explicit capability checks and audit behavior.

---

# 14. Step 12 — implement cross-role utilities once

Do not implement seven unrelated copies of common utilities.

Shared services should include:

- notification center;
- account;
- authorized role switch;
- context switch;
- maps;
- help/support;
- search abstraction;
- message routing;
- offline/sync status.

Presentation may vary by role, but domain behavior should be shared.

---

# 15. Step 13 — protect entity ownership

Before adding any new route, identify its primary domain entity.

Example:

```text
BudgetItem
→ Couple Plan / Planner Workspace
→ Budget detail
```

Do not duplicate the BudgetItem into a separate Daily Ops model merely to show an alert.

Daily Ops references the canonical BudgetItem/attention projection.

Use the entity ownership table in IA V2.

---

# 16. Step 14 — protect the database pipeline

For each Level-2 screen answer:

```text
What repository provides this data?
What active wedding/client/engagement ID scopes it?
What role capability allows it?
What happens if the record is absent?
What mutation command changes it?
Which sibling screens must observe the update?
```

Reject an implementation if it:

- hard-codes current wedding values in presentation;
- loads sanitized fixtures while Private Real Shadow is selected;
- creates a screen-local duplicate data array;
- bypasses the repository;
- loses wedding ID on navigation;
- uses hidden navigation as the only authorization mechanism.

---

# 17. Step 15 — visual preservation

IA V2 is an upgrade, not a redesign.

For shared Couple surfaces, preserve the approved Android design language.

Reference:

```text
apps/android/app/src/main/java/pro/wewed/app/theme/WeddingIdentityStyle.kt
apps/android/app/src/main/java/pro/wewed/app/ui/home/WeddingReferenceHomeScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/planner/WeddingReferencePlannerScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/guests/WeddingReferenceGuestsScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/invitation/IvoryInvitationScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/pass/WeddingReferencePassScreen.kt
apps/android/app/src/main/java/pro/wewed/app/ui/more/WeddingReferenceMoreScreen.kt
```

iOS should implement the same Wewed visual system without deleting richer role-specific functionality.

---

# 18. Step 16 — phone and tablet adaptation

Do not fork taxonomy by device.

Phone:

- bottom navigation;
- navigation stack;
- contextual sheets.

Tablet may promote Level-2 controls into:

- navigation rail;
- sidebar;
- split view.

The same role taxonomy remains authoritative.

---

# 19. Step 17 — deep-link and notification routing

Update deep links to resolve canonical routes.

Every deep link must:

1. parse entity/context;
2. restore/authenticate session;
3. resolve authorized role;
4. verify entitlement;
5. load canonical repository state;
6. navigate;
7. fail safely if unauthorized.

Notifications must use the same route resolver.

---

# 20. Step 18 — accessibility

For every primary destination verify:

- readable labels;
- touch targets;
- text scaling;
- screen-reader traversal;
- role/context announcement;
- logical focus;
- no color-only status;
- predictable back navigation.

---

# 21. Step 19 — Android/iOS parity

Implement navigation changes in parity pairs.

Do not finish all Android navigation before starting iOS, or vice versa.

Recommended order:

```text
Couple Android + Couple iOS
Planner Android + Planner iOS
Guest Android + Guest iOS
Vendor Android + Vendor iOS
Gate Android + Gate iOS
Coordinator Android + Coordinator iOS
Admin Android + Admin iOS
```

For every role compare:

- labels;
- order;
- route semantics;
- capability visibility;
- empty/error/offline states;
- final workflow outcome.

---

# 22. Step 20 — qualification

Minimum role-navigation tests:

## Couple
Home → Plan → Budget → back → Guests → Wedding Day → More

## Planner
Clients → select wedding → Workspace → Guests → Daily Ops → Wedding Day → More → Planner Actions

## Guest
Home → Invitation → RSVP → Pass → Wedding Day → More

## Vendor
Home → Job → Schedule → Messages → More

## Gate
Scan → Admissions → Guest lookup → Incident → More/offline status

## Coordinator
Today → Run Sheet → Team → Wedding Day → More

## Admin
Dashboard → Case → Account → Audit → More

All routes require role-boundary assertions.

---

# 23. Step 21 — Private Real Shadow validation

Where a role is supported by the protected snapshot, verify:

- active wedding identity remains constant;
- real records are used;
- no sanitized pseudonyms leak into Private Real Shadow;
- no private screenshots are committed;
- no production writes occur.

Where a relationship does not exist, do not invent it merely to complete a role screen.

Use explicit Shadow-only authorization overlays only when documented and clearly non-production.

---

# 24. Step 22 — final implementation report

Return:

```text
IA V2 IMPLEMENTATION:
PASS / PARTIAL / FAIL

FINAL SHA:
<sha>

COUPLE NAV:
PASS / PARTIAL

PLANNER NAV:
PASS / PARTIAL

GUEST NAV:
PASS / PARTIAL

VENDOR NAV:
PASS / PARTIAL

GATE NAV:
PASS / PARTIAL

COORDINATOR NAV:
PASS / PARTIAL

ADMIN NAV:
PASS / PARTIAL

ANDROID ↔ IOS NAV PARITY:
PASS / FAIL

ENTITY OWNERSHIP VIOLATIONS:
0 / list

ROLE LEAKAGE:
0 / list

DATA PIPELINE LEAKS:
0 / list

PRIVATE_REAL_SHADOW REGRESSIONS:
0 / list

PRODUCTION WRITES:
NO / YES

PROTECTED WEB WORKSPACE TOUCHED:
NO / YES

LOCAL == REMOTE:
YES / NO

DIVERGENCE:
0 0 / other

WORKTREE:
CLEAN / DIRTY

REMAINING GAPS:
<exact list>
```

---

# 25. Stop condition

Do not merge IA V2 to production merely because navigation renders.

Stop at native qualification.

Production auth/entitlements/read/write integration remains governed by the separate production-integration gate in the Master Mobile Sprint Plan.
