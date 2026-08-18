# Notebook / AI Meeting Intelligence — Agent Canon Pointer

> Status: **AUTHORITATIVE POINTER — DO NOT IMPLEMENT FROM MEMORY OR A REDUCED SUMMARY**
> Canon stamp: `WW-NOTEBOOK-AI-2026-08-18-01`
> Canonical plan: `docs/WEWED_NOTEBOOK_AI_MEETING_INTELLIGENCE_CANONICAL_PLAN.md`
> Implementation state: **AWAITING PRODUCT-OWNER GO-AHEAD**

Any agent touching Notebook, note-taking, meeting notes, voice recording/transcription, note AI, decision extraction, Notebook search/recall, or Notebook-driven Planner/Admin actions must read the canonical plan above before implementation.

The plan deliberately protects these non-negotiable boundaries:

- Notebook is a first-party Wewed productivity/intelligence domain, not a generic notes clone.
- User-facing note count is effectively unlimited; binary storage may use explicit fair-use/retention controls.
- Notes are durable, versioned, searchable, linkable to canonical Wewed entities and mobile-first.
- Private/team/shared/Admin-internal visibility is enforced server-side.
- AI inherits the requester's authorization and may never leak inaccessible notes through retrieval or summaries.
- AI can rewrite, summarize, transcribe, extract decisions/actions and propose Wewed updates.
- AI may **not** silently mutate Tasks, Budget, Timeline, Vendors, Guests, Communications, Admin or other authoritative data.
- Cross-domain updates pass through typed `NotebookSuggestion` review, current permission validation, explicit user selection/approval, idempotent apply and audit/provenance.
- Communications remains canonical for messages; Notebook links/curates intelligence from it.
- Semantic recall must filter authorization before retrieval and return source-backed answers.
- All six planned layers remain committed scope: Foundation → AI Writing → Voice/Meeting → Wewed Action Intelligence → Communications Integration → Knowledge/Recall.

If implementation reality conflicts with the canonical plan or another later Wewed architecture contract, stop the conflicting change and create an explicit stamped plan revision rather than silently narrowing or weakening the product.