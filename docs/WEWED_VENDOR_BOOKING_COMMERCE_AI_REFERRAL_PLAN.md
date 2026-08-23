# Wewed Vendor Booking, Commerce, AI & Referral — Canonical Implementation Plan

**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN — IMPLEMENTATION NOT YET STARTED  
**Stamp:** `WW-BOOKING-COMMERCE-2026-08-24-01`  
**Canonical date:** 2026-08-24  
**Baseline reviewed:** `01549a107a252a0b129760f6e7a7d6b477ce9dee` (`main`)  
**Canonical domain:** `https://wewed.pro`  
**Primary scope:** Marketplace + Provider Catalogue + Booking + Availability + Inventory + Planner + Budget + Contributions + Service Engagements + Contracts + Payments + Communications + Calendar/Notifications + AI Wedding Architect + Sharing/QR/Referral + Analytics + Admin  
**Reference vendor:** Shandy Events / Shandy Weddings & Events  

This document is the authoritative product, data, UX, integration, security, implementation, testing and release guide for the Wewed vendor-booking workstream described in the 2026-08-24 product discussions. It is deliberately broad because Booking is not a single button or calendar form. It is the commercial execution layer that turns marketplace discovery and Wedding Architect plans into real, governed wedding commitments.

Future agents implementing this scope must reference stamp `WW-BOOKING-COMMERCE-2026-08-24-01`. If code, schema or UX decisions conflict with this plan, the implementation must either be brought back into conformance or this document must be explicitly amended before the conflicting change is merged. Do not silently reinterpret the product after implementation starts.

This document itself records and governs the work. It does not authorize unrelated refactors or weakening of existing Wewed privacy, financial, contract, communications, planner, marketplace or AI controls.

---

## 1. Product vision

Wewed Booking must mean more than “choose a date and submit a request.” It must become a reusable wedding-commerce reservation engine capable of reserving:

- individual physical rental items;
- quantity-based inventory;
- people and teams;
- appointment slots;
- service hours;
- wedding/event dates;
- venue capacity;
- transport resources;
- packages and bundles;
- custom or quote-only services.

The complete product loop is:

```text
Discover
  -> Share / QR / referral
  -> Open provider or product deep link
  -> Browse catalogue + media
  -> Load wedding context when authorized
  -> AI / user chooses requirements
  -> Check deterministic availability
  -> Calculate deterministic price
  -> Hold / request / quote / book
  -> Govern terms / contract / consent
  -> Record deposit / payment / contribution funding
  -> Update Planner + Budget + Timeline + Tasks
  -> Coordinate through Communications + Notifications
  -> Fulfil / return / complete
  -> Record evidence / amendments / disputes where needed
  -> Attribute referral + analytics
```

The core promise is:

> **Wewed helps a couple or planner find what the wedding needs, understand whether it is available and affordable, reserve it under appropriate terms, and keep the booking synchronized with the wedding plan instead of creating disconnected marketplace transactions.**

---

## 2. Relationship to existing canonical Wewed plans

This work extends existing systems; it must not create parallel sources of truth.

### 2.1 AI Wedding Architect

`docs/AI_WEDDING_ARCHITECT_ECOSYSTEM_PLAN.md` already defines Wewed AI as an intelligence/orchestration layer spanning wedding requirements, catalogue, deterministic pricing, optimisation, introductions, quotes, bookings, tasks, payments and analytics.

Booking therefore becomes the **commercial execution layer** for the Wedding Architect. AI may interpret, recommend, compare, prepare and explain. Deterministic services remain authoritative for money, availability, capacity, geography, state transitions and writes.

### 2.2 Provider catalogue and taxonomy

`docs/vendor-forms-profiles-service-taxonomy-2026-08-05.md` already defines the public provider identity, `ProviderServiceOffering`, packages, portfolio and category-aware commercial data.

This plan extends that catalogue for booking-grade inventory, variants, media, availability modes, pricing rules and resource requirements. It does not replace the existing provider profile or service taxonomy.

### 2.3 Service Engagements, contracts and evidence

`docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_PLAN.md` defines `ServiceEngagement` as the wedding-specific commercial center joining vendor, service scope, dates, amounts, contract, payments, documents, messages, tasks, changes and evidence.

A confirmed booking must converge into or link to the canonical `ServiceEngagement`; Booking must not become a second competing contract/payment relationship record.

### 2.4 Contributions

`docs/WEWED_CONTRIBUTIONS_RESOURCE_ACCOUNTING_PLAN.md` defines contributor funding and in-kind resource accounting.

Booking must never assume that a service paid or fulfilled for a wedding was funded by the couple. Confirmed bookings must be able to reconcile with contribution funding, direct-to-vendor payments and in-kind fulfilment without double counting.

### 2.5 Communications

Existing Wewed Communications remains the canonical messaging/delivery layer. Booking-specific conversations must attach booking/service-engagement context rather than creating a separate messaging system.

### 2.6 Planner marketplace authority

Existing marketplace and planner authority rules remain fail-closed. A public enquiry or booking interaction must never silently grant a provider access to the private wedding workspace. Planner actions on behalf of a couple require existing wedding-scoped authority.

---

## 3. Non-negotiable product principles

1. **One booking engine, many vendor models.** Do not build separate booking applications for gowns, chairs, photographers, venues and transport.
2. **Marketplace identity is not wedding authority.** A public provider profile does not grant private wedding access.
3. **Catalogue first.** A bookable item/service must be represented by structured data, not only marketing prose.
4. **Media is first-class.** Wedding commerce is visual; listings must support meaningful galleries and video.
5. **Availability is deterministic.** AI and UI must never fabricate an available date, item or quantity.
6. **Price is deterministic.** AI may explain price but may not invent it.
7. **Holds prevent double booking.** Availability must be revalidated transactionally before a hold or confirmation.
8. **Instant Book is optional.** Request-to-book and request-quote are first-class modes.
9. **A hold is not a booking.** A draft or temporary reservation must never be presented as a confirmed commercial commitment.
10. **A booking is not automatically payment.** Payment state remains explicit and separately reconciled.
11. **A booking is not automatically couple-funded.** Contributions/source-of-funds remain explicit.
12. **Accepted terms are governed.** Where a contract or acceptance is required, Booking must use the canonical contract/engagement architecture.
13. **Changes are amendments, not history deletion.** Material booking changes preserve before/after state and approvals.
14. **AI never silently commits the user.** Recommendations, drafts, holds and confirmed bookings are visibly distinct states.
15. **AutoBook requires explicit limits.** No autonomous commercial commitment without a recorded user authorization policy.
16. **Booking writes back to the wedding.** Confirmed commercial actions must update Planner/Budget/Timeline/Tasks through governed actions.
17. **Public sharing is canonical-domain only.** Share URLs and QR codes resolve through `wewed.pro` and survive internal route changes via stable identifiers/redirects.
18. **Referral attribution is preserved.** Sharing should create measurable acquisition/conversion data without altering price or organic ranking.
19. **Progressive complexity.** A small vendor can publish one simple bookable service; advanced vendors can manage large inventory.
20. **Mobile is primary.** Customer booking, QR sharing, vendor operations and planner approvals must be usable from phones.
21. **Audit commercial state.** Holds, requests, approvals, rejections, confirmations, amendments, cancellations, refunds and fulfilment transitions must be traceable.
22. **Existing Wewed systems remain authoritative.** Extend, link and reconcile; do not duplicate.

---

## 4. Canonical vocabulary

### Provider
The approved marketplace business identity.

### Provider Service Offering
A public commercial service category/offering owned by a Provider.

### Catalogue Item
A distinct bookable/rentable/sellable product or service configuration under an offering. Examples: Royal Lace A-Line gown, Gold Chiavari Chair, Full-Day Photography.

### Variant
A selectable item dimension such as size, colour, model or capacity band. Variants can have distinct inventory and media.

### Resource
Something whose availability constrains a booking: a specific gown, a pool of chairs, a photographer/team, vehicle, room, venue, appointment slot or capacity unit.

### Booking
The canonical reservation/request record describing what a customer wants from a Provider for a specific wedding/event and time period.

### Booking Line
One product/service/package/add-on/fee within a booking.

### Availability Hold
A short-lived reservation of constrained resources while a user completes an allowed workflow. A hold expires automatically unless converted.

### Booking Request
A customer request requiring vendor approval before confirmation.

### Quote Request
A request for a provider-calculated/custom proposal where price or scope cannot be finalized automatically.

### Confirmed Booking
A booking whose required commercial acceptance conditions are satisfied. Payment/contract may still have separate states where policy permits confirmation before full settlement.

### Booking Amendment
A governed proposed change to a confirmed booking. It preserves the original state and records acceptance/rejection of the change.

### Fulfilment
Operational delivery of the service/rental, including pickup, setup, event use, collection, return, inspection and completion as applicable.

### Referral Link
A stable Wewed deep link containing attribution metadata sufficient to associate later qualified activity with a source/referrer.

### AutoBook Policy
A user-approved rule defining what AI is permitted to prepare, hold, request or confirm and within which financial/risk limits.

---

## 5. Booking archetypes

The booking engine must support these archetypes through configuration, not separate applications.

| Archetype | Example | Scarce resource |
| --- | --- | --- |
| Individual rental | Wedding gown | Specific serialized item / variant |
| Quantity rental | 120 chairs | Quantity from inventory pool |
| Appointment | Bridal fitting | Staff + time slot + optionally room |
| Timed service | Makeup artist | Staff/team + duration |
| Event-day service | Photographer | Person/team + wedding date/time |
| Capacity booking | Venue | Venue/space + capacity + date |
| Transport | Bridal car / bus | Vehicle + driver + route/time |
| Package/bundle | Décor package | Multiple resources and/or services |
| Custom/request | Bespoke floral installation | Provider capacity + quote workflow |
| Hybrid | Gown hire | Item + fitting + rental period + return |

Every catalogue item/offering should declare a booking archetype or explicit booking configuration.

---

## 6. Booking modes

Every offering/item must define one of the following customer transaction modes.

### 6.1 Instant Book

Use when availability, price, policy and required customer inputs can be determined safely by Wewed.

Examples:

- known quantity rental;
- standardized appointment slot;
- fixed package with deterministic price.

### 6.2 Request to Book

Use where vendor approval is required even after availability appears feasible.

Examples:

- gown requiring fit confirmation;
- photographer who approves event brief;
- venue with operational screening.

### 6.3 Request Quote

Use where price/scope requires provider work.

Examples:

- bespoke décor;
- complex catering;
- custom floral installation;
- multi-city transport.

### 6.4 Schedule Appointment

May be a standalone bookable service or a prerequisite to a later transaction.

### 6.5 Add to Plan / Shortlist

A non-commercial state allowing a user or AI to associate an option with the wedding plan without reserving anything.

UI must never blur these actions.

---

## 7. Catalogue, variants and media

### 7.1 Catalogue hierarchy

Target hierarchy:

```text
Provider
  -> Provider Service Offering
      -> Catalogue Item
          -> Variant(s)
          -> Resource / inventory configuration
          -> Media
          -> Price rules
          -> Availability policy
          -> Add-ons
          -> Package membership
          -> Booking policy
```

### 7.2 Variant requirements

Variants must support at least:

- label/name;
- stable SKU/reference code;
- option dimensions such as size, colour, model, finish or capacity;
- active/published state;
- variant-specific price override where permitted;
- variant-specific media;
- inventory/resource relationship;
- replacement value/security value where applicable.

### 7.3 Media requirements

A listing should support:

- hero image;
- multiple gallery images;
- video;
- front/back/detail/real-wedding media;
- variant-specific media;
- captions/alt text;
- ordering;
- provenance/owner confirmation;
- approved/published state.

Do not treat one profile image as a sufficient product catalogue.

### 7.4 Lightweight vendor path

The system must also support a provider with no complex inventory:

```text
Provider -> one service offering -> one simple catalogue/service item -> price/quote rule -> booking mode
```

Advanced inventory management is optional unless the service type requires it.

---

## 8. Availability and time model

A generic `bookingDate` is insufficient for weddings.

### 8.1 Core time fields

The data model must be able to represent, as relevant:

- event date/time;
- booking/service start;
- booking/service end;
- rental start/end;
- pickup time;
- delivery time;
- setup start/end;
- collection time;
- return due time;
- fitting/appointment time;
- buffer before;
- buffer after;
- cleaning/maintenance downtime;
- travel/turnaround buffer.

Only relevant fields should be exposed for each booking archetype.

### 8.2 Provider availability controls

Providers should be able to configure:

- operating days/hours;
- blackout dates;
- holidays/closures;
- minimum booking notice;
- maximum advance booking window;
- minimum/maximum duration;
- turnaround/buffer requirements;
- concurrent booking limit;
- staff capacity;
- inventory quantity;
- service area/location constraints;
- venue/space capacity;
- delivery/pickup windows.

### 8.3 Availability service output

The deterministic availability service should return:

- available / unavailable / request-only / unknown-confidence;
- available quantity/capacity;
- constrained resource IDs where appropriate;
- valid time windows;
- reason codes for failure;
- earliest next availability where useful;
- availability source/version/timestamp.

AI receives this result; it does not infer it from prose.

### 8.4 Concurrency and holds

Before creating a hold or confirmation, availability must be rechecked transactionally.

Hold flow:

```text
AVAILABLE
  -> HOLD_CREATED(expiresAt)
  -> CONFIRMED
```

or:

```text
HOLD_CREATED
  -> EXPIRED / RELEASED
  -> AVAILABLE
```

A hold must have:

- resource/quantity allocation;
- owning booking/draft;
- actor/customer;
- start/end window;
- expiration;
- state;
- idempotency key;
- audit event.

The implementation must protect against two users confirming the same constrained resource after a stale page view.

---

## 9. Pricing, charges and commercial configuration

Booking pricing must build on the deterministic Wedding Architect pricing approach.

Supported price bases should include:

- fixed;
- per hour;
- per day/night;
- per item;
- per person/guest;
- per session;
- per kilometre/trip;
- package;
- starting-from/range for discovery;
- quote-only.

Additional components may include:

- delivery;
- collection;
- setup;
- dismantling;
- cleaning;
- travel;
- overtime;
- alterations;
- additional staff;
- security/refundable deposit;
- damage waiver;
- taxes/service charges;
- optional add-ons;
- conditional surcharges;
- valid discounts.

A calculated booking must preserve a line-by-line price snapshot and catalogue/version provenance so later catalogue changes do not silently rewrite an existing quote/booking.

### 9.1 Add-ons

Add-ons may be optional or required and may themselves consume resources.

Examples:

- gown veil, petticoat, steaming, alterations, delivery;
- chair cushions, covers, delivery, setup, collection;
- photography second shooter, drone, album, engagement session, extra hour.

### 9.2 Packages/bundles

Packages must reserve/check the resources represented by their components, not merely show one marketing price.

Example:

`Gold Ceremony Package = 100 chairs + arch + signing table + aisle décor + delivery + setup`.

If any required constrained component is unavailable, the package must be treated accordingly.

---

## 10. Shandy Events — mandatory reference implementation

Shandy Events is the first fully configured reference vendor. The implementation should deliberately prove two different booking families.

### 10.1 Wedding gown hire

This must prove:

- rich catalogue/gallery/video;
- gown-specific product records;
- size and colour variants;
- serialized or variant-level inventory;
- wedding/use date;
- fitting appointment;
- pickup;
- rental period;
- return;
- cleaning/maintenance buffer;
- refundable/security deposit;
- optional veil/accessories/alterations/delivery;
- availability checks;
- request-to-book or instant-book policy as configured;
- item condition and return inspection.

Illustrative item:

```text
Royal Lace A-Line
  colour: Ivory
  size: 12
  inventory: 1
  rental price: provider-defined
  fitting: available
  cleaning buffer: provider-defined
```

Size/colour must not be unstructured description text if they affect availability.

### 10.2 Chairs / event-equipment hire

This must prove:

- quantity inventory pools;
- date-range availability;
- partial quantity availability;
- delivery/setup/collection;
- per-item pricing;
- packages/bundles;
- logistics windows;
- deposits/damage rules;
- inventory shortage handling.

If Shandy owns 100 chairs and 60 are committed during an overlapping period, the deterministic availability result must not allow 50 more to be confirmed as if 100 remained.

### 10.3 Reference-vendor rule

Do not hard-code Shandy-specific booking logic. Seed/configure Shandy using the same public data model and services that other providers will use.

---

## 11. Customer booking experience

### 11.1 Public/anonymous visitor

A public visitor may:

- open a vendor/product deep link;
- browse approved public catalogue and media;
- see safe public pricing and booking-mode information;
- check availability only to the extent permitted by anti-abuse/privacy rules;
- be asked to sign in/create an account before a governed request/hold/booking if required.

No private wedding information is exposed.

### 11.2 Registered couple

When a user has an authorized wedding context, Wewed may prefill:

- wedding date;
- wedding location;
- guest count;
- relevant budget allocation;
- known category requirements.

The user can override booking-specific details where permitted without silently rewriting the wedding's canonical facts.

### 11.3 Illustrative gown flow

```text
Open Shandy
-> Wedding Gowns
-> view product/gallery/video
-> choose colour + size
-> choose/confirm wedding date
-> availability check
-> choose rental period / pickup / return
-> schedule fitting if required
-> choose add-ons
-> deterministic price summary
-> review cancellation/deposit/terms
-> request/book according to mode
-> terms/contract/payment steps as configured
-> confirmation
-> Planner/Budget/Tasks/Calendar synchronization
```

### 11.4 My Bookings

Couples need a wedding-scoped `My Bookings` surface containing at least:

- provider;
- item/service/package;
- wedding/event date;
- booking status;
- quote/approval state;
- contract/terms state;
- payment/deposit state;
- key operational dates;
- messages;
- amendments;
- cancellation/refund state;
- fulfilment/return/completion state.

This should become a wedding order book, not a list of marketplace enquiries.

---

## 12. Vendor Booking Center

Providers need a private booking operations surface.

### 12.1 Core views

- new booking/quote requests;
- awaiting provider action;
- upcoming confirmed bookings;
- today's appointments/pickups/deliveries/returns;
- calendar/resource view;
- inventory conflicts;
- fulfilment tasks;
- cancellations/refunds;
- completed bookings;
- referral/commerce analytics.

### 12.2 Inventory operational states

Physical rental resources may use states such as:

`AVAILABLE`, `HELD`, `RESERVED`, `PREPARING`, `READY`, `OUT`, `RETURNED`, `INSPECTION`, `CLEANING`, `MAINTENANCE`, `LOST`, `RETIRED`.

The exact resource-state machine may vary by archetype but must not be represented only as free-form notes.

### 12.3 Item condition/history

For serialized rental inventory, support:

- purchase/reference data where useful;
- replacement value;
- current condition;
- last inspection;
- cleaning/maintenance history;
- rental count;
- damage/loss history;
- media/evidence for return disputes;
- retired state.

---

## 13. Booking lifecycle and state machine

Do not use one overloaded status for all concepts. Preserve separate booking, payment, contract and fulfilment states.

### 13.1 Booking state

Recommended canonical progression:

```text
DRAFT
-> AVAILABILITY_CHECKED
-> HELD (optional)
-> REQUESTED (request-to-book)
-> QUOTE_REQUESTED (quote-only)
-> VENDOR_APPROVED / QUOTED
-> AWAITING_CUSTOMER_APPROVAL
-> AWAITING_TERMS / AWAITING_DEPOSIT (as configured)
-> CONFIRMED
-> IN_PROGRESS
-> COMPLETED
```

Interruption/terminal states:

- `DECLINED`;
- `EXPIRED`;
- `CANCELLED`;
- `NO_SHOW`;
- `REFUNDED` where relevant;
- `DISPUTED`.

### 13.2 Contract state

Use canonical contract/service-engagement states; do not encode contract acceptance into booking text fields.

### 13.3 Payment state

Payment state remains explicit and reconciles to canonical payment records. Examples: no payment required, deposit due, deposit recorded, partially paid, paid, refund pending, refunded.

### 13.4 Fulfilment state

Archetype-specific fulfilment states should cover pickup/delivery/setup/service/return/inspection as relevant.

---

## 14. Booking amendments, cancellations and refunds

### 14.1 Amendments

Material changes must create a revision/amendment record rather than silently mutating history.

Examples:

- gown size/variant;
- rental dates;
- chair quantity;
- photography hours;
- event location;
- package/add-ons;
- delivery/collection time;
- price-affecting scope.

An amendment should record:

- original booking/version;
- proposed changes;
- price/availability impact;
- proposer;
- required approvals;
- acceptance/rejection;
- effective timestamp;
- audit events.

Where the change affects an effective contract, the canonical contract amendment rules apply.

### 14.2 Cancellation policy

Cancellation/refund policy should be structured enough for clear customer presentation and deterministic eligibility where possible. Provider-specific rules may differ by item/service.

The customer must see material cancellation/deposit/refund terms before confirming.

---

## 15. Location and logistics

Bookings may need:

- wedding venue/event location;
- service location;
- delivery address;
- pickup address;
- return address;
- route/transport legs;
- service area/radius;
- travel/delivery pricing rule;
- venue access/setup windows.

Availability and pricing services must be able to reject or surcharge a booking based on deterministic provider/location rules.

---

## 16. Actor, authority and privacy model

A booking must explicitly record both the wedding/customer and the actor who initiated/approved it.

Possible actors:

- couple member;
- authorized planner;
- vendor creating a booking on behalf of a known customer after a legitimate interaction;
- Wewed admin support through governed procedures;
- AI agent acting under a recorded user authorization policy.

Fields/concepts should distinguish:

- `weddingId` / customer context;
- `createdByActorId`;
- `bookedByActorId`;
- represented role/authority where relevant;
- provider/business account;
- referral source.

A planner may act only under existing wedding-scoped authority. A provider booking relationship does not itself grant access to unrelated Planner data.

---

## 17. Planner, Budget and wedding-data synchronization

A confirmed or materially approved booking must not remain isolated in Marketplace.

Governed integration should be able to:

- create/link the wedding-specific vendor relationship;
- create/link the `ServiceEngagement`;
- create/update budget items using accepted commercial values;
- create deposit/balance milestones;
- create Planner tasks;
- create Timeline/Calendar entries;
- attach communications context;
- surface documents/contracts;
- reconcile payment records;
- reconcile Contributions/source-of-funds;
- mark a wedding requirement as fulfilled/partially fulfilled where appropriate.

### 17.1 Financial states in Planner

Planner/Budget should distinguish at least:

- estimated/planned;
- quoted;
- committed/booked;
- paid;
- contributed/funded source;
- actual/final.

A booked amount is a commitment, not automatically cash paid.

### 17.2 Requirement satisfaction

Conceptual chain:

```text
Wedding Requirement
  -> Budget Allocation
  -> Candidate / Shortlist
  -> Booking / Service Engagement
  -> Payment / Contribution funding
  -> Fulfilment
  -> Requirement satisfied
```

This allows AI and Planner to understand that a need is already covered and avoid duplicate recommendations.

---

## 18. Contributions integration

Booking must obey the canonical Contributions plan.

Examples:

- Parent pays Shandy directly for the gown: the booking/engagement is paid, but funding source is contributor-funded direct-to-vendor.
- Aunt gives the couple cash and they later pay Shandy: contribution cash is received first; the later payment is funded from that contribution allocation.
- Friend provides photography free of charge: in-kind contribution may satisfy a planning requirement without a couple-funded cash payment.

Do not infer couple funding from `paid=true` or equivalent legacy status.

AI may summarize contribution impact but may not fabricate a contributor or classify unknown historical funding without confirmation.

---

## 19. Contract, evidence and communications integration

### 19.1 Service Engagement convergence

A confirmed commercial booking should create or link to a `ServiceEngagement` rather than form a permanent parallel transaction graph.

### 19.2 Terms/contract

Depending on category, value and provider configuration, a booking may require:

- simple policy acceptance;
- provider quote acceptance;
- Wewed Standard Service Agreement;
- contract amendment for later material changes.

AI cannot accept terms for a human party unless a future legally valid delegated mechanism explicitly authorizes that specific action. The default AutoBook model must therefore stop before consent that legally requires direct party acceptance.

### 19.3 Communications

Messages should be contextualized to the booking/engagement, e.g.:

`Booking BK-... — Royal Lace Gown`.

Use existing Communications conversations/entity links and delivery channels. Do not create a second messaging store.

---

## 20. AI Wedding Architect integration

AI is a core part of Booking but must respect deterministic commercial truth.

### 20.1 AI capabilities

AI may:

- interpret natural-language booking needs;
- map them into structured catalogue filters;
- use wedding context already available to the user;
- compare eligible products/providers;
- explain availability and price results supplied by deterministic services;
- suggest budget reallocations;
- identify missing requirements;
- prepare booking drafts;
- prepare quote or booking requests;
- prepare Planner tasks/operational follow-ups;
- flag conflicts between bookings;
- help vendors draft catalogue descriptions/attributes for confirmation;
- analyze demand and utilization data within permissions.

AI may not invent:

- price;
- availability;
- inventory quantity;
- payment result;
- contract acceptance;
- contribution source;
- vendor approval;
- booking confirmation.

### 20.2 AI action levels

Wewed must distinguish the following levels visibly.

**Level 1 — Suggest:** AI recommends but creates no commercial record.

**Level 2 — Add to Plan / Shortlist:** AI creates/updates planning intent only.

**Level 3 — Prepare Booking:** AI creates a draft with selected item, date, options and calculated price for human review.

**Level 4 — Hold / Submit Request:** only with explicit authorization; AI may create a temporary availability hold or submit a request-to-book/quote.

**Level 5 — AutoBook within policy:** only where all required conditions are deterministic and a user has explicitly created an AutoBook policy covering the action. Any required human legal acceptance outside that authority remains a stop point.

### 20.3 AutoBook Policy

A policy should be structured, auditable and revocable. It may contain:

- wedding scope;
- allowed categories;
- maximum per-booking amount;
- maximum cumulative committed amount;
- allowed booking modes;
- allowed providers/verification levels;
- refundable/non-refundable restrictions;
- deposit limit;
- whether holds are allowed;
- whether request-to-book submissions are allowed;
- whether deterministic Instant Book confirmation is allowed;
- expiry date;
- explicit exclusions;
- created/approved/revoked timestamps.

Example policy:

> Prepare any booking; place temporary holds automatically; confirm only Instant Book services up to USD 200 each and never exceed the approved wedding budget. Ask before any non-refundable commitment.

Enforcement must be server-side. The LLM cannot self-authorize beyond the recorded policy.

### 20.4 AI autobudgeting

The Wedding Architect should evolve budget allocations from estimates toward marketplace-grounded values:

`Estimated -> Marketplace-calculated -> Quoted -> Booked/Committed -> Paid -> Final`.

If a selected booking exceeds a category allocation, AI may propose a deterministic rebalance but must receive approval for material financial-plan mutations according to existing AI action rules.

### 20.5 Cross-booking reasoning

AI should eventually detect issues such as:

- venue includes chairs, so a separate chair need may already be satisfied;
- guest count rose above booked chair/catering quantity;
- gown booked but fitting missing;
- venue access time conflicts with décor setup;
- photography coverage exceeds venue/event timing;
- transport capacity is below current guest/party need.

The facts come from canonical records; AI provides reasoning/explanation.

---

## 21. Stable links, QR codes and social sharing

Every provider must have a stable public Wewed identity and shareable canonical link.

### 21.1 Link levels

Support stable deep links for at least:

- Provider storefront;
- Service offering;
- Catalogue item/product;
- Package;
- appointment/service entry point;
- later: authorized booking verification/check-in where appropriate.

Canonical examples may look like:

```text
https://wewed.pro/vendors/shandy-events
https://wewed.pro/v/shandy-events/royal-lace-gown
```

Exact route syntax may evolve. Stable entity identifiers and redirects must prevent printed/shared QR codes from breaking when UI routes change.

### 21.2 QR generation

Wewed should generate QR codes internally for canonical deep links. Providers should not need external QR services.

Share UI should include:

- Copy link;
- Show QR;
- native device Share where available;
- WhatsApp share;
- Facebook share/status-compatible share;
- email share;
- other channels supported safely by browser/mobile capabilities.

A QR preview should clearly identify the vendor/product and destination so users know what they are sharing/printing.

### 21.3 Social link previews

Public vendor/product routes must expose high-quality canonical metadata for social previews:

- provider/product name;
- concise category/service description;
- approved hero image;
- canonical Wewed URL;
- booking/check-availability intent where appropriate.

Do not leak private wedding data into social metadata.

### 21.4 Vendor Share Center

Vendor dashboard should eventually provide:

- canonical storefront URL;
- QR preview;
- copy/share actions;
- product-specific share links;
- referral/source analytics;
- top shared/booked products.

---

## 22. Referral attribution

Sharing is an acquisition system, not only a convenience button.

### 22.1 Attribution model

A referral event/link should be able to represent:

- referrer type: vendor, planner, couple/user, campaign, Wewed internal;
- referrer entity/user/business ID where authorized;
- source/channel: WhatsApp, Facebook, QR, copy link, email, native share, unknown/direct;
- target entity: provider, item, package, service;
- campaign code if any;
- first-touch and qualified conversion timestamps;
- privacy-safe session/visitor correlation;
- eventual wedding/booking attribution when the user authenticates and consent/policy permits.

### 22.2 Attribution persistence

If a planner shares a gown, the couple opens the link, signs in and books later within a defined attribution window, Wewed should retain the referral relationship rather than losing it at authentication.

### 22.3 Analytics

Potential provider metrics:

- link/QR opens;
- catalogue views;
- availability checks;
- booking requests;
- confirmed bookings;
- attributed booking value;
- channel conversion rates.

Referral data must not silently alter organic marketplace ranking or price. Future paid/affiliate programs require separate explicit policy.

---

## 23. Context-aware deep links

A shared link should remain useful to both anonymous and registered users.

Anonymous visitor:

- sees public product/storefront.

Authorized registered wedding user:

- may additionally see wedding-context intelligence such as current category budget, date compatibility, guest-count compatibility and AI match explanation.

Example:

> Available for your wedding date; within your current bridal-attire allocation; size 12 is available.

These statements must be produced from canonical wedding + catalogue + availability data. Private wedding facts must never be embedded in the public URL or public social preview.

---

## 24. Booking and commerce analytics

Booking gives Wewed actionable marketplace data beyond page views.

Measure where permitted:

- provider/product impressions;
- media engagement;
- availability checks;
- no-availability losses;
- holds;
- request-to-book submissions;
- quote requests;
- vendor approval/decline;
- confirmation conversion;
- cancellation;
- average lead time;
- average booking value;
- inventory utilization;
- most requested variants/sizes/colours;
- referral channel conversion;
- fulfilled/completed bookings;
- AI-assisted vs direct conversion;
- planner-assisted booking attribution.

Admin analytics must preserve role/privacy boundaries and should derive from canonical events rather than maintaining a separate manually edited total.

---

## 25. Target data model

Names below are canonical intent; exact Prisma/table naming should follow repository conventions while preserving responsibilities.

### 25.1 Catalogue

**ProviderCatalogueItem**

- id;
- provider/business ID;
- offering ID;
- name/slug/reference;
- booking archetype;
- booking mode;
- description/attributes;
- pricing visibility/model;
- published state;
- lead-time rules;
- location/service-area policy;
- created/updated/version fields.

**ProviderCatalogueVariant**

- item ID;
- SKU/reference;
- option dimensions;
- active state;
- price override;
- replacement/security value;
- inventory/resource link.

**ProviderCatalogueMedia**

- item/variant ID;
- governed media/Vault reference where appropriate;
- media type;
- ordering;
- caption/alt;
- published state.

**ProviderCatalogueAddon**

- parent item/package;
- add-on item/service;
- required/optional;
- price/resource behavior.

**ProviderPackageComponent**

- package ID;
- component item/variant/service;
- quantity;
- required/optional/substitutable rules.

### 25.2 Resource/availability

**BookingResource**

Represents a constrained unit/pool/person/team/vehicle/space/capacity resource.

**BookingResourceInventory** or equivalent

Represents quantity/serialized stock and operational state.

**ProviderAvailabilityRule**

Operating hours, blackout dates, notice windows, concurrency, buffers and related policy.

**AvailabilityHold**

Temporary resource allocation with expiry and idempotency.

### 25.3 Booking

**Booking**

- booking number;
- wedding/customer context;
- provider/business;
- offering/item context;
- booking mode/archetype;
- state;
- event/service/rental times;
- location/logistics snapshot;
- pricing snapshot/version;
- created/booked-by actor;
- referral attribution;
- Service Engagement link when created;
- quote/contract/payment/fulfilment summary references;
- timestamps/version.

**BookingLine**

Products, variants, packages, add-ons, fees, quantities and price snapshots.

**BookingResourceAllocation**

Which resource/quantity/time window is assigned to the booking.

**BookingAmendment**

Append-only change proposal and outcome.

**BookingEvent**

Structured audit/domain events.

### 25.4 Sharing/referral

**ShareLink** or stable referral-token model

- target entity;
- referrer;
- channel/campaign;
- active/expiry configuration;
- canonical redirect target.

**ReferralEvent**

- link/source;
- event type;
- privacy-safe visitor/session correlation;
- authenticated user/wedding only when allowed;
- booking conversion reference.

### 25.5 AI authorization

**AutoBookPolicy**

Recorded user authorization with limits and audit history.

Do not store AI authority only inside prompts or chat text.

---

## 26. Service/API boundaries

Implement domain services rather than allowing UI routes to perform inconsistent commercial logic.

Recommended service boundaries:

- `CatalogueService` — published bookable catalogue reads/management;
- `AvailabilityService` — deterministic resource/time/quantity evaluation;
- `PricingService` — deterministic line-by-line commercial calculation;
- `HoldService` — atomic hold create/release/expire;
- `BookingService` — request/approve/confirm/cancel/amend state transitions;
- `FulfilmentService` — delivery/rental/return/completion transitions;
- `ReferralService` — stable share links and attribution events;
- `BookingSyncService` — Service Engagement/Budget/Tasks/Timeline synchronization;
- `AutoBookAuthorizationService` — server-side AI action authorization;
- `BookingAnalyticsService` — derived event reporting.

### 26.1 Mutation requirements

Commercial mutation endpoints should support:

- authenticated actor;
- wedding/business authorization;
- idempotency key where duplicate submission is dangerous;
- optimistic concurrency/version where edits can race;
- transactional resource recheck for holds/confirmation;
- structured error/reason codes;
- audit/domain event emission.

---

## 27. Security, privacy and integrity

### 27.1 Public/private boundary

Public APIs may return only explicitly published catalogue/provider fields. They must never expose:

- private verification data;
- private wedding details;
- internal inventory notes;
- contributor contact data;
- private contract/payment records;
- planner authority data.

### 27.2 Resource integrity

Use database-enforced uniqueness/constraints/transactions sufficient to prevent over-allocation under concurrency. UI-only checks are insufficient.

### 27.3 Monetary integrity

Persist currency and exact commercial snapshots. Never allow floating ambiguity, AI-calculated totals or later catalogue mutation to rewrite historical booking amounts.

### 27.4 Audit

Important events must include actor, action, target, timestamp and useful transition metadata without leaking secrets.

### 27.5 Anti-abuse

Public availability and referral endpoints require sensible rate limiting/bot protection. QR/share tokens must not become authorization credentials for private wedding data.

---

## 28. Notifications and calendar

Use the existing Wewed notifications/calendar/reminder architecture.

Events may include:

- booking request submitted;
- quote ready;
- vendor approved/declined;
- hold expiring;
- deposit due;
- confirmation;
- fitting appointment;
- pickup/delivery/setup;
- return due/overdue;
- amendment awaiting approval;
- cancellation/refund update.

Notification channels follow existing Communications/notification rules. Do not invent parallel email/WhatsApp dispatch logic.

Calendar events should derive from canonical booking operational dates and maintain links back to the booking/engagement.

---

## 29. UX surfaces

### Public/provider discovery

- provider storefront with `Book`/`Services` area;
- visual category/catalogue collections;
- product/service detail;
- gallery/video;
- availability interaction;
- CTA based on mode: `Book now`, `Check availability`, `Request booking`, `Request quote`, `Schedule fitting`;
- Share/QR.

### Couple

- product booking flow;
- AI recommendations in Wedding Architect/Planner;
- My Bookings;
- booking detail/deal view;
- approvals/amendments;
- payments/terms status;
- calendar/tasks synchronization.

### Planner

- book on behalf of authorized wedding;
- compare/shortlist;
- AI procurement shortlist;
- booking oversight across weddings;
- client approval handoff where required;
- budget/requirement synchronization.

### Provider

- catalogue manager;
- inventory/resource manager;
- availability settings;
- booking center/calendar;
- fulfilment/return/inspection;
- Share Center;
- analytics.

### Admin

- booking search/support;
- audit/state visibility;
- dispute/support links to Service Engagement/Vault;
- provider/catalogue policy support;
- no invisible authority to alter accepted contracts or impersonate parties.

---

## 30. Migration and backward compatibility

1. Existing providers without booking data remain valid and visible according to current marketplace rules.
2. Booking capability is opt-in/configured per offering until data is complete enough.
3. Existing `ProviderEnquiry` records remain enquiries; do not retroactively pretend they were bookings.
4. Existing wedding `Vendor`, Budget and Service Engagement records remain authoritative for historical work.
5. Legacy marketplace/provider metadata continues to render through current fallbacks during catalogue normalization.
6. Existing Shandy account/profile should be extended with reference catalogue data rather than replaced with a duplicate provider identity.
7. No production wedding data is rewritten merely to fit the new model.
8. New financial/source-of-funds behavior must preserve Contributions migration rules.

---

## 31. Implementation phases

The phases below are ordered deliberately. Agents must not begin with a visually impressive checkout while availability, identity, money and synchronization remain undefined.

### Phase 0 — Baseline, architecture contract and regression inventory

**Goal:** establish the exact starting point and freeze boundaries.

Work:

- inventory current provider/profile/offerings/packages/media/enquiries;
- inventory current `Vendor`, Budget, Service Engagement, Payment, Contributions, Communications, AI, notification and planner APIs;
- record current Shandy IDs/account relationships without duplicating them;
- map current test suites and known UAT gates;
- define exact schema migration sequence and feature flags;
- add an implementation status/checkpoint document referencing this stamp.

**Gate:** no runtime behavior change; architecture review confirms no second source of truth.

### Phase 1 — Catalogue + media + booking configuration foundation

**Goal:** make provider offerings genuinely bookable as structured catalogue data.

Work:

- catalogue item/variant/add-on/package-component models;
- rich media associations;
- booking archetype and mode configuration;
- simple/advanced catalogue manager;
- public safe read APIs;
- Shandy gown and chair catalogue seed/configuration using canonical provider identity.

**Gate:** Shandy catalogue renders correctly on desktop/mobile; legacy providers remain unaffected.

### Phase 2 — Resource inventory + deterministic availability + holds

**Goal:** make Wewed capable of proving whether inventory/person/time/capacity is actually reservable.

Work:

- resource/inventory model;
- availability rules and blackout/buffer logic;
- quantity and serialized inventory;
- availability API/service;
- atomic temporary holds and expiry/release;
- concurrency/idempotency tests.

**Gate:** impossible to double-confirm the same serialized gown or exceed chair quantity under concurrent tests.

### Phase 3 — Deterministic pricing, add-ons and packages

**Goal:** calculate transparent booking totals from provider-owned commercial data.

Work:

- price snapshot/breakdown integration;
- per-item/hour/day/person/package rules;
- fees, deposits, add-ons, packages;
- price/version provenance;
- Shandy gown/chair calculations.

**Gate:** AI is not involved in arithmetic; booking totals are reproducible from deterministic tests.

### Phase 4 — Core booking lifecycle + customer/provider UX

**Goal:** complete the first end-to-end booking transaction without AI automation.

Work:

- Booking/BookingLine/resource-allocation/event models;
- Instant Book / Request to Book / Request Quote flows;
- customer booking UX;
- provider Booking Center;
- My Bookings;
- lifecycle transitions, cancellations and basic amendments;
- operational gown/chair fulfilment states.

**Gate:** Shandy gown and chair scenarios pass end-to-end UAT, including unavailable/conflict/cancel paths.

### Phase 5 — Wedding system synchronization

**Goal:** turn bookings into canonical wedding operations rather than marketplace islands.

Work:

- Service Engagement create/link;
- wedding vendor relationship link;
- Budget committed/quoted/paid distinctions;
- payment milestones;
- Contributions/source-of-funds hooks;
- Planner task/timeline/calendar synchronization;
- Communications entity links;
- notifications/reminders.

**Gate:** one confirmed Shandy booking appears consistently in Booking, Planner, Budget, vendor/engagement, tasks/calendar and communications context without duplicate money.

### Phase 6 — Contracts, amendments, evidence and fulfilment hardening

**Goal:** govern material commitments and post-booking changes.

Work:

- appropriate terms/contract routing;
- contract acceptance link to engagement;
- booking amendment/version semantics;
- return/inspection/damage evidence;
- cancellation/refund/dispute references;
- admin support controls.

**Gate:** accepted commercial history is immutable; amendments preserve prior state; evidence remains linked.

### Phase 7 — Stable deep links, QR, social previews and referral attribution

**Goal:** make every provider/product easily shareable and measurable.

Work:

- stable canonical provider/product/package links;
- QR generation/preview;
- Share Center;
- native/WhatsApp/Facebook/email/copy share actions;
- social metadata previews;
- referral token/event persistence through sign-in;
- referral/conversion analytics.

**Gate:** printed QR and shared links open canonical pages, never expose private wedding data, and preserve valid attribution into a later booking.

### Phase 8 — AI-assisted booking and wedding-aware commerce

**Goal:** connect Wedding Architect to live catalogue/availability/pricing/booking.

Work:

- structured AI tool/action layer for search/compare/availability/pricing;
- wedding-context recommendations;
- add-to-plan/shortlist;
- prepare booking drafts;
- budget-aware alternatives/rebalancing proposals;
- cross-booking conflict detection;
- vendor catalogue AI assistance requiring owner confirmation.

**Gate:** AI cannot claim or write price/availability outside deterministic services and cannot convert a recommendation into a confirmed booking silently.

### Phase 9 — AutoBook authorization

**Goal:** safely permit explicitly authorized agentic booking actions.

Work:

- AutoBookPolicy model/UI;
- server-side authorization service;
- hold/request/Instant Book action limits;
- per-booking/cumulative budget guards;
- non-refundable and contract-consent stop rules;
- revoke/expiry/audit;
- adversarial tests against prompt-driven overreach.

**Gate:** AI cannot exceed policy even if prompted to do so; every automated commercial action is attributable and auditable.

### Phase 10 — Analytics, optimization and marketplace-wide rollout

**Goal:** scale beyond Shandy while preserving correctness.

Work:

- provider commerce/referral dashboards;
- marketplace conversion/utilization metrics;
- category templates for remaining taxonomy;
- migration/onboarding guidance;
- AI readiness scoring for bookable offerings;
- operational performance monitoring;
- staged enablement by provider/category.

**Gate:** representative vendor-category matrix passes before global `Book` capability is enabled.

### Phase 11 — Full regression, UAT, release and closeout

**Goal:** qualify the exact release head across the entire Wewed ecosystem.

Required release evidence should include:

- clean database migration from fresh DB and current production-shaped DB;
- schema drift detection;
- RBAC/wedding/business isolation tests;
- concurrency/hold tests;
- deterministic pricing tests;
- booking state-machine tests;
- Shandy reference UAT;
- Planner/Budget/Contributions/Service Engagement regression;
- Communications/notifications regression;
- Wedding Architect safety/action regression;
- QR/referral/privacy tests;
- mobile/desktop browser tests;
- existing marketplace/provider/planner tests;
- production build;
- exact-head Vercel preview smoke/review;
- Supabase security/performance advisor review after DDL;
- release closeout document referencing this stamp and exact commit.

Do not merge merely because the happy-path Shandy demo works.

---

## 32. Mandatory Shandy UAT scenarios

At minimum, qualification should prove:

1. Public user opens Shandy storefront and gown catalogue.
2. Gallery and video/media render without exposing private management data.
3. User selects gown size/colour variant.
4. Available date can progress; unavailable date cannot be falsely confirmed.
5. Two concurrent users cannot both confirm the same serialized gown.
6. Required fitting can be scheduled without losing the gown context.
7. Pickup/return/cleaning buffer correctly blocks conflicting rental.
8. Add-ons change deterministic price correctly.
9. Request-to-book can be approved/declined by Shandy.
10. Confirmed gown booking synchronizes to the wedding systems.
11. Chair quantity availability decreases for overlapping confirmed/held bookings.
12. Partial remaining chair quantity is reported correctly.
13. Delivery/setup/collection details persist.
14. Package component availability prevents impossible package confirmation.
15. Cancellation/amendment preserves history.
16. Contributor-funded/direct-to-vendor payment is not reported as couple-funded.
17. Booking conversation is linked contextually.
18. Provider/vendor cannot access unrelated private wedding data.
19. Vendor link QR opens the canonical Shandy profile.
20. Product QR opens the intended gown/item.
21. WhatsApp/Facebook-compatible sharing uses correct public metadata.
22. Referral attribution survives authentication and reaches a later booking.
23. AI can find an available Shandy gown matching structured requirements.
24. AI cannot invent a size, price or availability state.
25. AI booking draft is visibly not a confirmed booking.
26. AutoBook policy tests enforce limits and require human action where authority/terms demand it.

---

## 33. Category rollout matrix

After Shandy, category enablement should be deliberate.

Suggested order by architectural coverage:

1. `attire` — serialized rental + fittings;
2. `decor-rentals` — quantity inventory + logistics;
3. `photography` / `videography` — timed team/event-day services;
4. `beauty` — staff appointments + party size;
5. `transport` — vehicles + time/route;
6. `venue` — date + capacity + access windows;
7. `catering` / `cakes` — guest/quantity + quote/package complexity;
8. entertainment, tents, lighting/AV, bar, photo booth, content creators;
9. other categories after their resource/pricing template is defined.

Do not label every provider “Book now” before its category has a safe booking configuration.

---

## 34. Definition of done

This workstream is not complete when Wewed has a `Book` button.

It is complete when:

- providers can define bookable catalogue/services appropriate to their category;
- customers can visually understand what they are booking;
- availability and price are deterministic and concurrency-safe;
- Shandy's gown and chair reference implementations work end to end;
- providers can operate bookings through fulfilment;
- couples/planners can manage bookings inside the wedding workspace;
- confirmed bookings synchronize with Service Engagement, Budget, Tasks, Timeline, Payments, Contributions, Communications and Contracts where relevant;
- stable links and QR sharing work across social/offline channels;
- referral attribution is measurable;
- Wedding Architect can recommend and prepare bookings from real marketplace data;
- AutoBook actions cannot exceed explicit user authority;
- existing Wewed data isolation and regression suites remain green;
- exact production release evidence and closeout are recorded.

The target architecture is therefore:

```text
Share / QR / Referral
        ↓
Marketplace Provider + Catalogue + Media
        ↓
Wedding context + AI Wedding Architect
        ↓
Availability + Pricing + Resource Engine
        ↓
Hold / Request / Quote / Booking
        ↓
Service Engagement + Contract + Payment + Contributions
        ↓
Planner + Budget + Tasks + Timeline + Calendar + Communications
        ↓
Fulfilment + Evidence + Analytics
```

This is the Wewed Wedding Commerce Engine. Shandy is the first proving ground, not the boundary of the product.
