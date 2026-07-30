# Wewed Business Admin Console — Implementation Plan

## Objective

Add a parent-company business administration layer above the existing planner, couple, wedding, venue, and vendor accounts without disrupting the working `/planner` application.

Target hierarchy:

**Wewed Platform → Business Accounts → Users and Teams → Couples, Weddings, Venues, and Vendors**

## Delivery approach

- Build in `feature/wewed-admin-console-mvp`.
- Keep `/planner` and existing wedding APIs operational.
- Use additive database changes only.
- Build the parent-company interface under `/admin`.
- Validate through automated checks and a Vercel Preview deployment before production promotion.

## Scope

### 1. Business account layer

Create or complete the organization/business-account model and connect existing records rather than recreating them.

Supported account types:

- Wewed internal
- Planning company
- Couple/client
- Venue
- Vendor

### 2. Existing-account alignment

Map the existing planner, Charity & Kudzie, and Imba Manor to the correct business hierarchy while preserving their current IDs, users, memberships, and wedding data.

### 3. Wewed `/admin` console

Provide:

- Business dashboard and counts
- Organization/client registry
- Account details and status
- User and role visibility
- Onboarding tracking
- Subscription and payment-status tracking
- Support cases and platform incidents
- Recent activity and audit history

### 4. Access control

Define distinct roles for:

- Wewed super administrator
- Wewed operations administrator
- Wewed billing administrator
- Wewed support administrator
- Business owner
- Planner
- Venue/vendor administrator
- Couple

Only Wewed-level administrators may access `/admin`. Existing planner and wedding access remains tenant-scoped.

### 5. Billing readiness

Store subscription, invoice, and payment status in the application database. Keep the model ready for Stripe integration; Stripe is not required for the first working internal console.

### 6. Regression protection

Protect:

- Existing sign-in
- Planner access
- Wedding switching
- Wedding permissions
- Existing APIs
- Existing couple, planner, venue, and wedding records

Add checks for:

- `/admin` authorization
- Business-account isolation
- Client onboarding
- Subscription updates
- Support operations
- Migration integrity

## Implementation sequence

1. Record this plan in the repository.
2. Inspect the latest schema, roles, business-account records, and deployment configuration.
3. Add additive database models and migrations where required.
4. Add server-side Wewed-admin authorization.
5. Add admin APIs for dashboard, organizations, onboarding, billing status, support, incidents, and audit logs.
6. Build the `/admin` UI.
7. Link existing planner, Charity & Kudzie, and Imba Manor records.
8. Run type checks, linting, tests, and regression checks.
9. Deploy a Vercel Preview build.
10. Review the preview and promote only after the release gate passes.

## Definition of done

- `/planner` continues to work.
- A Wewed administrator can sign in to `/admin`.
- The administrator can see all business clients and their relationships.
- Charity & Kudzie, their planner, and Imba Manor appear correctly.
- New business accounts can be onboarded.
- Users and roles can be assigned and reviewed.
- Subscription/payment status can be managed.
- Support cases and incidents can be recorded.
- Audit history is visible.
- Existing production data remains intact.

## MVP implementation status — July 30, 2026

Implemented and validated on the feature branch:

- Additive parent-company data migrations and existing-record mapping
- Private `wewed_admin` database schema with server-only access
- Production seed mapping for the Wewed internal account, couples, the existing planner business, weddings, and venues including Imba Manor
- Server-side Wewed administrator authorization
- `/api/admin/overview` read/write operations
- Private `/admin` application route
- Business dashboard and account registry
- Onboarding account creation and status management
- Manual subscription/payment records
- Support case management
- Platform incident management
- Admin audit history
- Separate Wewed administrator provisioning script and access guide
- Draft pull request #48 for controlled review

Validation completed:

- Admin Console lint and application build
- Clean PostgreSQL migration deployment
- Prisma migration status and drift check
- Existing planner unit and integration regression suites
- Existing planner browser release gate
- Live `/planner` HTTP smoke test after the production database migration
- Rolled-back production write-path smoke test for accounts, payments, support, incidents, and audit records

Remaining release gates:

- Vercel Preview deployment of the final branch commit; currently blocked by the project build-rate limit
- Provisioning of a separate Wewed company administrator identity
- Authenticated `/admin` preview walkthrough
- Production merge and deployment after those two checks pass
