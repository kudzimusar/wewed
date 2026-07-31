# Wewed Admin Governance, RBAC, Analytics and Route-Isolation Plan

## Purpose

Convert the current `/admin` implementation from a wedding-themed data viewer into a dedicated Wewed parent-company operations console.

The work must preserve the existing planner, couple, wedding, venue and vendor experiences while adding enforceable platform governance, useful analysis and auditable account lifecycle controls.

## Confirmed problems

1. Couple-facing global tools are visible inside `/admin`, including WhatsApp, couple login, ambient music and help/onboarding controls.
2. Business accounts are displayed mainly as repetitive cards, which limits comparison, filtering and operational review.
3. Existing account status controls are not a complete lifecycle workflow.
4. Platform roles are not sufficiently granular for operations, billing, support and read-only staff.
5. The dashboard does not surface actionable analysis, risk conditions or exception queues.

## Delivery principles

- Keep all work on `feature/wewed-admin-console-mvp` and draft PR #48 until validation passes.
- Make database changes additive and reversible.
- Enforce permissions on the server; UI visibility alone is never authorization.
- Preserve `/planner`, couple, vendor and wedding tools outside `/admin`.
- Record every privileged mutation in the admin audit log.
- Require explicit reason and confirmation for restrictive account actions.
- Do not delete historical wedding, billing, support or audit data when an account is blocked, cancelled or archived.

## Phase 1 — Route isolation

Create an explicit admin route boundary so `/admin` does not mount wedding or couple utilities.

Remove from `/admin` only:

- WhatsApp RSVP or chat launcher
- Couple login trigger
- Ambient music player
- Wedding help tours and how-to popups
- Wedding progress indicators
- Couple onboarding and contribution triggers
- AI or wedding-specific floating controls that are not part of parent-company operations

Implementation requirements:

- Route-aware rendering or route-group layout isolation rather than CSS hiding.
- `/planner` and public/couple pages retain their existing controls.
- Add a browser regression assertion that forbidden wedding controls are absent on `/admin` and still present where required.

## Phase 2 — Platform RBAC

Introduce explicit Wewed platform roles and permission checks.

### Roles

- `wewed_super_admin`
- `wewed_operations_admin`
- `wewed_billing_admin`
- `wewed_support_admin`
- `wewed_analyst`

### Permission groups

- `admin.overview.read`
- `admin.analytics.read`
- `admin.accounts.read`
- `admin.accounts.create`
- `admin.accounts.approve`
- `admin.accounts.reject`
- `admin.accounts.suspend`
- `admin.accounts.block`
- `admin.accounts.cancel`
- `admin.accounts.archive`
- `admin.accounts.restore`
- `admin.members.read`
- `admin.members.manage`
- `admin.billing.read`
- `admin.billing.manage`
- `admin.support.read`
- `admin.support.manage`
- `admin.incidents.read`
- `admin.incidents.manage`
- `admin.audit.read`

### Default mapping

| Role | Core access |
| --- | --- |
| Super Admin | All permissions |
| Operations Admin | Accounts, approvals, onboarding, members, support, incidents and analytics |
| Billing Admin | Account read, billing read/manage and analytics |
| Support Admin | Account read, support read/manage and limited incident visibility |
| Analyst | Read-only overview, analytics, accounts and audit summaries |

Requirements:

- Resolve the administrator's active Wewed business membership on every request.
- Deny access when the application user is inactive, the membership is inactive or the permission is absent.
- Keep the current application `User.role = admin` check as a platform-entry prerequisite, then apply granular business-role permissions.
- Return consistent `401` and `403` responses.

## Phase 3 — Account lifecycle governance

Use explicit statuses:

- `pending_review`
- `active`
- `rejected`
- `suspended`
- `blocked`
- `cancelled`
- `archived`

### Allowed transitions

- Pending review → Active or Rejected
- Active → Suspended, Blocked, Cancelled or Archived
- Suspended → Active, Blocked, Cancelled or Archived
- Blocked → Active, Cancelled or Archived
- Rejected → Pending review or Archived
- Cancelled → Active or Archived
- Archived → Pending review or Active when restored

Every transition must include:

- acting administrator
- previous status
- next status
- reason
- optional internal note
- timestamp
- audit-log record

### Access effects

- `suspended`: temporary sign-in/workspace denial for account members; data preserved.
- `blocked`: immediate denial pending administrative intervention; data preserved.
- `cancelled`: service access disabled while historical records remain available to Wewed administrators.
- `archived`: removed from normal operational queues but retained for reporting and audit.
- `rejected`: onboarding cannot proceed unless returned to pending review.

The application must not apply account-wide access denial until server-side membership and sign-in checks are updated and regression-tested.

## Phase 4 — Account-management workspace

Replace the card-only registry with an operational table and account inspector.

### Table capabilities

- Search by account, owner, email, wedding or venue
- Filter by type, lifecycle status, onboarding status, subscription and risk flag
- Sort by recent activity, creation date, wedding count, member count and status
- Bulk selection only for low-risk actions such as archive review; restrictive actions remain individual and confirmed
- Pagination or controlled result limits

### Account inspector

- Organization summary
- Owner and team memberships
- Linked couples, weddings, venues and vendors
- Subscription and payment history
- Support cases and incidents
- Recent sign-ins and activity
- Lifecycle action panel based on the current administrator's permissions
- Complete account audit timeline

## Phase 5 — Approvals and exception queues

Add dedicated operational queues for:

- Pending account approvals
- Rejected applications eligible for reconsideration
- Missing owner assignment
- No active business members
- Incomplete onboarding
- Wedding records without valid ownership/membership relationships
- Suspended, blocked and cancelled accounts
- Failed or overdue payments
- Stale accounts with no recent activity
- Open high-priority support cases

Each queue must link directly to the relevant account inspector and permitted action.

## Phase 6 — Useful analytics

Build analysis from existing data rather than decorative totals.

### Overview indicators

- Accounts by type and lifecycle status
- Approval backlog and average age
- Onboarding completion rate
- Accounts without owners or active members
- Weddings per planning business
- Couples per planner
- Upcoming versus completed weddings
- Subscription-plan distribution
- Payment status and overdue exposure
- Open support cases by priority
- Active incidents by severity
- Recently active versus inactive accounts
- Data-integrity and access-risk alerts

### Analytics rules

- Show denominators and reporting windows where applicable.
- Distinguish zero from missing data.
- Keep calculations server-side and return structured metrics.
- Label inferred risk indicators as operational signals, not definitive findings.
- Add drill-down links from metrics to filtered account lists.

## Phase 7 — Navigation and information architecture

Use the following admin navigation:

- Overview
- Accounts
- Approvals
- Users & Roles
- Billing
- Support
- Operations
- Audit Log

The default page should prioritize exceptions, pending actions and risk signals.

## Phase 8 — Audit and safety controls

- Audit every account lifecycle action, role change, billing mutation, support mutation and incident mutation.
- Store structured before/after details.
- Require confirmation for suspend, block, reject, cancel and archive.
- Do not expose secrets, password hashes, service keys or raw tokens in the UI or audit records.
- Preserve existing business records and relationships during status transitions.

## Regression gates

### Existing application

- Existing sign-in remains functional.
- `/planner` loads and retains wedding-specific tools.
- Wedding switching and permissions continue to pass.
- Existing couple and planner workflows remain unchanged.
- Existing APIs and database migrations remain valid.

### Admin isolation

- `/admin` does not render WhatsApp, couple login, music, wedding tours or wedding onboarding tools.
- Admin authentication and sign-out remain functional.

### RBAC

- Every platform role has positive and negative API tests.
- UI actions match server permissions.
- Direct API calls cannot bypass hidden controls.

### Lifecycle

- Valid transitions succeed.
- Invalid transitions fail without mutation.
- Reason is required for restrictive transitions.
- Every successful transition produces one audit event.
- Existing linked data remains intact.

### Analytics

- Metrics reconcile to seeded test data.
- Missing and zero values are represented correctly.
- Drill-down filters reproduce dashboard totals.

### Release

- Admin-specific lint and build pass.
- Main migration and planner regression workflow passes on a clean PostgreSQL database.
- Browser release gate passes.
- Vercel Preview is reviewed before merge.
- Production promotion remains a separate, explicit step.

## Implementation order

1. Record and approve this plan.
2. Inspect global layout mounting and existing admin authorization/data structures.
3. Implement admin route isolation and regression tests.
4. Add RBAC permission mapping and API enforcement.
5. Add lifecycle status model, transition validation and audit requirements.
6. Build account table, inspector and approval queues.
7. Add actionable analytics and drill-downs.
8. Add role-management UI limited by permission.
9. Run all regression gates.
10. Deploy and review a Vercel Preview.
11. Merge and promote only after explicit approval.

## Definition of done

- `/admin` is visually and functionally isolated from wedding/couple controls.
- Administrators have granular, server-enforced permissions.
- Accounts can be approved, rejected, suspended, blocked, cancelled, archived and restored through valid workflows.
- Restrictive actions require reasons and are fully audited.
- Account data can be searched, filtered, inspected and acted upon efficiently.
- Overview and analytics expose actionable operational signals.
- Existing planner, couple and wedding functionality passes all regression gates.
- The feature remains in preview until explicitly approved for production.
