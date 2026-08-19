# Wewed Contributions & Resource Accounting — Agent Canon

**Status:** CANONICAL POINTER — IMPLEMENTATION NOT YET AUTHORIZED  
**Stamp:** `WW-CONTRIBUTIONS-2026-08-19-01`  
**Full source of truth:** `docs/WEWED_CONTRIBUTIONS_RESOURCE_ACCOUNTING_PLAN.md`

Any agent working on Planner Contributions, Contributors, Budget funding-source attribution, direct vendor contributions, in-kind support, contribution campaigns, honeymoon/registry data, contributor recognition/thank-you, contribution links to Tasks/Notebook/Overview, or AI contribution reporting **must read the full canonical plan before changing code, schema, migrations, APIs, UI or tests**.

## Non-negotiable rules

1. “Paid” and “couple-funded” are not synonyms.
2. A pledge is never received cash or a completed vendor payment.
3. Cash given to the couple is available contributed funds until it is actually allocated/used.
4. A direct contributor-to-vendor payment remains an `EngagementPayment`; Contributions records its source of funds.
5. In-kind goods/services/time are separate from cash paid and any monetary value is clearly an estimate.
6. No contribution/payment/allocation may be double counted.
7. Existing source-less paid amounts remain legacy/unattributed until evidence or an authorized user classifies them; never silently backfill them as couple-funded.
8. Do not repurpose `GuestContribution`; that is the separate Our Village memories/advice/blessings/wishes system.
9. Do not create parallel Budget, Payment, Vault, Task, Notebook, Registry or evidence systems.
10. Contributor identity/contact/amount is private by default. Public campaign and recognition data require explicit publication controls.
11. Contributions UI must be intentionally usable on phone, tablet and desktop and follow the existing adaptive navigation rule against new persistent floating-control sprawl.
12. AI may summarize/suggest but may not invent funding sources, treat pledges as receipts, invent FX rates, or autonomously mutate financial facts.
13. Core financial allocation/reconciliation is server-authoritative and wedding-scoped.
14. Reconciled/verified financial facts require auditable correction/reversal semantics rather than silent destructive rewrites.
15. This scope intersects the existing Vault/Contracts/Transaction Governance canon; preserve its Service Engagement, EngagementPayment, evidence, audit and authorization invariants.

## Canonical implementation sequence after explicit approval

`Phase 0 Canon/Inventory -> Phase 1 Data Foundation -> Phase 2 Contributions Workspace -> Phase 3 Budget/Payment Attribution -> Phase 4 Tasks/Notebook/Overview/Vendors -> Phase 5 Campaign/Honeymoon/Invitation -> Phase 6 Recognition/Import-Export/AI -> Phase 7 Analytics/Hardening/Production Qualification`

Do not skip later-phase requirements merely because an earlier phase is being implemented. Do not start runtime implementation until the user explicitly authorizes implementation after reviewing the plan.

## PR rule

Any PR in this workstream must state either:

- `Contributions Canon impact: none` with a reason; or
- `Contributions Canon impact: updated` and update the canonical plan in the same PR.

Also state the applicable Vault/Contracts Canon impact when the change touches Service Engagements, payments, evidence, contracts or Vault data.
