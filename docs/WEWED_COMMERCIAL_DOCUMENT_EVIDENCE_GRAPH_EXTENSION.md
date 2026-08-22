# Wewed Commercial Document & Evidence Graph — Canonical UAT Extension

**Status:** CANONICAL PRODUCT / IMPLEMENTATION / CORRECTION MANUAL EXTENSION  
**Effective date:** 2026-08-22  
**Parent authority:** `docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_PLAN.md`  
**Implementation closeout:** `docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_CLOSEOUT.md`  
**Canonical production domain:** `https://wewed.pro`

## 1. Purpose and authority

This document records the UAT-derived extension of Wewed's Vault, Service Engagement, Contract, Budget, Payment and Contributions model into one **Commercial Document & Evidence Graph**.

It is not a new implementation phase and must not be described as “Phase 7.” The original Phase 0–6 workstream remains closed. This extension is the durable reference for:

- product behavior;
- implementation decisions;
- UAT interpretation;
- future corrections and regression fixes;
- manual/support procedures;
- document-access decisions;
- future document search and evidence discovery.

Where this extension is more specific about commercial-document linkage and stakeholder visibility than the parent plan, this extension governs that narrow subject. All parent-plan rules about private storage, immutability, auditability, historical truth, contract lifecycle and legal boundaries continue to apply.

## 2. Product thesis

Wewed must not behave like a folder of unrelated PDF uploads. It must behave like the governed record of a wedding's commercial relationships.

The canonical rule is:

> **Store once, link everywhere it is factually relevant, authorize by relationship, preserve history.**

A single authoritative Vault object may therefore be connected to several business records without cloning the file.

Example:

`Glass-Petal-Wedding-Contract.pdf`

may be linked to:

`Wedding → Vendor → Service Engagement → Contract/Agreement → Budget item → Payment → Direct-paying Contribution → Parties`

The file bytes remain one private `VaultObject`. Business context is expressed through `VaultLink` relationships and governed metadata.

## 3. Non-negotiable invariants

1. **One file, one authoritative Vault object.** Do not create duplicate physical files merely so the same document can appear in Vendor, Budget, Contribution or stakeholder workspaces.
2. **Many factual links are allowed.** One `VaultObject` may have several `VaultLink` rows to business entities.
3. **A link is not a copy and does not change the underlying document.**
4. **External agreement and Wewed-governed contract are different facts.** Uploading an external signed contract must never make Wewed claim that it authored, issued, accepted or made that agreement effective.
5. **Generated/issued Wewed contract artifacts remain immutable governed versions.** They are not ordinary editable uploads.
6. **Historical truth is preserved.** Corrections add or repair links/metadata; they do not rewrite an old agreement, payment or acceptance event.
7. **Private by default.** A commercial document never becomes public because it is linked to a public vendor profile, public campaign or public wedding page.
8. **Authorization follows stakeholder relationship, not possession of a storage URL.** Downloads use short-lived authorized URLs after app-level access checks.
9. **Direct contributor access is earned by the actual transaction relationship.** A pledge alone is not treated as a payment and must not automatically grant the contributor access to a vendor contract.
10. **Money movement remains independent from document attachment.** Uploading a receipt/contract must not increment Budget Paid, mark a contribution received, or create a payment.
11. **Evidence must remain traceable.** Upload, link, unlink, access, supersession and legal-hold-sensitive operations are auditable.
12. **No parallel document stack.** Vendor documents, Budget documents, Contribution evidence, contract artifacts and dispute evidence must converge on Wewed Vault rather than inventing separate storage systems.

## 4. Canonical commercial graph

The target relationship graph is:

```text
Wedding
  ├─ Vendor
  │   └─ Service Engagement
  │       ├─ Parties
  │       ├─ External agreement(s)
  │       ├─ Wewed Contract
  │       │   └─ Contract Version(s)
  │       ├─ Budget Item(s)
  │       ├─ Engagement Payment(s)
  │       ├─ Direct-paying Contribution(s)
  │       └─ Evidence / delivery / dispute records
  └─ Vault Object
      └─ Vault Links → any factually related entities above
```

A document's discoverability is therefore derived from its relationships, not from a folder path.

## 5. Document taxonomy

Commercial documents should use explicit document roles. The minimum vocabulary is:

| Role | Meaning |
| --- | --- |
| `existing_agreement` | External/pre-existing contract or signed agreement |
| `generated_contract` | Wewed-generated contract artifact |
| `amendment` | Amendment/change-order document |
| `proposal` / `quote` | Quotation, proposal or estimate |
| `invoice` | Vendor invoice |
| `receipt` | Receipt issued after payment |
| `payment_proof` / `proof` | Bank/payment evidence |
| `contribution_proof` | Evidence specifically supplied for a contribution |
| `service_evidence` | Delivery/completion evidence |
| `acceptance_evidence` | Evidence of service acceptance/completion where applicable |
| `dispute_evidence` / `evidence` | Other governed evidence |
| `insurance` / `licence` / `compliance` | Vendor compliance evidence |

Existing legacy role names may remain readable. New implementation should normalize toward this vocabulary without silently rewriting historical records.

## 6. Required entity links

For a commercial document attached to a Service Engagement, Wewed should create every relationship that is factually true at attachment time.

### 6.1 Always when available

- `service_engagement` → the governing Service Engagement;
- `vendor` → the wedding Vendor record;
- `budget_item` → each Budget item governed by that Service Engagement.

### 6.2 When money has actually moved

If a `DIRECT_VENDOR_PAYMENT` contribution has an actual contributor-funded payment against that Service Engagement, the same relevant commercial document may also be linked to:

- `WeddingContribution` → the actual direct-paying contribution;
- `engagement_payment` → the specific payment when document meaning is payment-specific.

A pending direct-vendor promise with `$0` actually paid is **not** automatically granted this direct-payer document relationship.

### 6.3 Contracts and versions

Wewed-generated artifacts keep their authoritative `contract` / `contract_version` relationship. Read models may additionally surface them through the parent Service Engagement, Vendor and Budget without cloning the artifact.

## 7. External contract versus Wewed contract

The UI must communicate these as separate sections/facts.

### Existing / external agreement

Example:

- Origin: outside Wewed
- Status: agreement on record
- File: original uploaded softcopy
- Wewed role: immutable reference/evidence after recording
- No claim that Wewed authored or originally executed it

### Wewed governed contract

Example:

- Generated from Wewed template
- Versioned
- Issued through Wewed
- Review and acceptance lifecycle governed by Wewed
- Immutable issued/effective artifact and hashes retained

A Deal Room may contain both at the same time.

## 8. Workspace visibility model

Visibility is relationship-scoped and role-scoped.

| Stakeholder | Default commercial-document visibility |
| --- | --- |
| Couple/client | Documents for their active wedding, subject to document sensitivity/legal hold rules |
| Assigned Planner/Coordinator | Operational documents for weddings they are authorized to manage |
| Service Provider/Vendor | Documents for Service Engagements in which that provider is the service-provider party; no access to unrelated wedding documents |
| Direct-paying Contributor | Only documents/payment evidence explicitly related to that contribution/payment; no blanket wedding or vendor-contract access |
| Wewed Admin | Governed support/dispute access under admin permission and audit rules |
| Other vendors / guests / public visitors | No access unless an explicit governed grant exists |

The system must never infer public visibility from contributor recognition settings, campaign publication, marketplace publication or wedding publication.

## 9. Required product surfaces

The same authoritative document should be discoverable from all relevant contexts.

### 9.1 Vendor / Service Engagement / Deal Room

- Attach existing contract/document directly in `Documents`.
- Display external agreements separately from Wewed-generated contract artifacts.
- Show document role, filename, file type, upload date and availability/scan state.
- Open through authorized short-lived Vault URL.

### 9.2 Budget

Each Budget row should be able to show related documents, for example:

- Contract
- Invoice
- Receipt/payment proof
- Delivery/service evidence

The Budget view must not create another document copy and must not change Paid merely because a document was attached.

### 9.3 Contributions

For a contributor who actually paid a vendor directly, the contribution detail should surface the relevant linked commercial documents in addition to contribution-specific evidence.

Pending promise-only contributions remain financially and access-wise distinct from actual direct payments.

### 9.4 Couple workspace

The couple should have a read-oriented wedding document surface backed by the same Vault objects. It may later evolve into a complete Wedding Documents library.

### 9.5 Vendor workspace

The provider should see only the documents connected to Service Engagements where that provider is the service-provider party. Provider access must use authenticated relationship checks or secure engagement grants, not the broad wedding-level Vault permission used for couple/planner roles.

## 10. Search and discovery roadmap

The long-term Documents & Contracts Library must search **metadata plus relationships**, not filename alone.

Minimum future search keys:

- original filename;
- display name;
- document role/type;
- vendor/company name;
- service category and service description;
- wedding/couple;
- planner;
- contract number/status/version;
- parties;
- contributor/direct payer where authorized;
- Budget item/category;
- invoice/payment reference;
- currency and amount where indexed safely;
- service/event date;
- upload/issue/effective date;
- tags and supersession state.

Search results must be authorization-filtered before they are returned. Search indexing must never become a side channel for discovering private document names or parties.

## 11. Proof-of-service lifecycle

The commercial evidence model should make the following chain understandable:

`Agreement → Payment → Delivery → Acceptance`

Typical evidence:

1. **Agreement** — contract, proposal, accepted quotation, amendment.
2. **Payment** — invoice, EngagementPayment, receipt, bank/payment proof, direct contributor funding record.
3. **Delivery** — delivery note, photographs, completion document or other service evidence.
4. **Acceptance** — completion confirmation, accepted milestone, governed contract/service acceptance where applicable.

For disputes and support, Wewed should be able to answer who agreed, what was agreed, what changed, who paid, what was delivered, and which evidence supports each fact.

## 12. Versioning, supersession and deletion

- Never overwrite an issued/effective Wewed contract artifact in place.
- External agreements uploaded as evidence remain immutable bytes after registration; a corrected/replacement file is a new Vault object.
- A replacement may mark an older document as superseded through metadata/relationship state, but the old object remains retained according to policy.
- Unlinking a document from one business context does not delete the object if other governed links remain.
- Hard deletion must remain exceptional and must respect retention/legal-hold controls.

## 13. Correction and reconciliation manual

When UAT finds a document in the wrong place:

1. Identify the authoritative `VaultObject` by id/checksum/filename.
2. Confirm the wedding and actual commercial relationship.
3. Add or repair the missing `VaultLink`; do **not** upload a duplicate file solely to fix visibility.
4. Do not alter payment, contribution or contract lifecycle state as a side effect.
5. Preserve old links unless they are factually wrong; if removing one, audit the unlink.
6. Re-run relationship-scoped access checks.
7. Verify all intended surfaces show the same Vault object id/checksum.
8. Verify unrelated stakeholders cannot discover or download it.

## 14. Implementation slices after 2026-08-22 UAT

### Slice A — current UAT correction / first delivery

- Generalize engagement document upload so both historical and current managed Service Engagements can use the same Vault-backed mechanism.
- Add `Attach document` / `Attach existing contract` in Deal Room Documents.
- On attachment, create one Vault object and links to the Service Engagement, Vendor and linked Budget items.
- When an actual direct contributor-funded vendor payment exists, link/surface the relevant document in that contribution.
- Surface related documents in Planner Budget rows.
- Preserve existing Contribution evidence upload while allowing commercial-context documents to appear in direct-payer contribution detail.
- Keep all downloads private and authorized.
- Add regression coverage proving “one object, many links” and proving upload does not mutate financial state.

### Slice B — stakeholder workspace projection

- Couple: read-only Wedding Documents / commercial-document projection.
- Vendor: relationship-scoped Service Engagement documents projection and download authorization.
- Reuse the same Vault objects/links; no copies.

### Slice C — indexed library and search

- Central Documents & Contracts Library.
- Relationship-aware indexed metadata.
- Filters by filename, parties, service, vendor, role/type, date and status.
- Permission filtering before result disclosure.

### Slice D — proof-of-service completion

- Delivery/completion evidence workflow.
- Service acceptance/acknowledgement where product/legal design allows.
- Evidence chain summary for dispute/support views.

## 15. UAT acceptance criteria

A release implementing Slice A is not complete until the following are demonstrated with real, truthful data:

1. A planner attaches one external contract to a current Service Engagement.
2. Exactly one new authoritative Vault object is created for the file.
3. The Deal Room displays and opens that object.
4. The Vendor/Service Engagement relationship is present.
5. Linked Budget items show the same document without another upload.
6. Budget Paid is unchanged by attachment/linking.
7. A pending `$0 paid` direct-vendor promise does not gain payment-derived visibility merely because it is pledged.
8. If a contributor has actually funded a direct vendor payment, the related contribution can show the same permitted document/evidence object.
9. Contribution promised/paid/remaining amounts are unchanged by document linkage.
10. Couple/planner access remains wedding-scoped.
11. Unrelated wedding users cannot open the object.
12. Vendor access, when enabled, is limited to its own Service Engagement relationship.
13. Audit records identify upload/link/access actions.
14. Existing historical engagement evidence still works.
15. Existing issued Wewed contract artifacts remain immutable and continue to verify normally.

## 16. Permanent architectural test

Future code changes must preserve this invariant:

> A commercial document is a governed Vault object whose business meaning is expressed by audited relationships. Product screens are projections of that graph, not separate document stores.

Any implementation that duplicates an attachment merely to make it visible in another Wewed module should be treated as an architectural regression unless a specific retention/legal requirement explicitly mandates a separate immutable artifact.
