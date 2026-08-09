# Session Closeout — Admin Productivity and Production Completion Plan

**Date:** 2026-08-09  
**Branch:** `feat/session-closeout-admin-productivity-20260809`  
**Base:** `main` at `a3cbe6585e38340021d561f30a864f2b362a408c`  
**Status:** Authoritative implementation and release plan. All changes in this closeout must map back to this document.

## 1. Objective

Close the current Admin/database workstream without expanding into unrelated product areas.

The closeout has three controlled stages:

1. **Production completion:** align the production application runtime with the already-merged Admin/database hardening state and prove live health.
2. **Deferred Admin productivity:** deliver the first-release items that were explicitly deferred from the Admin Command Centre plan: durable operational work items, governed pricing versioning/editing, a global Admin command palette, scoped exports, and keyboard productivity.
3. **Final qualification and closure:** run the full database, security, browser, cross-product and production release gates, merge only when the exact head is green, then record the final implementation report.

This plan extends and does not replace:

- `docs/product/admin-command-center-taxonomy-responsive-plan-2026-08-07.md`
- `docs/product/admin-command-center-implementation-report-2026-08-07.md`
- `docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md`
- `docs/product/database-integrity-live-audit-2026-08-09.md`

Their invariants remain authoritative.

## 2. Starting state confirmed before implementation

### Repository

- `main` contains PR #84 Admin Command Centre work.
- `main` contains PR #94 database-integrity hardening.
- current `main`: `a3cbe6585e38340021d561f30a864f2b362a408c`.

### Database

The production database already contains the PR #94 additive hardening migrations. Current verified invariants from the preceding release gate:

- missing candidate-backed BusinessAccount source IDs: 0;
- imported discovery candidates missing canonical BusinessAccount backlink: 0;
- missing Admin classification: 0;
- missing segmented billing: 0;
- supported accounts missing departments: 0;
- Guest/Wedding orphans: 0;
- PlannerTask/Wedding orphans: 0;
- provider/profile/offering account-link violations: 0;
- claim/profile/account mismatches: 0;
- integrity triggers enabled and helper functions private from untrusted roles.

### Production application

At the start of this closeout, Vercel production is still serving an older application deployment (`2a232e81...`) even though the merged database hardening is in `main`. The exact PR #94 application tree has already built successfully as a READY preview.

The closeout must not treat this as complete until the production runtime is aligned and smoke-tested.

## 3. Non-negotiable architectural rules

1. `BusinessAccount.type` remains the canonical account-population key.
2. Account subtype/classification never grants authorization.
3. `InternalStaffProfile` never grants PlatformAdministrator authority.
4. Existing Admin permission and scope checks remain authoritative for all new reads, mutations, exports and command actions.
5. New operational data references canonical records; it does not duplicate customer/provider/wedding/support/billing payloads.
6. Existing commercial assignments are historical facts and must never be silently rewritten when pricing definitions change.
7. Already-applied migrations are immutable. Any schema change uses a new additive migration.
8. Existing good customer, wedding, planner, provider, guest, payment, billing, membership and audit rows are protected data.
9. No new direct `anon`/`authenticated` access is introduced to private Admin structures or internal helper functions.
10. Every governed mutation requires a server-side authorization check and an auditable reason where the action changes business state.

## 4. Stage 1 — production completion

### 4.1 Resolve production runtime alignment

Goal: production must serve a tree that contains the merged PR #94 application code and all prior Admin Command Centre work.

Required checks:

- identify current production deployment SHA;
- trigger/retry production deployment without changing product behavior solely to bypass a transient host build-rate condition;
- require `target=production`, `state=READY`;
- confirm deployed Git SHA contains the merged database-hardening application change;
- no `.vercel.app` leakage requirement is changed by this closeout; `wewed.pro` remains the user-facing production entry point.

### 4.2 Production smoke

After production is aligned, smoke at minimum:

- `/admin`;
- `/admin/roles`;
- `/admin/client-operations`;
- Account 360 open/close;
- provider directory/profile;
- Admin provider-claim review route;
- planner workspace;
- Guest list load/save path.

### 4.3 Production health proof

- inspect Vercel runtime errors after the new production deployment;
- re-run the live relational integrity snapshot;
- prove no Admin provisioning, provider-link, Guest/Wedding or PlannerTask/Wedding invariant regressed.

Stage 1 is complete only when runtime and database are on a compatible, verified production state.

## 5. Stage 2A — durable Admin work items

### 5.1 Purpose

Turn important operational conditions into durable, idempotent Admin work without copying canonical business payloads.

### 5.2 Existing foundation

Reuse `wewed_admin."AdminWorkItem"`. Do not create a competing queue table.

### 5.3 Required behavior

Support durable work items for at least:

- provider claim review;
- provider verification;
- onboarding blocked/incomplete;
- billing attention;
- high-priority support cases;
- planner/account relationship mismatch where a stable canonical source exists.

### 5.4 Idempotency

One unresolved canonical issue must map to at most one open work item for the same `(source, resourceType, resourceId, category)` tuple.

The database should enforce the open-item uniqueness invariant where compatible with existing data.

### 5.5 Lifecycle

A work item may be:

- open;
- in_progress;
- blocked;
- resolved;
- dismissed.

Where source semantics are deterministic, source resolution should close the work item. Manual triage items remain manually governed.

### 5.6 Authorization

- read scope follows existing Admin scope and category permission;
- assignment target must be an active PlatformAdministrator;
- claim/verification work remains Operations/Super Admin;
- billing work remains billing-capable Admin;
- support work remains support-capable Admin;
- lifecycle mutation is audited.

## 6. Stage 2B — governed pricing offer management

### 6.1 Purpose

Allow billing-authorized administrators to create/version/retire commercial offers without rewriting historical client terms.

### 6.2 Existing foundation

Reuse:

- `BillingOffer`;
- `BusinessAccountBillingProfile`;
- account-type-specific department/entitlement definitions.

### 6.3 Versioning rules

- published/assigned offers are immutable commercial history;
- editing a published offer creates a new version rather than mutating the original terms;
- existing BusinessAccountBillingProfile assignments keep their historical offer/version until explicitly migrated through a governed account action;
- retiring an offer prevents new assignment but does not invalidate existing historical profiles;
- offer code + version/account type must be uniquely identifiable.

### 6.4 Mutation permissions

Pricing mutation requires existing billing-write authority or Super Admin. Every create/version/retire action writes an audit event and reason.

### 6.5 UI scope

Add a controlled editor to the existing Commercial area for authorized users. Read-only users continue to see only the catalog.

No destructive delete of an offer that is or has been assigned.

## 7. Stage 2C — global Admin command palette

### 7.1 Purpose

Provide one fast entry point for navigation and scoped record discovery.

### 7.2 Search scope

Initial searchable entities/actions:

- Admin destinations;
- BusinessAccounts available to the current Admin scope;
- provider profiles available through authorized account scope;
- internal workforce records where authorized;
- saved views;
- safe navigation actions such as opening Account 360 or Client Systems.

### 7.3 Security

The command palette must use server-authorized results. It must never fetch a global client-side index and filter locally.

### 7.4 UX

- desktop shortcut: `Ctrl/Cmd + K`;
- visible button remains available for mouse/touch;
- mobile exposes the same command/search capability through the Admin navigation/More interface;
- input shortcuts do not fire while typing in form controls.

## 8. Stage 2D — scoped exports

### 8.1 Initial export surfaces

- account registry current filtered view;
- operational work queue current filtered view;
- workforce directory current authorized view;
- pricing catalog current authorized view.

### 8.2 Rules

- export is generated server-side;
- server re-applies permission scope and filters;
- hidden/restricted billing data remains excluded;
- export requests are audited with screen, filter summary, row count and requesting administrator;
- no raw database dump functionality;
- CSV is required; XLSX may be added only if it does not broaden dependencies/risk unnecessarily.

## 9. Stage 2E — keyboard productivity

Initial shortcuts:

- `Ctrl/Cmd + K`: command palette;
- `g` then `a`: Accounts;
- `g` then `p`: People;
- `g` then `c`: Commercial;
- `/`: focus current registry/search when no form control is active;
- `Esc`: close palette/sheet/Account 360 where safe.

Rules:

- shortcuts are progressive enhancement only;
- every action remains reachable by pointer/touch;
- shortcuts do not override browser accessibility or text-entry behavior;
- shortcut help is discoverable from the command palette.

## 10. Database design additions for this closeout

Prefer the existing schema. New structures are allowed only when necessary.

Expected additive schema work:

1. Open-work-item uniqueness/index/validation on `AdminWorkItem` if current data permits.
2. Pricing-version support only if existing `BillingOffer.version` and status fields are insufficient for safe immutable versioning; otherwise reuse them.
3. No new table for command palette.
4. No new table for exports; audit through existing Admin/business audit mechanisms.
5. No new table for keyboard shortcuts.

Every migration must include:

- clean PostgreSQL compatibility;
- zero Prisma drift after migration chain;
- explicit privilege posture;
- regression SQL covering the new invariant.

## 11. Stage 3 — final qualification

### 11.1 Source and database gates

Require:

- documented-plan contract;
- Prisma validate/generate;
- complete clean migration chain;
- `prisma migrate status` clean;
- zero schema drift;
- Admin productivity PostgreSQL regression tests;
- existing database-integrity regression suite;
- lint;
- production build.

### 11.2 Cross-product workflows

Require every workflow that currently protects the Wewed ecosystem, including at minimum:

- core CI;
- Database Integrity;
- Admin Console;
- Admin Command Centre;
- Admin/Couple Consistency;
- Planner Marketplace;
- Provider Security;
- Provider Forms;
- Budget Data Integrity;
- Preview Data Safety;
- AI Wedding Architect;
- Production Integration Hardening.

No required red or flaky result may be waived because the change is “Admin-only.”

### 11.3 Browser qualification

Admin coverage must include:

- 360x800;
- 390x844;
- 768x1024;
- 1024x768;
- 1280x720;
- 1366x768;
- 1440x1000.

Browser tests must cover:

- no document-level horizontal overflow;
- mobile bottom navigation and More;
- Account 360;
- command palette keyboard and pointer opening;
- scoped search results;
- work queue filtering/assignment controls;
- pricing read/write permission split;
- exports not available where permission is missing;
- duplicate work-item/version invariants surfaced as controlled responses, not 500s.

### 11.4 Permission qualification

Test at least:

- Super Admin;
- Operations Admin;
- Billing Admin;
- Support Admin;
- restricted/viewer Admin.

Prove that each role sees only its permitted command results, work categories, pricing detail/mutations and exports.

## 12. Production database non-regression gate

Before any new live migration:

- capture live counts and repair/integrity snapshots for BusinessAccount, classification, departments, billing, provider relationships, work items, offers/profiles, Guest/Wedding and PlannerTask/Wedding;
- fingerprint existing AdminWorkItem and BillingOffer rows if a migration touches their structure;
- compute the exact expected changed rows.

After migration:

- all pre-existing protected rows remain unchanged except explicitly approved target metadata;
- no existing client offer/profile assignment changes automatically;
- no provider/discovery/Admin provisioning invariant increases above zero;
- no Guest/Wedding or PlannerTask/Wedding orphan appears;
- new triggers/indexes/functions are enabled and private as intended.

## 13. PR and merge gate

A closeout PR may merge only when all are true simultaneously:

1. branch is `0 behind main`;
2. exact-head dedicated and cross-product workflows are green;
3. no unresolved P1/P2 review thread;
4. exact-head Vercel preview is READY;
5. production pre-migration fingerprint matches the approved expected changes;
6. any qualified migration has been applied and post-migration proof is clean;
7. PR is non-draft and mergeable;
8. merge uses an exact-head SHA guard.

## 14. Post-merge production gate

After merge:

- production deployment for the merge commit/tree must become READY;
- `wewed.pro` Admin and provider smoke checks return successfully;
- no new runtime error cluster appears;
- database integrity snapshot remains clean;
- implementation report is updated with exact PR, merge SHA, production deployment and deferred items, if any.

## 15. Explicitly out of scope

Do not introduce in this closeout:

- internal communications/messaging system;
- AI model/provider expansion;
- new vendor population waves;
- major marketplace redesign;
- wedding-planner workflow redesign;
- payment-provider replacement;
- broad RLS redesign unrelated to a proven closeout blocker.

These require separate plans.

## 16. Definition of done

This session is closed only when:

- production runtime and database are aligned on the approved hardened foundation;
- durable Admin work items are idempotent, scoped and auditable;
- pricing offers can be safely created/versioned/retired without rewriting historical assignments;
- command palette search is server-scoped and usable by keyboard, pointer and mobile;
- exports are server-scoped and audited;
- keyboard shortcuts are accessible progressive enhancement;
- all database/security/browser/cross-product gates are green on the exact head;
- the PR is merged and production verified;
- the final implementation report records what was delivered and any deliberately remaining scope.
