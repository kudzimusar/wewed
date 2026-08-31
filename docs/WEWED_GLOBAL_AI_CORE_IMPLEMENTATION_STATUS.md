# Wewed Global AI Core — Implementation Status

**Architecture plan:** `docs/WEWED_GLOBAL_AI_CORE_ORCHESTRATION_UX_PLAN.md`  
**Plan stamp:** `WW-AI-CORE-UX-2026-08-25-01`  
**Implementation branch:** `feat/wewed-global-ai-core`  
**Baseline:** merged PR #185, merge commit `d55806aac33edd16de613b3e43185532a21e75ce`  
**Status:** implementation candidate — exact-head CI and Preview qualification required before merge

## Prerequisite closed

PR #185 established the redesigned Vendor/Booking progressive-disclosure UX and was merged before AI implementation began. This branch starts from that exact merged baseline and does not reopen the booking transaction model.

## Phase 0 — AI estate audit and bypass freeze

The existing AI estate is broader than one route. The current repository already contains AI surfaces for actions, chat, context, documents, drafts, health, live smoke, speech, summary, templates and Wedding Architect, backed by the existing `src/lib/ai` provider router.

This implementation therefore uses an incremental migration model:

1. preserve the tested Groq/Gemini/Z.ai transport layer;
2. create the Wewed AI Core above it;
3. prohibit new provider HTTP integrations outside the transport layer;
4. prohibit feature-owned model overrides;
5. move existing product AI surfaces through the Core deliberately rather than using a risky big-bang rewrite.

`src/lib/ai/core/bypass-guard.test.ts` makes the first two freeze rules executable in CI.

## Phase 1 — global AI Core and model release

Implemented:

- `src/lib/ai/core/model-release.ts`
  - one centrally versioned Wewed AI model release;
  - one default-language switch;
  - one reasoning-profile switch;
  - centrally controlled fallback policy;
  - private cross-provider fallback remains fail-closed unless explicitly enabled.
- low-level router support for a Core-owned `modelOverride`;
- feature code is not given provider/model-selection responsibility;
- `src/lib/ai/core/orchestrator.ts`
  - central execution entry point;
  - common safety constitution;
  - common structured outcome contract;
  - release/prompt/skill provenance;
  - central candidate fallback;
  - unstructured provider output is downgraded to summary-only and cannot create accepted action payloads.

Default release configuration:

- release: `wewed-ai-2026-08-a`;
- default language: Z.ai `glm-4.7-flash`;
- fallback: Groq `openai/gpt-oss-120b`;
- provider/model names are implementation details and are not returned from the public Marketplace Concierge response.

The global release can be changed centrally through the `WEWED_AI_*` model-release environment variables without editing product feature code.

## Phase 2 — skill registry, context and authority contract

Implemented initial registry for:

- Wedding Architect;
- Couple Coach;
- Planner Copilot;
- Marketplace Concierge;
- Booking Assistant;
- Vendor Copilot;
- Budget Analyst;
- Contributions Assistant;
- Contract & Terms Explainer;
- Communications Copilot;
- Guest Concierge;
- Timeline & Task Copilot;
- Admin Support AI;
- Visual Design Director.

Every skill declares roles, data profiles, allowed authority, outcomes, tools, prompt release and output budget.

The shared authority ladder is:

`Explain → Suggest → Simulate → Draft → Prepare → Execute`

No initial skill is granted general `Execute` authority. `runWewedAi(...)` rejects role, data-profile, outcome, tool and authority escalation before provider execution.

## Phase 3 — Vendor/Marketplace proving ground

Implemented the first visible Core-backed product proof:

### Marketplace Concierge API

`src/app/api/ai/marketplace/route.ts`

- public, rate-limited entry point;
- reads published ProviderProfile and published ProviderServiceOffering facts only;
- sends a minimised public fact bundle to the Core;
- supports understand, compare, structure and prepare-enquiry outcomes;
- cannot write a provider enquiry or booking;
- cannot determine price or availability independently;
- strips underlying provider/model names from the public response;
- explicitly reports deterministic boundaries for price, availability, booking, payment, Contributions and contract consent.

### Marketplace Concierge UX

`src/components/providers/provider-ai-concierge.tsx`

Contextual actions include:

- **Help me choose**;
- **Compare services**;
- **What am I missing?**;
- **Prepare an enquiry**;
- natural-language questions through **Ask Wewed**.

The UI presents structured facts, suggestions and missing information progressively instead of adding a permanent chatbot wall. It explicitly states that asking Wewed does not book or send anything.

The final **Continue to enquiry** action hands control back to the existing governed provider enquiry UI. The AI component itself does not call the enquiry or booking write endpoints.

## Deterministic boundaries preserved

The Core constitution and skill prompts prohibit generated text from becoming transactional truth for:

- price;
- availability;
- payment evidence;
- Contributions/funding;
- booking state;
- contract consent/signatures;
- communications sending;
- vendor inventory;
- generated visual provenance.

The existing booking, pricing, availability, payment, Contributions, contracts and communications subsystems remain authoritative.

## CI qualification

`AI Wedding Architect CI` now runs:

- `src/lib/ai/core/core.test.ts`;
- `src/lib/ai/core/bypass-guard.test.ts`;
- `src/lib/ai/core/marketplace-contract.test.ts`;
- the existing deterministic Wedding Architect commercial, pricing, entitlement, fit, optimisation, database and ecosystem contracts;
- migration/schema drift detection;
- production build.

The branch must not be merged based on this document alone. The exact PR head must pass the repository CI matrix and produce a READY Vercel Preview.

## Explicitly not claimed complete in this branch

The architecture is now usable, but the remaining rollout phases are intentionally not collapsed into this first merge:

- migrate every legacy AI route through `runWewedAi(...)`;
- Planner + Couple unified context rollout;
- Budget + Contributions + Contracts + Communications skill rollout;
- Guest consolidation;
- production Visual AI/Higgsfield gateway;
- Admin AI analytics and evaluation dashboards;
- governed automation/AutoBook maturity;
- Phase 10 global model-switch qualification across representative production surfaces.

Those phases should build on this Core rather than create parallel provider stacks.
