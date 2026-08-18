# Wewed Vault, Contracts & Transaction Governance Plan

**Status:** CANONICAL IMPLEMENTATION PLAN — product implementation is **not yet authorized**  
**Canonical date:** 2026-08-18  
**Canonical domain:** `https://wewed.pro`  
**Primary scope:** Planner + Couple + Vendor + Admin + Communications + Wedding Website + Storage  
**Authority:** This document is the source of truth for the Wewed Vault, digital vendor contract, service-engagement, evidence, communications-attachment, and wedding-media archive workstream until it is explicitly superseded by a later canonical product decision.

---

## 1. Why this exists

Wewed must move beyond a collection of planning screens into a trusted wedding operating system where commercial commitments, documents, payments, communications, and media are connected to the wedding record and remain understandable after the event.

The immediate operational trigger is that real vendors have already been paid. Those payments and vendor relationships must be captured now in a way that does not fabricate history and does not force Wewed to wait for the complete long-term contract engine before creating a reliable record.

The long-term product goal is broader:

> Every paid wedding service should have a governed Wewed Service Engagement containing the parties, service scope, branded contract, approvals, payment schedule, documents, communication evidence, amendments, delivery record, and dispute trail.

The Vault is the storage and evidence foundation underneath that goal. Communications attachments, vendor files, invoices, receipts, planner notes, couple media, wedding-site media, and finalized contracts must resolve to governed Vault objects rather than independent links scattered across the application.

This plan intentionally extends, but does not rewrite, the completed communications UI redesign. `docs/COMMUNICATIONS_UI_REDESIGN_PLAN.md` treated attachments as out of scope for that presentation-only phase. Attachments become in scope here as a separate data/storage/governance capability.

This plan also remains consistent with `docs/LEGAL_IMPLEMENTATION_NOTES.md`: Wewed subscription billing must remain distinct from independent wedding-provider contracts unless a future product decision intentionally makes Wewed the merchant or a contracting party.

---

## 2. Canonical product principles

The implementation must preserve the following principles. Future agents must not silently weaken them for implementation convenience.

1. **One wedding, one evidence graph.** Contracts, vendors, payments, messages, files, tasks, notes, and media must be linkable to the same wedding and to each other.
2. **A paid vendor is a Service Engagement, not only a Vendor row.** Vendor identity describes who the provider is; the Service Engagement describes what was agreed for this wedding.
3. **Wewed authors and brands the contract framework.** The contract experience must visibly originate from Wewed and follow Wewed design, numbering, versioning, and governance rules.
4. **Wewed is not automatically a commercial contracting party.** Wewed may publish/standardize the agreement and operate the evidence platform while the actual commercial obligations belong to the named client/couple, planner when applicable, and vendor. If Wewed is ever intended to be a contracting party or merchant, that must be an explicit product/legal configuration, never an implication of branding.
5. **Accepted contract versions are immutable.** An accepted version is never edited in place. Any change produces an amendment/new version.
6. **Material amendments require all required parties.** For the standard planner-managed Wewed vendor engagement, the default approval set is Couple/Client + Planner + Vendor. A different approval topology may exist only when the engagement explicitly records a lawful role/authority structure.
7. **No retroactive fiction.** Existing paid vendor arrangements created before this feature must be captured as historical/legacy engagements. Wewed must not generate a new contract and pretend it existed before acceptance.
8. **Uploads are Vault objects first.** Communications, vendor records, notes, contracts, invoices, and website media reference governed Vault objects; they do not each invent their own storage behavior.
9. **Storage is private by default.** Public display is a publication state/derived access path, not a reason to make original files globally public.
10. **The application authorizes access.** Raw object-storage paths are never the access-control system.
11. **Evidence cannot be silently destroyed.** Deletion, replacement, redaction, and retention actions must respect contract status, legal hold, dispute state, and audit requirements.
12. **Admin has support authority, not invisible authorship authority.** Admin can investigate, resend, suspend, correct metadata under governed procedures, and manage disputes, but cannot secretly alter an accepted contract or impersonate a party acceptance.
13. **Payments are linked facts, not free-form labels.** Contract milestones, budget items, receipts, and recorded payments should reconcile to the same engagement.
14. **AI may explain and assist, never consent.** AI can summarize, detect missing terms, extract proposed changes, and assist search. It cannot accept, sign, amend, or adjudicate a contract for a party.
15. **Every important state transition is auditable.** Creation, upload, view where appropriate, send, acceptance, rejection, amendment, payment proof, dispute action, hold, archive, and destructive actions must emit structured events.

---

## 3. Current repository reality to preserve

The implementation must build from current Wewed behavior instead of creating parallel systems.

### Existing useful foundations

- `Wedding` is the core scope and already owns vendors, media, tasks, budget items, memberships, and audit events.
- `Vendor` already has `contractStatus`, `paymentStatus`, notes, and a relationship to `BudgetItem`.
- `BudgetItem` already supports estimated/actual costs, paid amount, currency, due date, vendor linkage, and audit hardening.
- `MediaItem` already represents wedding-scoped images/video references.
- `WeddingMembership` already provides a wedding-scoped authorization concept.
- `AuditEvent` already provides a general audit primitive.
- The communications foundation lives in the private `wewed_communications` schema and already includes conversations, participants, messages, entity links, deliveries, and events.
- Communications already supports `IN_APP`, `EMAIL`, `WHATSAPP`, `SMS`, and `PUSH` delivery concepts.

### Current gap

There is no canonical Vault object model, no communication attachment model, no Service Engagement model, no governed contract/version/acceptance model, and no durable evidence relationship that unifies vendor + contract + payment + file + message + media.

The work must close those gaps without breaking current Planner, marketplace, wedding website, communications, or billing behavior.

---

## 4. Product vocabulary — use these names consistently

### Wewed Vault
The private, metadata-driven document/media/evidence layer for a wedding. It owns stored file metadata, access state, hashes, versions, links, retention status, and publication state.

### Service Engagement
The wedding-specific commercial relationship for one vendor/service. Example: “Photography coverage for Charity & Kudzie — USD 3,500.” A single provider may have multiple engagements if they deliver materially separate services.

### Wewed Standard Service Agreement
The Wewed-authored, Wewed-branded contract document generated from an approved service-specific template and the Service Engagement data.

### Contract Template
A governed legal/content template with version, jurisdiction/market metadata, service category, clause set, and counsel/review status.

### Contract Version
An immutable rendered snapshot of the agreement at a point in time. Draft versions may be superseded. Accepted/effective versions are locked permanently.

### Amendment
A proposed change to an effective agreement that creates a new contract version rather than mutating the old one.

### Acceptance Receipt
The evidence record proving who accepted which exact contract version, in which represented role, at what time, through which authenticated/shared-link flow, and against which document hash.

### Evidence Item
A file, message reference, payment proof, note snapshot, delivery event, or other artifact intentionally promoted into the engagement/dispute evidence set.

### Historical Engagement Record
A Service Engagement created to capture a vendor relationship/payment that existed before the Wewed contract system. It records known facts and documents without pretending a new Wewed agreement was previously accepted.

### Wedding Archive
The post-wedding preservation state for website media, selected communications/documents, contracts, and other couple memories. Exact commercial retention policy may evolve; the data model must support durable retention.

---

## 5. Branded contract experience — non-negotiable

Branding is not cosmetic. It communicates document origin, standardization, trust, and version identity.

Every Wewed-generated contract must have a consistent branded presentation in both responsive web and printable/PDF form.

### Required Wewed branding

- Wewed wordmark/logo.
- `wewed.pro` canonical origin.
- “Wewed Standard Service Agreement” or approved service-specific title.
- Unique human-readable contract identifier, e.g. `WW-CON-2026-000184`.
- Contract template/version label, e.g. `Wewed Standard Photography Agreement v1.2`.
- Contract version number for the specific engagement, e.g. `Version 3`.
- State badge: Draft / Awaiting acceptance / Effective / Superseded / Cancelled / Disputed / Completed.
- Generated/issued timestamp.
- Verification QR code or verification link resolving through `wewed.pro` to an authorized verification view.
- Footer identifying Wewed as the platform/template publisher and directing support through Wewed.
- Document hash or shortened verification fingerprint in the evidence/verification area.

### Wedding and party branding

The Wewed framework remains visually primary, but the agreement should clearly present:

- Couple/client names.
- Wedding name/date.
- Optional wedding monogram.
- Planner name and company/trading name.
- Vendor legal/trading name.
- Optional planner/vendor logos only in constrained identity blocks; they must not overpower or alter the canonical contract styling.

### Mobile-first comprehension

The primary acceptance surface is responsive HTML, not only a PDF download.

The viewer must provide:

- plain-language agreement summary;
- service and payment summary;
- key dates;
- clauses grouped under understandable headings;
- “what changed” view for amendments;
- required-party acceptance state;
- access to full printable/PDF document;
- clear statement of who is accepting and on whose behalf;
- prominent Wewed branding and contract identifier.

### PDF/rendered artifact

At the moment a version is issued for acceptance, Wewed must create/freeze a canonical rendered artifact. At the moment it becomes effective, the effective artifact and its hash must be permanently associated with that version.

The PDF must not be regenerated from a later template and presented as if it were the original accepted document.

---

## 6. Contract party and authority model

The system must model legal/commercial roles explicitly rather than assuming every participant has the same obligations.

Possible roles include:

- CLIENT / COUPLE
- PLANNER
- SERVICE_PROVIDER / VENDOR
- AUTHORIZED_REPRESENTATIVE
- WITNESS where later required
- WEWED_PLATFORM / TEMPLATE_PUBLISHER as a non-obligor platform role by default

### Standard Wewed planner-managed engagement

Default required acceptance set:

1. Couple/Client
2. Planner
3. Vendor/Service Provider

A material change does not become effective until all currently required approvers accept the same exact version.

### Authority exceptions

Some real arrangements may have the planner legally acting for the couple or the planner company directly engaging the vendor. The system must support this, but only through explicit recorded configuration of party role and authority. It must never infer authority merely because a planner has application access.

### Admin

Admin may:

- view authorized records for platform support/dispute handling;
- resend invitations;
- revoke compromised share links;
- flag identity concerns;
- place legal/dispute holds;
- correct non-substantive operational metadata through auditable workflows;
- assist parties in creating an amendment.

Admin may not:

- accept for another party without a separately supported legal delegation mechanism;
- silently modify accepted content;
- backdate acceptance;
- delete an effective contract to “fix” a dispute.

---

## 7. Contract lifecycle state machine

The lifecycle must be explicit, testable, and server-enforced.

Recommended states:

`DRAFT -> READY_FOR_REVIEW -> SENT -> PARTIALLY_ACCEPTED -> EFFECTIVE -> COMPLETED`

Additional terminal/interruption states:

`REJECTED`, `WITHDRAWN`, `SUPERSEDED`, `CANCELLED`, `DISPUTED`, `VOIDED_BY_GOVERNED_PROCESS`

Rules:

- Drafts can change until sent/issued.
- Sending freezes the exact version under review.
- A party rejection never edits the version; it records rejection and creates a new draft if changes are needed.
- Partial acceptance never makes a material amendment effective.
- Effective versions are immutable.
- A new amendment starts from the current effective version and produces a new version.
- The prior effective version remains authoritative until the amendment satisfies the required acceptance set.
- Once the amendment becomes effective, the previous version becomes `SUPERSEDED` but remains readable and verifiable.
- Cancellation/termination must preserve the agreement and termination evidence.

---

## 8. Contract immutability and integrity design

“Immutable” must be enforced technically, not merely stated in UI copy.

### Required controls

- Canonical serialization of the contract version content/data snapshot.
- SHA-256 or equivalent cryptographic digest of the canonical version.
- Frozen rendered artifact stored in the Vault.
- Accepted/effective versions use append-only semantics.
- Application service refuses content mutation of accepted/effective versions.
- Database guard/trigger should prevent unauthorized update/delete of finalized contractual content.
- Amendment creates a new row/version linked to its predecessor.
- Acceptance records reference the exact contract version ID and digest.
- Contract events are append-only.
- Audit events record actor, action, target, and relevant before/after metadata without exposing secrets.

### Deletion

A finalized contract must not be hard-deleted through ordinary product workflows. Account deletion, privacy requests, retention expiry, and legal holds require a separately designed policy-aware process that distinguishes data that can be deleted from records Wewed must or is permitted to retain.

---

## 9. Contract template and clause architecture

Do not create one giant hard-coded contract string.

The template system must be modular so Wewed can improve language without changing already accepted contracts.

### Template metadata

Each template should record at least:

- template ID;
- service category;
- market/jurisdiction code;
- language;
- semantic version;
- status: draft / internal review / counsel-approved / active / retired;
- effective-from date;
- retired-at date;
- owner/reviewer metadata;
- required clause IDs;
- optional clause IDs;
- data fields required to render;
- hash of the approved template content.

### Common Wewed clause families

- Parties and authority.
- Scope of service.
- Price/currency.
- Deposit and payment schedule.
- Taxes/fees where applicable.
- Client/planner responsibilities.
- Vendor responsibilities.
- Access/setup/teardown.
- Service timing and delays.
- Change control.
- Substitutions.
- Cancellation/postponement.
- Refund/credit/contractual remedies.
- No-show/non-performance.
- Force majeure / events beyond control.
- Intellectual property/media rights where relevant.
- Confidentiality/privacy where relevant.
- Safety/compliance obligations where relevant.
- Notice/communications process.
- Evidence/record-keeping through Wewed.
- Dispute/escalation process.
- Termination/completion.
- Governing law/forum only after valid market-specific legal approval.

### Service-specific packs

Initial contract packs should cover the services most likely to be paid through Planner workflows:

- Planner / coordinator
- Venue
- Catering
- Photography
- Videography
- Decor
- Florist
- DJ / band / entertainment
- Cake / confectionery
- Hair / makeup / beauty
- Transport
- Accommodation
- Officiant
- Rentals / furniture / equipment
- Lighting / AV / production
- Security
- Printing / stationery / signage
- Content creator / social content
- Bar / beverages
- Photo booth
- Childcare
- Gifts / favours
- Other/custom service

Each pack adds specialist terms without duplicating the common Wewed framework.

### Legal release gate

Wewed may build the contract engine before every clause has final market approval, but no template may be marketed as legally binding for a jurisdiction until the operator identity, party model, electronic acceptance method, governing law, consumer rules, remedy language, privacy/retention, and relevant service clauses have been reviewed for that market by qualified counsel.

Product copy must not claim universal enforceability.

---

## 10. Service Engagement — the transactional center

The Service Engagement is the object that binds Planner operational data together.

It should include/link:

- wedding;
- vendor/provider identity;
- service category/subcategory;
- service description/scope;
- service date/time/location;
- client/couple;
- planner;
- commercial amount/currency;
- deposit;
- payment milestones;
- budget item(s);
- contract;
- required parties;
- documents;
- communications conversation/entity links;
- notes;
- tasks;
- evidence;
- amendment history;
- delivery/completion state;
- dispute state.

### Vendor versus Service Engagement

Do not overload `Vendor` with every wedding-specific commercial detail.

`Vendor` answers: **Who is the provider?**

`Service Engagement` answers: **What did this provider agree to deliver for this wedding, for how much, under which terms, with which payment and evidence history?**

### Planner UI

Selecting a vendor in Planner should eventually open a Deal Room / Engagement view:

`Overview | Contract | Payments | Documents | Messages | Tasks | Changes | Evidence`

This becomes the operational home for that paid service.

---

## 11. ASAP priority: capture vendors already paid

This is Phase 0 and must be delivered before waiting for the full future-state contract engine.

### Goal

Allow Admin/Planner to create truthful, auditable records for existing paid/partially paid vendors immediately.

### Historical Engagement workflow

For each existing paid vendor:

1. Select existing Vendor or create/link the correct vendor identity.
2. Create `Historical Engagement Record`.
3. Capture service/category.
4. Capture agreed amount/currency.
5. Capture amount already paid and payment date(s).
6. Capture method/reference where known.
7. Upload proof: receipt, invoice, transfer confirmation, quotation, existing contract, WhatsApp screenshot, email, or other source document.
8. Capture service date/deliverables.
9. Record whether an external agreement already exists.
10. If terms are incomplete, mark them as unknown rather than inventing them.
11. Link the engagement to existing Budget item(s) and Vendor.
12. Record who entered the historical record and when.

### Important integrity rule

A Wewed contract created today for an engagement paid earlier must not be backdated and represented as if it governed the past payment.

Instead, Wewed may offer one of these explicit flows:

- **Record only:** preserve existing evidence without creating a new agreement.
- **Acknowledge existing terms:** parties review a Wewed summary of the known arrangement and affirm that it accurately records the existing agreement from now on.
- **Replace/go-forward agreement:** parties enter a new Wewed contract governing the remaining service/payment period, with an explicit effective date and reference to prior payments.

### Paid-vendor rescue dashboard

Admin/Planner should be able to filter:

- paid vendor with no engagement;
- paid vendor with no proof document;
- paid vendor with no contract/external agreement;
- partially paid;
- agreement awaiting acknowledgment;
- upcoming service date;
- unresolved mismatch between Budget and engagement amount.

---

## 12. Wewed Vault architecture

The Vault is not a visual folder tree sitting on top of arbitrary URLs. It is a governed object registry with metadata and links.

### Canonical storage design

Use a storage abstraction so Wewed can change object-storage providers later. The first implementation should prefer infrastructure already compatible with Wewed's Supabase/Postgres stack, but domain logic must not depend on provider-specific public URLs.

### Object principles

Every stored file has a `VaultObject`-equivalent record containing at least:

- ID;
- wedding ID;
- object key/provider location;
- original filename;
- safe display name;
- MIME type detected server-side;
- extension;
- byte size;
- checksum/digest;
- uploader actor;
- upload source;
- storage state;
- scan/quarantine state;
- created timestamp;
- deleted/archived timestamp where applicable;
- retention class;
- legal/dispute hold state;
- sensitivity/access classification;
- publication state;
- optional image/video metadata;
- optional derivative/thumbnail linkage;
- metadata JSON for future expansion.

### Vault links

A file may be linked to multiple application entities without duplicating the binary:

- wedding;
- vendor;
- service engagement;
- contract/version;
- invoice;
- payment;
- task;
- note;
- conversation;
- message;
- dispute;
- media gallery;
- guest contribution.

Use an explicit `VaultLink`/entity-link model.

### Suggested Vault user-facing sections

- Contracts
- Vendors / Engagements
- Invoices & Receipts
- Payments
- Planner Notes
- Communications Attachments
- Wedding Documents
- Couple Media
- Guest Media / Contributions
- Website Media
- Evidence & Disputes
- Archive

The UI may look folder-like, but retrieval should be metadata-driven.

### File safety

Uploads must include:

- server-authorized upload initiation;
- authenticated or securely tokenized share-link context;
- upload size limits by file class;
- allowlist/denylist policy;
- MIME sniffing rather than trusting the filename;
- safe filename handling;
- checksum;
- malware scanning/quarantine workflow before broad distribution;
- image/video processing in isolated services where applicable;
- no executable content served inline in unsafe ways;
- short-lived signed download/view access for private originals;
- audit events for sensitive evidence access where appropriate.

### Storage access

Originals are private by default. A public wedding website can display an explicitly published derivative or an application-authorized media route. Publication must not expose unrelated Vault contents or permanent private object URLs.

---

## 13. Communications uploads — required extension

The `/messages` experience must gain attachment support without breaking existing conversation safety rules.

### Composer capability

Desktop:

- attachment button;
- drag/drop;
- file chooser;
- image preview;
- upload progress;
- cancel/retry;
- optional caption/message;
- clear failure state.

Mobile:

- attachment button;
- photo library;
- camera capture where supported;
- document picker;
- progress/cancel/retry;
- avoid composer/layout regression.

### Initial file classes

- PDF
- DOC/DOCX
- XLS/XLSX where appropriate
- TXT/CSV
- common images: JPEG/PNG/WebP/HEIC if processing supports it
- common video formats subject to configured size policy
- audio/voice files where supported

Do not accept arbitrary executable files.

### Data model rule

A message attachment must reference a Vault object; the message must not own an isolated external file URL.

Recommended relationship:

`CommunicationMessage -> CommunicationAttachment -> VaultObject`

Each attachment should also be entity-linkable to the conversation and, when promoted, to a vendor/engagement/payment/dispute.

### Evidence promotion

From a message attachment, authorized users should be able to choose actions such as:

- Add to Vendor Documents
- Add to Engagement
- Mark as Invoice
- Mark as Payment Proof
- Add to Evidence
- Save to Wedding Documents
- Save to Couple Media where appropriate

Promoting an item to contractual/dispute evidence creates a durable evidence relationship. Later hiding/deleting the chat presentation must not silently destroy a governed evidence copy/reference.

### Attachment sharing across external channels

The canonical binary remains in Wewed Vault. External channel behavior may vary:

- In-app: render/upload directly.
- Email: send secure Wewed link or provider attachment where safe/appropriate.
- WhatsApp: send secure Wewed document link initially; native media/document API delivery may be added only after channel capability is deliberately implemented.
- SMS: secure link only.
- Push: notification/deep link only.

A contract sent through WhatsApp/email must link to the authoritative Wewed contract view rather than relying on an uncontrolled copy as the only source of truth.

---

## 14. Secure share links for vendors and external parties

Vendors must not be forced to create a full Wewed account before they can read an agreement, but access must still be controlled.

### Link requirements

- high-entropy token;
- hashed token stored server-side;
- explicit target contract/engagement;
- role/party being invited;
- expiration;
- revocation;
- single-purpose scope;
- optional step-up verification by email/phone OTP for acceptance;
- rate limiting;
- no contract IDs alone as authorization;
- access event logging;
- ability to reissue without invalidating contract evidence.

### Read versus accept

Viewing through a secure link and legally/contractually accepting are separate events.

Acceptance should require a stronger confirmation step than merely opening the URL.

---

## 15. Acceptance and consent evidence

The acceptance system must produce stronger evidence than a boolean flag.

Each acceptance record should include at least:

- contract version ID;
- contract digest;
- party ID;
- person/user identity;
- represented role/entity;
- authenticated account or secure-link identity evidence;
- explicit acceptance declaration version;
- accepted timestamp using server time;
- relevant request/session metadata subject to privacy policy;
- acceptance channel/source;
- status: accepted / rejected / revoked only where legally/product permitted;
- resulting effective-state transition.

### Acceptance certificate

When the required party set is complete, Wewed should generate a Wewed Acceptance Certificate containing:

- contract ID;
- contract version;
- document digest/fingerprint;
- party names/roles;
- acceptance timestamps;
- effective timestamp;
- verification path.

This certificate is stored in the Vault and linked to the effective Contract Version.

---

## 16. Amendments and “three-way” change control

No party can unilaterally edit an effective agreement.

### Amendment workflow

1. Authorized party proposes a change.
2. System records proposer and reason.
3. New draft version is derived from the current effective version.
4. Changed fields/clauses are displayed as a diff.
5. Required parties review the same exact version.
6. Acceptance occurs independently.
7. Until complete, the old version remains effective.
8. When all required approvals complete, the new version becomes effective and the old one becomes superseded.
9. All parties receive in-app + configured external notifications.
10. The event ledger records every step.

### Material versus non-substantive metadata

The system may distinguish non-contractual metadata (e.g. internal tags) from contract content. Changing an internal display label must not unnecessarily create an amendment. Changing price, service scope, date, cancellation terms, obligations, payment schedule, or remedies always requires a new contract version.

---

## 17. Payment linkage and financial evidence

Wewed must avoid three conflicting sources of truth: Budget, contract, and payment proof.

### Payment milestone model

Each Service Engagement may define milestones such as:

- deposit;
- second installment;
- pre-event balance;
- post-event/delivery balance;
- refundable security/damage deposit;
- custom milestone.

Each milestone should support:

- amount/currency;
- due date;
- contractual basis;
- payment status;
- paid amount/date;
- payment method/reference;
- linked Budget item;
- receipt/invoice/proof Vault links;
- dispute/refund/credit state.

### Budget reconciliation

Where an engagement amount changes through an effective amendment, Wewed should update/reconcile the linked Budget through an auditable workflow rather than silently changing one system.

A mismatch should surface clearly:

- contract total != budget committed total;
- recorded payments > contract total;
- paid amount without proof where proof is required;
- payment recorded for vendor with no Service Engagement.

### Payment processing

This plan does not automatically make Wewed the merchant of record or escrow provider. If payment processing is later added, merchant/marketplace/escrow responsibilities require explicit financial/legal design.

---

## 18. Contractual remedies, penalties, and disputes

The system should distinguish **contract terms**, **detected possible breach**, and **adjudicated/agreed resolution**.

### Do not auto-punish from a single event

Example: a planner marks a photographer late. Wewed may flag a possible breach tied to the relevant clause, but should not automatically seize money or declare the vendor liable.

### Dispute workflow

1. Open issue against Service Engagement.
2. Select issue type/related clause.
3. State allegation/requested outcome.
4. Attach evidence from Vault/messages/payments.
5. Notify other required parties.
6. Capture response.
7. Optional negotiation/settlement proposal.
8. Admin support review where within Wewed's role.
9. Record resolution, unresolved status, refund/credit/remedy, or external escalation.
10. Apply retention/legal hold to the evidence set.

### Terminology

The implementation should use jurisdiction-reviewed terms such as fee, refund, credit, agreed remedy, cancellation charge, or damages provision instead of assuming every “penalty” is enforceable.

---

## 19. Planner Notes and document organization

Notes must become part of the evidence/organization system without pretending every note is a legal document.

### Structured Note record

Notes should have:

- wedding;
- author;
- title/body;
- visibility classification;
- links to vendor/engagement/task/payment/contract/meeting;
- attachments as Vault objects;
- created/updated timestamps;
- optional pinned/status/category fields.

### Snapshot promotion

If a note becomes material evidence, create a timestamped immutable snapshot and link that snapshot as Evidence rather than freezing the live editable note itself.

---

## 20. Couple and wedding website media archive

The Vault must preserve the couple's wedding media, including content used by the wedding website before, during, and after the wedding.

### Core rule

New media should enter Wewed through the Vault/media pipeline first. Website/gallery components then reference the authorized media record.

Do not build a future website that depends on ephemeral external URLs with no durable Wewed copy.

### Media types

- couple profile/hero images;
- engagement photos;
- invitation artwork;
- wedding-day photos;
- videos;
- guest-contributed photos/videos;
- planner/vendor-provided media where licensed/authorized;
- website gallery assets;
- post-wedding highlights/memories.

### Media object requirements

- original Vault object;
- thumbnails/derivatives;
- dimensions/duration where applicable;
- uploader/source;
- capture/upload timestamp;
- caption/moment/tags;
- publication state;
- privacy state;
- rights/consent metadata where needed;
- content moderation state for guest contributions where applicable;
- link to existing `MediaItem` or successor media domain model.

### Existing external media backfill

A migration/backfill job should identify existing wedding media references and, where Wewed has the right and technical ability to retain them, ingest originals into controlled storage. The migration must record source URL, ingestion timestamp, checksum, and failures.

### Wedding Archive lifecycle

Support lifecycle states such as:

`ACTIVE_PLANNING -> LIVE_EVENT -> POST_WEDDING -> ARCHIVED`

Archive must preserve effective contracts/evidence independently from whether the public wedding website remains live.

The product should be designed for durable post-wedding couple media retention. Exact free/paid retention duration is a business-policy decision and must not be hard-coded into data structures. Before any future retention expiry, users should receive clear notice and export options, subject to legal/evidence holds.

### Canon/sealing integration

The existing wedding canon/sealing concept may be used later to freeze selected public memories/presentation state. Canon sealing must not make private Vault contents public and must not prevent authorized archival maintenance/retention operations.

---

## 21. Permissions and access matrix

Authorization must be server-side and wedding/entity scoped.

### Couple/Client

Expected capabilities:

- view own wedding engagements/contracts;
- accept/reject where required;
- view payment state permitted by role;
- upload agreed documents/proof;
- access shared wedding media;
- see amendment history;
- open disputes/issues where enabled.

### Planner

Expected capabilities:

- create/manage Service Engagements for weddings they are authorized to manage;
- generate contract drafts;
- propose amendments;
- record payments/proofs under permissions;
- organize vendor documents;
- communicate/upload;
- accept when planner approval is required;
- not access unrelated weddings.

### Vendor

Expected capabilities:

- view only engagements/contracts in which the vendor is a party;
- upload invoices/documents/deliverables;
- accept/reject/amend through governed workflow;
- communicate with authorized participants;
- access only permitted payment/document information.

Vendor access may be account-based or secure-link based depending onboarding state.

### Admin

Expected capabilities:

- support/investigation access under admin authority;
- cross-wedding operational search where authorized;
- view contract/evidence trail;
- manage templates through elevated permissions;
- manage disputes/support cases;
- manage holds and link revocation;
- no silent acceptance/content mutation.

### Guest/Public

No general Vault access. Public wedding media must be explicitly published. Guest contributions use dedicated scoped upload/submission flows.

---

## 22. Suggested domain entities

Exact implementation names may change after repository review, but the semantic model must cover these concepts:

- `ServiceEngagement`
- `EngagementParty`
- `ContractTemplate`
- `ContractClause`
- `ContractTemplateClause`
- `Contract`
- `ContractVersion`
- `ContractPartyRequirement`
- `ContractAcceptance`
- `ContractChangeRequest` / `ContractAmendment`
- `ContractEvent`
- `PaymentMilestone`
- `PaymentRecord` or governed linkage to existing Budget/payment facts
- `VaultObject`
- `VaultLink`
- `VaultDerivative`
- `VaultAccessGrant` / secure share token
- `CommunicationAttachment`
- `EvidenceItem`
- `DisputeCase`
- `DisputeEvent`
- `Note` / `NoteSnapshot`
- media archive linkage to `MediaItem`

Avoid forcing these concepts into generic JSON when relational integrity is important.

---

## 23. API/service boundaries

All sensitive operations must run through server-authorized services/routes.

Recommended service boundaries:

- Vault upload initialization/finalization
- Vault download/view authorization
- Engagement CRUD/state transitions
- Historical engagement capture
- Contract template selection/rendering
- Contract issue/send
- Contract acceptance/rejection
- Amendment proposal/issue/acceptance
- Payment reconciliation
- Evidence promotion
- Dispute workflow
- Secure share-link verification
- Communications attachment send/fetch
- Media ingestion/publication/archive
- Admin investigation/support

State transitions should be command-like and server-validated rather than unrestricted row update endpoints.

---

## 24. Notifications and communications integration

Contract and engagement events must use the existing Wewed communication infrastructure where possible.

Events requiring notifications include:

- contract ready for review;
- contract issued;
- party accepted;
- party rejected;
- final acceptance/effective;
- amendment proposed;
- amendment accepted/rejected;
- payment due/upcoming/overdue where configured;
- payment recorded;
- new invoice/proof uploaded;
- dispute opened/responded/resolved;
- document access/link revocation where material.

### Channels

Use the existing Wewed communications delivery abstraction:

- in-app primary record;
- email;
- WhatsApp;
- SMS/push where configured.

The canonical event and document remain in Wewed. External channels are delivery mechanisms, not alternative sources of truth.

### Deep links

Links shared externally must return to controlled `wewed.pro` routes and must not leak `.vercel.app` or deprecated domains.

---

## 25. AI contract intelligence — later, never foundational

AI is a later enhancement after deterministic contract and evidence behavior is proven.

Allowed assistance:

- plain-language summary;
- clause explanation;
- missing-field detection;
- unusual-risk checklist;
- compare version changes;
- extract a proposed amendment from a conversation;
- classify uploaded documents;
- suggest which engagement a file belongs to;
- search/summarize a wedding's authorized contract set;
- operational queries such as “which vendor contracts are still awaiting acceptance?”

AI must not:

- generate final legal clauses into an active template without review;
- make a contract effective;
- accept/reject for a party;
- decide a dispute;
- silently change commercial amounts;
- make unsupported legal-enforceability claims.

---

## 26. Analytics and future Wewed Trust layer

The architecture should allow later privacy-safe analytics across engagements.

Potential signals:

- contract completion rate;
- amendment frequency;
- time to acceptance;
- payment milestone timeliness;
- dispute rate;
- unresolved dispute rate;
- documented on-time service completion;
- invoice/payment reconciliation quality.

Any future “verified performance” or trust badge must be based on clearly defined, auditable facts and comply with Wewed's existing rule against vague verification claims.

Do not expose private contract content as marketplace analytics.

---

## 27. Security, privacy, retention, and governance gates

Before production release of each phase, review:

- cross-wedding isolation;
- vendor/couple/planner authorization;
- admin privilege boundaries;
- object-storage privacy;
- signed URL expiration;
- secure-link token hashing/revocation;
- malware/quarantine behavior;
- upload abuse/rate limits;
- personal data minimization;
- audit log sensitivity/redaction;
- media privacy/publication state;
- contract/evidence retention;
- account deletion interaction;
- dispute/legal hold interaction;
- backup/restore behavior;
- incident response for exposed links/files;
- policy impact per `docs/LEGAL_IMPLEMENTATION_NOTES.md`.

A feature is not production-ready merely because the UI works.

---

## 28. Implementation sequence

The order below is canonical because the user has real paid vendors requiring immediate records.

### Phase 0 — Paid Vendor Record Rescue

**Goal:** capture existing paid vendor relationships truthfully and safely.

Deliverables:

- historical Service Engagement model/minimum fields;
- admin/planner historical capture UI;
- link to current Vendor and BudgetItem;
- payment amount/date/reference capture;
- Vault foundation sufficient for invoices/receipts/existing agreements/payment proof;
- basic engagement document list;
- audit events;
- paid-vendor gap/reconciliation view.

Exit gate:

- every currently paid vendor can be represented without fabricating a retroactive Wewed acceptance.

### Phase 1 — Vault Core + Communications Attachments

**Goal:** establish one secure file layer and make it usable in daily communications.

Deliverables:

- Vault tables/services/private object storage;
- upload/download authorization;
- checksums/security/quarantine framework;
- Vault UI baseline;
- communication attachment model;
- desktop/mobile upload UX;
- attachment previews/downloads;
- entity links/promote-to-engagement/evidence;
- notes attachments;
- storage/audit observability.

Exit gate:

- users can send a document/image in an authorized conversation and the same governed object appears in the wedding Vault with correct access boundaries.

### Phase 2 — Service Engagement Deal Room + Branded Contract Generator

**Goal:** convert planned/paid services into governed transaction records.

Deliverables:

- full Service Engagement model;
- party/authority model;
- Deal Room tabs;
- initial contract templates and service packs;
- Wewed-branded mobile contract viewer;
- branded PDF artifact;
- contract IDs/versioning;
- QR/verification route;
- draft/issue/send flow;
- WhatsApp/email/in-app contract links.

Exit gate:

- a Planner can create an engagement and issue a branded Wewed contract for a test vendor without manual document editing.

### Phase 3 — Acceptance, Immutability & Amendments

**Goal:** make consent and change control evidentiary and tamper-resistant.

Deliverables:

- secure share-link/identity verification;
- required-party acceptance set;
- acceptance receipts;
- effective-state transition;
- immutable version controls/database guards;
- canonical hash;
- Acceptance Certificate;
- amendment diff/proposal flow;
- three-party approval default;
- supersession history;
- notification events.

Exit gate:

- no single party or admin can modify an effective contract in place; a material change requires a new version and all required approvals.

### Phase 4 — Payments, Evidence & Disputes

**Goal:** reconcile contract obligations to actual money and support disputes.

Deliverables:

- payment milestones;
- Budget reconciliation;
- invoice/receipt/payment-proof classification;
- evidence promotion;
- dispute case model/UI;
- clause-linked issue capture;
- holds/retention state;
- resolution record;
- admin support surface.

Exit gate:

- for a paid engagement, Wewed can show what was agreed, what was due, what was paid, the proof, relevant messages/documents, and any unresolved issue.

### Phase 5 — Wedding Media Vault & Post-Wedding Archive

**Goal:** preserve couple website/event media before, during, and after the wedding.

Deliverables:

- media originals through Vault;
- website media linkage;
- derivative/thumbnail pipeline;
- guest/couple/vendor media source metadata;
- existing-media backfill;
- privacy/publication controls;
- archive lifecycle;
- couple export path;
- post-wedding archive UX.

Exit gate:

- the wedding website no longer depends on uncontrolled media URLs for newly uploaded content, and authorized couple media remains available after the event under the configured retention policy.

### Phase 6 — Contract Intelligence, Analytics & Trust

**Goal:** build differentiated intelligence on top of trustworthy underlying records.

Deliverables:

- explain/summarize contract;
- amendment extraction assistance;
- contract/engagement search;
- operational dashboards;
- vendor performance signals only where definitions are defensible;
- privacy-safe analytics.

Exit gate:

- AI/analytics can be disabled without affecting contract validity, storage integrity, payments, or evidence.

---

## 29. First implementation milestone after approval

When product implementation is authorized, the first engineering milestone is **not** “build the final signature UI.”

It is:

> **Create the Vault + Historical Service Engagement foundation required to put already-paid vendors on record immediately.**

The first approved branch should therefore prioritize:

1. exact repository/data audit;
2. migration design for Vault + Historical Engagement;
3. private storage configuration;
4. authorization helpers;
5. payment-proof/document upload;
6. Vendor/Budget linkage;
7. historical paid-vendor capture UI;
8. audit/reconciliation tests;
9. production-safe backfill/capture procedure.

Only after that foundation is proven should the branded Wewed contract generation/acceptance engine be layered on top.

---

## 30. UAT / qualification matrix

No phase may rely only on unit tests. Browser/API/database qualification must prove user boundaries.

### Historical paid vendor

- Planner creates historical engagement for existing vendor.
- Links existing budget item.
- Records prior payment.
- Uploads receipt/proof.
- Admin sees it.
- Couple sees only permitted data.
- No retroactive acceptance timestamp is generated.
- Wrong-wedding planner cannot access it.

### Vault

- Upload permitted file succeeds.
- Invalid/oversized/unsafe file is rejected or quarantined.
- Private object cannot be fetched without authorized route/link.
- Signed access expires.
- Cross-wedding object ID access fails closed.
- Same object can link to message + engagement without binary duplication.
- Evidence-held object cannot be silently deleted.

### Communications attachments

- Planner -> Vendor attachment.
- Vendor -> Planner attachment.
- Couple -> Planner attachment.
- Admin support conversation attachment.
- Mobile upload/picker.
- Desktop drag/drop.
- Upload retry/cancel.
- Switching conversations cannot send attachment to wrong thread.
- Hidden mobile thread does not mutate read state unexpectedly.
- External notification uses controlled Wewed link.

### Contract generation

- Correct vendor/service template chosen.
- Couple/planner/vendor identities render correctly.
- Wewed branding appears on web and PDF.
- Contract ID and version visible.
- QR verification resolves correctly under authorization policy.
- PDF artifact remains identical after template is later updated.

### Acceptance

- Vendor secure link read access works.
- Expired/revoked token fails.
- Viewing does not equal accepting.
- Couple accepts.
- Planner accepts.
- Vendor accepts.
- Contract becomes effective only after required set is complete.
- Acceptance receipt references correct hash/version.
- Admin cannot forge acceptance.

### Amendment

- One party proposes price/date/scope change.
- Current effective contract remains effective.
- Diff displays accurately.
- Partial approval does not activate amendment.
- All required approvals activate new version.
- Old version remains viewable as superseded.
- Attempted direct DB/application mutation of effective content is blocked by release-tested guards.

### Payments

- Contract milestone reconciles to Budget.
- Payment proof links to correct engagement.
- Mismatch is surfaced.
- Amendment changing amount creates/requires auditable budget reconciliation.

### Dispute/evidence

- Evidence can be promoted from communication attachment.
- Dispute links contract clause/version.
- Admin can support without mutating source evidence.
- Hold prevents destructive cleanup.

### Wedding media

- New couple image stored as private original.
- Authorized published derivative appears on site.
- Unpublished media is not public.
- Existing media backfill records success/failure.
- Archive preserves media after lifecycle changes.
- Contract/evidence access remains independent from public-site state.

---

## 31. Observability and operational dashboards

Production support must be able to answer:

- Which uploads failed and why?
- Which objects are quarantined?
- How much storage does each wedding consume?
- Which contracts are awaiting acceptance and from whom?
- Which share links are expired/revoked?
- Which contract hash verification checks failed?
- Which paid vendors have no engagement or proof?
- Which Budget/contract/payment totals disagree?
- Which amendments are pending?
- Which disputes are open?
- Which objects are under hold?
- Which wedding media ingestion jobs failed?

Events should feed existing operational/audit patterns without logging full sensitive document contents.

---

## 32. Migration and backward-compatibility rules

- Do not break existing `Vendor`/`BudgetItem` reads during Service Engagement rollout.
- Introduce new entities additively, then progressively make Service Engagement the richer source.
- Existing `contractStatus`/`paymentStatus` fields may temporarily remain compatibility summaries derived from the richer engagement state; remove/redefine them only through a deliberate migration.
- Existing MediaItem URLs remain readable during media backfill.
- Existing communications continue working for text-only messages throughout attachment rollout.
- Attachment/message migration must not mark old messages unread/read unexpectedly.
- No backfill may infer acceptance or legal terms from a paid amount alone.
- Every backfill must be idempotent and report exceptions.

---

## 33. Performance and cost discipline

Vault/media can grow rapidly. Build for control from the start.

- object deduplication where safe using checksum/reference model;
- derivatives instead of serving full-resolution originals everywhere;
- quotas/usage metrics;
- upload size policy by account/tier/file class;
- background processing for large media;
- resumable upload later for very large video if needed;
- archive/cold-storage abstraction later without changing domain IDs;
- avoid storing identical contract binaries per recipient;
- never duplicate a file solely because it is linked from multiple modules.

Cost controls must never compromise evidence integrity without an explicit retention policy.

---

## 34. Product UX standards

The system must feel simpler than paper even though the governance underneath is sophisticated.

### Planner

A planner should be able to answer from one screen:

- Who is this vendor?
- What exactly are they delivering?
- What is the agreed price?
- Is the contract effective?
- Who has not accepted?
- What has been paid?
- What is still due?
- Where are the invoice/receipt/documents?
- What changed?
- What messages matter?
- Is there a dispute?

### Vendor

A vendor should be able to open a link on a phone, understand the service/payment summary, read the contract, upload an invoice, accept/reject, and communicate without navigating the full Planner application.

### Couple

A couple should see plain-language contract/payment status without being exposed to unrelated internal planner/admin notes.

### Admin

Admin should see the chronological evidence trail with clear authority boundaries and no need to manually reconstruct events from unrelated databases.

---

## 35. Explicit non-goals for the first release

These may become future products but must not distract the ASAP implementation:

- Wewed becoming escrow by implication.
- Wewed automatically adjudicating legal liability.
- blockchain as a requirement for immutability.
- crypto signatures/tokens.
- public exposure of private contract documents.
- AI-generated autonomous legal advice.
- replacing all third-party accounting software.
- full document office-suite editing.
- arbitrary executable/file hosting.
- claiming global legal enforceability without market review.

The benchmark advantage comes from coherent product/data/evidence design, not adding fashionable infrastructure unrelated to the problem.

---

## 36. Documentation governance — how this plan stays canonical

### Required agent behavior

Before implementing or materially changing any of the following, an agent must read this document:

- storage/uploads;
- Communications attachments;
- Planner vendor documents;
- Service Engagements;
- vendor contracts;
- contract templates/clauses;
- digital acceptance;
- payment proof/reconciliation;
- dispute/evidence;
- planner notes attachments;
- wedding/couple media storage;
- post-wedding archive.

### Change rule

Any PR that changes a canonical principle in this plan must either:

- update this document in the same PR with an explicit rationale; or
- state `Vault/Contracts Canon impact: none` with a short explanation.

### Policy rule

The PR must also follow `docs/LEGAL_IMPLEMENTATION_NOTES.md`:

- `Policy impact: none` with reason; or
- `Policy impact: updated` with affected public policy/matrix references.

### No silent scope deletion

Agents may phase functionality, but they must not remove a requirement from the target architecture merely because it is deferred from the current milestone.

---

## 37. Definition of success

The workstream is successful when Wewed can truthfully demonstrate the following end-to-end scenario:

1. A planner selects or records a vendor.
2. A wedding-specific Service Engagement is created.
3. Relevant files live in the Wewed Vault.
4. A Wewed-branded service-specific contract is generated.
5. Couple, planner, and vendor can review the same version.
6. Required parties accept with evidentiary receipts.
7. The effective version becomes immutable and verifiable.
8. The payment schedule and Budget reconcile.
9. Invoices/receipts/payment proofs are retained.
10. Communications can carry attachments that remain governed Vault objects.
11. A later contractual change creates a new version requiring approval rather than overwriting history.
12. A dispute can be reconstructed from the contract, evidence, payments, and communications without relying on private external inboxes.
13. Admin can support the dispute without changing the evidence.
14. The couple's wedding media and website assets remain organized in the Vault through the post-wedding archive lifecycle.
15. Existing paid vendors are on record without Wewed falsifying retroactive consent.

At that point Wewed is no longer only helping users plan a wedding. It is providing a controlled transaction and evidence layer for wedding execution and memory preservation.

---

## 38. Approval gate

This document is the planning artifact only.

**Do not begin product/database/UI implementation solely because this plan exists.**

Implementation begins only after explicit user approval. When approval is given, start with **Phase 0 — Paid Vendor Record Rescue**, using the Vault + Historical Service Engagement foundation as the first engineering goal.
