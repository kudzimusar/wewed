# Wewed Vault, Contracts & Transaction Governance — Agent Canon

**Status:** CANONICAL POINTER — PHASE 0–6 IMPLEMENTATION COMPLETE; MANUAL PRODUCT UAT NEXT  
**Architectural source of truth:** `docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_PLAN.md`  
**Implementation-status authority:** `docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_CLOSEOUT.md`

The closeout document supersedes only the old pre-implementation authorization/status wording in the canonical plan. The plan's architecture, security boundaries, legal boundaries, lifecycle rules and product principles remain authoritative.

Any agent working on storage, uploads, communications attachments, Planner vendor documents, Service Engagements, digital contracts, contract branding, acceptance/signature-equivalent consent, amendments, payment proof/reconciliation, disputes/evidence, planner notes attachments, wedding website media, couple media, post-wedding archives, or contract intelligence **must read both the canonical plan and the implementation closeout before changing code or schema**.

## Non-negotiable rules

1. Wewed Vault is the common storage/evidence layer; modules reference Vault objects rather than inventing unrelated file URLs.
2. A paid vendor must be represented by a wedding-specific Service Engagement, not only a Vendor row.
3. Existing paid vendors are captured truthfully as Historical Engagement Records; do not fabricate retroactive Wewed contracts or acceptance timestamps.
4. Wewed owns/authors and brands the standard contract framework, while Wewed is not automatically a commercial contracting party.
5. Standard planner-managed material amendments require Couple/Client + Planner + Vendor acceptance of the same exact version unless an explicitly recorded authority model says otherwise.
6. Accepted/effective contract versions are immutable. Amendments create new versions; old versions remain preserved and verifiable.
7. Communications attachments are governed Vault objects and may be promoted to engagement/payment/dispute evidence.
8. Admin has support/investigation authority but cannot secretly alter an effective contract or impersonate party acceptance.
9. Couple/wedding website media must be preservable in the Vault through post-wedding archive lifecycle; public display is explicit publication, not public raw storage.
10. AI may assist explanation/classification/search but cannot consent, amend, adjudicate, or silently change contractual facts.

## Implemented canonical sequence

`Phase 0 Paid Vendor Record Rescue -> Phase 1 Vault + Communications Attachments -> Phase 2 Service Engagement + Branded Contract Generator -> Phase 3 Acceptance/Immutability/Amendments -> Phase 4 Payments/Evidence/Disputes -> Phase 5 Wedding Media Archive -> Phase 6 Intelligence/Analytics/Trust`

Phase 0 through Phase 6 are implemented and merged. There is no canonical Phase 7 in this plan. The next work in this workstream is manual UAT/acclimatization or defect correction discovered by UAT; do not invent another implementation phase merely because testing continues.

Do not manufacture production contracts, acceptances, payments, disputes, evidence or media solely to satisfy a release/closeout assertion. Use explicit controlled UAT data when a human product test is authorized.

## Regression rule

The cross-phase closure contract is `src/lib/vault-contracts-closeout.test.ts`. Any change to this workstream must preserve that contract together with the existing Phase 0–6 dedicated gates and repository-wide regression/browser matrix.

## PR rule

Any PR in this workstream must state either:

- `Vault/Contracts Canon impact: none` with a reason; or
- `Vault/Contracts Canon impact: updated` and update the relevant canonical/closeout documentation in the same PR.

Also follow the policy-impact rule in `docs/LEGAL_IMPLEMENTATION_NOTES.md`.
