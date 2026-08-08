# Wewed AI Wedding Architect — Ecosystem Implementation Plan

Status: **Approved direction; implementation proceeds incrementally on `feature/ai-wedding-architect`.**

This document is the implementation contract for the Wewed AI Wedding Architect. It extends the existing Guest Concierge, Planner Copilot, Template Intelligence and Communication Assistant architecture into a connected wedding-planning, marketplace, procurement and referral system.

## 1. Product goal

Wewed should allow a couple or planner to provide a wedding brief — budget, date, location, guest count, priorities, required categories, style and constraints — and receive a complete, editable wedding plan assembled from real Wewed marketplace offerings and deterministic price calculations.

The core promise is:

> Tell Wewed what the wedding needs and what it can cost. Wewed AI helps assemble a realistic plan from eligible providers, explains the trade-offs, keeps the whole plan within budget where feasible, and turns approved recommendations into governed internal opportunities, quotes, bookings, tasks, payments and analytics.

The Wedding Architect is **not a standalone AI page or isolated database**. It is an intelligence and optimisation layer spanning the Wewed ecosystem.

## 2. Ecosystem rule

No new Wedding Architect domain may create a second source of truth for data that already belongs elsewhere.

Canonical ownership is:

- provider identity and eligibility: Wewed business/provider records;
- services, packages, price rules and availability: provider catalogue;
- wedding requirements: wedding/client planning records;
- generated plan: structured Wedding Architect plan records;
- planner tasks: planner task records;
- wedding budget: budget records;
- vendor relationships: wedding/vendor and marketplace relationship records;
- internal introductions: marketplace lead/enquiry records;
- quotations: governed quote records;
- bookings and payment state: booking/payment records;
- AI drafts and proposals: existing governed AI revision/action mechanisms;
- commercial attribution: referral/conversion events;
- reporting: derived analytics from canonical transactional data.

AI consumes these records and proposes actions. It does not maintain a shadow copy of the marketplace or wedding.

## 3. AI is the glue, not the calculator of record

AI should be thoroughly present across the workflow, but responsibilities must remain explicit.

### AI responsibilities

- interpret natural-language wedding briefs;
- ask the next useful missing question;
- infer preferences only when marked as an inference and ask for confirmation where material;
- explain provider/package matches;
- explain budget trade-offs and optimisation decisions;
- produce plan narratives, summaries and printable presentation copy;
- suggest substitutions when a plan becomes infeasible;
- help providers structure incomplete catalogue descriptions into form suggestions that the provider confirms;
- help planners compare alternatives and advise clients;
- draft internal introductions, follow-ups and quote summaries;
- analyse outcome and conversion data for stakeholders within permissions.

### Deterministic services remain authoritative for

- monetary arithmetic;
- tax/service-charge calculations;
- quantity and unit pricing;
- capacity checks;
- geographical eligibility;
- date/availability constraints;
- subscription/entitlement checks;
- hard client requirements;
- ranking inputs and optimisation constraints;
- referral attribution;
- state transitions and database writes.

AI must never invent a price, availability state, subscription state, booking result or payment result.

## 4. End-to-end event map

```text
Provider enrols/claims profile
  -> completes company data
  -> completes category offerings
  -> completes packages + price components + conditions
  -> Wewed calculates catalogue completeness / AI readiness
  -> eligible offering enters marketplace matching pool

Couple or planner starts Wedding Architect
  -> wedding brief / requirements are created or loaded
  -> AI asks for missing requirements
  -> client confirms budget, priorities and category constraints
  -> deterministic engine normalises quantities and budget
  -> marketplace candidate filter applies hard constraints
  -> price engine calculates each viable candidate for THIS wedding
  -> optimiser assembles complete candidate wedding plans
  -> AI explains best plan + alternatives + assumptions
  -> structured editable Wedding Plan is saved
  -> printable/exportable view renders the same plan data
  -> user locks, swaps or edits choices
  -> price/optimisation engine recalculates affected categories
  -> user explicitly approves vendor introductions
  -> internal marketplace leads are created
  -> subscribed/eligible providers receive internal opportunity notifications
  -> providers respond / quote inside Wewed
  -> quote is reconciled against the plan
  -> AI explains variance and proposes rebalancing
  -> user approves booking
  -> budget/tasks/timeline/payment schedule are updated through governed actions
  -> referral and conversion events are recorded
  -> outcome data improves marketplace analytics and future matching
```

No provider is contacted simply because it appeared in an AI draft. A user-approved introduction is required.

## 5. Provider catalogue data model

The provider form remains category-aware, but the commercial dataset must become calculation-ready.

### 5.1 Business/profile data

Continue using canonical provider/business data for:

- display/legal identity;
- verification and listing status;
- subscription plan/status;
- primary location and service areas;
- public contacts and internal account ownership;
- languages;
- experience/team size;
- response expectation;
- minimum booking notice;
- travel radius/policy;
- payment methods;
- deposit/cancellation/refund policies;
- accessibility and cultural experience;
- provenance, confidence and owner-confirmation timestamps.

### 5.2 Offering data

Every service offering needs structured commercial fields in addition to its category-specific details:

- pricing visibility: `exact`, `from`, `range`, `quote_only`;
- pricing model/unit;
- currency;
- base/starting price;
- maximum indicative price;
- minimum spend;
- minimum/maximum capacity or quantity where relevant;
- quantity included in base price;
- incremental unit price;
- minimum billable quantity;
- billing increment;
- setup fee;
- delivery fee/rule;
- travel inclusion and travel fee/rule;
- overtime rate/unit;
- tax included flag and tax percentage when excluded;
- service charge type/value;
- deposit type/value;
- balance due rule;
- price valid from / price valid until;
- availability mode;
- lead-time constraints;
- required dependencies;
- optional add-ons;
- discount rules;
- owner-confirmed commercial timestamp;
- commercial completeness score;
- AI planning readiness state.

### 5.3 Package data

A package is a purchasable configuration, not just display copy. It must support:

- name and description;
- active/published state;
- base price and currency;
- pricing unit;
- included quantity/capacity;
- min/max applicable quantity;
- inclusions;
- excluded items where commercially significant;
- optional add-ons;
- required add-ons/dependencies;
- overtime/additional-unit price;
- travel/delivery rules;
- tax/service-charge handling;
- deposit/balance terms;
- price validity period;
- package-specific category attributes;
- catalogue version / updated timestamp.

### 5.4 Price components

The system should support explicit components so category calculations are inspectable:

- fixed;
- per guest/adult/child;
- per item/serving/table/room/vehicle;
- per hour/day/night/session;
- per kilometre/trip;
- percentage surcharge;
- conditional fixed surcharge;
- tiered quantity price;
- discount;
- refundable security amount;
- tax/service charge.

Every calculated total must retain a line-by-line breakdown and the catalogue/version that produced it.

## 6. Category-specific form contract

Shared pricing fields are not enough. Each provider category must prompt for the data needed to calculate a real client scenario.

- Venue: hire basis, ceremony/reception fees, capacity, furniture, catering/bar restrictions, corkage, cleaning/security, accommodation, overtime and day/time premiums.
- Planning: full/partial/month-of/day-of/consultation fees, fixed vs percentage fee, assistants, travel and wedding-size/budget bands.
- Photography: hours, shooters, images/deliverables, overtime, albums, engagement sessions, drone and travel.
- Videography: hours, operators, film deliverables, livestream, drone, extra edits, overtime and travel.
- Florals: bouquet/buttonhole/table/arch/installation components, minimum spend, setup/teardown and seasonal/import premiums.
- Catering: adult/child/per-person pricing, minimum guests, menu tiers, staffing, equipment, dietary premiums, service charge and travel.
- Cakes/desserts: servings, tiers, per-serving/per-tier/design pricing, delivery/setup, stands and decoration complexity.
- Entertainment: performer type, duration/sets, equipment, overtime, travel and additional performers.
- Decor/rentals: per-item quantities, minimum order, delivery, setup/collection and damage/security deposits.
- Beauty: per person/service, trials, bridal party, travel and early-start surcharge.
- Attire: purchase/hire, garment, fitting/tailoring, customisation and accessories.
- Transport: vehicle capacity, trip/hour/day/km pricing, waiting time, driver/fuel and route rules.
- Stationery/signage: design fee, unit price, quantity tiers, customisation, printing and delivery.
- Officiants: ceremony/rehearsal/documentation/travel fees.
- Jewellery: item/material/customisation/sizing price rules.
- Accommodation/travel: room/night/occupancy, minimum stay, meal plan, group rate and transfers.
- Tents/marquees: size/capacity, hire period, flooring/walls/setup and delivery.
- Lighting/AV: equipment package, operators, hours, setup, stage/sound and overtime.
- Bar/beverages: guest/package/bottle pricing, staffing, corkage and service duration.
- Photo booth: hours, prints, attendant, props and overtime.
- Content creation: hours, deliverables, turnaround and extra coverage.
- Gifts/favours: unit price, quantity tiers and personalisation.
- Choreography: lessons/session/package and travel.
- Security: guards/hours, minimum hours, supervision/equipment.
- Childcare: children/hours/carers, age bands and activities.
- Cleaning/sanitation: labour/hours, washrooms, consumables and servicing.
- Other: shared structured component builder with explicit units and conditions.

## 7. Provider form UX

Provider onboarding/editing must actively explain why complete catalogue data matters.

Two separate scores are required:

- **Profile completion** — quality of the public marketplace profile;
- **AI Planning Readiness** — whether Wewed can safely calculate and recommend the offering for a real wedding.

UI behaviour:

- show missing calculation-critical fields;
- show readiness per offering/package;
- explain that AI Wedding Architect eligibility requires sufficiently complete and current commercial data;
- let AI suggest structured values from provider-entered descriptions/website data, but never save them without provider confirmation;
- require explicit price-validity confirmation;
- warn when price information is stale;
- preserve draft saving and existing onboarding recovery behaviour.

A provider may remain visible in ordinary marketplace search while not being eligible for exact-budget AI selection.

## 8. Client/wedding requirement data model

Couples and planners must write to the same canonical wedding requirement dataset.

### 8.1 Global requirements

- wedding date/date flexibility;
- country/city/venue radius;
- total budget;
- currency;
- contingency target;
- budget flexibility;
- guest count and adult/child breakdown;
- ceremony/reception types;
- style/cultural requirements;
- payment/cash-flow constraints;
- required categories;
- excluded categories;
- quality/value strategy.

### 8.2 Category requirements

Each category receives a structured requirement object matching the calculable provider attributes for that category.

Examples:

- venue: seated capacity, ceremony/reception co-location, indoor/outdoor, accommodation, accessibility, external catering requirement;
- photography: coverage hours, shooters, album, engagement shoot, style;
- catering: adult/child count, service style, cuisine, dietary requirements, equipment/staff needs;
- transport: passengers, route, vehicle type, trips and duration.

### 8.3 Requirement priority

Every material requirement can be:

- `required` — cannot be violated;
- `strong_preference`;
- `preferred`;
- `flexible`;
- `not_required`.

The optimiser may trade only non-required preferences and must explain material compromises.

## 9. Eligibility and matching

Before ranking, deterministic hard filters apply:

- offering is published/active;
- provider/account is active;
- provider is entitled to receive AI-originated opportunities under the current commercial rules;
- listing/verification rules are satisfied;
- AI planning readiness is satisfied for exact-budget selection;
- service location matches;
- date/lead-time constraints match;
- capacity/quantity constraints match;
- required client attributes match;
- price validity is current enough for the requested confidence tier.

After filtering, candidates may be scored using transparent factors such as:

- requirements fit;
- calculated price/value fit;
- verified-data confidence;
- availability confidence;
- response reliability;
- marketplace quality/review signals;
- client preference alignment.

Paid promotion must never silently replace organic fit. Sponsored placement, if introduced, must be separately identified.

## 10. Pricing engine

The pricing engine is deterministic and independently tested.

Canonical total:

```text
base price
+ quantity components
+ required components
+ chosen add-ons
+ setup/delivery/travel
+ overtime/surcharges
+ tax/service charges
- valid discounts
```

The engine returns:

- total amount;
- currency;
- breakdown lines;
- assumptions;
- unmet requirements;
- price source/version;
- price-valid-until;
- confidence state.

The LLM receives the calculated result; it does not reproduce the calculation from prose.

## 11. Optimisation engine

The optimiser assembles complete plans, not independent cheapest-category picks.

Hard constraints include total budget, required requirements, capacity, service area, date/lead time and dependency rules.

Soft objective combines client priorities, preference fit, quality/reliability and budget efficiency.

The optimiser should support at least three presentation modes:

- value-conscious;
- balanced;
- priority-led.

A locked plan line remains fixed while the remainder of the plan is re-optimised.

When the plan is infeasible, the system must say so and provide the smallest understandable changes that could restore feasibility.

## 12. Wedding Plan as a first-class object

The generated plan must be structured and editable. A plan contains:

- wedding/client requirement snapshot;
- target and contingency budget;
- plan mode;
- selected candidate per category;
- selected package/configuration;
- calculated cost/breakdown;
- alternatives;
- requirement-fit explanation;
- confidence/freshness state;
- locked/unlocked state;
- introduction/quote/booking state;
- plan version and provenance.

The printable/PDF view is a rendering of the same structured plan. It is never a separate AI-generated document that can drift from the editable plan.

## 13. Recalculation and cascading change

Any material change — guest count, date, location, package, vendor, category requirement, quote or budget — invalidates affected calculations and triggers deterministic recalculation.

AI then explains the impact and suggests re-optimisation.

Example:

```text
Guest count 120 -> 160
  -> catering quantity changes
  -> cake servings change
  -> rentals/stationery may change
  -> venue capacity is rechecked
  -> transport may change
  -> plan variance is recalculated
  -> optimiser proposes savings while preserving locked/high-priority lines
```

## 14. Internal lead, quote and communication system

Vendor notification occurs only after explicit couple/planner approval.

```text
AI recommends provider
-> user shortlists provider
-> user approves introduction
-> Wewed creates internal opportunity
-> eligible provider receives internal notification
-> provider sees limited wedding brief
-> provider accepts/declines/asks question
-> quote/proposal is created internally
-> Wedding Plan reconciles actual quote vs calculated estimate
-> AI explains variance
-> user accepts/rejects/requests revision
```

Default privacy rule: personal contact details remain hidden until the appropriate consent/booking stage.

AI Communication Assistant should draft the internal messages, but existing governed send/approval boundaries remain in force.

## 15. Booking, budget, tasks and payment integration

An accepted plan/quote should not create disconnected records.

Governed actions should be able to:

- link/create the wedding vendor relationship;
- create/update budget items from accepted commercial values;
- create deposit and balance milestones;
- create planner tasks for booking, contracts and due dates;
- add relevant timeline dependencies;
- connect payment records where Wewed payment rails are used;
- preserve audit events for each transition.

Planner Copilot should then see the resulting canonical data automatically.

## 16. Stakeholder experiences

### Couples

- conversational requirement capture;
- complete calculated wedding plans;
- budget-safe alternatives;
- editable/printable plan;
- controlled introductions and private communication;
- quote comparison and rebalancing;
- booking/payment visibility.

### Planners

- same requirement and plan model on behalf of clients;
- multiple plan scenarios;
- ability to lock preferred/trusted providers;
- professional explanations and printable client proposals;
- quote reconciliation;
- AI-generated advice, agendas, tasks and communications.

### Providers/venues

- category-specific catalogue and pricing tools;
- AI-assisted catalogue completion;
- AI readiness score;
- qualified internal opportunities;
- quote/proposal workflow;
- conversion and revenue attribution analytics;
- subscription value tied to measurable business outcomes.

### Wewed administrators

- catalogue completeness/freshness monitoring;
- pricing/provenance confidence;
- recommendation/lead/quote/booking funnel analytics;
- referral attribution;
- subscription entitlement governance;
- dispute/audit visibility;
- marketplace health and supply-gap analysis.

## 17. Monetisation contract

The system should support, without coupling recommendation quality to payment:

- provider subscription entitlement for AI-originated opportunities;
- Planner Pro access to multi-client Wedding Architect workflows;
- premium couple planning scenarios/export/collaboration where appropriate;
- successful referral/booking fee;
- Wewed payment-processing revenue;
- premium vendor conversion/demand analytics;
- clearly labelled sponsored visibility that is separate from organic recommendation ranking;
- eventual enterprise/white-label Wedding Architect access.

Commercial attribution event chain:

```text
plan_generated
-> provider_recommended
-> provider_shortlisted
-> introduction_approved
-> lead_created
-> provider_responded
-> quote_created
-> quote_accepted
-> booking_confirmed
-> payment_recorded
-> service_completed
```

This allows Wewed to demonstrate subscription ROI rather than selling vague exposure.

## 18. Database/UI alignment rule

Every field introduced for Wedding Architect must have all applicable layers updated in the same feature slice:

1. database migration/schema;
2. server/API validation and serialization;
3. provider/client form state and validation;
4. public/internal display where relevant;
5. pricing/matching consumption;
6. AI context/prompt contract where relevant;
7. audit/provenance handling;
8. tests and fixtures;
9. analytics/event implications.

No database-only or UI-only commercial field is considered complete.

## 19. Migration and backwards compatibility

- Schema changes are additive first.
- Existing provider profiles/packages remain readable.
- Existing packages migrate to a valid legacy/default representation without inventing pricing rules.
- Existing ordinary marketplace search continues to work when AI-readiness data is absent.
- Missing structured pricing means `not_ready` for exact-budget AI planning, not broken provider pages.
- Existing wedding-scoped `Vendor` records remain intact; marketplace/provider-account records remain canonical for discovery.
- Existing AI areas continue operating while Wedding Architect is introduced.
- Production data is never destructively rewritten as part of initial adoption.

## 20. Delivery phases

### Phase A — Data contract and provider catalogue readiness — COMPLETE

- [x] Add structured commercial fields and calculation components.
- [x] Extend package model.
- [x] Add AI planning readiness/completeness calculation.
- [x] Upgrade category forms and validation.
- [x] Preserve public provider and marketplace compatibility.

### Phase B — Client requirements — COMPLETE

- [x] Canonical wedding requirements model.
- [x] Couple/planner shared requirement UI.
- [x] Category-specific questions and priority levels.
- [x] AI-assisted conversational requirement completion.

### Phase C — Pricing and eligibility — PARTIAL / FAIL-CLOSED

- [x] Deterministic pricing library with category fixtures.
- [x] Price provenance/versioning primitives in deterministic calculation results.
- [x] Eligibility filter and explicit rejection reasons as a deterministic library.
- [ ] Canonical marketplace candidate adapter resolving live provider/account/subscription/availability data.
- [ ] End-to-end subscription entitlement integration into Wedding Architect candidate selection.
- [ ] Category-semantic approval for ambiguous variable quantity bindings.

Release boundary: Phase C libraries are present for controlled development and testing, but the production-facing Wedding Architect does not yet auto-select or optimise real providers. Ambiguous variable units are stored but fail AI Planning Readiness for automatic selection until their category semantics are explicitly approved.

### Phase D — Optimisation and Wedding Plan

- [ ] Plan optimisation service.
- [ ] Value/balanced/priority-led scenarios.
- [ ] Structured plan persistence/versioning.
- [ ] Editable plan UI.
- [ ] Print/PDF rendering from structured plan.
- [ ] AI explanations and plan conversation.

### Phase E — Internal opportunities and quotes

- [ ] Explicit introduction approval.
- [ ] Internal lead creation/notification.
- [ ] Provider response and quote workflow.
- [ ] Quote-to-plan reconciliation and AI explanation.

### Phase F — Booking and monetisation

- [ ] Booking conversion.
- [ ] Budget/task/timeline/payment integration.
- [ ] Referral attribution.
- [ ] Subscription and fee rules.
- [ ] Stakeholder conversion analytics.

## 21. Regression gates

Every implementation slice must demonstrate that it does not regress unrelated stakeholder flows.

Required gates include, as applicable:

- provider registration/sign-in/profile autosave/save/publish;
- provider claim/correction/provisional-listing paths;
- public provider directory/profile/enquiry;
- planner marketplace and appointment flows;
- planner tasks/budget/vendors/guests/timeline;
- couple/wedding public access and Guest Concierge;
- existing AI Workspace tests and permission isolation;
- admin/RBAC/governance;
- subscription/billing integrity;
- database migration from existing schema and clean database;
- production build;
- browser smoke/regression suite;
- Preview deployment and runtime error review before merge.

## 22. Release principle

No phase is merged merely because its isolated tests pass.

Before merge, the branch must be synchronised with current `main` and the **combined build** must pass the relevant ecosystem gates. Production remains unchanged until the release candidate is verified.

## 23. Current implementation status

Phases A and B are implemented on the Wedding Architect feature branch. Phase C has deterministic pricing, provenance primitives, eligibility rules and quantity-binding infrastructure, but live marketplace candidate selection, subscription integration and category-semantic approval remain intentionally incomplete.

The release therefore fails closed: no production-facing optimiser or automatic provider recommendation is exposed from partial Phase C work. The shared provider catalogue and Wedding Brief may be tested and merged only after the exact-head regression gates, Preview deployment and UAT pass. Later optimiser work must consume the same canonical records rather than creating a parallel AI data model.
