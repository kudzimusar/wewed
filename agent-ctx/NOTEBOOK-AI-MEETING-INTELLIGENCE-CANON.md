# Notebook / AI Meeting Intelligence — Agent Canon Pointer

> Status: **AUTHORITATIVE POINTER — DO NOT IMPLEMENT FROM MEMORY OR A REDUCED SUMMARY**
> Canon stamp: `WW-NOTEBOOK-AI-2026-08-18-01`
> Canonical plan: `docs/WEWED_NOTEBOOK_AI_MEETING_INTELLIGENCE_CANONICAL_PLAN.md`
> Implementation/UAT contract: `docs/WEWED_NOTEBOOK_IMPLEMENTATION_UAT_RELEASE.md`
> Production release closeout: `docs/WEWED_NOTEBOOK_RELEASE_CLOSEOUT_20260818.md`
> Implementation state: **PRODUCT-OWNER APPROVED 2026-08-18 — IMPLEMENTED AND PRODUCTION RELEASED VIA PR #140**

Any agent touching Notebook, note-taking, meeting notes, voice recording/transcription, note AI, decision extraction, Notebook search/recall, or Notebook-driven Planner/Admin actions must read the canonical plan, implementation/UAT contract, and production release closeout above before implementation, refinement, testing or release work.

The plan deliberately protects these non-negotiable boundaries:

- Notebook is a first-party Wewed productivity/intelligence domain, not a generic notes clone.
- User-facing note count is effectively unlimited; binary storage may use explicit fair-use/retention controls.
- Notes are durable, versioned, searchable, linkable to canonical Wewed entities and mobile-first.
- Private/team/shared/Admin-internal visibility is enforced server-side.
- AI inherits the requester's authorization and may never leak inaccessible notes through retrieval or summaries.
- AI can rewrite, summarize, transcribe, extract decisions/actions and propose Wewed updates.
- AI may **not** silently mutate Tasks, Budget, Timeline, Vendors, Guests, Communications, Admin or other authoritative data.
- Cross-domain updates pass through typed `NotebookSuggestion` review, current permission validation, explicit user selection/approval, source-version validation, transactional idempotency and audit/provenance.
- Communications remains canonical for messages; Notebook links/curates intelligence from it.
- Recall must filter authorization before retrieval and return source-backed answers.
- All six planned layers remain committed scope: Foundation → AI Writing → Voice/Meeting → Wewed Action Intelligence → Communications Integration → Knowledge/Recall.
- AI/transcription may fail independently without preventing durable Notebook CRUD or deleting recordings.

Release identity:

- qualified feature head: `845b15792888e24d241f309259cede6e56461adf`;
- merged PR: `#140`;
- merge commit: `d50257718fb576bc786fd4263d233ba9dc0832de`;
- exact-head qualification: **19/19 registered workflows successful**, including Notebook security/migration/build and executable Planner browser gates;
- production database: private `wewed_notebook` schema applied and verified with no `PUBLIC`/`anon`/`authenticated` grants;
- production API auth smoke: unauthenticated `/api/notebook` returns `401`;
- the later `main` commit after the Notebook merge changed documentation only and is a direct descendant of the release merge.

If implementation reality conflicts with the canonical plan or another later Wewed architecture contract, stop the conflicting change and create an explicit stamped plan revision rather than silently narrowing or weakening the product.