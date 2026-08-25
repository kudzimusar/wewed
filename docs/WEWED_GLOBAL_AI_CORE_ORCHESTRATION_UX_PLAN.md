# Wewed AI Core, Orchestration & Experience — Canonical Global Plan

**Status:** STAMPED — AUTHORITATIVE GLOBAL AI PLAN — IMPLEMENTATION FOLLOWS CURRENT BOOKING UI/UX CLOSEOUT  
**Stamp:** `WW-AI-CORE-UX-2026-08-25-01`  
**Canonical date:** 2026-08-25  
**Current implementation sequence:** finish and qualify PR #185 first; implement this plan on a dedicated follow-on branch/PR from the merged UI baseline  
**Scope:** all Wewed AI across Couple, Planner, Guest, Vendor, Marketplace, Booking, Wedding Architect, Budget, Contributions, Contracts, Communications, Tasks/Timeline, Documents, Admin, Analytics and Visual Generation  

This document is the global architecture and product contract for Wewed AI. It exists because Wewed already contains useful AI capabilities, but they have grown through separate product areas and workstreams. The next stage is not to add another AI feature. It is to make **one Wewed AI system** that is shared by every surface, governed by one model policy, one context pipeline, one safety constitution, one tool/action protocol and one observable release process.

The user-facing result must also change. AI must improve UX: reduce form burden, explain complexity, help people decide, simulate alternatives, prepare work and expose the next useful action in context. Wewed must not advertise itself as AI-led while users experience a collection of static forms with unrelated AI pages elsewhere.

---

## 1. Why this plan exists

Wewed already has AI foundations and implemented product areas. `docs/AI_PRODUCT_AREAS_PLAN.md` defines Guest Concierge, Planner Copilot, Template Intelligence and Communication Assistant. `docs/AI_WEDDING_ARCHITECT_ECOSYSTEM_PLAN.md` defines Wedding Architect as an intelligence/orchestration layer across requirements, marketplace, deterministic pricing, optimisation, quotes, bookings, tasks, payments and analytics. The booking work adds governed AutoBook boundaries and deterministic booking execution.

The architectural gap is that these capabilities are not yet experienced or governed as one product-wide intelligence system. Risks of continuing feature-by-feature include:

- different features selecting providers or models independently;
- duplicated or drifting system prompts and safety language;
- inconsistent context assembly and privacy filtering;
- duplicate AI logic for the same wedding facts;
- AI being visible in one workspace but absent from another related workflow;
- model upgrades requiring multiple feature-specific edits;
- inconsistent output shapes that force every UI to parse prose differently;
- weak observability of which model, prompt, tools and facts produced an answer;
- visual AI becoming another disconnected integration;
- users seeing forms and information dumps instead of contextual assistance.

This plan makes fragmentation an explicit technical debt item and defines the migration to one core.

---

## 2. Relationship to the work currently in progress

This plan does **not** replace or interrupt PR #185 (`fix/booking-marketplace-mobile-ui`). The active product problem remains the booking/vendor interaction redesign identified during Shandy UAT.

The sequence is authoritative:

1. complete the second-generation provider/booking UI work already underway;
2. diagnose and clear exact-head CI on PR #185;
3. perform visual/mobile UAT against the exact preview;
4. merge PR #185 only when clean;
5. create the dedicated global AI unification branch/PR from that merged baseline;
6. use the redesigned Vendor Marketplace/booking journey as the first visible proof of the unified AI Core;
7. expand the same Core through Planner, Couple, Communications, Budget, Contributions, Contracts, Guests and Admin without creating new model silos.

AI implementation must therefore **enhance the interaction architecture we are building**, not reopen it into another information-heavy page or bolt a generic chatbot beside it.

The current vendor work remains the immediate product proving ground because the UI problems exposed the larger AI problem: users were being asked to interpret catalogues, logistics and enquiry forms themselves when Wewed should often be helping them understand and structure the request.

---

## 3. Existing foundation that must be preserved

Wewed is not starting from zero.

### 3.1 Existing provider router

`src/lib/ai/config.ts` already centralises provider configuration for:

- `groq`;
- `gemini`;
- `zai`.

It already distinguishes private and quality routing, fallback policy, request timeout, output-token limits and provider diagnostics. `src/lib/ai/index.ts` already exposes one `generateAiText(...)` entry point and applies provider ordering based on the request data profile.

This is a useful **transport/router foundation**, but it is not sufficient as the global AI product architecture. Feature code still needs one higher-level Wewed orchestration API so domains ask for a Wewed capability rather than constructing model messages or selecting providers.

### 3.2 Existing privacy boundary

The current AI request contract distinguishes `private` and `anonymized` data profiles and restricts private fallback unless explicitly enabled. This must remain fail-closed and become part of the global context envelope rather than being rediscovered by individual routes.

### 3.3 Existing governed AI product areas

The following remain valid domain specifications:

- Guest Concierge;
- Planner Copilot;
- Template Intelligence;
- Communication Assistant;
- Wedding Architect;
- booking/AutoBook orchestration.

They become **skills under the Wewed AI Core**, not independent AI architectures.

### 3.4 Existing deterministic-source-of-truth principle

The Wedding Architect rule remains global:

> AI is the glue, not the calculator or transactional source of record.

Deterministic/domain services remain authoritative for money, pricing, availability, capacity, geography, permissions, contract effectivity, payment facts, contribution funding, booking state, database writes and other governed state transitions.

---

## 4. Target product promise

The Wewed AI product promise is:

> **Wherever a user is in Wewed, Wewed AI understands the authorised context of that task, helps the user understand or complete it, and can prepare the next governed action without requiring the user to learn Wewed's internal data model.**

The AI should feel continuous as the user moves from discovery to planning to booking to fulfilment. It should not feel like separate bots.

Examples:

- a couple can describe a need naturally and receive structured marketplace options;
- a planner can ask what needs attention and receive results grounded in the same booking/budget/task records shown on screen;
- a vendor can receive an AI analysis of an enquiry and prepare a response without re-reading every message;
- a couple can simulate an alternative wedding design without creating a booking;
- a guest can ask a question using only public wedding facts;
- an admin can understand a support case without AI crossing wedding/private boundaries;
- a user can change the wedding brief once and all relevant AI skills operate from the updated canonical data.

---

## 5. One AI Core, not many AI implementations

The target architecture is:

```text
Wewed surface / event
        |
        v
AI Experience Gateway
        |
        v
Wewed AI Core / Orchestrator
  |        |         |          |
  |        |         |          +--> Visual AI Gateway (Higgsfield)
  |        |         +-------------> Tool / Action Registry
  |        +-----------------------> Context & Retrieval Pipeline
  +-------------------------------> Canonical Model Release Policy
        |
        v
Domain deterministic services / canonical records
        |
        v
Structured AI Outcome
        |
        v
Wewed UI presentation + explicit user action/approval
```

Every AI-capable product surface must enter through the AI Experience Gateway/Core. No feature is allowed to become its own provider client, prompt stack, model selector or safety policy.

---

## 6. Canonical model policy — one change point for everyone

The user's requirement that a model change should change Wewed globally is adopted as a non-negotiable rule.

### 6.1 Feature code must never select a model

Feature/domain code calls a **skill** and an **outcome**, for example:

```ts
wewedAi.run({
  skill: 'marketplace_concierge',
  outcome: 'recommend_options',
  context,
  input,
})
```

It must not call:

```ts
model: 'some-model-name'
provider: 'some-provider'
```

Provider/model forcing remains available only for diagnostics, controlled evaluation and migration tooling.

### 6.2 Wewed AI Model Release

Introduce one centrally versioned model release configuration, conceptually:

```ts
WewedAiModelRelease {
  releaseId: 'wewed-ai-2026-08-a'
  defaultLanguageProfile
  reasoningProfile
  visionUnderstandingProfile
  embeddingProfile
  visualGenerationProfile
  fallbackPolicy
  privacyPolicy
}
```

The **default language profile is the normal cognitive model for all Wewed domain skills**. Changing its mapping is a single central release change that moves every skill that uses the default profile after regression qualification.

A skill cannot choose a different model because its developer prefers one. Capability profiles such as reasoning, vision or embeddings are allowed only because the modality/capability is materially different; their provider/model mapping is still central and versioned.

Visual generation is inherently a different modality and therefore uses the central Visual AI Gateway rather than pretending the text model and image generator are the same model.

### 6.3 Current provider router becomes an implementation detail

Groq/Gemini/Z.ai remain replaceable providers behind the model release. User-facing copy never names the provider/model. Wewed is the product.

### 6.4 Global model change gate

A model-release change requires:

- representative evals for every registered AI skill;
- privacy/data-boundary tests;
- tool/action permission tests;
- structured-output conformance tests;
- grounding/factuality fixtures;
- latency/error/fallback comparison;
- exact-head Preview UAT;
- explicit release record identifying previous/new model release.

No model is changed directly in one route as an emergency shortcut unless it is a centrally recorded incident override.

---

## 7. The Wewed AI Org — one intelligence, specialised job descriptions

The requested customised AI "org" is defined as a **skill registry**, not independent uncontrolled agents. Every specialist shares the Wewed Core, model release, safety constitution, context protocol, audit format and action rules. What changes is the job description, allowed context, tools and outcomes.

Initial skill organisation:

| Skill | Primary users | Primary work | Allowed authority |
| --- | --- | --- | --- |
| Wedding Architect | Couple / Planner | interpret brief, assemble/explain plan, optimisation | explain/simulate/prepare |
| Couple Coach | Couple | explain decisions, next steps, trade-offs | explain/suggest/draft |
| Planner Copilot | Planner | attention brief, risks, tasks, coordination | explain/suggest/prepare governed actions |
| Marketplace Concierge | Public / Couple / Planner | interpret need, discover/compare providers/services | explain/suggest/simulate |
| Booking Assistant | Couple / Planner | structure request, explain availability/quote/booking | explain/draft/prepare; governed AutoBook separately |
| Vendor Copilot | Vendor | analyse enquiry, identify missing facts, draft response/quote brief | explain/draft/prepare |
| Budget Analyst | Couple / Planner | explain pressure/variance/options | explain/simulate; deterministic money only |
| Contributions Assistant | Couple / Planner | explain funding/source-of-funds gaps | explain/draft; never infer funding truth |
| Contract & Terms Explainer | authorised parties | summarise/explain terms and changes | explain/draft questions; never consent |
| Communications Copilot | authorised users | summarise, draft, translate, extract commitments | draft/prepare; sending governed separately |
| Guest Concierge | Guest | answer published wedding questions | read-only public context |
| Timeline & Task Copilot | Planner / Couple | identify dependencies and prepare tasks | explain/prepare governed actions |
| Admin Support AI | Wewed staff | support analysis and operational summaries | role-scoped read/prepare only unless explicit admin action |
| Visual Design Director | authorised users / Wewed | generate visual concepts/media through Higgsfield | simulate/generate with provenance; never claim vendor evidence |

A skill registry entry must declare:

- skill ID and version;
- intended users/roles;
- required permissions;
- data profile;
- context domains it may request;
- deterministic tools it may call;
- action classes it may propose;
- action classes it may never execute;
- system/skill prompt version;
- output schema;
- presentation contract;
- evaluation suite;
- privacy/redaction rules;
- visual-generation permission, if any.

---

## 8. Shared AI Context Envelope

Every AI request receives one server-created `WewedAiContextEnvelope`. Browser code may identify the current surface/entity but may not construct trusted wedding facts or permission claims.

Target envelope:

```ts
interface WewedAiContextEnvelope {
  traceId: string
  skill: WewedAiSkillId
  actor: {
    userId?: string
    role: string
    permissions: string[]
  }
  wedding?: {
    id: string
    timezone?: string
    currency?: string
  }
  surface: {
    route: string
    entityType?: string
    entityId?: string
    intent?: string
  }
  dataProfile: 'public' | 'private' | 'anonymized'
  facts: StructuredFactBundle
  retrievedEvidence?: EvidenceReference[]
  conversation?: SanitizedConversationContext
  allowedTools: WewedAiToolId[]
  actionBoundary: WewedAiActionBoundary
  modelReleaseId: string
  promptReleaseId: string
}
```

### Context rules

- resolve active wedding and actor authority on the server;
- retrieve only relevant domains for the selected skill/outcome;
- prefer structured canonical facts before documents or conversation summaries;
- minimise personal data sent to providers;
- never send another wedding's context;
- treat database text, vendor descriptions, uploaded documents and messages as untrusted data, not system instructions;
- include source/provenance for factual claims where useful;
- do not copy the whole database into prompts;
- AI memory never overrides canonical records.

---

## 9. AI actions: Explain → Suggest → Simulate → Draft → Prepare → Execute

Every user-visible AI interaction must communicate its authority class.

### Explain
Read-only answer grounded in authorised facts.

### Suggest
Recommendation; nothing is changed or reserved.

### Simulate
A hypothetical scenario using deterministic engines where relevant. Simulations are never bookings, payments, funding or vendor evidence.

### Draft
Creates/editable text or structured content for human review.

### Prepare
Builds a governed action proposal, booking request, shortlist, task set, quote brief, communication draft or other action-ready payload. It is still not execution.

### Execute
Permitted only through a domain-specific governed action system and explicit authority. AutoBook is the main example and is constrained by recorded policy. AI must not gain general write authority merely because the skill is capable of preparing a write.

### Global prohibitions

Unless a future canonical governance plan explicitly changes them, AI may never:

- invent price or availability;
- assert payment happened without payment evidence;
- infer that the couple funded an amount;
- create a Contribution as factual funding without a user/governed source;
- accept a contract or amendment for a person;
- manufacture vendor inventory;
- represent generated imagery as actual vendor products/events;
- expose private wedding/provider/admin data outside the actor boundary;
- silently send email/WhatsApp/SMS/messages;
- silently create a commercial commitment outside explicit AutoBook authorization.

---

## 10. Structured outcomes first; prose second

The Core should not return only a block of chat text. Every important response should have a typed outcome that the UI can render as cards, actions, comparisons, warnings and progressive disclosures.

Conceptual result:

```ts
interface WewedAiOutcome {
  traceId: string
  skill: WewedAiSkillId
  authority: 'explain' | 'suggest' | 'simulate' | 'draft' | 'prepare' | 'execute'
  summary: string
  facts: AiFactPresentation[]
  recommendations?: AiRecommendation[]
  missingInformation?: AiQuestion[]
  simulations?: AiSimulation[]
  proposedActions?: AiActionProposal[]
  citations?: AiEvidenceReference[]
  warnings?: AiWarning[]
  provenance: AiProvenance
}
```

This is required for good UX. It allows Wewed to show one relevant question, an actionable recommendation or a compact simulation rather than forcing users through a chat transcript or long form.

---

## 11. UX principle: AI should remove friction, not add another panel

AI is a product interaction layer, not a page that users must remember to visit.

### Global visible patterns

Wewed surfaces may expose contextual actions such as:

- **Ask Wewed**;
- **Help me choose**;
- **Explain this**;
- **What am I missing?**;
- **Simulate another option**;
- **Prepare this enquiry**;
- **Draft a reply**;
- **Summarise this conversation**;
- **What needs attention?**;
- **Check against my budget**;
- **Generate a visual concept**.

The UI must disclose AI progressively. It should not replace one information dump with an always-open AI chat window.

### Natural language to structured form

Where a user says:

> We need around 100 chairs in Harare in December and probably setup too.

AI should extract known fields, identify only missing material fields and ask the next useful question. The user reviews the structured request before submission.

### Context continuity

If the user is already on a provider/service/booking/budget/contract page, Wewed AI must know that authorised context automatically. Users should not have to re-explain which booking or vendor they are discussing.

---

## 12. Vendor/Marketplace is the first visible proving ground after PR #185

The redesigned provider/booking experience becomes the first implementation of the global AI UX.

### 12.1 Provider profile — Marketplace Concierge

Add an unobtrusive contextual AI entry point:

**Ask Wewed about this provider**

Supported outcomes:

- explain what the provider offers;
- explain service differences;
- match a wedding need to published catalogue items;
- identify whether price/availability is known, quote-only or missing;
- compare options using verified facts;
- prepare an enquiry.

### 12.2 Intelligent enquiry

The permanent form remains removed. AI can turn natural-language intent into the existing structured enquiry/booking fields, ask missing questions and present a review step.

### 12.3 Booking Assistant

Inside Choose → Logistics → Review:

- help select a service/variant;
- explain what information is required and why;
- detect schedule/logistics conflicts using deterministic wedding/booking facts;
- check completeness before submission;
- explain quote/contract/deposit state after submission.

AI does not calculate availability or money itself; it calls the deterministic booking resource/pricing services.

### 12.4 Vendor Copilot

Vendor booking inbox may show a compact **AI brief** on demand:

- request summary;
- confirmed/missing requirements;
- availability/pricing facts already known;
- unanswered questions;
- suggested next action;
- draft response or quote brief.

A vendor must still approve commercial terms.

### 12.5 Visual simulation

Use Visual Design Director + Higgsfield for clearly labelled **Wewed AI Concept** imagery based on style/brief choices. Generated concepts are inspiration, not Shandy or another provider's inventory evidence.

This work must preserve the compact/progressive UX acceptance rules in `docs/WEWED_BOOKING_UI_UX_HARDENING.md`.

---

## 13. Planner and Couple expansion

After the Vendor proving ground is stable, migrate the same Core into the broader planning experience.

### Planner

- daily/weekly attention brief;
- booking/vendor blockers;
- timeline conflicts;
- budget pressure;
- missing contracts/deposits/tasks;
- meeting agenda preparation;
- conversation summaries;
- action proposal preparation.

### Couple

- next-decision guidance;
- explain planner/vendor options;
- budget trade-off simulations;
- checklist completion;
- booking/contract/payment explanations;
- visual wedding concept generation;
- natural-language planning input.

Planner and Couple must see the same canonical facts appropriate to their permissions. AI may phrase differently for the role but must not create contradictory truth.

---

## 14. Budget and Contributions integration

AI is useful here only if accounting truth remains strict.

Budget Analyst may:

- explain planned vs actual vs paid;
- identify budget pressure;
- simulate alternatives;
- explain upcoming obligations;
- compare quote/booking changes.

Contributions Assistant may:

- explain what is couple-funded vs externally funded;
- identify unallocated or incomplete funding records;
- prepare a contribution/funding capture draft.

It may **not** infer that a payment was a contribution, infer a contributor, or mark an amount funded merely because a booking/payment exists.

---

## 15. Contracts and evidence integration

Contract & Terms Explainer may:

- summarise an effective contract/version;
- explain differences between versions/amendments;
- identify clauses relevant to a booking question;
- prepare questions for parties;
- explain whether the system currently has evidence of effectivity.

It must never say that a user has consented when no governed acceptance exists and must never accept/sign a contract.

AI-generated visual/text evidence is never equivalent to contractual/fulfilment evidence unless separately captured and governed by the evidence system.

---

## 16. Communications integration

Communications becomes a major AI surface because it connects every relationship.

AI may:

- summarise a booking-scoped conversation;
- identify unresolved questions or commitments;
- draft a reply;
- translate;
- extract proposed dates/amounts/tasks as reviewable structured suggestions;
- prepare a follow-up task;
- explain the current booking/contract/payment context relevant to the thread.

Sending remains controlled by the canonical Communications/delivery systems.

---

## 17. Guest experience

Guest Concierge remains the public/guest-safe skill. It uses the same Wewed Core/model release but a strictly public context profile.

The public skill must remain unable to access:

- private planner/couple notes;
- budget;
- private vendor negotiation;
- contracts;
- unpublished documents;
- guest contact data;
- admin/support data.

A global model change therefore reaches Guest Concierge too, but the context and tool boundary remains guest-specific.

---

## 18. Admin and operational intelligence

Admin Support AI uses the same Core but an admin-specific skill and permission set. It can help Wewed staff:

- understand support cases;
- summarise cross-entity records the staff member is authorised to read;
- identify likely workflow state/gaps;
- draft support communication;
- analyse aggregate product issues and AI failures.

Admin AI is not a privilege bypass. It still receives only the data permitted by the authenticated admin scope.

---

## 19. Visual AI / Higgsfield global gateway

Higgsfield is designated the first Wewed Visual AI provider, but visual generation must enter through a Wewed-owned gateway rather than being called ad hoc from feature components.

### 19.1 Two integration stages

**Development/design stage:** the connected Higgsfield workspace is used to create Wewed-owned editorial assets and prototype visual interactions.

**Production-user stage:** Wewed backend integration must own generation policy, credentials/provider connection, quotas, moderation, provenance, storage, permissions and cost controls. A user's browser must not hold provider credentials.

### 19.2 Visual provenance classes

Every surfaced visual must distinguish:

- `vendor_photo` — vendor-provided/published factual media;
- `wewed_editorial` — Wewed-owned illustrative brand/category media;
- `ai_concept` — generated visual simulation/concept;
- other governed provenance classes added later.

AI-generated concepts must never be presented as actual vendor inventory, portfolio evidence or proof that an event occurred.

### 19.3 Shared visual identity

Visual Design Director should use a versioned Wewed design profile so marketplace, planner, couple, invitation, onboarding, marketing and simulation media share one recognisable visual language rather than random prompts.

### 19.4 Current operational note

The Higgsfield connector/workspace must be verified as paid/credit-enabled before implementation relies on it. Subscription state and production credentials are operational dependencies, not assumptions encoded in UI.

---

## 20. Prompt architecture — one constitution, versioned skills

Prompt composition becomes:

```text
Wewed AI Constitution
+ Wewed Model Release rules
+ registered skill role/boundaries
+ registered outcome schema
+ server-built authorised context
+ retrieved evidence marked as untrusted data
+ sanitised conversation/request
```

### Rules

- no route-specific hidden system prompt may redefine Wewed safety/authority;
- client system messages are discarded;
- skill prompts are versioned in a central registry;
- prompt release/version is recorded with every trace;
- shared brand/tone rules belong in the Core, not copied across features;
- output/presentation contracts are centrally reusable;
- prompt changes receive evals just like model changes.

---

## 21. Tool registry and action policy

Domain skills do not directly import arbitrary database writers. The AI Core exposes a registry of narrow Wewed tools.

Tool classes:

### Read
Examples: catalogue lookup, booking status, budget summary, task query, conversation context, contract effectivity check.

### Deterministic compute
Examples: price calculation, availability check, budget simulation, plan optimisation.

### Prepare
Examples: create an action proposal payload, draft enquiry, draft communication, prepare booking request.

### Governed execute
Examples: already-authorised AutoBook action or approved action proposal execution. These remain implemented by the owning domain service and require their normal authorization/evidence.

The AI model never receives database credentials or unrestricted SQL as a tool.

---

## 22. Memory and continuity

Wewed needs continuity without turning AI memory into a competing database.

Separate:

1. **canonical wedding memory** — actual Wewed records; authoritative;
2. **conversation context** — recent relevant interaction, sanitised and scoped;
3. **AI preferences** — explicit user preferences that are safe and useful to persist;
4. **derived AI summaries** — convenience caches that are invalidated by source changes and never treated as source truth.

A new model release must be able to operate on existing canonical data without depending on model-specific hidden state.

---

## 23. AI observability and audit

Every request should generate an AI trace containing at minimum:

- trace ID;
- timestamp;
- actor/wedding scope identifiers or safe hashes where appropriate;
- skill ID/version;
- outcome/action class;
- model release ID;
- provider/model actually used for internal diagnostics;
- prompt release ID;
- data profile;
- context domains requested/used;
- tool calls and result status;
- proposed/executed action IDs;
- user confirmation where required;
- latency;
- token/credit/cost metadata where available;
- fallback/error classification.

Do not store secrets or unnecessary raw sensitive prompt content merely for telemetry.

AI product analytics should answer questions such as:

- which skills reduce form abandonment;
- whether AI-assisted enquiries are more complete;
- which suggested actions users accept/reject;
- where AI creates confusion;
- model/provider reliability and latency;
- visual-generation usage/cost;
- whether model upgrades improve representative evals.

---

## 24. Evaluation strategy

Every registered skill needs golden/evaluable scenarios.

Shared global tests must include:

- cross-wedding isolation;
- public/private data separation;
- prompt injection inside application data/documents/messages;
- unknown fact refusal/qualification;
- no invented price;
- no invented availability;
- no payment inference;
- no contribution/funding inference;
- no contract acceptance;
- no silent send/write;
- deterministic tool result preserved over model suggestion;
- structured-output validity;
- model fallback behavior;
- mobile/readability presentation contracts;
- generated-media provenance.

A model release is not production-ready merely because one chat prompt looks better.

---

## 25. CI architecture rules

Add an AI architecture contract that fails CI when the codebase fragments again.

Required checks:

- provider SDK/base URL/model IDs may exist only inside approved `src/lib/ai/**` provider/model-policy modules;
- feature routes/components cannot read `*_MODEL`, provider API key or provider-selection environment variables;
- feature code cannot force `provider` except diagnostics/tests;
- every AI skill is registered;
- every skill has permission/data-profile/action-boundary metadata;
- every skill has an output schema/evaluation contract;
- all AI writes go through a registered governed action path;
- direct contract/payment/contribution truth mutation by AI is prohibited;
- visual generation must emit provenance;
- global model release switch is exercised against representative skills in CI.

---

## 26. Migration from today's fragmented state

### Phase 0 — Inventory and freeze

After PR #185 merges:

- inventory every `/api/ai/**`, AI helper, prompt, provider call, model string, AI environment variable, AI UI surface and action path;
- classify each as Core-compliant, legacy-but-governed, bypass, duplicate or obsolete;
- freeze new direct provider/model integrations;
- create a migration matrix with owner, skill, context domains, action boundary and test coverage.

No claim of 100% unification is permitted until this audit is complete.

### Phase 1 — Global AI Core / model release

- introduce `WewedAiModelRelease`;
- wrap the existing provider router behind a higher-level orchestrator;
- introduce shared trace IDs and request/outcome contracts;
- centralise Wewed constitution/presentation rules;
- add architecture CI preventing new bypasses.

### Phase 2 — Skill registry and context envelope

- register existing Guest Concierge, Planner Copilot, Template Intelligence and Communication Assistant;
- register Wedding Architect, Booking Assistant and AutoBook boundary;
- add context-domain loaders and permission contracts;
- move feature-specific prompt composition into registered skills.

### Phase 3 — Vendor/Marketplace visible AI UX

Using the merged PR #185 UI baseline:

- contextual Marketplace Concierge;
- natural-language intelligent enquiry;
- Booking Assistant in Choose/Logistics/Review;
- Vendor Copilot enquiry analysis and draft response;
- Wewed AI Concept visual simulation via Visual AI Gateway;
- AI interaction analytics and UX UAT.

This phase must improve clicks/comprehension while preserving progressive disclosure; it must not create another permanent AI panel.

### Phase 4 — Planner and Couple unified experience

- contextual AI entry points throughout planner/couple workflow;
- one cross-domain attention/next-action system;
- Wedding Architect integrated with bookings/tasks/budget/communications rather than standing apart;
- simulations use deterministic services and canonical facts.

### Phase 5 — Budget, Contributions, Contracts and Communications

- register domain-specific skills/tools;
- migrate existing AI drafts/summaries through the Core;
- add strict financial/consent/evidence tests;
- connect communication summarisation/action extraction to canonical conversations.

### Phase 6 — Guest and public experience consolidation

- move Guest Concierge to the same model release and trace infrastructure while preserving public-only context;
- verify public AI latency/cost and abuse controls.

### Phase 7 — Higgsfield production visual gateway

- establish Wewed production integration/accounting;
- implement quotas/cost controls/moderation/storage;
- implement visual prompt/design profile registry;
- surface AI concepts globally where they materially improve UX;
- keep vendor evidence distinct.

### Phase 8 — Admin/analytics intelligence

- central Admin Support AI;
- AI reliability/product dashboards;
- skill/model outcome analytics;
- incident/recovery controls.

### Phase 9 — Controlled automation / AutoBook maturity

- expand only within explicit user authorization policies;
- use the same Core to prepare actions but domain services to execute them;
- prove concurrency, financial limits, revocation and audit.

### Phase 10 — Global model switch qualification

Demonstrate the defining architecture test:

> Change one central language-model release mapping, run the full AI evaluation/release matrix, and prove representative Guest, Couple, Planner, Vendor, Marketplace, Communications and Admin skills all use the new release without feature code changes.

---

## 27. Proposed code organization

The exact implementation may evolve, but ownership should resemble:

```text
src/lib/ai/
  core/
    orchestrator.ts
    model-policy.ts
    context.ts
    outcomes.ts
    trace.ts
    constitution.ts
  providers/
    groq.ts
    gemini.ts
    zai.ts
    higgsfield.ts          # visual gateway when production integration is available
  skills/
    registry.ts
    wedding-architect.ts
    couple-coach.ts
    planner-copilot.ts
    marketplace-concierge.ts
    booking-assistant.ts
    vendor-copilot.ts
    budget-analyst.ts
    contributions-assistant.ts
    contract-explainer.ts
    communications-copilot.ts
    guest-concierge.ts
    admin-support.ts
    visual-design-director.ts
  tools/
    registry.ts
    marketplace.ts
    booking.ts
    budget.ts
    contributions.ts
    contracts.ts
    communications.ts
    planner.ts
  evals/
  index.ts
```

Domain services remain in their existing canonical modules. The AI tool layer adapts them; it does not duplicate them.

---

## 28. Release/rollback principle

A model/provider/prompt release is a production dependency and must be versioned like code.

Required abilities:

- know which model release produced a trace;
- compare current vs candidate release on eval fixtures;
- switch centrally;
- roll back centrally without editing every feature;
- disable AI globally with controlled UX fallback;
- disable one skill if its domain is unsafe while leaving the rest of Wewed AI available;
- disable visual generation separately from language AI;
- preserve deterministic application workflows when AI is unavailable.

AI outage must never make core wedding records inaccessible or create false transactional state.

---

## 29. Definition of done for global AI unification

This plan is complete only when:

1. every production AI request enters through the Wewed AI Core;
2. feature code contains no unmanaged provider/model selection;
3. one central model release controls the default language model across Wewed;
4. model/profile exceptions are centrally declared and justified by capability, never by feature preference;
5. every AI capability is a registered skill with permissions, context domains, tools, action boundary, output schema and evals;
6. server-built context is wedding/user/role scoped and source-of-truth aware;
7. deterministic services remain authoritative for price, availability, money, contract consent and writes;
8. AI outcomes are structured and usable by UX beyond raw chat;
9. Vendor, Couple and Planner experiences expose contextual AI that demonstrably reduces workflow friction;
10. existing Guest/Template/Communication/Wedding Architect functionality is migrated without losing its safety controls;
11. Higgsfield/visual generation runs through a governed global visual gateway with provenance and cost controls;
12. AI traces make model/prompt/tool/action provenance observable;
13. CI blocks architecture fragmentation and unsafe AI writes;
14. a central model switch can be qualified and rolled out across representative Wewed surfaces without changing feature code;
15. Wewed remains fully usable when AI is unavailable.

---

## 30. Immediate next action from the current project state

**Do not start Phase 0 implementation inside PR #185.** The immediate task remains the Vendor/Booking UI hardening iteration.

After this document is committed:

1. return to PR #185 exact-head CI and diagnose any remaining failure;
2. produce the exact current Vercel preview;
3. complete mobile/desktop visual UAT for provider profile, service booking, Planner bookings and Vendor bookings;
4. merge PR #185 when clean;
5. branch from the merged UI baseline for Global AI Phase 0/1;
6. preserve the redesigned surfaces and add Marketplace Concierge/Intelligent Enquiry as the first visible AI Core experience.

This sequencing keeps the project focused: **we finish the interaction foundation first, then put one coherent Wewed intelligence layer through it and through the rest of the ecosystem.**
