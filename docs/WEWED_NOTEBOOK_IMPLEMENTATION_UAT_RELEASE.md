# Wewed Notebook — Implementation, UAT & Release Contract

## Document stamp

- **Parent canon:** `WW-NOTEBOOK-AI-2026-08-18-01`
- **Status:** IMPLEMENTED ON FEATURE BRANCH — QUALIFICATION IN PROGRESS
- **Implementation approval:** Product owner explicitly approved implementation on 2026-08-18.
- **Branch:** `feat/notebook-ai-meeting-intelligence-20260818`
- **Pull request:** `#140`
- **Primary surfaces:** `/planner/notebook`, `/admin/notebook`
- **Management surfaces:** `/planner/notebook/manage`, `/admin/notebook/manage`

This document is the executable handoff companion to `WEWED_NOTEBOOK_AI_MEETING_INTELLIGENCE_CANONICAL_PLAN.md`. It records the implementation footprint, operational configuration, release gates and UAT matrix. It does not narrow the parent canon.

---

# 1. Implemented product boundary

The implementation follows the canonical workflow:

```text
capture
  -> durable Notebook note
  -> AI understanding / transcription / recall
  -> typed suggestion or preview
  -> explicit human review
  -> current permission validation
  -> canonical Wewed service/data write
  -> audit + provenance
```

There is no generic AI-to-database mutation endpoint.

Implemented capability groups:

1. **Notebook foundation**
   - effectively unlimited note/page count;
   - personal, wedding and Admin contexts;
   - create/edit/autosave;
   - optimistic version-conflict detection;
   - immutable note versions and restore;
   - search;
   - pin/archive/trash/restore;
   - note types: General, Meeting, Voice, Quick;
   - visibility: Private, Wedding Team, Selected Users, Admin Internal, Shared;
   - explicit viewer/editor sharing;
   - first-class tags;
   - entity links to canonical Wewed records;
   - mobile-oriented Quick Note entry from Planner and Admin.

2. **AI writing and meeting intelligence**
   - improve writing;
   - grammar;
   - shorten/expand/professional rewrite;
   - checklist conversion;
   - meeting structuring;
   - summary and structured meeting analysis;
   - decision/action/question/risk/entity extraction;
   - title/tag/entity suggestions;
   - governed Wewed action suggestions;
   - source-backed Notebook recall/Q&A.

3. **Voice and meeting capture**
   - explicit recording-consent acknowledgement in UI;
   - browser MediaRecorder capture;
   - private object storage;
   - recording remains durable if transcription fails or is unavailable;
   - provider-neutral OpenAI-compatible transcription adapter;
   - retry;
   - signed playback URL;
   - transcript correction/revision;
   - append corrected transcript to note;
   - meeting analysis may then operate on the user-reviewed note/transcript.

4. **Governed operational actions**
   - create Planner task;
   - create Budget item when an explicit amount exists in the source;
   - create Timeline event when an explicit valid time exists in the source;
   - generate communication draft for review;
   - Vendor/Guest/Admin changes remain review-only unless represented through a safe supported action.

5. **Communications integration**
   - save an authorized canonical Wewed conversation as a Notebook note;
   - optional summary after capture;
   - link the note back to the canonical conversation;
   - reviewed communication text can be sent through the canonical Communications service;
   - Notebook never becomes the message system of record.

6. **Knowledge and recall**
   - server-authorized note retrieval happens before note bodies reach the AI provider;
   - full-text source retrieval is used in the first release;
   - returned answers include source note references;
   - semantic/vector retrieval may replace or augment ranking later only behind the same pre-retrieval authorization boundary.

---

# 2. Persistence architecture

Notebook data is deliberately outside the ordinary public Prisma model surface in a private PostgreSQL schema:

`wewed_notebook`

Primary objects:

- `NotebookNote`
- `NotebookNoteVersion`
- `NotebookShare`
- `NotebookEntityLink`
- `NotebookAttachment`
- `NotebookRecording`
- `NotebookTranscript`
- `NotebookAiDerivation`
- `NotebookSuggestion`
- `NotebookActionReceipt`
- `NotebookAuditEvent`

Migrations:

- `20260818113500_notebook_ai_meeting_intelligence`
- `20260818121000_notebook_tags_and_metadata`

The migration revokes schema/table access from `PUBLIC`, and from `anon`/`authenticated` when those roles exist. Application access is server-side only.

Large binary media is not stored in relational rows.

Object-storage buckets are created privately on demand through the Supabase service role:

- `wewed-notebook` — voice/audio recordings;
- `wewed-notebook-files` — note attachments.

Downloads/playback use short-lived signed URLs.

---

# 3. Authorization contract

Authorization is resolved from the signed Wewed application session plus current canonical wedding/platform access.

Rules:

- `PRIVATE`: owner only unless explicitly shared;
- `SELECTED_USERS`: explicit `NotebookShare` membership controls view/edit;
- `WEDDING_TEAM` / `SHARED`: current wedding membership is required to read; current Planner edit authority is required to edit;
- `ADMIN_INTERNAL`: readable by a resolved Wewed platform administrator, but Admin status alone does not grant edit authority to another user's note;
- platform Admin status never grants ordinary access to somebody else's `PRIVATE` note;
- an AI query receives only sources already authorized for the requester;
- a share revocation removes future access;
- action application re-checks current permission at apply time.

Executable tests live in:

`src/lib/notebook/policy.test.ts`

---

# 4. Autosave, versions and conflict recovery

The editor uses debounced autosave with `expectedVersion`.

Server save semantics:

1. load an authorized note;
2. require edit authority;
3. update only when `version = expectedVersion`;
4. increment version atomically;
5. create immutable `NotebookNoteVersion` snapshot;
6. mark older AI derivations/suggestions stale;
7. return the new version.

If another browser/session wins the write race, the API returns HTTP `409` with `NOTE_VERSION_CONFLICT`. The client preserves the unsaved local draft instead of overwriting it silently.

Restoring a historic note does not delete newer history. Restore creates a new version whose source is `RESTORE`.

---

# 5. AI governance

Notebook uses the existing Wewed AI router rather than a second provider client.

Private Notebook content uses `profile: private`.

Operational boundaries:

- AI cannot invent a price, approval, booking state, payment state, RSVP state, identity or date and save it as fact;
- rewrite output is preview-only until accepted;
- AI acceptance creates a versioned note update;
- structured action suggestions store source version, rationale/evidence, confidence and typed payload;
- editing the source note makes pending/approved suggestions stale;
- actions are not applied merely because AI generated them.

Distributed rate limits use the existing `AiRateLimitBucket` service:

- Notebook writing/analysis: 30 requests / 10 minutes / user;
- Notebook recall: 30 requests / 10 minutes / user;
- transcription: 10 jobs / hour / user.

---

# 6. Action safety and idempotency

Action application locks both the source note and suggestion inside the database transaction.

The transaction:

1. checks source version;
2. checks suggestion lifecycle;
3. checks existing action receipt;
4. re-checks current wedding permission;
5. validates source evidence again;
6. writes the canonical Planner record;
7. writes `NotebookActionReceipt`;
8. marks suggestion `APPLIED`.

The canonical record and idempotency receipt commit together. Concurrent double-clicks/retries cannot intentionally create a second Task, Budget item or Timeline event from the same suggestion.

Batch apply is deliberately partial: one failed suggestion does not roll back unrelated accepted suggestions. Each result is reported independently.

---

# 7. Voice/transcription operations

Recording works independently of transcription configuration.

Optional server configuration:

```text
WEWED_TRANSCRIPTION_URL=
WEWED_TRANSCRIPTION_API_KEY=
WEWED_TRANSCRIPTION_MODEL=whisper-1
```

The endpoint must accept an OpenAI-compatible multipart transcription request and return JSON with a `text` field. Provider-specific code is not embedded in Notebook UI/domain logic.

If not configured:

- recording remains saved;
- recording status becomes a retryable failure state;
- user receives a clear configuration-safe message;
- no note content is lost.

Consent/legal policy is a product/operational responsibility. The UI requires an acknowledgement that required participant notice/consent has been obtained before recording begins. Wewed must not market that checkbox as a substitute for applicable law or organizational policy.

---

# 8. Attachment operations

Allowed first-release file types:

- JPEG / PNG / WebP / GIF;
- PDF;
- plain text / Markdown / CSV;
- DOCX;
- XLSX.

Limits:

- attachment: 25 MB each;
- recording: 100 MB each;
- note body: 2,000,000 characters per note;
- user-visible page/note count: not artificially capped by product UI/API.

These are per-object safety limits, not a small notebook-page quota.

---

# 9. Entry points

Planner:

- `/planner/notebook`
- `/planner/notebook/manage`
- persistent `Open Notebook` control in Planner layout;
- persistent `Quick Note` capture outside Notebook pages.

Admin:

- `/admin/notebook`
- `/admin/notebook/manage`
- first-class Notebook entry in Admin desktop navigation/mobile More sheet;
- persistent `Open Notebook` control;
- persistent `Quick Note` capture.

Quick Note is private by default. Planner Quick Note can attach the active editable wedding context without making the note team-visible automatically.

---

# 10. Release qualification gates

The feature cannot be declared production-qualified until all of the following are true for the exact release head:

1. Prisma schema validates and client generates.
2. Every migration applies to a clean PostgreSQL database.
3. Migration status is clean and broad database integrity CI passes.
4. `wewed_notebook` exists and is not granted to `PUBLIC`, `anon` or `authenticated` roles.
5. Notebook authorization policy tests pass.
6. Full Next.js production build passes.
7. Existing global CI passes.
8. Existing Planner, Admin, Communications, AI, provider/security and production-hardening suites remain green.
9. PR mergeability is clean against the current `main` head.
10. Production database migrations are applied through the controlled migration process before/with application rollout.
11. Production deployment becomes READY.
12. Post-deployment auth smoke confirms unauthorized users cannot open Notebook APIs.

The dedicated GitHub Actions gate is:

`.github/workflows/notebook-ai-meeting-intelligence-ci.yml`

---

# 11. Functional UAT matrix

## A. Foundation

- Create 1 private personal note; refresh; content persists.
- Create multiple notes rapidly; no note replaces another.
- Create wedding-scoped private note; it remains private.
- Create Wedding Team note; another authorized wedding editor can read/edit it.
- User outside wedding cannot enumerate/read the note by ID.
- Platform Admin cannot read another user's Private note merely because they are Admin.
- Explicit Viewer share reads but cannot edit.
- Explicit Editor share can edit.
- Revoke share; recipient loses future access.
- Rename/edit body and observe truthful Saving → Saved state.
- Concurrent browser edit produces conflict instead of last-write-wins overwrite.
- Pin/unpin persists.
- Archive removes from default working list and can be restored.
- Trash is recoverable.
- Version restore creates a newer version and keeps old history.
- Search returns title/body matches without leaking unauthorized records.
- Tags can be added/changed and persist.
- Entity links persist without copying target records.

## B. Quick Note and mobile

- Create Quick Note from Planner worksheet without navigating away.
- Active wedding can be selected as context.
- Quick Note remains Private by default.
- Create Quick Note from Admin.
- Phone viewport can create, open, edit and save without horizontal-control loss.
- Editor remains usable with virtual keyboard visible.

## C. AI writing

- Improve/grammar/shorten/professional/checklist creates preview only.
- Cancel leaves note unchanged.
- Accept creates a new version.
- AI outage leaves Notebook CRUD working.
- Private-profile provider rule is used.
- Rate limit returns 429 without changing note.

## D. Meeting intelligence

Use a controlled note containing explicit facts such as:

`Florist needs access at 06:00. Couple approved USD 300 additional flowers. Sarah will send centrepiece designs Friday.`

Verify:

- summary is grounded;
- decisions distinguish confirmed/pending;
- action items contain source evidence;
- suggested budget amount is exactly source-backed;
- suggested timeline time is exactly source-backed;
- no booking/payment/RSVP state is invented;
- suggestions are not applied before selection/approval.

## E. Governed actions

- Apply selected Task suggestion; exactly one PlannerTask appears.
- Retry/double-click same suggestion; no second task appears.
- Apply Budget suggestion; amount/category shown and one BudgetItem appears.
- Apply Timeline suggestion; explicit time is revalidated and one event appears.
- Remove Planner permission between generation and apply; apply fails closed.
- Edit source note after suggestions; old suggestions become stale.
- One item in batch fails; successful independent items remain successful and results show both states.

## F. Voice

- Consent checkbox is required before browser recording action.
- Start/pause/resume/stop works in supported browser.
- Recording upload persists privately.
- Signed playback works only through authorized API.
- Missing transcription config leaves recording preserved.
- Configure provider; transcription produces text.
- Correct transcript and save revision.
- Append transcript to note.
- Run meeting analysis only after transcript is visible/reviewable.
- Transcription rate limit does not delete audio.

## G. Attachments

- Upload allowed image/PDF/text/DOCX/XLSX.
- Attempt disallowed executable/binary type; upload rejected.
- Over-25-MB file rejected.
- Authorized signed download succeeds.
- Unrelated user cannot obtain a signed URL by guessing attachment ID.
- Delete removes storage object and hides attachment row from normal list.

## H. Communications

- Authorized participant saves conversation to Notebook.
- Note contains conversation snapshot and canonical conversation link.
- Unauthorized conversation ID cannot be captured.
- Optional summary obeys Notebook private AI rules.
- Reviewed Notebook communication draft can be sent through Communications service only after explicit send action.
- Sending does not make Notebook the canonical message owner.

## I. Recall and privacy adversarial tests

- Ask question answered by one authorized note; source link returned.
- Ask question with no supporting source; AI says evidence is insufficient.
- User A has a Private note with a unique secret marker.
- User B asks Notebook directly for that marker; it must not appear.
- Platform Admin asks recall for another user's Private marker; it must not appear merely due to Admin role.
- Shared-note revocation immediately excludes the note from later recall.
- Wedding membership removal excludes wedding-team note from later recall.

---

# 12. Rollback / failure containment

Notebook is additive.

If rollout must be contained:

- hide/remove Notebook navigation and Quick Note entry;
- leave private schema and stored data intact;
- disable AI provider routing/transcription independently;
- do not drop Notebook tables as an emergency rollback because that destroys user notes;
- do not remove private buckets unless a deliberate retention/deletion project authorizes it;
- canonical Planner/Communications domains remain independently operable because Notebook does not replace them.

If AI fails, CRUD still works. If transcription fails, audio remains. If an action fails, the note remains. This is a required failure-isolation property.

---

# 13. Deferred refinements that do not invalidate completion

The parent canon permits refinement after the first complete governed implementation. The following are legitimate later improvements, not release blockers for the implemented contract:

- vector/embedding semantic ranking behind authorization-first retrieval;
- richer collaborative editor/cursors;
- additional attachment types after malware/scanning policy work;
- diarization provider enhancements and user-confirmed speaker naming;
- direct Meeting calendar integration;
- more typed canonical target actions after each target domain defines a safe mutation contract;
- retention/storage-plan UI and enterprise export tooling.

They must not be used to remove or weaken the existing privacy/review/idempotency boundaries.
