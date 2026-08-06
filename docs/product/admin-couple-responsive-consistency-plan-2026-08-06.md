# Admin, Couple, and Planner Consistency Plan

**Date:** 2026-08-06  
**Branch:** `feat/admin-couple-responsive-consistency-20260806`  
**Basis:** Manual review of the Charity & Kudzie Admin, Couple, public wedding-site, and Planner experiences.

## Objective

Make account ownership, onboarding, invitations, planner relationships, guest access, and responsive layouts understandable and consistent across Admin, Couple, public wedding-site, and Planner surfaces without mutating production wedding data.

## Confirmed current behavior

- The Charity & Kudzie couple owner can open the correct Couple dashboard and existing wedding site.
- The appointed planner can open the populated Charity & Kudzie Planner workspace.
- Admin shows the account as active and onboarding as complete, but the owner identity is truncated and the owner email is not directly visible.
- Wedding-level pending invitations are not surfaced clearly in the Admin account view.
- The public wedding site continues to show a `Couple login` action even when a signed-in couple member is viewing it.
- Mobile and tablet layouts use desktop-sized card padding and minimum heights, which produces excessive whitespace and unnecessary scrolling.
- Guest, invitation, QR, and RSVP features must be verified to use one canonical set of wedding records across Couple and Planner surfaces.
- Planner workspace membership and the customer-facing planner engagement relationship can diverge, leaving a working planner unable to appear as appointed in Couple-facing views.

## Implementation workstreams

### 1. Admin identity, onboarding, and invitation visibility

- Show the account owner's full name and email in the account review experience.
- Make onboarding state visible without relying on a truncated table column.
- Surface wedding-level pending invitations, including email, role, invitation state, and creation/expiry metadata where available.
- Keep destructive membership actions out of this change; this work is visibility and review only.
- Preserve desktop table behavior while providing a compact mobile/tablet account-detail layout.

**Acceptance criteria**

- An Admin reviewer can identify the current Charity & Kudzie owner as `kudzimusar@gmail.com` without inspecting the database.
- A pending invitation such as `shandymanyewu@gmail.com`, when present in the canonical membership/invitation records, is visible from the relevant account review screen.
- Active and onboarding states remain visible at tablet and mobile widths.

### 2. Session-aware public wedding-site navigation

- Resolve the authenticated user and active wedding relationship on the server.
- Show `Back to Couple dashboard` or `Manage wedding` to a signed-in couple member for that wedding.
- Show `Couple login` only to visitors who do not have a matching authenticated couple relationship.
- Do not expose private dashboard routes or membership details to public visitors.

**Acceptance criteria**

- A signed-in Charity & Kudzie owner no longer sees a login prompt on their own wedding site.
- A signed-out visitor continues to see the public login action.
- A signed-in user without access to that wedding does not receive an owner-management action.

### 3. Responsive density for Couple and Planner

- Reduce mobile card padding, minimum heights, inter-card gaps, and oversized typography where it does not improve readability.
- Use compact metric rows/cards for dashboard summaries.
- Use two columns at suitable tablet widths and one compact column on phones.
- Keep touch targets at least 44 pixels and preserve accessible focus and text contrast.
- Avoid changing desktop information architecture in this pass.

**Acceptance criteria**

- Primary Couple actions and at least two dashboard modules are visible with materially less scrolling on a typical phone viewport.
- Planner overview metrics no longer occupy a full phone viewport per card.
- No horizontal overflow appears at 360, 390, 768, or 1024 pixel viewport widths.

### 4. Canonical Guest, invitation, QR, and RSVP verification

- Trace Couple and Planner guest features to their route handlers and data-access functions.
- Confirm both roles read and write the same canonical guest and invitation identifiers.
- Add automated contract coverage that verifies guest identity, RSVP state, seat count, invitation token, and QR destination remain consistent across role-specific endpoints.
- Change data access only where a real split or derived copy is found.

**Acceptance criteria**

- A single test guest has the same identifier and RSVP state in Couple and Planner responses.
- The QR destination resolves to the same invitation/access record displayed in guest management.
- No duplicate guest record is created by switching between Couple and Planner tools.

### 5. Planner relationship visibility and reconciliation

- Distinguish workspace authorization from the customer-facing appointed-planner relationship.
- Show the appointed planner from the canonical `PlannerEngagement` relationship when present.
- Where workspace access exists without an engagement, show an explicit Admin reconciliation state rather than silently presenting the relationship as complete.
- Do not automatically create or backfill a production engagement in this change.

**Acceptance criteria**

- Couple-facing UI does not falsely claim that no planner has access when a reconciliation issue exists.
- Admin can identify whether planner workspace access and planner engagement are aligned.
- No production relationship record is created by rendering or reviewing the account.

## Test plan

- Unit tests for authenticated wedding-site CTA selection.
- Route/data contract tests for Admin account identity and invitation visibility.
- Guest/QR/RSVP parity tests across Couple and Planner role paths.
- Responsive browser tests at 360x800, 390x844, 768x1024, and 1024x768.
- Existing Admin, Couple, Planner, guest-access, and release browser gates must remain green.

## Delivery sequence

1. Commit this plan before application changes.
2. Implement read-only Admin visibility and relationship diagnostics.
3. Implement session-aware wedding-site navigation.
4. Apply scoped responsive-density changes.
5. Add canonical-data parity tests and repair only proven inconsistencies.
6. Open a pull request from this branch and wait for exact-head CI and preview deployment results.

## Safety and non-goals

- No production database writes, invitation revocations, membership changes, planner engagement creation, guest edits, or RSVP edits.
- No speculative correction of Charity & Kudzie data.
- No merge or production promotion as part of implementation without a separate review decision.
- No broad redesign of desktop navigation or brand styling.
