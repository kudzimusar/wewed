# Admin Command Centre Implementation and Verification Report

**Date:** 2026-08-07  
**Authoritative plan:** `docs/product/admin-command-center-taxonomy-responsive-plan-2026-08-07.md`  
**Live audit:** `docs/product/admin-command-center-phase0-live-database-audit-2026-08-07.md`  
**Validated application head before this report:** `ebfddbd4587b7160d9ffb7aa1a8ebd9195cc7fb9`

## 1. Purpose

This report maps the delivered implementation back to the documented plan and records the clean-database, browser, security, and live-production database evidence gathered before merge.

No item in this report changes the plan. Where implementation was deliberately deferred, that is listed explicitly.

## 2. Plan-to-implementation map

### Phase 0 — plan and live database audit: complete

Delivered:

- main implementation plan committed before application/schema changes;
- live database audit committed separately;
- confirmed canonical `BusinessAccount.type` populations;
- confirmed private PlatformAdministrator boundary;
- confirmed no proposed-table naming collisions;
- confirmed zero existing account-type mismatches;
- discovered the marketplace provisioning gap for newer vendor/venue accounts.

The initial audit found 132 external accounts without default departments or billing profiles. A final pre-migration check found the number had grown to 162 while marketplace population continued, validating the plan's decision to solve the issue at the BusinessAccount data-loop boundary rather than patching individual creation routes.

### Phase 1 — additive taxonomy and productivity schema: complete

Migration:

`prisma/migrations/20260807150000_admin_command_center_taxonomy/migration.sql`

Added private Admin structures:

- `AccountSubtypeDefinition`
- `BusinessAccountClassification`
- `InternalDepartmentDefinition`
- `InternalStaffProfile`
- `AdminWorkItem`
- `AdminSavedView`

Added controlled taxonomy definitions for couples, planning businesses, venues, vendor service categories, client businesses, and the Wewed internal parent account.

Added internal department definitions for Management, Operations, Marketplace, Customer Support, Billing & Finance, Compliance, Product & Engineering, and Sales & Partnerships.

Added database-level default provisioning so every supported new BusinessAccount receives its account classification, default client departments, and account-type-specific billing profile without overwriting any existing assignment/profile.

Added canonical vendor subtype refresh from `ProviderServiceOffering`, with manual classifications protected from automatic overwrite.

### Phase 2 — Admin API: complete

Route:

`src/app/api/admin/command-center/route.ts`

Delivered:

- account queries use the existing `requireWewedAdmin` and `buildBusinessAccountScopeSql` security layer;
- account classification remains subordinate to existing Admin permissions;
- workforce profile mutation is Super Admin only;
- billing data is redacted from roles without existing billing permission;
- provider claims, provider verification, and planner-relationship mismatch diagnostics are Operations/Super-Admin work;
- support work is exposed only to support-capable roles;
- persisted work items are category-authorized;
- work-item assignees must be active PlatformAdministrators;
- saved views are administrator-owned and cannot expand server-side account scope;
- governed mutations write to the existing business audit loop.

### Phase 3 — responsive shell and navigation: complete

Delivered:

- `src/app/admin/admin-responsive.css`;
- mobile Admin navigation no longer relies on horizontal scrolling;
- native-style five-slot mobile bottom navigation with `More` sheet;
- fixed Account Identity control is moved above the mobile-navigation safe area;
- below desktop widths, the existing 1050px-wide account table is presented as compact record cards rather than requiring a primary horizontal gesture;
- legitimate overflow regions retain stable scrollbar space;
- document-level horizontal overflow is clipped at the Admin shell boundary.

### Phase 4 — registry and command centre: complete

Delivered:

- operational Command Centre metrics;
- account population map;
- two-column phone / three-column tablet / six-column desktop account categories;
- scoped `My work queue` projections;
- compact account registry cards;
- account type/subtype search and filtering;
- saved account views.

### Phase 5 — Account 360 and organisation: complete for the planned first release

Delivered:

- Account 360 responsive drawer;
- separate overview/people, systems, commercial, and classification information;
- People & Organisation view;
- workforce membership shown separately from PlatformAdministrator authority;
- explicit `No platform admin access` state for internal workforce records without platform authority;
- Super Admin workforce metadata controls.

### Phase 6 — commercial catalog and saved views: complete for the planned first release

Delivered:

- read-oriented pricing catalog grouped by the existing segmented `BillingOffer` model;
- self-service versus controlled/contract posture remains explicit;
- saved account-registry view persistence.

Deliberately deferred per the plan:

- destructive/direct pricing-offer editing;
- automatic persisted work-item generation by database triggers/jobs;
- global cross-module command palette;
- exports and advanced keyboard shortcuts.

These were not required to establish the first safe Admin productivity foundation.

## 3. Exact-head release qualification

Dedicated workflow:

`.github/workflows/admin-command-center-ci.yml`

Exact application head qualified before the live migration:

`ebfddbd4587b7160d9ffb7aa1a8ebd9195cc7fb9`

All required steps passed:

- documented-plan source contract;
- Prisma validation;
- Prisma client generation;
- complete migration chain on clean PostgreSQL;
- migration status;
- zero Prisma schema drift;
- PostgreSQL taxonomy/provisioning/security integration contract;
- changed-file lint;
- production application build;
- Chromium installation;
- Admin responsive browser gate with flaky tests treated as failures.

Browser widths executed:

- 360x800
- 390x844
- 768x1024
- 1024x768
- 1280x720
- 1366x768
- 1440x1000

The browser contract verifies:

- no document-level horizontal overflow;
- phone 2-column account population density;
- tablet 3-column density;
- desktop 6-column density;
- native mobile Admin navigation and More sheet;
- Account Identity fixed-control separation from mobile navigation;
- governed Business Account registry behavior below desktop widths;
- Account 360 separation between classification, systems, lifecycle, and billing.

## 4. Live database non-regression gate

### Pre-migration snapshot

Captured at:

`2026-08-07T06:48:46.050817Z`

Protected pre-existing structures excluded only the two approved repair targets and the six not-yet-existing planned tables.

- protected pre-existing tables: **57**
- protected rows: **2,284**
- pre-migration aggregate digest: `4a18236d034d17d03cb69b0d454fc679`
- BusinessAccountDepartment rows: **65**
- BusinessAccountDepartment digest: `892b06af87e3ac6c65cbe3fd3429644c`
- BusinessAccountBillingProfile rows: **13**
- BusinessAccountBillingProfile digest: `8f77d99f37295874780b5b15a0f08d14`
- accounts missing default departments: **162**
- accounts missing billing profiles: **162**
- expected inserted default department rows: **810**

### Migration result

The exact CI-qualified migration was applied successfully to the live Supabase project through the migration API.

### Approved repair targets

Post-migration:

- BusinessAccountDepartment rows: **875** = 65 existing + 810 missing defaults;
- BusinessAccountBillingProfile rows: **175** = 13 existing + 162 missing profiles;
- accounts missing default departments: **0**;
- accounts missing billing profiles: **0**;
- department/account-type mismatches: **0**;
- billing/account-type mismatches: **0**;
- classification/account-type mismatches: **0**.

Most importantly, pre-existing target rows are byte-for-byte preserved at the cutoff:

- original 65 department rows digest remains `892b06af87e3ac6c65cbe3fd3429644c`;
- original 13 billing rows digest remains `8f77d99f37295874780b5b15a0f08d14`.

No existing department assignment or billing profile was overwritten.

### New private structures

Post-migration counts:

- BusinessAccountClassification: **176**
- AccountSubtypeDefinition: **50**
- InternalDepartmentDefinition: **8**
- InternalStaffProfile: **0**
- AdminWorkItem: **0**
- AdminSavedView: **0**

Zero-value workforce/work-item/saved-view tables are expected; the release does not infer staff employment metadata or manufacture work records from historical data.

### Security verification

For all six new tables:

- `anon` SELECT/INSERT/UPDATE/DELETE: **false**;
- `authenticated` SELECT/INSERT/UPDATE/DELETE: **false**.

Direct execution of the provisioning/subtype helper functions is also unavailable to `anon` and `authenticated`.

Required triggers are enabled:

- `validate_business_account_classification`
- `provision_business_account_defaults_after_insert`
- `refresh_system_vendor_classification_after_offering`

### Protected aggregate explanation

The post-migration protected table count and protected row count remained exactly **57 tables / 2,284 rows**, but the global digest differed from the pre-migration snapshot.

The post-cutoff audit isolated unrelated live activity after the snapshot in canonical tables that the migration does not write:

- `public.User`
- `public.UserProfile`
- `wewed_admin.BusinessAuditLog`
- `wewed_admin.PlannerEnquiry`
- `wewed_admin.PlannerShortlist`

This activity occurred while the live application remained active. The migration SQL does not update these structures. The approved migration targets were therefore verified separately against their pre-migration cutoff digests, and both matched exactly.

No database regression attributable to this migration was found.

## 5. Data-loop result

Before this release, marketplace-created vendor/venue accounts could be present in `BusinessAccount` without the default client-department and segmented-billing records introduced by the earlier billing migration.

After this migration:

- all current supported external accounts are inside the department and billing data loop;
- future supported BusinessAccount inserts are provisioned centrally by the database;
- vendor subtype classification follows canonical provider service offerings while remaining manually overridable through governed Admin controls;
- account type remains the authoritative security/operational population key;
- subtype never grants permission;
- workforce metadata never grants PlatformAdministrator authority;
- saved views never expand server-side scope.

## 6. Remaining release steps before merge

1. Commit this verification report.
2. Confirm the feature branch is still zero commits behind current `main`.
3. Rerun the exact-head dedicated workflow after this documentation-only commit.
4. Open the implementation pull request.
5. Require the repository's full cross-product release matrix in addition to the dedicated Admin Command Centre workflow.
6. Require a READY Vercel preview for the PR head.
7. Review all PR comments/threads and remediate real findings.
8. Merge only after the integrated exact head remains green.
9. After merge, verify the production deployment, Admin routes, runtime errors, and the live provisioning invariant again.

## 7. Definition-of-done assessment

The implementation meets the documented first-release definition of done at the feature-branch and live-schema level:

- external accounts, Wewed workforce, and platform administrators are separate concepts;
- account types remain canonical and controlled subtypes are additive;
- mobile Admin navigation no longer requires horizontal scrolling;
- the Business Accounts experience no longer depends on horizontal scrolling below desktop widths;
- phone/tablet information density is materially increased;
- fixed mobile controls have coordinated safe areas;
- Command Centre, work queue projections, Account 360, workforce organisation, pricing catalog, and saved views are implemented;
- workforce department metadata does not grant Admin access;
- segmented pricing remains account-type-specific;
- clean migration, build, security, and responsive browser gates are green;
- live database target rows are preserved and the missing provisioning gap is zero.

Production application promotion remains a separate final release decision after the pull-request release matrix.