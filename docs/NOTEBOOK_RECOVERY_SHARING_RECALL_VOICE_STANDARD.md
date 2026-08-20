# Wewed Notebook Recovery, Sharing, Recall & Voice Standard

**Stamp:** `WW-NOTEBOOK-OPS-2026-08-19-01`  
**Status:** STAMPED — AUTHORITATIVE UAT REMEDIATION STANDARD  
**Baseline:** `fe67432be3ca47989614987d1821d0ff5c3c172b`  
**Scope:** Notebook archive/trash/recovery semantics, note sharing notifications, Ask Notebook retrieval, meeting recording/transcription workflow, and the Planner/Admin Notebook UX needed to explain those behaviors.

## Operating standard

Wewed Notebook continues to follow **WNPS-1: Source → Structure → Verify → Act → Retain**.

This remediation adds four operational rules:

1. **Archive is not Trash.** Archive removes a note from the active working list but keeps it intact and immediately recoverable. Trash is a soft-delete state and is also recoverable. Normal Notebook UI has no permanent-delete action.
2. **Access and delivery are separate.** Sharing grants Wewed access first. Wewed Messages is the canonical notification channel; verified/enabled Email and WhatsApp endpoints may receive the secure notification through the existing communications delivery pipeline. External delivery carries a secure Wewed link/title, not a copied editable Notebook record.
3. **Recall searches authorized evidence, not literal questions.** Ask Notebook must rank authorized sources using meaningful query terms and must fall back safely to scoped authorized notes rather than returning a false no-source result because filler words did not match.
4. **Meeting capture means record + transcribe.** After consent, Wewed preserves the private audio recording and should automatically start transcription when a transcription provider is configured. The transcript is searchable source material, but users review names, amounts and commitments before applying operational actions.

## UAT findings

1. The Archive icon looks like a bin/tray on phone. Archiving removes a note from the active list with no explanatory confirmation, so users can reasonably believe the note was deleted.
2. Recovery exists under Notebook management, including Archived and Trash restore controls, but it is too hidden for accidental-removal recovery.
3. Specific sharing currently accepts an existing Wewed user email plus Viewer/Editor role, but the UI does not explain whether or how Wewed Messages, Email and WhatsApp notify an offline recipient.
4. `askNotebook` passes the entire natural-language question to `plainto_tsquery('simple', ...)`; common question words can make an otherwise relevant note fail retrieval. Production reproduction: the Tony budget note matches `chairs` but not `what did we decide about chairs` as a complete full-text query.
5. Recording currently saves audio first and requires a second explicit Transcribe click. The product intent is automatic transcription after recording while preserving the audio if transcription fails.

## Required implementation

### A. Archive / Trash / Recovery

- Preserve both Archive and Trash as reversible states.
- No hard-delete action is added to normal Notebook UI.
- Add clear confirmation before Archive as well as Trash.
- Confirmation text explains the destination and recovery path.
- Make Recovery directly visible from the Notebook entry surface instead of requiring users to infer it from `Files · tags · recovery`.
- Keep existing management recovery for Archived and Trash records and verify restore behavior.

### B. Sharing and offline notification

- Preserve `NotebookShare` Viewer/Editor authorization and wedding-team visibility semantics.
- Specific-user share continues to require an existing Wewed identity.
- After access is granted, attempt a canonical Wewed communication notification to the recipient. Notification failure must never roll back the access grant.
- The communication message contains the note title and a secure Wewed Notebook link, not the note body.
- The existing communications system remains the owner of delivery fan-out: IN_APP is canonical; verified/enabled Email/WhatsApp endpoints receive external delivery according to recipient settings and provider availability.
- Add explanatory UX describing access versus notification channels.
- Wedding-team visibility continues to grant access to active wedding members. The UX must state this clearly.

### C. Ask Notebook retrieval

- Authorization remains upstream of model access.
- Extract meaningful search terms from a natural-language question, ignoring common filler/question words.
- Rank authorized notes by title/content term overlap; title matches carry higher weight.
- Preserve wedding/note-type filters.
- If strict ranked recall finds no lexical hit, fall back to recent scoped authorized notes so the model can determine whether evidence is sufficient.
- Never include deleted notes.
- Archived authorized notes may remain eligible for recall.
- Keep source citations in AI answers.

### D. Voice recording and transcription

- Keep recording consent explicit.
- Change the user-facing mental model to **Record & transcribe**.
- Preserve audio privately before transcription.
- Resolve speech-to-text server-side in this order: an explicit `WEWED_TRANSCRIPTION_URL` override first; otherwise the existing server-only Groq credential and `GROQ_BASE_URL` when available.
- When a provider is resolved, automatically attempt transcription after upload. Groq fallback uses its OpenAI-compatible audio transcription endpoint and defaults to `whisper-large-v3-turbo` unless an intentional `WEWED_TRANSCRIPTION_MODEL` override is supplied.
- Automatic transcription uses the same rate-limit and fail-closed preservation behavior as manual retry.
- If provider configuration is absent or transcription fails, the recording remains recoverable and the UI keeps a manual Retry transcription path.
- No provider credential is exposed to the browser or committed to source control.
- Do not silently convert transcript statements into approved budget/payment/booking facts.
- Keep explicit user approval for AI/governed actions.

## Release gates

Before merge:

1. Focused unit/source contracts cover Archive/Trash clarity, recovery exposure, communications notification fail-soft behavior, natural-language recall ranking and auto-transcription/provider resolution.
2. Notebook security/migration/build workflow passes.
3. Full executable Planner browser release gate passes.
4. Existing Communications and Notebook regression workflows remain green.
5. Exact-head Vercel preview is READY.
6. No Notebook data cleanup, note deletion, authorization broadening, payment semantics or Contributions semantics are introduced.

## Manual UAT after release

- Restore an archived note and a trashed note from visible Recovery.
- Share a note with an existing Wewed user and verify Viewer/Editor access plus Wewed notification delivery; verify external channel behavior according to that recipient's enabled verified endpoints.
- Ask a natural-language question such as `What did we decide about chairs?` and verify the Tony budget note is cited when authorized/in scope.
- Record a short consented meeting sample and verify audio is saved and transcription begins automatically when a provider resolves; if unavailable, verify the recording remains preserved with a clear retry state.
