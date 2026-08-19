# Wewed Notebook Writing & AI UX Standard

**Stamp:** `WW-NOTEBOOK-WRITING-UX-2026-08-19-01`  
**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION STANDARD  
**Baseline:** `fb7ab3cca21e72aa821a1a7881742d54751edf41`  
**Scope:** Planner/Admin Notebook writing surface, AI discoverability, AI preview presentation, autosave/checkpoint history semantics.  
**Contributions Canon impact:** none — this work changes Notebook presentation/history behavior only and does not alter Contributions data or financial semantics.  
**Vault/Contracts Canon impact:** none — no contract, Vault, payment, evidence, dispute or acceptance semantics change.

## Operating standard — WNPS-1

Wewed Notebook follows **Source → Structure → Verify → Act → Retain**.

1. Human-authored or transcribed source material remains the factual source of truth.
2. AI may organize, rewrite, summarize, analyse and propose governed actions, but must not silently convert a proposal into a confirmed fact or operational record.
3. AI rewrites are previews until the user explicitly accepts them.
4. Governed actions are reviewed and explicitly applied by the user; AI has no arbitrary database-write authority.
5. Raw Markdown syntax is an implementation/storage format, not the normal reading experience. Rendered content must present headings, bold text, lists, quotes and links as formatted content.
6. Autosave protects the working draft continuously, but user-facing history should represent meaningful checkpoints rather than each autosave pulse.

## UAT findings driving this refinement

1. AI rewrite preview currently exposes raw Markdown tokens (`**`, `*`, `>`, `[text](url)`) instead of rendered writing.
2. AI actions are technically available but can be visually buried in the right/bottom panel, so first-time users may not discover the workflow.
3. The Notebook lacks concise in-product guidance explaining how to write source facts for safe/effective AI use.
4. Every autosave currently creates a historical version and the header exposes the internal revision (`Saved · v49`), making history noisy and confusing.

## Required implementation

### A. Rendered writing
- Add a shared safe Markdown renderer for Notebook reading/preview surfaces using the already-installed `react-markdown` package.
- AI rewrite previews render Markdown rather than exposing formatting tokens.
- Provide a clear `Write | Preview` mode in the main editor so users can inspect the formatted note without changing stored Markdown or existing AI/source contracts.
- Links open safely and visually read as links.

### B. AI discoverability and first-use guidance
- Opening the AI panel must immediately show a short explanation of the WNPS-1 workflow and the available AI operations without requiring scrolling/searching for hidden controls.
- Keep the operation controls near the top of the panel and make the panel usable on phone, tablet and desktop.
- Add concise tips: state facts explicitly; distinguish Confirmed/Approved/Proposed/Pending/TBC/Quoted/Paid/Risk; review AI previews; apply only verified suggestions.
- Preserve the existing governed action boundary.

### C. Autosave vs meaningful history
- Keep optimistic concurrency/revision increments on each autosave so conflict safety is unchanged.
- Stop creating a `NotebookNoteVersion` history row for ordinary autosave revisions.
- Add an explicit user action to create a meaningful checkpoint (`Save checkpoint`).
- AI-accepted rewrites and restores remain meaningful historical checkpoints automatically.
- Do not expose the internal database revision as a user-facing `vN` save indicator. Show `Saved` / `Saving…` / `Editing` / `Conflict` instead.
- History labels user-visible checkpoints sequentially (Checkpoint 1, 2, 3...) while retaining the underlying revision needed for restore.
- Existing historical version rows remain readable/restorable; no destructive cleanup/backfill is required.

## Safety invariants

- No note content is discarded by the history refinement.
- Autosave remains enabled and conflict-safe.
- Existing APIs remain wedding/actor scoped.
- AI source-version staleness protection remains tied to the internal note revision.
- AI accepts remain explicit.
- No cross-domain write becomes automatic.
- No schema migration is required for this refinement.

## Release/UAT gate

Before merge:
1. Static/unit contract protects rendered Markdown, AI tips/discoverability and checkpoint semantics.
2. Production build passes.
3. Notebook workflow and full Planner browser release gates remain green.
4. Exact-head Vercel preview is READY.
5. Manual UAT verifies: Markdown rendering, AI panel discoverability, tips, autosave label, explicit checkpoint creation/history, restore, and no data loss.
