# Admin account segmentation and RBAC remediation plan

Date: 2026-08-06
Status: implementation approved by the product owner

## Purpose

Make the Wewed Business Admin Console unambiguous, least-privileged, and safe for multiple named administrators. The console must clearly separate platform administrators from customer and partner accounts, show the effective access state of every administrator, and ensure only a Super Admin can traverse the whole platform or manage platform roles.

## Audit findings

### 1. Different account populations are presented as one undifferentiated list

`BusinessAccount.type` already distinguishes `wewed_internal`, `planning_company`, `couple`, `venue`, `vendor`, and `client`, but the current Accounts table renders every type in one continuous result set. The type is secondary text rather than the primary navigation model. This makes planners, couples, venues, vendors, business clients, and Wewed internal records look operationally equivalent.

### 2. Platform administrators reuse the business-account membership table

Platform administrators are currently represented as `BusinessAccountMember` records under the `wewed_internal` account. This technically works, but it conflates two trust domains:

- customer/partner membership in a business account;
- privileged platform administration.

The implementation also returns all platform accounts to any role with `admin.accounts.read`; there is no account-scope grant model.

### 3. Role management is hidden and inconsistent across two interfaces

The dedicated `/admin/roles` screen contains the invitation workflow, but the main Admin Console's **Users and roles** section only shows an editable table. A Super Admin cannot discover the add/invite action from the primary console.

### 4. Statuses can contradict one another

The UI displays membership status and application-user status independently. A membership can appear `active` while the corresponding application user is inactive, which creates an unclear and misleading effective state. Live data currently includes an invited Operations Admin whose application identity is inactive, yet the table's controls make it possible to describe the membership separately.

### 5. Role permissions are broader than intended

`wewed_operations_admin` currently receives global account read, account creation, lifecycle management, member management, support, incident, and audit permissions. Because the overview query is global, Operations, Billing, Support, and Analyst roles can traverse every account permitted by their role rather than only explicitly assigned accounts.

### 6. Explicit permission additions can only expand access

The policy resolver merges database-supplied permissions into the role defaults. Without strict validation, a malformed or manually edited permission array can grant capabilities outside the intended role boundary.

### 7. High-risk role changes need stronger safeguards

The current Admin Console can update an administrator's role and membership status through one generic action. It does not require a reason, does not protect the last active Super Admin, and does not prevent self-demotion/self-suspension.

### 8. Database security advisory

Supabase reports multiple application tables with Row Level Security disabled, including several customer-data and private admin-domain tables. Enabling RLS without complete policies would block legitimate application access, so this project will not automatically enable RLS as part of this change. A separate, explicit RLS policy project is required. This plan will, however, keep new platform-administration tables private from `anon` and `authenticated` roles and use server-only access.

## Target operating model

### Account registry

The Accounts section will use type-led navigation with explicit counts and separate views:

1. Couples / clients
2. Planners
3. Venues
4. Vendors
5. Other business clients
6. Wewed internal — Super Admin only

Each row will show a prominent category badge, lifecycle, onboarding, owner, team, linked weddings/entities, and effective risk state. Internal platform records will never be mixed into the default customer/partner view.

### Platform administrator registry

Introduce a private `wewed_admin.PlatformAdministrator` registry as the authoritative platform-membership record. It will contain:

- one row per named administrator;
- role;
- lifecycle status (`invited`, `active`, `suspended`, `revoked`);
- optional suspension/revocation reason and timestamps;
- invitation/activation metadata;
- optimistic version field;
- created/updated attribution.

Existing Wewed internal memberships will be backfilled. The legacy internal `BusinessAccountMember` record will remain synchronized during transition so current application paths remain compatible.

### Account scope grants

Introduce `wewed_admin.PlatformAdministratorScope`:

- `global` scope is reserved for active Super Admins;
- non-Super Admins receive one or more account-category or explicit-account grants;
- grants are server-only and auditable;
- the overview query filters every account-dependent dataset through the resolved scope.

Default scopes:

- Super Admin: global
- Operations Admin: category scopes for couples, planners, venues, vendors, and clients
- Billing Admin: category scopes for billable customer/partner accounts
- Support Admin: category scopes for customer/partner accounts
- Analyst: category scopes for customer/partner accounts

A non-Super Admin will not see the Wewed internal account, platform administrator records outside the permitted administrative view, or account data outside the assigned scope.

### Effective access status

The API will compute one clear effective state:

- `invited`: invitation not accepted;
- `active`: platform membership active and application identity active;
- `suspended`: platform membership suspended or application identity inactive;
- `revoked`: platform membership revoked.

The UI will still disclose the underlying membership and identity states for diagnosis, but the effective state will be primary.

### Role and permission governance

- Only `wewed_super_admin` can invite administrators, change platform roles, change platform membership status, or manage scopes.
- Non-Super Admin roles cannot receive arbitrary permission escalation through the database. Explicit permissions will be constrained to the role's declared permission ceiling.
- Super Admin is the only role with global traversal.
- Role changes require a reason and are audited.
- The last active Super Admin cannot be demoted, suspended, or revoked.
- An administrator cannot demote, suspend, or revoke their own active Super Admin membership.
- Invited administrators cannot be manually marked active; activation occurs only through invitation acceptance.

## UI work

### Accounts

- Replace the single mixed list with account-category tabs/cards and counts.
- Default to **Customer & partner accounts**, excluding Wewed internal.
- Add a visible category column/badge and clearer empty states.
- Preserve existing search, lifecycle, risk, and sort filters inside the selected category.
- Add category summary cards and risk counts.
- Restrict the internal category to Super Admin.

### Users and roles

- Rename to **Platform administrators**.
- Add a prominent **Invite administrator** action and expanded form for Super Admin.
- Show role, scope, membership state, identity state, effective state, invitation state, and last login.
- Add explicit actions for Suspend, Reinstate, and Revoke, each with a required reason.
- Keep invited users visibly pending; do not present them as suspended merely because the application identity is inactive before acceptance.
- Explain role boundaries using a permission matrix rather than only prose cards.
- Non-Super Admins get a read-only view limited to their permission boundary.

### Navigation and language

- Use distinct labels for **Business accounts**, **Platform administrators**, and **Application users**.
- Remove ambiguous use of “Users” where the screen actually means platform administrators.
- Surface security and scope notices near sensitive controls.

## API and database work

1. Add the two private platform-administration tables, constraints, indexes, and privilege revocations.
2. Backfill existing Wewed internal administrator memberships idempotently.
3. Resolve admin context from the platform registry, with a safe compatibility fallback while backfill/deployment converge.
4. Add role/scope-aware SQL predicates to accounts, members, links, billing, support, audit, and summary queries.
5. Split administrator mutations into explicit operations with validation and transaction boundaries.
6. Synchronize legacy internal memberships during role/status changes and invitation acceptance.
7. Record before/after values, reason, actor, and target in `BusinessAuditLog`.
8. Return structured API errors for forbidden role, scope, and lifecycle transitions.

## Test plan

### Policy contracts

- Super Admin resolves global scope and all permissions.
- Every non-Super Admin permission set is bounded by its role definition.
- Only Super Admin can manage platform administrators or scopes.
- Category and explicit-account scope predicates are deterministic.
- Internal accounts are never visible to non-Super Admins.

### Lifecycle contracts

- Invited cannot be manually activated.
- Accepted invitation activates both platform and compatibility membership records.
- Suspension overrides an active application identity.
- Inactive identity overrides an active membership.
- Reinstate returns effective access only when the identity is active.
- Last-active-Super-Admin and self-lockout protections hold.

### API/source contracts

- Overview queries apply resolved account scope to all account-derived datasets.
- Platform-administrator mutations require `admin.platform_admins.manage`.
- Role/status mutations require reasons and write an audit record.
- Account category segmentation is represented in the payload and UI.
- The primary console exposes the invitation form only to Super Admin.

### Validation

- Run focused Bun contract tests.
- Run existing Admin governance, invitation, registration/RBAC, planner access, pricing isolation, and TypeScript/build checks.
- Review migration idempotency and server-only privileges.
- Deploy a Vercel preview and smoke-test `/admin`, `/admin/roles`, `/api/admin/overview`, and `/admin/accept-invite`.
- Apply the database migration only after source review and successful build.
- Merge only after the PR is mergeable and checks/preview are green.

## Non-goals and follow-up work

- This change will not enable RLS indiscriminately across the existing application tables. A separate RLS policy migration must be designed and approved because enabling RLS without compatible policies can cause a production outage.
- This change will not merge the separate `public.User` and `public.UserProfile` models; that identity consolidation deserves a separate migration.
- This change will not redesign planner/vendor/couple product workspaces outside the Admin Console.
