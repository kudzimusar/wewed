# Planner Relationship & Portfolio Intelligence Plan

## Status

Implementation plan for the first testable release. This document is intentionally broader than a UI change: the goal is to make the planner–wedding–couple relationship a shared operational data layer for Wewed Admin, the Planner Workspace, and eventually the couple experience.

## Product principle

Wewed should maintain one authoritative relationship graph:

`Planner / planning company -> Wedding -> Couple`

The relationship is represented by existing wedding access/membership records rather than duplicated `plannerId` fields on couples or denormalized lists on planner profiles. That keeps Admin, Planner, and Couple views aligned and avoids relationship drift.

The same graph then powers two kinds of intelligence:

1. **Relationship intelligence** — who manages whom, under what role/status, and for which wedding.
2. **Operational intelligence** — what needs attention across the planner's managed weddings.

## Stakeholder outcomes

### Wewed Admin

Admin should be able to answer, without manually cross-referencing screens:

- Which weddings/couples does this planner manage?
- Which planner or planning team manages this wedding/couple?
- Is the relationship active, invited, revoked, or missing?
- What is the planner's current active workload?
- Which weddings have no active planner?
- Are there inconsistent relationship/access records that require support attention?

### Planner

The Planner Workspace should evolve from only `select wedding -> work inside wedding` into:

`Portfolio command centre -> identify priority -> open wedding -> act in existing worksheet modules`

The planner should see:

- all managed weddings in one portfolio view;
- upcoming wedding dates and workload;
- transparent wedding-health signals;
- overdue/blocked tasks across weddings;
- pending RSVP pressure;
- unsigned vendors / payment attention where the saved data supports it;
- recent/priority changes in later iterations;
- direct navigation into the selected wedding's existing Tasks, Budget, Vendors, Guests, Timeline, and Seating modules.

### Couple

The couple should eventually see the same relationship from the other side:

- lead planner / planning team;
- relationship status;
- shared progress and relevant planner updates;
- decisions waiting on the couple;
- upcoming milestones.

The first implementation release will establish the shared server-side relationship and analytics contract required for this experience. Couple-facing collaboration intelligence can then be layered on without inventing a second relationship model.

## Canonical relationship rules

1. A planner manages a **wedding**, not a couple user record directly.
2. The couple relationship is derived through `Wedding.coupleId`.
3. `WeddingMembership` remains the canonical professional access relationship for this release.
4. Planning roles are `planner` and `coordinator`.
5. `active` membership means current operational access.
6. `invited` remains visible as pending relationship state but must not count as active workload.
7. `revoked` remains historical and does not count as active workload.
8. Do not enforce one planner per wedding at database level. The UI may identify a lead planner, but multiple planning professionals must remain structurally possible.
9. Marketplace `PlannerProfile.status` is separate from wedding relationship status.
10. No analytics score should hide its reasoning. Wedding health must be explainable by visible signals.

## Release 1 scope

### A. Shared relationship/portfolio API

Create a planner portfolio endpoint that derives all accessible active planner/coordinator weddings and returns compact cross-wedding operational summaries.

For each wedding, include:

- wedding id / slug / title / date / venue;
- couple id and couple display name;
- planner membership role/status;
- task counts: total, done, overdue, blocked;
- budget totals: estimated, paid, outstanding;
- guest counts: total, confirmed, pending;
- vendor counts: total, signed, pending contracts, unpaid/partially paid attention;
- timeline count;
- transparent health state: `on_track`, `attention`, or `at_risk`;
- explicit health reasons.

Portfolio totals include:

- active weddings;
- weddings in the next 30 / 90 days;
- overdue tasks;
- blocked tasks;
- pending RSVPs;
- pending vendor contracts;
- weddings needing attention / at risk.

### B. Planner Portfolio Command Centre

Add a portfolio view above the existing single-wedding workspace rather than replacing it.

The planner landing experience should include:

- portfolio headline and workload summary;
- cards for Active weddings, Upcoming, Needs attention, Overdue tasks;
- a priority queue generated from transparent saved-data signals;
- one compact row/card per managed wedding;
- health label plus reasons;
- direct `Open wedding` action that switches the active wedding and returns the planner to the detailed workspace.

The existing detailed Planner Workspace remains responsible for editing Tasks, Budget, Vendors, Guests, Timeline, and Seating.

### C. Admin Planner -> Couples/Weddings visibility

Enrich Admin Planner Profiles with relationship summaries derived from `WeddingMembership`.

Each planner/planning company record should show:

- active managed wedding count;
- invited count;
- upcoming count;
- a clear `Clients & Weddings` section;
- couple names;
- wedding title/date/location;
- planner/coordinator role;
- membership status;
- workload/health summary where available.

Marketplace profile status and wedding relationship status must be visually separated.

### D. Admin Wedding/Couple -> Planner visibility

Add an Admin relationship view listing weddings/couples and their active planning professionals.

Each wedding row should show:

- couple;
- wedding title/date;
- active planner/coordinator names;
- primary/lead display selection rule for the UI;
- `No planner assigned` state when no active planning membership exists;
- invited professional count when relevant.

This must read the same membership graph as the planner-side view.

### E. Admin relationship metrics

Surface operational metrics such as:

- active planning professionals;
- planner-managed weddings;
- weddings without active planner/coordinator;
- planning relationships pending invitation acceptance;
- weddings at risk / needing attention when analytics are available.

## Wedding health rules for Release 1

Health is rule-based and explainable.

### `at_risk`

At least one critical signal, for example:

- wedding is within 30 days and has overdue tasks;
- wedding is within 30 days and has pending vendor contracts;
- wedding is within 14 days and still has pending RSVPs;
- two or more blocked tasks close to the wedding.

### `attention`

Non-critical but actionable signals, for example:

- any overdue task;
- any blocked task;
- pending vendor contracts;
- pending RSVPs;
- unpaid/partially paid vendor records where applicable.

### `on_track`

No current attention rules are triggered.

Every non-green state must include reason strings, e.g. `3 overdue tasks`, `18 RSVPs pending`, `2 vendor contracts pending`.

## Data and privacy constraints

- Derive analytics only from weddings the current planner is authorized to access.
- Admin endpoints remain permission-gated.
- Do not expose internal planner-only information to public marketplace endpoints.
- Do not expose one couple's data to another couple.
- Do not convert invited memberships into active workload.
- Do not create duplicate relationship tables for this release.
- Do not auto-assign or auto-publish marketplace profiles as part of relationship analytics.

## UI hierarchy

### Planner

`Portfolio` -> `Wedding Workspace`

Portfolio answers: **What needs my attention across all clients?**

Wedding Workspace answers: **What exactly do I need to do for this wedding?**

### Admin

`Planner Profile` -> `Clients & Weddings`

`Wedding/Couple Relationships` -> `Planner & Team`

Admin answers: **Who is connected, under what status, and where is support attention required?**

## Deliberate non-goals for Release 1

- AI-generated health scores.
- Automated planner capacity enforcement.
- Revenue analytics that Wewed cannot verify from its own records.
- Couple-facing private planner notes.
- Replacing the current worksheet modules.
- Adding a new planner/couple foreign key when `WeddingMembership` already provides the relationship.
- Automatic reassignment of legacy/UAT planner profiles.

## Follow-on releases

### Release 2 — Change intelligence

- `Since your last visit` changes across managed weddings.
- meaningful cross-wedding activity feed;
- client decision queue;
- planner update summaries.

### Release 3 — Couple collaboration intelligence

- planner/team card in couple workspace;
- shared progress;
- decisions waiting on couple;
- relevant planner updates and milestones.

### Release 4 — Business/capacity analytics

- current workload/capacity;
- accepting-new-weddings state tied to planner-controlled availability;
- marketplace enquiry -> appointment -> active wedding funnel;
- booking/conversion analytics where the lifecycle data is authoritative.

## Test plan

Release 1 must prove:

1. A planner with two active weddings sees both in portfolio analytics.
2. Invited/revoked memberships do not inflate active workload.
3. Admin planner view lists the same active wedding relationships as the planner portfolio.
4. Admin wedding/couple view lists the same planner/coordinator relationship in reverse.
5. Wedding switching from portfolio preserves authorization boundaries.
6. Health state is deterministic and reasons match underlying saved records.
7. A wedding with no planner shows an explicit `No planner assigned` state in Admin.
8. Existing single-wedding Tasks/Budget/Vendors/Guests/Timeline/Seating editing remains unchanged.
9. Marketplace public discovery remains published-profile-only and unrelated to wedding membership visibility.
10. Existing Planner Marketplace and planner workspace CI remains green.

## Acceptance criteria for PR review

The PR is testable when:

- the plan exists in-repo;
- Admin planner records clearly expose managed couples/weddings;
- Admin can view the inverse wedding/couple -> planner relationship;
- planners have a portfolio-level command view with cross-wedding analytics;
- direct navigation from portfolio to an authorized wedding works;
- analytics are read-only and derived from authoritative wedding records;
- no production migration is required unless a later implementation finding proves one necessary;
- automated tests cover the relationship contract and health rules;
- the PR remains unmerged until UAT approval.
