# Wewed Vault, Contracts & Transaction Governance — Agent Canon

**Status:** CANONICAL POINTER  
**Full source of truth:** `docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_PLAN.md`

Any agent working on storage, uploads, communications attachments, Planner vendor documents, Service Engagements, digital contracts, contract branding, acceptance/signature-equivalent consent, amendments, payment proof/reconciliation, disputes/evidence, planner notes attachments, wedding website media, couple media, or post-wedding archives **must read the full canonical plan before changing code or schema**.

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

## Implementation order after explicit approval

`Phase 0 Paid Vendor Record Rescue -> Phase 1 Vault + Communications Attachments -> Phase 2 Service Engagement + Branded Contract Generator -> Phase 3 Acceptance/Immutability/Amendments -> Phase 4 Payments/Evidence/Disputes -> Phase 5 Wedding Media Archive -> Phase 6 Intelligence/Analytics/Trust`

Do not delete later-phase requirements merely because the current branch implements an earlier phase.

## PR rule

Any PR in this workstream must state either:

- `Vault/Contracts Canon impact: none` with a reason; or
- `Vault/Contracts Canon impact: updated` and update the canonical plan in the same PR.

Also follow the policy-impact rule in `docs/LEGAL_IMPLEMENTATION_NOTES.md`.
