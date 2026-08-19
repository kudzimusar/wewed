# Wewed Contributions & Resource Accounting Plan

**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN — IMPLEMENTATION NOT YET AUTHORIZED  
**Stamp:** `WW-CONTRIBUTIONS-2026-08-19-01`  
**Baseline:** `38b86d462728c9d2939e2e3e2bc848ef668594d5` (`main`, after PR #158 Vault/Contracts Phase 0–6 closeout)  
**Canonical date:** 2026-08-19  
**Canonical domain:** `https://wewed.pro`  
**Primary scope:** Planner + Couple + Budget + Vendors/Service Engagements + Payments + Tasks + Notebook + Overview + Wedding Website/Invitation + AI + Admin + Vault/Evidence  
**Implementation state:** Planning/documentation only. No runtime implementation is authorized by this document alone.

This document is the authoritative product, data, UX, integration, migration, testing and release reference for the Wewed **Contributions** workstream. Future implementation commits, pull requests, UAT records, fixes and release closeout records for this scope must reference stamp `WW-CONTRIBUTIONS-2026-08-19-01`.

If an implementation choice conflicts with this document, either bring the implementation back into conformance or amend this document explicitly before the conflicting change is merged. Do not silently reinterpret the plan after code has been written.

This plan extends the current Wewed planner and the completed Vault/Contracts/Transaction Governance architecture. It must not create a competing budget, payment, evidence, task, notebook, registry or guest-contribution system.

---

## 1. Product problem and objective

A wedding is not funded only by the couple. Parents, relatives, friends, employers, churches, sponsors, vendors and guests may contribute money, direct vendor payments, goods, services, time, discounts, materials, honeymoon gifts or other resources.

The current planner can record what something costs and how much is paid, but that does not always answer the more important question:

> **Whose money or resources actually covered the wedding?**

Without source-of-funds attribution, a USD 1,000 vendor payment made by a parent can appear economically identical to USD 1,000 paid by the couple. That can cause Wewed to overstate the couple's personal expenditure, misunderstand outstanding responsibility, obscure family/community support, and give AI or reporting an incomplete financial picture.

The product objective is therefore:

> **Give Wewed one clear, non-accountant-friendly contribution and resource-accounting layer that records who contributed, what they contributed, whether it was cash or in kind, where it went, whether it was merely pledged or actually received/delivered, how it affected a budget item or vendor payment, and whether the contributor has been acknowledged — without double counting money or confusing public gifting with internal accounting.**

The resulting system must support both operational planning and the human reality of a wedding: a couple should be able to know not only what was spent, but who helped make the wedding possible.

---

## 2. Current repository reality to preserve

Implementation must begin from the current Wewed build rather than creating parallel systems.

### 2.1 Existing financial and commercial foundation

The current repository already has:

- `Wedding` as the main wedding/project scope;
- `BudgetItem` with estimated cost, actual cost, paid amount, currency, due date, vendor and Service Engagement linkage;
- `ServiceEngagement` as the wedding-specific commercial relationship with a vendor;
- `EngagementPayment` for recorded engagement payments;
- `Vendor` for provider identity and planning metadata;
- Vault objects/evidence and contract/payment governance from the completed Vault/Contracts workstream;
- audit/event foundations that must remain authoritative for important state changes.

The Contributions implementation must extend this graph. It must **not** create a second payment ledger or treat a contribution as a substitute for an `EngagementPayment` when an actual vendor payment occurred.

### 2.2 Existing Planner surfaces

The Planner already contains operational worksheets including Tasks, Budget, Vendors, Guests, Timeline and Seating, with adaptive navigation and worksheet-action rules. Contributions should become a first-class Planner worksheet/destination while respecting the existing responsive navigation architecture and the rule against new persistent floating-control sprawl.

### 2.3 Existing Notebook foundation

Notebook already supports wedding context, private Quick Notes and future/actual record linking. Contributions and Contributors should become linkable Notebook entities rather than inventing a separate notes field as the only way to preserve context.

### 2.4 Existing wedding-site gifting surface

The public wedding site already has a Registry/Gifting presentation with an example Honeymoon Fund and metadata such as goal/raised/progress. Today that presentation is content-oriented. The target state is for published contribution campaigns to be driven from the Planner data pipeline rather than maintained as an unrelated public value.

### 2.5 Existing semantic collision: `GuestContribution`

Wewed already uses the word “contribution” for guest-created memories, advice, blessings, funny stories and wishes. That existing `GuestContribution`/“Our Village” feature is **not financial/resource Contributions**.

Canonical naming rule:

- **Contributions** — new financial/in-kind resource feature visible in Planner.
- **Our Village / Guest Messages** — existing memories, advice, blessings, wishes and story submissions.
- Internal new financial models must use explicit names such as `Contributor`, `WeddingContribution`, `ContributionAllocation` and `ContributionCampaign`; do not overload or repurpose `GuestContribution`.

### 2.6 Active Planner UAT must remain separate

At the time this plan is stamped, Planner functional UAT is active. Contributions implementation must not be mixed into an unrelated in-progress UAT defect or silently change task/budget behavior merely to advance this feature. A Contributions implementation should begin from a clean, known baseline and receive its own regression/UAT stream.

---

## 3. Canonical product principles

Future agents must preserve these principles.

1. **Financial truth before convenience.** “Paid” and “couple-funded” are not synonyms.
2. **Source of funds is explicit.** A payment/value can be funded by the couple, a contributor, multiple sources, or remain legacy/unattributed until reconciled.
3. **Pledge is not receipt.** A promised contribution must never be counted as money received or a vendor payment completed.
4. **Contribution is not automatically payment.** Cash given to the couple becomes available contributed funds; it does not mark a budget item/vendor paid until allocated/used.
5. **Direct vendor payments reconcile to real payments.** If a contributor pays a vendor, the vendor payment remains an `EngagementPayment`; the contribution is its funding source.
6. **In-kind is not cash.** Goods, services, labour and materials are tracked separately from cash paid. Optional estimated values must be visibly estimates.
7. **No double counting.** The same USD 500 must never simultaneously increase received cash, paid-to-vendor cash and available balance as though it were three different resources.
8. **One contributor, many contributions.** Contributor identity is reusable and not duplicated into every contribution row.
9. **One contribution, many uses.** A USD 5,000 family contribution may be allocated across multiple budget items.
10. **One payment, many funding sources.** A USD 1,000 vendor payment may be funded USD 600 by the couple and USD 400 by a contributor.
11. **Existing records are not retroactively fictionalized.** Historical paid amounts must not be silently classified as couple-funded.
12. **Public gifting is opt-in and restrained.** The wedding site may share optional contribution/registry information without turning the invitation into a solicitation page.
13. **Privacy by default.** Contributor emails, phone numbers, internal notes and financial amounts are never public by default.
14. **Plain language first.** The UI should explain the financial reality without requiring accounting vocabulary.
15. **Sophistication through progressive disclosure.** Simple entry first; advanced allocation, verification, evidence and history remain available when needed.
16. **Mobile is a primary surface.** Phone and tablet workflows must be intentionally designed, not desktop tables squeezed smaller.
17. **Editing is safe and easy.** Ordinary corrections are simple while verified/linked financial facts receive stronger audit/reversal protections.
18. **Existing Wewed systems remain authoritative.** Budget, Service Engagement, EngagementPayment, Vault, Tasks, Notebook, wedding-site content, permissions and audit infrastructure are extended rather than duplicated.
19. **AI may assist, never fabricate financial facts.** AI can summarize, suggest allocations and identify gaps, but user confirmation remains required for financial mutations.
20. **Recognition is part of the product.** Wewed should help the couple remember and thank the people who contributed, without forcing public recognition.

---

## 4. Product vocabulary

Use these names consistently in product, schema and documentation.

### Contributor
A person, household, family, company, church, sponsor, community group, vendor or other entity that provides or promises value toward the wedding or a related campaign.

A Contributor may optionally link to an existing `Guest`, Wewed user or organization, but does not have to be a wedding guest.

### Wedding Contribution
A single promised or fulfilled contribution of money, goods, services, labour, discount or other value for one wedding.

Examples:

- “Bride's parents gave USD 2,000 cash.”
- “Aunt paid florist USD 600 directly.”
- “Uncle supplied 20 crates of drinks.”
- “Friend provided photography service free of charge.”
- “Venue waived USD 500.”
- “Guest contributed USD 100 to honeymoon fund.”

### Contribution Allocation
The explicit application of contribution value to one or more wedding uses/budget items. A cash contribution given to the couple can remain unallocated until actually assigned.

### Payment Funding Allocation
The source-of-funds link for a real `EngagementPayment`. It states how much of that payment came from the couple, a specific Wedding Contribution or an acknowledged legacy/unattributed source.

### Contribution Campaign
A couple-controlled public or private purpose/fund such as Honeymoon Fund, Future Home Fund, Wedding Support, Charity in Our Honour or a specific experience/item. A campaign is presentation and intent; actual received contributions remain Wedding Contribution records.

### In-kind Contribution
Goods, materials, services, time or labour provided without the same cash outflow from the couple. An estimated monetary value is optional and must remain labeled as an estimate.

### Direct-to-vendor Contribution
A contribution where the contributor pays the vendor/service provider rather than transferring cash to the couple.

### Received Contribution Cash
Contribution money actually received into the couple/planner-controlled pool and not merely promised.

### Unallocated Contribution Cash
Received contribution cash that has not yet been assigned/used against a budget item or payment.

### Legacy/Unattributed Funding
A historical payment/paid amount whose actual funding source is unknown or not yet reconciled. This state is required to preserve truth during migration.

---

## 5. Contribution taxonomy

The system must support at least these user-facing contribution types.

| Type | Example | Cash? | Can link to payment? | Optional estimated value? |
| --- | --- | --- | --- | --- |
| Cash to couple | Parent transfers USD 2,000 | Yes | When later used | n/a |
| Direct vendor payment | Aunt pays florist USD 600 | Yes | Yes, directly | n/a |
| Goods/materials in kind | Drinks, flowers, beef, stationery | No | Usually no | Yes |
| Professional service in kind | Photography, makeup, MC | No | Usually no | Yes |
| Time/labour | Family decor/setup/transport help | No | No | Yes |
| Discount/concession/sponsorship | Venue waives USD 500 | No cash transfer | May affect commercial amount | Yes/derived |
| Honeymoon/experience gift | Guest gives USD 100 | Usually yes | Not necessarily wedding vendor payment | n/a |
| Other | Any meaningful wedding resource | Depends | Depends | Optional |

Implementation may use stable internal enum/string codes, but UI labels must remain human-readable.

### 5.1 Contribution route/destination

Each contribution should state how value flows:

- `TO_COUPLE` — cash/value received by couple/planner-controlled pool;
- `DIRECT_TO_VENDOR` — contributor pays provider directly;
- `IN_KIND_TO_COUPLE` — goods/service delivered to couple/planner;
- `IN_KIND_TO_VENDOR` — goods/materials delivered directly to provider/event operation;
- `CAMPAIGN_EXTERNAL` — contribution is recorded against a campaign/external registry/payment route;
- `OTHER` — only with clear notes.

---

## 6. Lifecycle and status model

Avoid one overloaded status that tries to represent promise, receipt, verification, allocation and thanks simultaneously.

The implementation should preserve separate concepts.

### 6.1 Commitment state

- `PLEDGED` — promised, not yet received/delivered;
- `CONFIRMED` — contributor/organizer has confirmed intent/details;
- `CANCELLED` — pledge withdrawn/cancelled;
- `NOT_APPLICABLE` — for immediately received contributions where a pledge stage did not exist.

### 6.2 Fulfilment state

- `PENDING` — not yet received/delivered;
- `PARTIALLY_RECEIVED` — partial cash/goods/service delivered;
- `RECEIVED` — cash is in couple/planner custody;
- `DELIVERED` — in-kind item/service delivered;
- `PAID_DIRECT` — contributor-funded vendor payment occurred;
- `COMPLETED` — non-cash/time/service obligation completed;
- `FAILED_OR_CANCELLED` — expected fulfilment will not occur.

### 6.3 Verification state

- `UNVERIFIED`;
- `CONFIRMED_BY_USER`;
- `EVIDENCE_ATTACHED`;
- `RECONCILED` — linked/reconciled to the relevant payment/budget/evidence record where applicable.

### 6.4 Allocation state — derived where possible

- Unallocated;
- Partially allocated;
- Fully allocated;
- Not applicable.

### 6.5 Thank-you state

- Not due yet;
- To thank;
- Thank-you prepared;
- Thank-you sent;
- Acknowledged in person/other;
- No thank-you required.

These states should not force users through bureaucratic steps. Most users should be able to record a contribution in one short flow, with advanced states available only when useful.

---

## 7. Financial and resource-accounting semantics

This section is a hard implementation contract.

### 7.1 Separate the numbers Wewed reports

Wewed should eventually report these concepts separately:

- **Estimated Wedding Cost** — budget estimate.
- **Actual Wedding Cost / Cash Obligation** — actual recorded cash cost owed for budgeted purchases/services.
- **Cash Paid/Covered** — actual cash obligations satisfied by payments.
- **Couple-Funded Cash** — portion of cash payments attributable to the couple's own funds.
- **Contributor-Funded Cash** — portion of cash payments attributable to external contributors.
- **Contribution Cash Received** — cash actually received from contributors into the couple/planner-controlled pool.
- **Unallocated Contribution Cash** — received contribution cash not yet used/allocated.
- **In-kind Recognized Value** — optional estimated value of delivered goods/services/time; always presented separately from cash paid.
- **Pledged/Expected Contributions** — promises not yet received; never included in cash paid or cash received.
- **Outstanding Cash Obligation** — cash cost not yet paid.
- **Couple Remaining Responsibility** — a planning view of what the couple may still need to fund after correctly considering confirmed/received contributed resources, without treating unfulfilled pledges as cash.

### 7.2 Direct vendor payment example

Caterer actual cost: USD 5,000.

- Couple paid: USD 2,000.
- Bride's parents paid vendor directly: USD 2,000.
- Friend supplied ingredients valued at USD 500 in kind.
- Cash outstanding to caterer: USD 1,000.

Wewed should make all of these facts visible. It must not say the couple personally paid USD 4,000.

### 7.3 Cash-to-couple example

A parent gives the couple USD 2,000.

Immediately after receipt:

- Contribution cash received: USD 2,000.
- Unallocated contribution cash: USD 2,000.
- Vendor payments: unchanged.

Later the couple uses:

- USD 700 photographer;
- USD 500 dress;
- USD 300 catering;

Then USD 500 remains unallocated. The system must not count the original USD 2,000 receipt and the USD 1,500 later spending as USD 3,500 of independent contribution value.

### 7.4 Mixed payment example

A USD 1,000 photographer payment may be funded:

- USD 600 couple funds;
- USD 400 contributor funds.

`EngagementPayment.amount` remains USD 1,000. Payment Funding Allocations explain the source; they do not create a second USD 1,000 payment.

### 7.5 In-kind example

Uncle provides 80 kg of beef.

Record:

- type: goods/materials;
- quantity: 80;
- unit: kg;
- estimated value: optional, e.g. USD 480;
- destination: catering/caterer;
- delivery state;
- budget linkage;
- notes/evidence where useful.

The USD 480 is **estimated in-kind value**, not automatically USD 480 “paid”. If the caterer's actual cash invoice was already reduced because ingredients were supplied, the budget should reflect the actual invoice independently; do not add the same value twice.

### 7.6 Currency rule

A contribution always stores its own currency when monetary. Do not silently combine different currencies into one total without an explicit exchange-rate source/date or a separately approved conversion system.

Initial implementation may restrict financial allocation/reconciliation to matching currencies while still allowing the original contribution to be recorded in another currency.

### 7.7 Allocation integrity rules

Server-side rules must enforce:

- a pledge cannot be treated as received cash;
- allocated cash cannot exceed fulfilled/received available cash;
- a direct-to-vendor contribution cannot also remain available as unallocated cash;
- payment funding allocations cannot exceed the payment amount;
- total funding allocations for a fully attributed payment should equal the payment amount;
- one contribution can fund multiple payments/budget items only up to its available amount;
- in-kind quantity/value cannot be included in cash-paid totals;
- cancelled/reversed contributions do not remain available;
- cross-wedding allocation is forbidden;
- currencies must match or use an explicit approved conversion record;
- edits that would break existing reconciled allocations are rejected or require a governed adjustment/reversal workflow.

---

## 8. Canonical data model direction

Exact field names may be adjusted during implementation after schema inspection, but the entity boundaries below are authoritative.

### 8.1 `Contributor`

Recommended fields/concepts:

- `id`;
- `weddingId` or wedding-scoped relationship model as appropriate;
- display name;
- legal/organization name when relevant;
- contributor kind: individual / household / family / organization / vendor / other;
- relationship to couple;
- email;
- phone;
- address optional;
- linked `Guest` ID optional;
- linked user/entity ID optional;
- preferred contact method optional;
- public-recognition preference;
- anonymity/privacy preference;
- internal notes;
- created/updated/audit metadata.

A Contributor is reusable across multiple contributions for the same wedding.

### 8.2 `WeddingContribution`

Recommended fields/concepts:

- `id`;
- `weddingId`;
- `contributorId`;
- contribution type;
- title/short description;
- detailed description;
- monetary amount/currency when cash;
- estimated in-kind value/currency when applicable;
- quantity/unit for goods;
- route/destination;
- commitment state;
- fulfilment state;
- verification state;
- pledged date;
- expected date;
- received/delivered/paid date;
- campaign ID optional;
- related vendor/Service Engagement optional where applicable;
- notes;
- source: planner / couple / admin / import / campaign / API;
- createdBy/recordedBy metadata;
- audit timestamps.

Do not put a duplicated free-form contributor name/email on every row as the canonical identity when a Contributor record exists.

### 8.3 `ContributionAllocation`

This represents application of a contribution to a BudgetItem/use.

Recommended fields:

- contribution ID;
- budget item ID;
- amount/value allocated;
- currency;
- allocation kind (cash/in-kind recognition/etc.);
- note;
- createdBy;
- timestamps.

For financial integrity, prefer explicit foreign-key joins over a generic `entityType/entityId` polymorphic target for core financial allocations.

### 8.4 `PaymentFundingAllocation`

This links a real `EngagementPayment` to its funding source.

Recommended fields:

- payment ID;
- contribution ID optional;
- funding-source kind: couple / contribution / legacy-unattributed / other governed source;
- amount;
- currency;
- createdBy;
- reconciliation metadata;
- timestamps.

A contribution-funded direct vendor payment must resolve through this layer rather than being represented only by a note.

### 8.5 `ContributionCampaign`

Recommended fields:

- wedding ID;
- campaign type;
- title;
- description;
- optional target amount/currency;
- public/private state;
- whether target is displayed;
- whether amount raised/progress is displayed;
- payment/registry instructions or approved external URL;
- optional image/icon/accent presentation metadata;
- publication dates;
- invitation visibility;
- thank-you/public copy;
- timestamps.

Actual received value is computed from linked Wedding Contributions; campaign `raised` must not become an independently editable competing truth.

### 8.6 Record linking to Tasks/Notebook/Vault

Core financial links should be relational and explicit. Secondary context/evidence links can use/extend Wewed's existing record-link/evidence patterns.

Contributions should be linkable to:

- PlannerTask;
- Notebook note;
- BudgetItem;
- ServiceEngagement;
- EngagementPayment;
- Vendor;
- ContributionCampaign;
- VaultObject/evidence;
- Guest/Contributor where relevant.

---

## 9. Migration and legacy-data policy

This is a critical safety area.

### 9.1 Never assume existing paid amounts came from the couple

Current `BudgetItem.paidAmount` and historical `EngagementPayment` records may predate source-of-funds tracking.

Migration must **not** backfill them as `COUPLE_FUNDED` merely because no contributor is currently attached.

Use an explicit state such as:

- `LEGACY_UNATTRIBUTED` / “Funding source not recorded”.

This preserves historical truth and lets users reconcile later.

### 9.2 Do not fabricate historical payments

If a BudgetItem currently has a paid amount without a corresponding durable EngagementPayment, implementation must inventory and reconcile carefully. If a historical payment record must be created to preserve an existing paid fact, it must be explicitly marked historical/imported with known/unknown date and provenance. Do not invent payer, timestamp, reference or proof.

### 9.3 Guided reconciliation

After launch, Wewed may offer a non-blocking review:

> “Some previous payments do not yet say who funded them.”

Users can classify each as:

- Couple;
- Existing contributor;
- Add contributor;
- Mixed;
- Keep unspecified.

This review must not block ordinary Planner use.

---

## 10. Planner information architecture

Contributions becomes a first-class Planner destination.

Target worksheet/navigation concept:

`Overview | Tasks | Budget | Contributions | Vendors | Guests | Timeline | Seating | ...`

Exact responsive placement must follow the adaptive Planner navigation contract; do not add another permanent floating navigation element.

### 10.1 Contributions overview

The top of the Contributions worksheet should answer ordinary user questions quickly.

Suggested summary cards/metrics:

- Confirmed/received contribution value;
- Cash received;
- Direct vendor payments;
- In-kind estimated value;
- Pledged/not yet received;
- Unallocated contributed cash;
- contributors count;
- thank-yous outstanding.

Avoid showing eight dense cards on a phone. Use responsive prioritization and a compact “View breakdown” pattern.

### 10.2 Contribution ledger/list

Desktop/tablet can use a clear table/list with columns such as:

- Contributor;
- Contribution;
- Type;
- Value;
- Destination;
- Status;
- Date;
- Actions.

Phone should use stacked cards, not a horizontally compressed finance table.

Each row/card should answer:

- Who helped?
- What did they contribute?
- How much/value?
- Where did it go?
- Is it promised, received/delivered or verified?

### 10.3 Contributor detail

Contributor profile/detail should show:

- identity/contact details;
- relationship;
- privacy/recognition preference;
- all contributions;
- total cash/in-kind views without misleading currency mixing;
- linked budget/vendor uses;
- notes;
- thank-you history;
- optional guest linkage.

### 10.4 Contribution detail

Use progressive disclosure with a readable summary first:

- contributor;
- contribution description;
- amount/value;
- status;
- destination;
- allocations;
- vendor/payment relationship;
- evidence;
- linked tasks/notes;
- thank-you state;
- audit/history when relevant.

---

## 11. Entry and editing UX — non-accountant-first contract

The UI must be sophisticated underneath and simple on the surface.

### 11.1 Primary entry flow

A normal “Add contribution” flow should feel closer to recording a helpful event than completing an accounting form.

Recommended sequence:

1. **Who contributed?**
   - choose existing contributor;
   - add new contributor;
   - optionally connect to a guest.

2. **What did they contribute?**
   - money;
   - paid a vendor directly;
   - goods/materials;
   - a service;
   - time/help;
   - discount/sponsorship;
   - honeymoon/other gift.

3. **Where is it going?**
   - to us;
   - directly to a vendor;
   - specific budget item;
   - honeymoon/campaign;
   - not decided yet.

4. **What is the current state?**
   - promised;
   - received/paid/delivered;
   - partially received;
   - optional date/proof/notes.

Advanced allocation/evidence fields should remain collapsed unless needed.

### 11.2 Plain-language labels

Prefer:

- “Paid by” rather than “funding attribution”;
- “Money we received” rather than “cash inflow”;
- “Still available” rather than “unallocated balance” where appropriate;
- “Estimated value” clearly marked for in-kind items;
- “Promised” versus “Received” prominently separated.

Internal/accounting terminology can appear in reports/help text but should not dominate ordinary workflows.

### 11.3 Easy editing

- Common fields should support direct edit from a detail drawer/page.
- Contributor identity edits update the contributor record rather than copying changes across rows.
- Allocation changes should provide a clear preview of remaining available balance.
- On phone, edit forms should use one-column layouts, appropriate input types, clear Save/Cancel controls and keyboard-safe presentation.
- Do not require a full-page desktop dialog for a simple status update.

### 11.4 Financial-history protection

Before a contribution is verified/reconciled, ordinary corrections can be straightforward.

Once a contribution is linked to a reconciled vendor payment/evidence record, destructive edits must be restricted. Use correction/reversal/adjustment semantics and audit history rather than silently rewriting a financial fact.

---

## 12. Responsive UI contract

Contributions must be usable on desktop, tablet and smartphone from the first implementation phase that exposes UI.

### Wide desktop — approximately 1200 px and above

- summary metrics can display in a compact row/grid;
- contribution list may use a table;
- side/detail panels may expose allocations and context;
- filters and search remain visible without overwhelming the screen.

### Compact desktop/tablet — approximately 768–1199 px

- summary metrics wrap/condense;
- lower-priority columns disappear into row detail rather than horizontal overflow;
- actions group into a contextual menu;
- table/list remains touch usable;
- forms remain one or two columns only when readable.

### Phone — below approximately 768 px

- stacked contribution cards replace dense tables;
- one primary “Add contribution” action is obvious and reachable without introducing another competing permanent floating pill;
- filters use a compact sheet/menu or horizontally safe chip group;
- create/edit flows are single-column;
- money keyboard/input mode is used where appropriate;
- bottom sheets/modals respect safe areas and on-screen keyboard height;
- no content or Save action is covered by global navigation;
- no horizontal document overflow.

### Required geometry verification

At minimum:

- 320 px;
- 375 px;
- 390 px;
- 768 px;
- 1024 px;
- 1280 px;
- 1440 px.

---

## 13. Budget integration

Budget is the most important integration surface.

### 13.1 Budget-row funding summary

Each BudgetItem should eventually be able to reveal:

- actual cost;
- cash paid;
- couple-funded portion;
- contributor-funded portion;
- related in-kind support;
- outstanding cash obligation;
- funding source not yet classified where applicable.

Do not force every column into the default table. Keep the main budget visually calm and offer a funding breakdown through a secondary line, badge, details drawer or configurable columns.

Example:

**Florist — USD 1,500**  
Paid/covered: USD 1,300  
Couple: USD 500 · Aunt: USD 500 direct · Flowers in kind: USD 300 est.  
Cash outstanding: USD 500 if the in-kind contribution does not settle a vendor invoice; actual calculation follows the underlying commercial record.

### 13.2 Budget totals

The current broad “Paid” number should evolve toward a truthful breakdown rather than be relabeled without data support.

Recommended high-level budget reporting:

- Estimated;
- Actual;
- Cash paid;
- Couple-funded;
- Contributor-funded;
- In-kind value;
- Outstanding;
- Unattributed legacy paid amount where present.

### 13.3 Contribution allocation from Budget

From a BudgetItem, the user should be able to:

- “Add contribution”;
- allocate existing received contribution funds;
- record direct vendor payment by contributor;
- link an in-kind contribution;
- review who funded this item.

The same operation must update the canonical Contribution/payment allocation data, not a budget-only copy.

---

## 14. Vendor and Service Engagement integration

A paid vendor is already represented by Service Engagement/payment architecture. Contributions must respect that boundary.

### 14.1 Direct vendor payment

Workflow:

1. identify contributor;
2. identify Service Engagement/vendor;
3. record/choose the actual EngagementPayment;
4. attribute all or part of that payment to the contribution;
5. attach receipt/proof if available through Vault/evidence;
6. update contribution fulfilment/reconciliation state;
7. reflect the result in Budget funding breakdown.

### 14.2 Vendor visibility/privacy

A vendor may need to know that a payment was made and by what reference, but does not automatically need access to the contributor's private email, phone, relationship notes, total contribution history or unrelated wedding support.

Expose the minimum necessary payment identity/context according to current vendor permissions.

### 14.3 Discounts and donated vendor services

If the vendor itself contributes a discount/free service:

- vendor may also be the Contributor entity;
- commercial agreed/actual amount must remain truthful;
- concession/in-kind value is shown separately if needed;
- do not create a fake cash payment to represent a discount.

---

## 15. Tasks integration

Contributions should be linkable to Planner tasks without bloating the core task row with contribution-specific columns.

Useful actions:

- create follow-up task from a pledge;
- confirm contribution by a due date;
- collect/verify receipt;
- confirm vendor received payment;
- confirm in-kind delivery;
- return borrowed items;
- send thank-you.

Examples:

- “Confirm uncle's drinks delivery — 15 Oct.”
- “Verify florist received Aunt Rudo's USD 600 payment.”
- “Send thank-you to Mr & Mrs Moyo.”

Task status remains task status; contribution fulfilment remains contribution state. Linking them must not make one silently mutate the other unless an explicitly designed action is confirmed.

---

## 16. Notebook integration

Contributors and Contributions become linkable Notebook records.

Example note:

> “Dad agreed today to handle the remaining venue balance. Need to confirm whether he will transfer to us or pay the venue directly.”

The note can later link to:

- Contributor: Dad;
- WeddingContribution: venue balance pledge;
- BudgetItem: Venue;
- ServiceEngagement: Venue;
- follow-up PlannerTask.

Notebook remains the place for narrative context/decision history. It must not become the canonical monetary ledger.

Quick Note may optionally offer “Link to contribution” after save or from Notebook record linking; do not overload the quick-capture form with finance fields.

---

## 17. Overview / project dashboard integration

Overview should expose contribution health without becoming another full ledger.

Suggested module:

### Contributions

**USD 8,450 confirmed/received value**

- USD 4,200 cash received;
- USD 2,500 paid directly to vendors;
- USD 1,750 estimated in kind;
- USD 1,500 still pledged;
- 12 contributors;
- 4 thank-yous pending.

Then show a few recent/actionable items and `View Contributions`.

If currencies differ, do not manufacture a combined total. Group by currency or show separate values.

---

## 18. Couple wedding site, honeymoon and invitation pipeline

This is a direct target integration, not a separate future idea.

### 18.1 Contribution Campaign becomes the public source of truth

The Planner should own campaign configuration. The wedding site Registry/Gifting section renders only campaigns explicitly published by the couple/authorized planner.

Flow:

`Planner Contribution Campaign -> approved publication state -> wedding site Registry/Gifting section -> optional invitation link/QR -> recorded Wedding Contributions when actual contributions are known`

Do not maintain a disconnected “raised” number manually in public content if the canonical campaign can compute it from recorded contributions.

### 18.2 Supported campaign examples

- Honeymoon Fund;
- Future Home Fund;
- Wedding Support;
- Specific experience/item;
- Charity/community cause in the couple's honour;
- External store/registry.

### 18.3 Public presentation principle — information, not begging

Public copy should remain restrained and appreciative.

Default tone:

- presence is valued first;
- gifting/contributing is optional;
- couples can hide target and/or amount raised;
- no urgency/scarcity pressure;
- no automatic public contributor list;
- no public contributor amounts by default.

Couple controls may choose to display:

- purpose/description only;
- payment/registry instructions;
- target amount;
- progress/raised amount;
- no amounts at all;
- external registry link;
- campaign visibility on invitation/wedding site.

### 18.4 Invitation integration

Published campaigns may be included in invitation/share surfaces through:

- a tasteful “Gifting / Honeymoon” link;
- optional QR/deep link;
- section on the wedding site referenced from the invitation.

Do not inject a fund into every invitation by default.

### 18.5 Payment-processing boundary

A campaign does not imply that Wewed is a payment processor or merchant. Initial implementation may publish instructions/links and allow manual/verified recording of contributions.

Any future in-app payment collection must be separately designed for processor, fees, refunds, compliance, payout ownership, reconciliation and legal/billing boundaries. Do not fabricate a payment capability merely because Campaign exists.

---

## 19. Recognition and thank-you workflow

Contribution tracking should help couples remember people, not only money.

### 19.1 Private recognition history

Contributor detail should preserve:

- what they contributed;
- when;
- what it supported;
- private notes;
- thank-you state;
- acknowledgement history.

### 19.2 Thank-you workflow

Typical progression:

`Contribution received/delivered -> To thank -> Thank-you prepared -> Sent/acknowledged`

Wewed may offer:

- create thank-you task;
- draft thank-you with AI after explicit user request;
- filter “Need to thank”;
- bulk view/prepare without auto-sending.

### 19.3 Public recognition

Public recognition is always opt-in and must respect contributor preference.

Possible later presentation:

- contributor name only;
- “With thanks to our families/friends” grouped recognition;
- no amounts unless an explicit future product decision supports it.

Private financial detail must never leak through public recognition.

---

## 20. Vault, evidence and audit integration

A contribution may have supporting evidence:

- bank transfer proof;
- receipt;
- vendor receipt/reference;
- photo of delivered materials;
- invoice/credit note;
- sponsorship/discount letter;
- written pledge or agreement;
- delivery confirmation.

Use governed Vault objects/evidence links rather than a new upload system.

Important contribution state changes should emit audit events, including where appropriate:

- contributor created/merged;
- contribution created;
- pledge changed/cancelled;
- receipt/delivery confirmed;
- allocation created/changed/reversed;
- payment funding attributed/reconciled;
- evidence attached/removed under policy;
- campaign published/unpublished;
- sensitive recognition/privacy preference changed;
- financial correction/reversal.

Evidence and reconciled records must follow existing Vault/transaction-governance retention and deletion rules.

---

## 21. Permissions and privacy contract

### Couple/client

May view and manage their wedding Contributions subject to existing project role rules.

### Planner/coordinator

May record/manage Contributions according to wedding membership/role authority. Planner access does not create ownership of contributor funds or authority outside the existing project role model.

### Vendor

May see payment/service facts that current engagement permissions allow. Vendor does not automatically see full contributor profile/history.

### Admin

May access records for governed platform support, reconciliation/dispute/audit needs according to current admin authority. Admin cannot silently rewrite reconciled financial facts.

### Public guest/invitee

Can see only explicitly published campaign/gifting information. No private contributor list, email, phone, internal note, allocation history or hidden amount is exposed.

### Privacy defaults

- contributor identity private to authorized project users;
- email/phone never public by default;
- contribution amount private by default;
- public recognition disabled by default;
- campaign raised/progress display controlled separately from contributor identity;
- anonymous contribution can still be internally attributable to authorized users when necessary while remaining anonymous publicly.

---

## 22. Search, filter, import and export

### Search/filter

Useful filters:

- contributor;
- type;
- promised vs received/delivered;
- cash vs in-kind;
- direct-to-vendor;
- campaign;
- budget category;
- vendor;
- verification state;
- thank-you state;
- date range.

### Import

Later phase may support CSV/Excel import through Wewed's existing import engine. It must validate wedding scope, currency, duplicate contributor detection and contribution status. Historical imports must preserve provenance.

### Export

Contribution exports can support private planning/accounting use, but must respect permissions and should distinguish:

- contributor identity/contact;
- cash received;
- direct vendor paid;
- in-kind estimate;
- pledged;
- allocations;
- thank-you state.

No cross-currency total should be silently invented.

---

## 23. AI integration

Once the canonical data exists, AI can become significantly more useful.

Permitted assistance examples:

- “How much have we personally paid?”
- “How much of the wedding was contributor-funded?”
- “Which promised contributions are still outstanding?”
- “Which vendor balances have a confirmed contributor?”
- “Show everything Mum contributed.”
- “What contribution cash is still unallocated?”
- “Which contributors still need a thank-you?”
- “Create suggested follow-up tasks for unfulfilled contributions.”
- “Explain the difference between Paid, Couple-funded and Contributor-funded.”

AI rules:

- do not infer an unknown payer as the couple;
- do not convert a pledge into received money;
- do not invent exchange rates;
- do not create/reallocate/reverse a financial record without explicit user confirmation and server validation;
- show source records/links where possible;
- respect wedding permissions and contributor privacy;
- AI-generated thank-you text is a draft, never auto-sent without explicit action.

---

## 24. Admin and product analytics

Authorized internal analytics may help Wewed understand feature use without exposing private contributor detail unnecessarily.

Possible aggregate metrics:

- percentage of weddings using Contributions;
- cash vs in-kind usage distribution;
- direct-vendor-payment prevalence;
- average number of contributors per wedding;
- campaign adoption;
- percentage of legacy payments still unattributed;
- common budget categories receiving external support;
- thank-you workflow usage;
- contribution-record completion/verification rates.

Analytics must use privacy-minimized data and must not turn contributor contact information or family financial support into an advertising dataset.

---

## 25. Implementation phases

No phase should silently absorb later-phase behavior merely because the UI makes it convenient. Each phase receives its own regression gate.

### Phase 0 — Canon, inventory and implementation guardrails

**Goal:** establish the source of truth and map every affected current surface before schema/runtime changes.

Deliverables:

1. Commit this stamped plan and agent pointer before implementation.
2. Inventory current Planner Budget APIs/UI, `BudgetItem.paidAmount`, `ServiceEngagement`, `EngagementPayment`, Overview, Tasks, Notebook, wedding-site Registry/Gifting and `GuestContribution` routes/models.
3. Record current database migration state and exact production/main baseline.
4. Define stable internal type/status constants and no-double-counting invariants.
5. Add/prepare regression contracts that ensure existing Budget/Payment behavior does not regress.
6. Do not alter the unrelated active Planner UAT record.

**Exit gate:** architecture inventory complete, no naming collision, legacy attribution policy accepted, tests/fixtures strategy documented.

### Phase 1 — Data foundation and server integrity

**Goal:** create canonical Contributor/Contribution/allocation/campaign data without exposing incomplete UI.

Deliverables:

1. Add Contributor.
2. Add WeddingContribution.
3. Add ContributionAllocation.
4. Add PaymentFundingAllocation.
5. Add ContributionCampaign.
6. Add required indexes/unique constraints/wedding-scoped integrity.
7. Add server validation for pledge/receipt/allocation/currency/double-counting rules.
8. Add audit events.
9. Add migration/backfill that classifies existing source-less payment facts as legacy/unattributed, never automatically couple-funded.
10. Add authenticated APIs/services using current wedding authorization.

**Exit gate:** schema migration safe; server tests prove allocation/payment integrity and cross-wedding isolation; existing budget/payment tests remain green.

### Phase 2 — Contributions Planner workspace

**Goal:** make Contributors and Contributions easy to create, view, edit and search on all screen sizes.

Deliverables:

1. Add Contributions worksheet/destination through existing adaptive Planner navigation.
2. Add responsive summary.
3. Add desktop/tablet list and phone card layout.
4. Add simple Add Contribution flow.
5. Add Contributor create/select/detail.
6. Add contribution detail/edit.
7. Add search/filter/status views.
8. Add clear pledge vs received/in-kind states.
9. Add basic evidence attachment entry through Vault.

**Exit gate:** non-accounting tester can add cash, direct-vendor, in-kind and pledge records on desktop/tablet/phone; edit them safely; no overflow/control collision.

### Phase 3 — Budget and payment source-of-funds integration

**Goal:** make Budget and Service Engagement payments financially truthful.

Deliverables:

1. Add Budget funding breakdown.
2. Add allocate-existing-contribution flow.
3. Add direct vendor contribution/payment attribution.
4. Add mixed payment funding allocation.
5. Add couple-funded vs contributor-funded vs unattributed reporting.
6. Add received/unallocated contribution cash view.
7. Add guided legacy funding-source reconciliation.
8. Preserve `EngagementPayment` as the payment fact.

**Exit gate:** test fixtures prove no double counting; partial/mixed funding works; legacy records remain truthful; existing vendor/payment evidence flow remains intact.

### Phase 4 — Operational integration: Tasks, Notebook, Overview, Vendors

**Goal:** make Contributions part of daily planning rather than an isolated ledger.

Deliverables:

1. Link/create Planner tasks.
2. Link Notebook notes and expose contribution context from Notebook.
3. Add Overview contribution summary/action items.
4. Add Service Engagement/Vendor funding context.
5. Add receipt/verification workflow integration.
6. Add actionable “promised/overdue/unverified/to thank” views.

**Exit gate:** a user can follow a contribution from promise -> task/note -> receipt/payment/delivery -> budget/vendor context without re-entering duplicate facts.

### Phase 5 — Contribution Campaigns, honeymoon and invitation/wedding-site pipeline

**Goal:** connect Planner data to tasteful optional public gifting information.

Deliverables:

1. Campaign management in Planner.
2. Publication controls.
3. Replace disconnected public Registry/Honeymoon raised/progress truth with canonical campaign-derived data where campaign is used.
4. Support external registry/payment instructions without pretending Wewed processes funds.
5. Add invitation/deep-link/QR integration where selected.
6. Add privacy controls for target/progress/identity display.
7. Preserve “Our Village” guest memories as a separate feature.

**Exit gate:** publishing/unpublishing works; public page shows only authorized campaign information; private contributor data never leaks; no fake payment processing.

### Phase 6 — Recognition, thank-you, import/export and AI assistance

**Goal:** complete the human and productivity workflow.

Deliverables:

1. Thank-you status/workflow.
2. Contributor recognition preferences.
3. Private contributor history.
4. Contribution CSV/Excel import/export through existing engines where appropriate.
5. AI read/summarize/question support.
6. Confirmed AI-assisted task/thank-you drafting.
7. No autonomous financial mutation.

**Exit gate:** users can identify contributors needing acknowledgement, export/review records, and ask AI accurate source-of-funds questions.

### Phase 7 — Analytics, hardening, full regression and production qualification

**Goal:** qualify the complete workstream for production.

Deliverables:

1. Privacy-minimized aggregate analytics.
2. Financial-integrity/property tests.
3. Authorization/security tests.
4. responsive browser matrix.
5. Accessibility review.
6. migration/backfill rehearsal on production-like data.
7. full Planner/Vault/Contracts/Payments/Notebook/Wedding-site regression.
8. exact-head preview qualification.
9. manual UAT.
10. merge only exact qualified head and verify production.

**Exit gate:** all defined UAT and release gates pass; no unresolved double-counting, privacy, cross-wedding, mobile or legacy-attribution defect.

---

## 26. UAT matrix

At minimum, dedicated Contributions UAT must cover these scenarios.

### Core records

1. Create new contributor.
2. Link contributor to existing guest.
3. Record cash pledge.
4. Mark pledge received.
5. Record immediate cash receipt without prior pledge.
6. Record direct vendor payment.
7. Record in-kind goods with quantity/unit/value.
8. Record free service/time contribution.
9. Record vendor discount/concession.
10. Edit ordinary unverified contribution.
11. Cancel pledge.
12. Attempt destructive edit after reconciliation and confirm safe restriction/adjustment behavior.

### Allocation and accounting

13. Allocate one cash contribution across multiple budget items.
14. Leave some received cash unallocated.
15. Prevent allocation above available balance.
16. Attribute one payment entirely to couple.
17. Attribute one payment entirely to contributor.
18. Split one payment between couple and contributor.
19. Prevent payment funding allocations above payment amount.
20. Confirm direct vendor payment does not create available cash.
21. Confirm in-kind value does not enter cash-paid total.
22. Confirm pledge does not enter received/paid total.
23. Confirm legacy paid record remains “source not recorded” until classified.
24. Confirm no cross-wedding contributor/allocation access.
25. Confirm different currencies do not silently combine.

### Planner integrations

26. Budget item shows correct funding breakdown.
27. Overview shows accurate contribution summary.
28. Create task from contribution.
29. Link Notebook note.
30. Open linked Vendor/Service Engagement.
31. Attach/view receipt/evidence through Vault.
32. Filter promised/received/in-kind/direct-vendor/to-thank.

### Campaign/public site

33. Create private Honeymoon campaign.
34. Publish campaign.
35. Public wedding site displays approved copy.
36. Hide target/progress and verify it is not exposed.
37. Unpublish and verify removal.
38. Invitation link/QR only appears when configured.
39. Public page never exposes contributor email/phone/internal notes.
40. Public recognition remains off by default.
41. Existing “Our Village” guest-memory Contributions remain unaffected.

### Responsive/accessibility

For 320, 375, 390, 768, 1024, 1280 and 1440 widths:

42. no horizontal document overflow;
43. Contributions navigation remains reachable;
44. list/card content is readable;
45. Add Contribution is obvious;
46. create/edit form is usable with keyboard/touch;
47. Save/Cancel remain visible with mobile keyboard;
48. no global-navigation overlap;
49. filters/actions remain reachable;
50. accessible labels/focus/escape behavior work for dialogs/sheets.

### Regression

51. Tasks behavior unchanged except explicit links/actions.
52. Budget CRUD and existing calculations remain valid.
53. Vendor/Service Engagement/payment records remain authoritative.
54. Vault evidence rules remain intact.
55. Notebook quick capture continues to work.
56. Wedding site Registry remains functional for weddings without campaigns.
57. GuestContribution/Our Village remains separate and functional.
58. current role/wedding-switching isolation remains intact.
59. print/export behavior is not broken.
60. full repository CI/browser release gate passes on exact head.

---

## 27. Completion criteria

The workstream is complete only when a non-technical user can, without developer guidance:

1. add a person/organization that helped;
2. record money, a direct vendor payment, goods, a service, time or a pledge;
3. understand at a glance whether it is promised, received, delivered or verified;
4. see where the contribution went;
5. split one contribution across multiple expenses;
6. see that a vendor payment can be paid by someone other than the couple;
7. see how much the couple personally funded without Wewed claiming legacy unknown payments were theirs;
8. see cash received but not yet used;
9. see in-kind support without confusing it with cash paid;
10. link the contribution to budget, vendor, task, note and evidence as needed;
11. publish an optional Honeymoon/registry campaign without exposing private contributor details;
12. use the same workflows comfortably on smartphone, tablet and desktop;
13. edit ordinary records easily while reconciled records remain auditable;
14. identify who still needs a thank-you;
15. ask AI accurate questions about contributions without AI inventing facts;
16. complete existing Planner workflows with no Budget/Payment/Task/Notebook/Vault/Wedding-site regression.

---

## 28. Explicit non-goals for the first implementation

Unless a later stamped amendment authorizes them, this plan does not automatically authorize:

- Wewed becoming the merchant/payment processor for guest contributions;
- escrow/custody of contributor funds;
- tax/accounting advice;
- legally binding donor agreements;
- automated bank-feed reconciliation;
- automatic foreign-exchange conversion;
- public contributor leaderboards;
- automatic publication of contribution amounts;
- automatic AI financial mutations;
- merging financial Contributions with `GuestContribution` memories/messages;
- replacing Service Engagement/EngagementPayment with a new contribution-payment system.

---

## 29. Agent continuation and implementation rule

If an implementation session is interrupted, the next agent must:

1. read this entire stamped plan;
2. inspect `main`, the active branch, open PRs and migration status;
3. inspect the current Planner/Vault/Contracts/Payment source before changing schema or financial logic;
4. identify the closest incomplete Phase/exit gate and continue from there;
5. preserve existing UAT records instead of rewriting them to fit the new feature;
6. never classify historical source-less paid amounts as couple-funded without evidence/user action;
7. never build a parallel payment/evidence/registry/task/notebook system;
8. preserve mobile/tablet/desktop acceptance requirements from the first exposed UI phase;
9. update this plan explicitly if product semantics change;
10. qualify the exact branch head before merge and verify the exact merged production build.

Any PR in this workstream must state one of:

- `Contributions Canon impact: none` with a reason; or
- `Contributions Canon impact: updated` and update this document in the same PR.

Because this scope intersects Vault/Contracts/Transaction Governance, any relevant PR must also state the existing Vault/Contracts Canon impact and preserve its payment/evidence invariants.

---

## 30. Final architectural statement

The target Wewed model is:

`Contributor -> Wedding Contribution -> Allocation / Funding Source -> Budget Item + Service Engagement Payment`

with operational links to:

`Tasks + Notebook + Overview + Vendors + Vault/Evidence + AI + Recognition/Thank-you`

and public presentation through:

`Contribution Campaign -> Wedding Website / Invitation`

while preserving:

`GuestContribution -> Our Village / Memories / Advice / Blessings / Wishes`

as a separate social-memory system.

The core product truth is simple:

> **Wewed should show what the wedding cost, what has been paid or provided, who actually supplied that money or value, what remains outstanding, and who helped — in language ordinary people can understand.**
