# Wewed Admin Governance — Implementation Status

**Recorded:** July 30, 2026  
**Branch:** `feature/wewed-admin-console-mvp`  
**Pull request:** Draft PR #48  
**Production status:** Not merged or promoted

This status record supplements `WEWED_ADMIN_GOVERNANCE_ANALYTICS_PLAN.md` and must be updated whenever the governance scope, release gates or operational behavior changes.

## Implemented

### Admin route isolation

- Root application layout now mounts wedding utilities through a route-aware component.
- `/admin` and all `/admin/*` routes do not mount:
  - WhatsApp controls
  - Couple login
  - Ambient music
  - Wedding progress controls
  - Wedding help/onboarding controls
  - Wedding contribution and AI triggers
- Non-admin wedding and planner routes retain the existing utilities.

### Platform RBAC

Implemented Wewed roles:

- `wewed_super_admin`
- `wewed_operations_admin`
- `wewed_billing_admin`
- `wewed_support_admin`
- `wewed_analyst`

Every parent-company request now requires:

1. a valid signed session;
2. an active application `admin` user;
3. an active membership in the Wewed internal business account;
4. the permission required by the requested operation.

The interface hides unauthorized sections and actions, while the server independently rejects unauthorized direct API calls.

### Account lifecycle governance

Implemented lifecycle states:

- `pending_review`
- `active`
- `rejected`
- `suspended`
- `blocked`
- `cancelled`
- `archived`

Lifecycle transitions are validated against the approved transition matrix. Every transition requires a reason, records before/after state, identifies the acting administrator and creates an audit event. Historical wedding, billing, support and audit data is preserved.

Newly created business accounts enter `pending_review` rather than becoming active automatically.

### Account access effects

Account restrictions are enforced conservatively to avoid breaking legacy data:

- Users explicitly linked through a business membership and a wedding relationship require an active business membership and active business account.
- Suspended, blocked, cancelled or archived mapped businesses lose access to their linked weddings.
- Legacy wedding users without a business-account mapping retain their existing access behavior.
- Wewed platform administrators retain platform-level access.

### Admin workspace

The previous account cards were replaced with:

- searchable, filterable and sortable account table;
- filters for type, lifecycle state and operational risk;
- account inspector with owners, members and linked records;
- lifecycle decision controls;
- billing, support and audit history;
- onboarding, subscription and internal-note controls;
- approval, reconsideration and restricted-account queues;
- Wewed user and role administration;
- dedicated audit log.

Navigation now contains:

- Overview
- Accounts
- Approvals
- Users & Roles
- Billing
- Support
- Operations
- Audit Log

### Operational analytics

The overview now calculates and exposes:

- accounts by type and lifecycle state;
- approval backlog and average waiting age;
- onboarding completion rate;
- accounts without owners;
- accounts without active members;
- weddings without an active owner membership;
- upcoming and completed weddings;
- average weddings per planning business;
- couples per active planner;
- subscription distribution;
- pending payment exposure;
- high-priority support cases;
- open platform incidents;
- inactive-account signals;
- account-level risk flags and drill-down queues.

## Regression protection completed

### Focused Admin Console gate

Passed:

- RBAC contracts
- account lifecycle contracts
- admin route-isolation contracts
- mapped business access contracts
- targeted lint
- full Next.js application build

### Full repository release gate

Passed on a clean PostgreSQL database:

- Prisma schema validation and client generation
- complete migration deployment
- migration status and drift detection
- original planner parity contract
- planner integrity tests
- all Stage 2 through Stage 10 suites
- Phase 2 through Phase 6 suites
- full application build
- executable Playwright planner browser release gate

### Production-data safety checks

Completed without retained test mutations:

- operational analytics SQL executed against the existing Supabase data;
- business-account relationships resolved correctly;
- mapped access allowed while a planning account was active;
- mapped access was denied when the same account was suspended inside a transaction;
- the transaction was rolled back;
- the planning account remained active;
- no smoke-test metadata or records remained.

## Remaining release gate

The final branch commit has not received a Vercel Preview deployment because the Vercel project build-rate limit rejected the deployment.

The latest available branch preview contains only an earlier route-isolation commit and does not contain the complete governance workspace. It must not be presented as the final review build.

Remaining work before production:

1. Allow Vercel's build-rate window to reset or increase the project's build allowance.
2. Deploy the exact latest branch commit to a Preview environment.
3. Perform an authenticated administrator walkthrough covering:
   - route isolation;
   - dashboard analysis;
   - account table and inspector;
   - approval and rejection;
   - suspend/block/cancel/archive/restore flows;
   - role restrictions;
   - audit creation.
4. Obtain explicit approval to merge.
5. Merge and promote as a separate production action.

Production remains on the previous stable build.
