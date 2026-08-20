# Contributions & Resource Accounting — Second Review

**Date:** 2026-08-19  
**Canon:** `WW-CONTRIBUTIONS-2026-08-19-01`  
**Review branch:** `fix/contributions-planner-alignment-20260819`  
**Baseline:** production `main` at `fe67432be3ca47989614987d1821d0ff5c3c172b`

## Why this review exists

The first Contributions release proved that the route, APIs, migrations, accounting invariants and production deployment were healthy, but it did not prove that a normal Planner user could discover and use Contributions through the canonical Planner UI. A production `200` for `/planner/contributions` is not feature-parity evidence.

The release is therefore reopened for product-integration review. It must not be called complete again until the exact remediation head passes source contracts, clean migration replay, build, executable desktop/mobile browser navigation, the broader Planner regression matrix and a READY Vercel preview.

## Broad goal

Wewed must treat third-party wedding support as a first-class resource-accounting layer:

`Contributor → Contribution → Allocation / Funding Source → Budget & Vendor Payment`

with governed connections to:

`Planner navigation · Overview · Tasks · Notebook · Guests · Vendors · Campaigns · Couple site · Invitations · AI · Admin analytics · Export`

The accounting language must remain understandable to non-accountants, currencies must never be silently combined, pledges must not become received cash, in-kind help must not become cash paid, and historical paid facts must not be guessed as couple-funded.

## Second-review findings

| Area | Baseline status | Finding | Required remediation |
|---|---|---|---|
| Core ledger/schema | PASS | Private `wewed_contributions` graph exists with contributor, campaign, contribution, allocation, payment-funding and task-link tables. | Preserve. |
| Cash / pledge / direct vendor / in-kind semantics | PASS | Domain helpers and API enforce distinct states and valuation behavior. | Preserve and regression-test. |
| Historical paid reconciliation | PASS | Existing paid facts remain source-not-recorded until classified; duplicate/double-use guards exist. | Preserve and regression-test. |
| Budget funding breakdown | PASS | Budget displays couple-funded, contributor-funded, other, unrecorded source, allocated contribution money and in-kind value. | Preserve. |
| Planner discoverability | **FAIL** | `PlannerModuleSlug`, core `WorkspaceTab` and visible `TABS` omit Contributions. | Register Contributions as a canonical Planner module. |
| Switch worksheet | **PARTIAL** | A one-off `router.push('/planner/contributions')` button exists outside the canonical module registry and is hidden behind collapsed Actions. | Remove the one-off path and use the canonical module list. |
| Direct Contributions route | **FAIL** | `/planner/contributions` renders a standalone auth/workspace page and bypasses `SecureWeddingPlanner` / `PlannerPortal`. | Route through the normal Planner shell and active-wedding context. |
| Desktop/mobile Planner navigation | **FAIL** | Core tab navigation and mobile section selector have no Contributions option. | Add visible Contributions option and browser proof on both responsive modes. |
| Planner Overview | **FAIL** | Overview has no contribution/resource-support summary or route into Contributions. | Add compact per-currency support summary, contributor counts and CTA. |
| Tasks | PASS | Contribution follow-up task creation and durable task link exist. | Preserve; exercise in source/browser contracts where practical. |
| Notebook | PASS | Contribution note creation uses existing Notebook note and entity-link action. | Preserve. |
| Contributor entity | **PARTIAL** | Schema supports phone, address, preferred contact and recognition/privacy fields, but creation UI only exposes a subset. | Expand contributor capture without forcing optional fields. |
| Campaign types | **PARTIAL** | Campaign data model/public renderer support categories, but Planner creation hard-codes `HONEYMOON`. | Provide governed campaign type choices and API validation. |
| Public wedding site | PASS | Published campaign bridge replaces/falls back to the existing registry and keeps contributor identity private. | Preserve. |
| Invitation gifting | PASS | Invitation shows gifting information only when a published invitation-visible campaign exists. | Preserve. |
| Public privacy | PASS | Public campaign API does not expose contributor identity or individual contribution records. | Preserve. |
| CSV export | PASS | Private contribution export route exists. | Preserve. |
| AI context | PASS | Private Planner AI context route exists. | Preserve. |
| Admin analytics | **PARTIAL** | Financial Contributions analytics endpoint exists, but this must not be confused with the legacy GuestContribution moderation UI. | Document the boundary; expose an Admin-facing financial summary if the Admin command centre has an appropriate governed surface. |
| Dedicated Contributions CI | **FAIL** | Workflow runs schema/unit/source/build checks only; it does not execute browser navigation and does not explicitly watch all canonical Planner routing files. | Extend path coverage and add executable Contributions UI/browser gate. |
| Broader Planner regression | PASS on first release, requalification required | Full Planner CI was green on the first release head, but it lacked an assertion that Contributions was actually reachable. | Re-run full matrix on the corrected exact head. |

## Remediation acceptance criteria

1. `Contributions` is a member of the canonical Planner route/module registry.
2. It is visible in the normal desktop module navigation and mobile Planner section selector without opening a hidden secondary menu.
3. `Actions → Switch worksheet` uses the same module registry and does not carry a separate Contributions exception.
4. Direct navigation to `/planner/contributions` stays inside the normal Planner header, adaptive navigation, active-wedding selector and project context.
5. Switching weddings remounts Contributions against the newly active wedding, with no cross-wedding data leak.
6. Overview shows a compact Contributions/resource-support panel. Multi-currency values are rendered separately; they are never summed silently.
7. Contribution creation remains plain-language and responsive and supports the Contributor entity fields that are useful at capture time without making optional details mandatory.
8. Campaign creation offers the governed contribution-campaign categories rather than forcing every campaign to be Honeymoon.
9. Existing Budget, vendor-payment, allocation, task, Notebook, public-site, invitation, AI/export and privacy behavior remains intact.
10. Source contracts fail if Contributions disappears from the canonical route registry, visible Planner tabs, Overview, or standard Planner shell.
11. An executable Playwright test proves desktop and mobile reachability and direct-route persistence.
12. Exact remediation head is current with `main`, all applicable repository workflows are green, the exact-head Vercel preview is READY, and production smoke verification is completed after merge.

## Release rule

**Do not merge on route/build success alone.** The feature is complete only when a user can reach it through the normal Planner UI and the release gates assert that discoverability as a contractual behavior.
