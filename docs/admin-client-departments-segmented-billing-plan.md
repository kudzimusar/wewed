# Admin client departments and segmented billing remediation plan

Date: 2026-08-06
Status: approved for implementation on the Admin governance branch

## Objective

Extend the governed Wewed Admin Console so each customer or partner category is operated through its own department model, systems, data points, resources, and billing offers. Couples, planning companies, venues, vendors, and other business clients must not be treated as one interchangeable population or be offered one blanket price catalog.

The implementation must preserve every existing customer record, Stripe reference, subscription state, payment record, membership, wedding, planner engagement, provider profile, and audit event. New structures are additive and private. Existing billing columns remain as compatibility mirrors until a later, separately approved cleanup.

## Current-state audit

### Administrative segmentation

`wewed_admin.BusinessAccount.type` already distinguishes:

- `couple`
- `planning_company`
- `venue`
- `vendor`
- `client`
- `wewed_internal`

The new Admin governance work separates these categories visually and scopes non-Super Admin access. It does not yet define the operational departments, systems, data points, and resource tools that belong to each category.

### Billing

The current billing catalog has four generic plan identifiers: `free`, `starter`, `professional`, and `enterprise`. The same checkout endpoint accepts any paid plan for any external account type. Stripe Checkout metadata records the generic plan and interval, but does not record the customer category or a category-specific offer code.

This creates three risks:

1. a couple can select a planner-oriented plan;
2. a planner, vendor, or venue can be shown services that do not match its workspace;
3. future reporting cannot reliably explain which service bundle was purchased.

### Live-data findings

The connected Supabase project currently contains couple, planning-company, venue, and Wewed-internal accounts. Most are Free. One couple QA account has an active Stripe test subscription stored in isolated test metadata. No `PaymentRecord` rows exist at the time of this audit.

The remediation will not rewrite those records. It will create an account-type-aware billing profile beside the legacy fields and backfill only deterministic references.

### Data exposure posture

The `wewed_admin` schema is not usable by the Supabase `anon` or `authenticated` roles, and those roles have no CRUD privileges on its tables. Supabase still reports disabled-RLS advisories for several private-schema tables. Enabling RLS without complete server-compatible policies could interrupt production access, so this release will not change RLS on existing tables. New tables will be private, privilege-revoked, and server-only.

## Target client-department model

A department is an operational capability area attached to an account category. Definitions are platform-managed; account assignments are stored independently so a Super Admin can see which areas are enabled without mixing customer data.

### Couples

| Department | System | Primary data points | Resource tools |
|---|---|---|---|
| Wedding workspace | Couple and Wedding records | wedding identity, date, venue, lifecycle, privacy | wedding site, dashboard, settings |
| Guest experience | Guest and RSVP records | invitations, attendance, meals, dietary needs, check-in | guest list, RSVP, QR and check-in |
| Planning controls | Planner operational records | tasks, budget, vendors, timeline, seating | task board, budget, vendor list, timeline, seating |
| Content and memories | Wedding content records | revisions, media, messages, contributions | content editor, media library, moderation |
| Billing and support | Business account billing/support | offer, subscription, billing cadence, cases | billing portal, invoices, support |

### Planning companies

| Department | System | Primary data points | Resource tools |
|---|---|---|---|
| Portfolio operations | Planning-company account and wedding links | active weddings, pipeline, account ownership | planner workspace, portfolio dashboard |
| Client delivery | Wedding memberships and engagements | authority, permissions, engagement status | client workspaces, approvals, collaboration |
| Templates and resources | Template and import/export records | reusable structures, versions, imports | template library, import/export, worksheets |
| Team governance | Business members and permissions | team members, roles, status, scope | team management, audit history |
| Commercial operations | Billing and enquiries | service packages, enquiries, subscription offer | billing portal, enquiry workflow, analytics |

### Vendors

| Department | System | Primary data points | Resource tools |
|---|---|---|---|
| Business profile | Provider profile | identity, service areas, contact, policies | profile editor, public listing preview |
| Services and packages | Provider offering and package records | category, inclusions, price range, capacity | offering editor, package manager |
| Portfolio | Provider portfolio records | media, links, captions, publication status | portfolio manager |
| Enquiries | Provider enquiry records | event date, location, budget, response status | enquiry inbox, response workflow |
| Verification and billing | Verification and billing records | legal checks, insurance, offer, subscription | verification center, billing portal |

### Venues

Venue accounts use the provider domain but receive venue-specific areas:

- venue profile and spaces;
- capacity, availability, amenities, accessibility, and policies;
- packages and event services;
- enquiries and site visits;
- verification, portfolio, billing, and support.

### Other business clients

Other clients receive a contract-defined department set. No generic customer account automatically receives planner, vendor, or couple tools.

## Segmented billing offer model

The new authoritative offer key combines the account audience and service bundle. Legacy plan codes remain as compatibility mirrors for existing UI, Stripe variables, and reports.

### Initial offer catalog

| Offer code | Account type | Display name | Billing posture | Legacy mirror |
|---|---|---|---|---|
| `couple_free` | couple | Couple Free | free | free |
| `couple_canon` | couple | Couple Canon | self-service, $15 monthly / $150 annual | starter |
| `planner_free` | planning_company | Planner Starter | free | free |
| `planner_professional` | planning_company | Planner Professional | self-service, $39 monthly / $390 annual | professional |
| `vendor_profile` | vendor | Vendor Profile | free listing foundation | free |
| `vendor_growth` | vendor | Vendor Growth | contract/configured price; unavailable until Stripe price is configured | enterprise |
| `venue_profile` | venue | Venue Profile | free listing foundation | free |
| `venue_portfolio` | venue | Venue Portfolio | contract/configured price; unavailable until Stripe price is configured | enterprise |
| `client_custom` | client | Business Custom | sales-assisted contract | enterprise |

The known Couple Canon and Planner Professional amounts preserve the existing approved Stripe catalog. Vendor, venue, and custom-client prices are not invented by this migration. They remain sales-assisted or unavailable for unattended Checkout until explicit prices and Stripe resources are approved.

## Database design

All tables live in `wewed_admin` and remain server-only.

### `ClientDepartmentDefinition`

Platform catalog of valid department definitions:

- department key;
- account type;
- name and description;
- system key;
- data-point keys as JSON array;
- resource-tool keys as JSON array;
- default-enabled flag;
- status and sort order.

### `BusinessAccountDepartment`

Assignment of valid departments to one business account:

- business account ID;
- department key;
- status (`enabled`, `disabled`, `pending`);
- version and timestamps;
- optional actor attribution.

A composite unique constraint prevents duplicate assignments. The foreign keys ensure a department cannot point outside the platform catalog.

### `BillingOffer`

Private offer catalog:

- offer code;
- allowed account type;
- display name and description;
- billing model (`free`, `subscription`, or `contract`);
- legacy plan mirror;
- currency and monthly/annual amounts;
- department entitlements and resource-tool entitlements;
- self-service flag, status, and version.

### `BusinessAccountBillingProfile`

One account-aware billing profile per business account:

- business account ID and immutable account type mirror;
- current offer code;
- interval, status, source, and period end;
- version and private metadata;
- created/updated attribution.

The profile does not copy customer PII. Stripe customer/subscription IDs remain in the existing environment-isolated metadata until a later dedicated token/reference migration.

## Backfill and compatibility rules

1. Insert department definitions and billing offers idempotently.
2. Assign only default departments that match each existing account's `type`.
3. Create a billing profile only when one does not already exist.
4. Map existing records deterministically:
   - couple + `starter` -> `couple_canon`;
   - planning company + `professional` -> `planner_professional`;
   - free accounts -> the account-type free/profile offer;
   - venue/vendor/client paid or enterprise records -> their contract offer;
   - internal accounts are excluded.
5. Do not update, delete, merge, or reinterpret existing BusinessAccount, PaymentRecord, Stripe metadata, wedding, member, planner, provider, or audit rows.
6. Existing generic plan fields remain readable and are updated only as a compatibility mirror after a verified live Stripe synchronization.

## Application changes

### Admin governance

- Add a **Client departments & systems** section.
- Show department definitions grouped by account category.
- Show each account's enabled departments, systems, data points, and tools.
- Show account-aware billing offer, billing model, legacy mirror, cadence, and status.
- Add an audited, scoped action to replace an account's enabled departments using only definitions valid for its category.
- Restrict internal records and cross-account traversal through the existing scope resolver.

### Billing portal

- Return only offers allowed for the resolved account type.
- Display account-category language and resources rather than a couple-only card for every customer.
- Submit `offerCode`, not a generic plan, to Checkout.
- Accept legacy plan input only as a deterministic compatibility path for the resolved account type.
- Reject account/offer mismatches before creating a Stripe Customer or Checkout Session.

### Stripe

- Resolve prices by offer code.
- Reuse existing Canon and Forever Stripe variables only for `couple_canon` and `planner_professional`.
- Use dedicated future environment variables for vendor and venue offers; do not fall back to another audience's price.
- Write `offerCode`, `accountType`, legacy plan, interval, environment, and business account ID into Checkout and subscription metadata.
- During reconciliation, verify the offer belongs to the account type before any database write.

## Transaction and data-loop controls

- Every department or billing-profile mutation runs in one database transaction.
- Every Admin mutation writes a BusinessAuditLog row with actor, account, previous value, next value, and reason.
- Stripe webhook/reconciliation remains idempotent and account-bound.
- No customer data is copied into public catalog tables.
- No client-supplied table name, SQL fragment, department key, or offer code is trusted without allow-list validation.
- Private-schema privileges are revoked from PUBLIC, `anon`, and `authenticated`.
- The migration is additive and contains no `DROP TABLE`, `DELETE` of customer records, or destructive column alteration.

## Validation and release gate

### Database

- Apply all migrations to a clean PostgreSQL database.
- Verify migration idempotency and foreign-key integrity.
- Verify existing live row counts and identifiers before and after migration.
- Verify no existing BusinessAccount, PaymentRecord, membership, wedding, planner, provider, or audit rows change.
- Verify new profile counts equal eligible external account counts.
- Verify `anon` and `authenticated` retain no schema/table privileges.

### Contracts

- Fix the stale administrator invitation contract using current source names and the real migration path.
- Verify each account type receives only its own departments and billing offers.
- Verify a couple cannot purchase a planner/vendor/venue offer.
- Verify a planner cannot purchase a couple offer.
- Verify vendor and venue paid offers are not self-service without dedicated Stripe price configuration.
- Verify legacy plan input maps deterministically by account type.
- Verify Stripe metadata includes audience and offer identity.
- Verify Admin scope predicates remain present on department and billing reads/mutations.

### Application

- Run Admin governance, invitation, RBAC segmentation, registration, data-pipeline, pricing, Stripe, provider, planner, lint, TypeScript, production build, and browser release gates.
- Review the final diff and all review threads.
- Smoke-test `/admin`, `/admin/roles`, `/billing`, `/api/admin/governance`, `/api/billing/account`, and `/api/billing/sync` on Preview.
- Merge only when the exact head is green and the database verification report shows no changed legacy rows.

## Rollback posture

The feature can be disabled at application level while leaving additive catalog/profile rows intact. Because no existing records are deleted or re-keyed, rollback does not require restoring customer data. A later cleanup migration may remove the additive tables only after confirming no application version uses them; that cleanup is outside this release.