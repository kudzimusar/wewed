# Wewed Notebook, AI Meeting Intelligence & Action Layer — Canonical Implementation Plan

## Document stamp

- **Stamp ID:** `WW-NOTEBOOK-AI-2026-08-18-01`
- **Status:** **STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN; IMPLEMENTATION AWAITS PRODUCT-OWNER GO-AHEAD**
- **Issued:** 2026-08-18
- **Repository baseline:** `main` at `ac8cba3aabd310ef9afc507d5d61b3d254008bec`
- **Primary product surfaces:** Planner Workspace and Wewed Admin
- **Future-compatible surfaces:** Couple, Vendor/Provider, internal staff and governed shared-workspace contexts
- **Change authority:** This document is the implementation contract and regression-control reference for the Wewed Notebook domain. Implementation commits, schema migrations, AI actions, agent hand-offs, UAT plans and release closeout must reference this stamp or a later explicitly stamped revision.
- **Implementation lock:** No product/schema/API implementation is authorized by this document alone. Product-owner approval is required before implementation starts.

This plan canonizes the complete product direction agreed during product brainstorming. The work may be delivered in phases, but later phases in this document are **committed product scope**, not disposable ideas. An implementation agent must not silently omit, reinterpret or replace them because a smaller notes feature is easier to build.

---

# 1. Executive product decision

Wewed will build a first-party **Notebook** that begins as a fast, durable note-taking system and matures into a permission-aware wedding and operations intelligence layer.

The Notebook is **not** a clone of Google Keep, Notion, Google Docs, Otter, Fireflies or a generic AI chat page. Those products may inspire interaction patterns, but Wewed's differentiator is that a note can understand and safely connect to canonical Wewed records.

The product promise is:

> **Capture what happened. Preserve what matters. Understand it with AI. Connect it to the correct Wewed context. Let the user approve the actions that move the wedding or operation forward.**

The canonical workflow is:

```text
Text / quick note / meeting / voice / communication
                    ↓
              Wewed Notebook
                    ↓
             AI understanding
                    ↓
      summaries / decisions / actions /
      questions / risks / commitments
                    ↓
            USER REVIEW GATE
                    ↓
 Tasks / Budget / Timeline / Vendors / Guests /
 Communications / Admin work / linked records
```

AI can interpret, draft, classify, extract and propose. **AI does not silently mutate authoritative Planner, Admin, communications, financial, booking, guest or permission data.**

---

# 2. Product goals

The Notebook must make Wewed materially more useful before, during and after a wedding or operational meeting.

A user should be able to:

1. create an effectively unlimited number of durable notes/pages;
2. find a note later without remembering where it was filed;
3. associate notes with the correct wedding, account, vendor, person or Wewed record;
4. keep personal/private notes separate from team/shared/internal notes;
5. capture meeting notes by typing, checklist entry, attachments or voice recording;
6. receive a transcript and structured AI meeting output from an approved recording;
7. use AI to rewrite, summarize, expand, shorten, structure and clean notes;
8. have AI identify decisions, commitments, action items, unresolved questions, risks and relevant entities;
9. see exactly where extracted information could be useful elsewhere in Wewed;
10. review and selectively approve proposed Wewed changes;
11. preserve source provenance so a task, decision or update can be traced back to the note/meeting/conversation that produced it;
12. search accumulated knowledge using both ordinary search and, later, permission-safe semantic recall;
13. use the feature comfortably on desktop, tablet and mobile, including fast capture during venue visits and live meetings;
14. trust that AI, Admin privileges and analytics cannot leak content beyond the note's actual authorization boundary.

---

# 3. Non-goals and anti-goals

The Notebook must not become an uncontrolled parallel productivity suite.

The first implementation programme must **not** attempt to recreate:

- Notion-style arbitrary databases;
- a spreadsheet engine inside notes;
- a full collaborative office suite;
- Google Docs-level publishing/layout controls;
- Zoom/Google Meet as a conferencing product;
- a generic cloud drive;
- an ungoverned AI agent that writes directly to Wewed records;
- a second task, budget, vendor, guest, booking, communication or CRM database;
- a second source of truth for wedding/account identity;
- a surveillance system for administrators.

Richness is welcome only when it advances the core Wewed flow:

> **Capture → Understand → Connect → Review → Act → Recall**

---

# 4. Canonical ownership rule

The Notebook may reference or derive intelligence from Wewed entities, but it must not clone their authoritative state.

Canonical ownership remains:

- wedding identity, membership and lifecycle → existing wedding/planner domain;
- task state → Planner task records;
- budget and financial values → Planner budget / governed financial records;
- vendor/provider identity and marketplace data → canonical provider/business records;
- wedding-vendor relationships → canonical relationship records;
- guest/RSVP/seating state → canonical guest and seating records;
- timeline state → canonical Planner timeline records;
- private communication → `Communication*` domain;
- support/admin operational state → canonical Admin domains;
- permissions and Admin scope → existing RBAC/platform-administration contracts;
- AI provider configuration and governed AI execution → existing AI provider/governance architecture;
- Notebook source content, versions, attachments, recordings, transcripts and Notebook-specific derivations → Notebook domain.

A Notebook link to a task stores the task identifier and relationship metadata. It does not copy the task into Notebook as a shadow task.

A meeting summary may say that an additional USD 300 was approved for flowers, but the actual wedding budget does not change until a permitted user explicitly approves a governed budget action.

---

# 5. Product surfaces and navigation

## 5.1 Planner Workspace

Notebook becomes a first-class Planner capability alongside the existing wedding workflow.

It must support two navigation levels:

### Portfolio-level Notebook

For a professional planner managing multiple weddings:

- All notes;
- Recent;
- Pinned;
- Meetings;
- Voice notes;
- Shared with me;
- Personal;
- filter/search by wedding;
- fast switch into a wedding context.

### Wedding-scoped Notebook

When a wedding is selected, Notebook defaults to that wedding and shows only authorized notes relevant to that context unless the user deliberately broadens the scope.

Typical note types:

- Couple consultation;
- Venue walkthrough;
- Vendor meeting;
- Wedding-week briefing;
- Internal planning note;
- Decision log;
- Voice note;
- Freeform working note.

The user should not need to repeatedly choose the same wedding while already working inside it.

## 5.2 Wewed Admin

Admin Notebook must support:

- Personal/private notes;
- Account notes;
- Planner notes;
- Couple/client notes;
- Vendor/provider notes;
- Support/operations notes;
- Internal meeting notes;
- Management notes where authorization permits;
- links to canonical Admin records.

Admin Notebook content must obey account scope and Admin permissions. Platform authority must **not** imply unrestricted browsing of every user's private Notebook.

## 5.3 Quick Note — global productivity primitive

A low-friction **Quick Note** action must be available from relevant authenticated surfaces.

Expected behavior:

1. opens without navigating away from the current task;
2. pre-populates current context when safe and unambiguous;
3. lets the user change context before saving;
4. records source/context provenance;
5. supports text first, then optional checklist/voice/attachment actions;
6. saves quickly and visibly;
7. never assigns a wedding/vendor/account by guessing when context is ambiguous.

Examples:

- From a vendor record: pre-link that vendor and current wedding if both are known.
- From a Planner task: offer that task as a linked record.
- From Admin account view: pre-link the account within the Admin's current authorized scope.

## 5.4 Mobile-first meeting capture

Notebook must be fully usable on a phone. Venue visits, supplier meetings and couple consultations often occur away from a desk.

Mobile requirements include:

- large tap targets;
- fast note creation;
- stable autosave feedback;
- keyboard-safe editor layout;
- sticky access to recording state while recording;
- background/interruption-safe draft handling where platform/browser constraints permit;
- no desktop-only critical action;
- accessible non-drag/non-hover controls.

---

# 6. Core Notebook experience

## 6.1 Note anatomy

A note must support at least:

- title;
- rich-text body;
- headings;
- paragraphs;
- bulleted lists;
- numbered lists;
- checklists;
- links;
- basic emphasis;
- attachments/images through governed storage;
- tags;
- pin/unpin;
- archive/unarchive;
- created/updated timestamp;
- author/owner;
- note scope/visibility;
- wedding/account context when applicable;
- linked Wewed records;
- note type;
- version history;
- AI/transcription state when applicable.

Tables may be added later only if a concrete Notebook use case justifies them. Tables must not become a hidden replacement for structured Wewed worksheets.

## 6.2 Effectively unlimited pages

The user-facing product must not impose an ordinary page-count ceiling.

Contract:

- text note count is effectively unlimited in normal product use;
- pagination/infinite loading is an implementation detail, not a user quota;
- binary storage such as audio, images and files may have fair-use, plan, retention or abuse-protection limits;
- any storage limit must be transparent and must not cause silent note loss;
- archival does not destroy content;
- deletions must follow an explicit lifecycle/recovery policy.

## 6.3 Note organization

Notebook must provide:

- All notes;
- Recent;
- Pinned;
- Archived;
- Meetings;
- Voice notes;
- Shared with me where applicable;
- Personal/private;
- wedding/account filters;
- tag filters;
- author/participant filters where authorized;
- ordinary text search.

Folder support is optional. The architecture must not require folders for discoverability because links, context, tags and search should carry most of the organizational load.

## 6.4 Autosave and save truth

Notebook is a persistence-critical product. The editor must not imply a save that has not reached durable storage.

Required states:

- Saving…
- Saved
- Offline/local draft where supported;
- Save failed / Retry;
- conflict/recovery state when optimistic version checks fail.

Implementation must use a durable server save contract with optimistic concurrency/versioning. Debounced autosave is preferred for editing, with explicit flush on navigation/unload where practical.

A failed server save must not be shown as Saved merely because local React state changed.

## 6.5 Version history

Every material content revision must be recoverable according to a reasonable retention policy.

Version history exists because:

- AI rewriting can change substantial text;
- users can accidentally remove meeting details;
- shared editing can create conflicts;
- compliance/support investigations may require provenance.

Users must be able to inspect and restore an earlier permitted version. Restoring creates a new version; it should not erase history.

---

# 7. Notebook scope, visibility and authorization

Privacy is a foundational domain requirement, not a later hardening task.

## 7.1 Initial visibility classes

The implementation should support clear user-facing visibility semantics mapped to server policy, including at minimum:

- **PRIVATE** — owner only;
- **WEDDING_TEAM** — authorized members of the linked wedding/project subject to role policy;
- **SELECTED_USERS** — explicit permitted users;
- **ADMIN_INTERNAL** — explicitly authorized Wewed staff within the relevant Admin scope;
- **SHARED** — explicitly shared participants under a defined sharing contract.

These names may be refined in schema, but the semantic boundaries must remain.

## 7.2 Authorization rules

1. Authorization is enforced server-side on every read, search, link, AI, transcript, attachment and mutation path.
2. A UI-hidden note is not considered secured unless server access is denied.
3. Admin account-scope restrictions apply before Notebook content is returned.
4. A Planner sees wedding-team notes only for weddings where the existing membership model authorizes that access.
5. A user cannot expose another user's private note by linking it to a broadly visible record.
6. A share cannot silently escalate the recipient's authority over the linked wedding/account/entity.
7. Removing wedding/account membership must immediately affect Notebook access according to the canonical membership policy.
8. Deleted/revoked users must not retain Notebook access through stale share/session state.

## 7.3 AI authorization inheritance

AI must operate on **exactly the content the requesting user is authorized to read for that operation**.

Therefore:

- semantic retrieval filters authorization before content is supplied to the model;
- private notes cannot be leaked through a summary of broader notes;
- AI cannot use Admin-only notes to answer a Planner question;
- selected-user shares do not make the note available to unrelated collaborators;
- embeddings/indexes, if used, must preserve tenant/scope identifiers and be filtered before retrieval;
- AI logs/telemetry must not create a new unrestricted copy of sensitive note content.

## 7.4 Admin privacy boundary

Wewed staff need operational controls, not blanket surveillance.

Default contract:

- Super Admin/global platform authority does not create a normal UI for browsing all private user notes;
- support/recovery tooling should expose metadata first and content only under an explicit, audited and policy-authorized pathway if the business later approves such a pathway;
- ordinary analytics operate on structured events and counts, not private note bodies.

---

# 8. Canonical data model

The exact Prisma/schema names may be adjusted to fit repository conventions, but the domain separation below is required.

## 8.1 `NotebookNote`

Canonical note container.

Conceptual fields:

- `id`;
- `ownerUserId`;
- `createdByUserId`;
- `updatedByUserId`;
- `title`;
- `noteType`;
- `visibility`;
- optional `weddingId`;
- optional `businessAccountId` where appropriate;
- current content representation/version pointer;
- `pinnedAt`;
- `archivedAt`;
- soft-delete lifecycle fields if adopted;
- `createdAt` / `updatedAt`;
- optimistic `version`.

Do not store authorization solely inside arbitrary content JSON.

## 8.2 `NotebookNoteVersion`

Immutable or append-oriented version record containing:

- note id;
- revision number/version;
- content payload;
- title snapshot where needed;
- actor;
- origin (`USER`, `AI_REWRITE`, `TRANSCRIPT_IMPORT`, `RESTORE`, etc.);
- timestamp;
- optional diff/change summary.

## 8.3 `NotebookShare` / explicit access grants

Stores explicit selected-user/shared access separately from content.

Must support:

- grantee;
- access level;
- granted by;
- created time;
- revoked time;
- optional expiry if later required.

## 8.4 `NotebookTag` / tag relationships

Tags support user organization without becoming an authorization mechanism.

## 8.5 `NotebookEntityLink`

Generic link from a note to a canonical Wewed entity.

Conceptual fields:

- `noteId`;
- `entityType`;
- `entityId`;
- relationship/link type;
- source (`USER`, `CONTEXT`, `AI_SUGGESTED`, `ACTION_RESULT`);
- created by/time.

Supported entity types should evolve through a controlled registry, initially including where relevant:

- wedding;
- task;
- budget item;
- vendor/provider/business account;
- guest;
- timeline item;
- seating table/assignment where useful;
- communication conversation/message reference;
- support case;
- application user/platform administrator where policy permits;
- booking/quote/payment records when those integrations are approved.

The entity link service must validate both the entity and the user's authority to link/read it.

## 8.6 `NotebookAttachment`

Metadata for governed binary storage.

Store files/audio/images in object storage, not as base64 blobs in ordinary relational rows.

Metadata should include:

- storage key/path;
- mime type;
- size;
- original filename;
- uploader;
- lifecycle/scanning state where available;
- created time;
- note relationship.

Access must use authorized/signed delivery paths rather than public permanent URLs for private content.

## 8.7 `NotebookRecording`

Represents an intentional voice/meeting recording.

Fields/concepts:

- note id;
- recording state;
- start/end/duration;
- storage reference;
- mime/codec;
- uploader/recorder;
- recording consent acknowledgement metadata as product/legal policy requires;
- upload/transcription state;
- failure/retry state;
- retention/deletion state.

## 8.8 `NotebookTranscript`

Stores transcription output separately from the original recording.

Support:

- complete transcript;
- segments with timestamps;
- speaker labels when provider capability/confidence permits;
- transcription provider/model metadata;
- language where known;
- confidence/quality metadata when available;
- manual corrections/versioning;
- source recording link.

AI must never pretend uncertain speaker attribution is certain.

## 8.9 `NotebookAiDerivation`

Captures reusable AI outputs without overwriting source content.

Examples:

- summary;
- meeting minutes;
- decisions;
- action items;
- unresolved questions;
- risks;
- entities mentioned;
- suggested tags/title;
- semantic topic map.

Store model/provider/version, source version, actor/requester, timestamps and status so outputs can be invalidated/regenerated when source material changes.

## 8.10 `NotebookSuggestion`

Represents a proposed cross-Wewed action before approval.

Required concepts:

- source note/transcript/communication reference;
- suggestion type;
- target entity type/id if resolved;
- proposed payload;
- human-readable explanation;
- confidence/resolution state;
- status (`PENDING`, `APPROVED`, `REJECTED`, `APPLIED`, `FAILED`, `STALE` or equivalent);
- created by AI/rule/version;
- reviewer;
- reviewed/applied timestamps;
- resulting canonical entity/action reference after successful application.

This model is the core safety boundary between AI understanding and authoritative writes.

## 8.11 Decision records

Decisions extracted from notes should be represented in a structured Notebook derivation or dedicated decision projection that always retains source provenance.

A decision record may contain:

- statement;
- status (`CONFIRMED`, `PENDING`, `SUPERSEDED`, `REJECTED`);
- source note/transcript segment;
- participants/actors when confidently resolved;
- effective date/time if stated;
- related entity links.

A decision log is **not** a replacement for canonical budget/task/vendor/timeline state. Where a decision creates an operational update, that update still passes through `NotebookSuggestion` and user approval.

---

# 9. AI inside the Notebook

AI is embedded in the user's workflow rather than isolated behind a separate generic chatbot.

## 9.1 Inline writing assistance

Expected actions:

- Improve writing;
- Fix grammar;
- Make concise;
- Expand;
- Rewrite professionally;
- Change tone where appropriate;
- Turn into checklist;
- Turn into structured meeting notes;
- Extract action items;
- suggest title;
- suggest tags.

AI rewrite behavior:

1. operates on the selected text or current note version;
2. previews the result;
3. user explicitly accepts/replaces/inserts it;
4. accepted rewrite creates a new version;
5. source version remains recoverable.

## 9.2 Meeting intelligence

From typed notes, transcript or combined meeting content, AI should be able to produce:

- concise summary;
- detailed meeting minutes;
- confirmed decisions;
- pending decisions;
- action items;
- owners/assignees when stated;
- due dates when stated;
- unresolved questions;
- risks/blockers;
- commitments/promises;
- vendors/people/accounts/wedding entities mentioned;
- budget implications;
- timeline implications;
- guest implications;
- communication/follow-up suggestions;
- candidate Wewed actions.

## 9.3 No invented operational facts

AI must not invent:

- wedding/account/entity identity;
- user/vendor IDs;
- prices or currency conversions;
- budget approvals;
- due dates that were not stated unless clearly offered as a suggestion;
- participant consent;
- booking/payment state;
- guest/RSVP state;
- authoritative task status;
- recording speaker identity when uncertain;
- Admin permissions.

If an entity is ambiguous, the system should present a resolution choice rather than silently selecting the most likely record.

## 9.4 AI provenance

Every material AI output must be traceable to:

- requesting user;
- source note/version/recording/transcript;
- model/provider/version where available;
- time generated;
- action type;
- resulting accepted/rejected/applied state.

For extracted decisions/actions, the UI should be able to navigate back to the source note or transcript segment where practical.

---

# 10. Meeting Mode and voice capture

Voice is a first-class capture method, not merely an attachment.

## 10.1 Start Meeting flow

From Notebook, the user can start a meeting and provide/confirm:

- wedding/account context;
- meeting title;
- meeting type;
- participants/relationship category where useful;
- recording choice;
- visibility/access;
- optional agenda/template.

Typical meeting types:

- Couple consultation;
- Vendor meeting;
- Venue walkthrough;
- Planner team meeting;
- Wewed Admin operations/support meeting;
- Other.

## 10.2 Recording behavior

The UI must show an unmistakable active recording state and duration.

Rules:

- no hidden/background recording initiated without a user action;
- clear stop/pause controls where supported;
- recording permission errors are handled visibly;
- recording/upload failures retain recoverable local state where technically practical;
- a failed upload must not create a fake transcript-complete state;
- recording legal/consent language is implemented according to the governing Wewed policy for deployment jurisdictions;
- privacy/visibility is chosen before or at recording creation and remains enforced throughout processing.

## 10.3 Transcription pipeline

Canonical flow:

```text
Record locally/browser capture
    ↓
Authorized object storage upload
    ↓
Recording metadata committed
    ↓
Transcription job/provider adapter
    ↓
Transcript segments + metadata
    ↓
User can review/correct
    ↓
AI meeting derivations
    ↓
Suggested Wewed actions
```

Transcription must be provider-abstracted. The system should not couple Notebook schema or UI to one vendor/model.

The architecture should remain compatible with free-first/current Wewed AI-provider policy, while allowing provider substitution without rewriting Notebook.

## 10.4 Speaker handling

Speaker diarization is desirable where reliable and economically feasible, but not required for the foundation.

If available:

- labels begin as neutral `Speaker 1`, `Speaker 2`, etc.;
- identity assignment is user-confirmed unless an existing trusted identity signal makes it deterministic;
- low-confidence attribution must be visibly uncertain;
- changing a speaker label does not alter the original audio.

## 10.5 Post-meeting result

A completed meeting note should expose clear tabs/sections such as:

- Notes;
- Recording;
- Transcript;
- Summary;
- Decisions;
- Action items;
- Suggested Wewed updates.

The user may edit the human note independently of the original transcript. Generated outputs should state which source version they came from and become stale when material source content changes.

---

# 11. Wewed Action Intelligence — the differentiating layer

This phase turns Notebook from a useful note app into a Wewed operating tool.

The safety model is always:

```text
Source content
   ↓
AI extraction
   ↓
Candidate suggestion
   ↓
Policy + target validation
   ↓
Human review
   ↓
Apply selected actions
   ↓
Canonical Wewed service/database write
   ↓
Audit + source/result link
```

## 11.1 Planner suggestion matrix

### Tasks

AI may suggest:

- create task;
- assign/reassign if a real authorized user is resolved;
- due date when explicitly stated;
- priority/category suggestion;
- task description based on meeting context.

Applying uses the canonical Planner task service and its permission/validation rules.

### Budget

AI may identify:

- new cost;
- approved/potential variance;
- deposit/balance implication;
- category association;
- request for quotation/follow-up.

Financial writes require explicit review and canonical deterministic validation. AI never performs authoritative arithmetic where a deterministic Wewed calculation exists.

### Timeline

AI may suggest:

- add event;
- change start time;
- add access/setup window;
- add dependency/follow-up;
- attach responsible person/vendor.

Time/date ambiguity must be surfaced before apply.

### Vendors/providers

AI may suggest:

- link note to vendor;
- record follow-up task;
- create/update permitted wedding-vendor relationship data;
- mark an unresolved vendor question;
- draft a message or request for information.

It must not change canonical provider profile/commercial data from a private wedding meeting unless the provider-facing workflow explicitly permits and confirms that change.

### Guests

AI may suggest guest-related updates only when a specific guest is confidently resolved and the user has permission.

Sensitive guest state changes should be individually reviewable. The system must not bulk-alter RSVP/seating/attendance from ambiguous conversation prose.

### Seating

AI may create suggestions or notes about seating constraints, but seating-capacity rules and actual assignments remain governed by the seating engine. AI does not bypass capacity or relationship constraints.

### Communications

AI may draft/send-to-review:

- follow-up message;
- meeting summary;
- vendor request;
- couple confirmation request;
- internal team update.

The existing communications approval/send rules remain authoritative.

## 11.2 Admin suggestion matrix

Depending on Admin permission/scope, AI may suggest:

- create internal operational follow-up;
- link note to an account/vendor/planner/support context;
- draft support communication;
- summarize account meeting/history;
- create an incident/support action where a canonical service exists;
- flag a policy/compliance issue for review;
- route an unresolved issue to the appropriate Admin function.

Notebook must not invent new Admin powers. Every applied action resolves current Admin identity, role, scope and permission at apply time, not only at suggestion-generation time.

## 11.3 Review UI

The review experience must make each proposal independently selectable.

Example:

```text
4 suggested updates from this meeting

[x] Create task — Sarah: Send centrepiece designs by Friday
[x] Add timeline item — Florist venue access at 06:00
[ ] Increase Flowers budget by USD 300
[x] Link this meeting to Shandy Weddings & Events

Apply 3 selected changes
```

Requirements:

- show target wedding/account/entity;
- show the proposed before/after or creation payload in plain language;
- show source/provenance;
- distinguish confirmed facts from AI suggestions/inferences;
- let user reject/edit before apply;
- validate again on the server at apply time;
- return per-action success/failure rather than pretending an entire batch succeeded;
- record resulting canonical IDs for successful actions.

## 11.4 Idempotency and stale suggestions

Applying a suggestion twice must not duplicate a task/budget/timeline update.

Suggestions become stale when:

- source note changed materially;
- target record was deleted/revoked;
- authorization changed;
- target state changed enough that the proposed action no longer safely applies;
- wedding/account context changed;
- linked provider/guest/user can no longer be resolved.

Stale suggestions require regeneration or explicit re-review.

---

# 12. Decision and commitment memory

Wedding planning contains a large volume of decisions that are easy to lose in chat threads and meeting notes.

Notebook must provide a structured decision/commitment view derived from source notes.

Examples:

- Sage + ivory palette — confirmed;
- Add two transport shuttles — confirmed;
- Dessert station — pending;
- Photographer package — awaiting couple;
- Venue generator backup — unresolved.

Users should eventually be able to ask:

- “When did the couple approve the transport increase?”
- “What decisions are still pending for this wedding?”
- “What did the venue promise about generator backup?”
- “Which commitments are overdue?”

Answers must link back to authorized source material and distinguish explicit statements from AI inference.

A later decision can supersede an earlier decision without deleting historical provenance.

---

# 13. Communications integration

Notebook and the existing Wewed Communications Platform are complementary, not competing stores.

Canonical rule:

> Communication owns messages. Notebook owns curated notes/meeting intelligence. Links connect them.

## 13.1 Conversation → Notebook

Authorized users should eventually be able to:

- save a conversation/message selection as a linked note;
- ask AI to summarize an authorized conversation into Notebook;
- extract decisions/action items from a conversation into reviewable Notebook derivations;
- attach a communication thread as source provenance.

The Notebook must store a reference/snapshot only where necessary for provenance; it must not duplicate the entire communication thread as a new canonical message system.

## 13.2 Notebook → Communication

From a note/meeting the user may:

- draft a meeting summary;
- draft a follow-up;
- choose permitted recipients/conversation;
- preview content;
- send through the canonical communications service under its normal policy.

AI drafting does not bypass explicit send permissions or service-window/channel rules.

## 13.3 Communication intelligence suggestion

Wewed may later offer a non-invasive suggestion such as:

> “This conversation appears to contain a confirmed decision. Add it to Wedding Notes?”

This must remain user-controlled and permission-safe. Ordinary communication must not be silently converted into broadly visible Notebook content.

---

# 14. Search and recall

Unlimited notes are only useful if they remain retrievable.

## 14.1 Phase 1 search

Foundation search must support authorized filtering across:

- title;
- text content;
- tags;
- note type;
- wedding/account;
- linked entity;
- author where permitted;
- created/updated date;
- archived/pinned state.

## 14.2 Semantic recall

Later AI recall should support natural-language queries such as:

- “Find the meeting where the couple discussed changing photographers.”
- “What promises did this vendor make?”
- “Show unresolved decisions from meetings this month.”
- “What changed since the last couple meeting?”

Semantic architecture must be designed around authorization first.

Required retrieval pipeline:

```text
Resolve requester + current permissions
        ↓
Resolve permitted Notebook scope/entity context
        ↓
Retrieve/filter candidate authorized material
        ↓
Rank semantic/text relevance
        ↓
Supply only permitted source fragments to AI
        ↓
Answer with source links/provenance
```

Never retrieve globally and rely on the LLM to “ignore” unauthorized notes.

## 14.3 Search index lifecycle

If embeddings/search projections are introduced:

- index current permitted source versions;
- update/delete index entries when note content changes/deletes;
- include tenant/wedding/account/visibility identifiers needed for pre-retrieval authorization;
- never allow stale shares to keep content searchable;
- support re-indexing independently of canonical note storage;
- keep embeddings derived and rebuildable, not the source of truth.

---

# 15. Templates and meeting structure

Notebook may provide lightweight templates without turning into a document-template platform.

Initial high-value templates may include:

- Couple consultation;
- Venue walkthrough;
- Vendor meeting;
- Wedding-week briefing;
- Post-wedding debrief;
- Admin account/support review;
- Internal operations meeting.

Template structure can include prompts such as:

- agenda;
- attendees;
- discussion;
- decisions;
- actions;
- unresolved questions;
- next meeting/follow-up.

Users remain free to create a blank note. Templates are accelerators, not mandatory schemas.

---

# 16. Attachments and storage

Notebook attachments must use Wewed-governed storage patterns.

Requirements:

- private-by-default storage for private notes;
- authorized signed access;
- size/type validation;
- safe filename handling;
- explicit failure states;
- malware/content scanning where the infrastructure supports it;
- no public object URL leakage for private content;
- deletion/retention coordinated with note lifecycle;
- storage usage measurable separately from note count.

Audio storage should be monitored because it will dominate Notebook storage cost relative to text.

---

# 17. Reliability and offline/interruption behavior

Notebook is used in real meetings; loss of content is unacceptable.

Foundation requirements:

- durable autosave;
- local draft buffering where practical;
- retry queue for transient save failures;
- visible sync state;
- idempotent writes;
- optimistic concurrency;
- recovery after browser refresh/crash where practical;
- attachment/recording upload retry/resume strategy for larger files;
- no destructive AI processing of the only source copy.

Full offline collaborative editing is not required initially. The goal is resilient capture, not building an offline-first document engine.

---

# 18. Security, privacy and abuse controls

Notebook introduces high-value private data and audio, so security is a release gate.

At minimum:

- authenticated server-side authorization for all private routes;
- account/wedding/entity scope validation;
- explicit sharing authorization;
- attachment signed access;
- upload type/size limits;
- rate limiting for AI/transcription endpoints;
- prompt/input size bounds;
- AI provider secret isolation on server;
- no secret/client key exposure;
- audit events for sensitive share/access/action transitions;
- deletion/revocation propagation;
- CSRF/session conventions consistent with the existing app;
- safe rendering/sanitization of rich text;
- no execution of embedded scripts/unsafe HTML;
- prompt-injection awareness when external communication/attachments become AI source material;
- structured tool/action allowlists rather than model-generated arbitrary API calls.

AI tool execution must be capability-based: the model proposes a known typed action; server policy decides whether that action exists and whether the user may perform it.

---

# 19. Auditability

Audit events should cover at least:

- note created/deleted/restored where lifecycle requires;
- visibility changed;
- share granted/revoked;
- attachment/recording deleted where important;
- recording/transcription requested/completed/failed;
- AI derivation generated;
- AI rewrite accepted;
- suggestion approved/rejected/applied/failed;
- cross-domain canonical record created/changed from a Notebook suggestion;
- sensitive Admin content-access pathway if one is ever introduced.

Audit logs should record identifiers and structured metadata. They should not indiscriminately duplicate full private note bodies.

---

# 20. Analytics and product learning

Wewed should learn whether Notebook improves work without turning note content into an analytics dataset.

Safe product events may include:

- notes created/edited/archived;
- note type;
- wedding/account-scoped vs personal;
- quick-note usage;
- meeting mode started/completed;
- recording duration;
- transcription success/failure/latency;
- AI action type invoked;
- derivation generated;
- suggestions generated/reviewed/accepted/rejected/applied;
- target action category;
- search usage and zero-result rate;
- return-to-note/recall usage;
- storage size metrics;
- errors/retries.

Do not send full note text/transcripts into ordinary analytics events.

Useful outcome metrics include:

- percentage of meetings that produce at least one accepted action;
- suggestion acceptance rate by action category;
- reduction in unresolved meeting action items;
- note retrieval/search success;
- repeat weekly Notebook usage by active planners/admins;
- transcription completion reliability;
- percentage of applied suggestions that later require correction/rollback.

---

# 21. Accessibility and UX quality contract

Notebook must follow the broader Wewed usability goal: understandable under operational pressure.

Requirements:

1. keyboard-accessible editing/navigation/actions;
2. visible focus states;
3. accessible labels for recording and AI controls;
4. no color-only state meaning;
5. screen-reader meaningful save/recording/transcription status;
6. adequate contrast in fixed Wewed surfaces;
7. touch-friendly mobile controls;
8. dialogs explain consequences before sharing/deleting/applying actions;
9. AI output is clearly marked as generated/suggested, not user-confirmed fact;
10. consistent verbs: New note, Save, Pin, Archive, Share, Record, Transcribe, Summarize, Review suggestions, Apply.

---

# 22. Implementation architecture

The implementation should favor reusable domain services rather than page-specific behavior.

Conceptual layers:

```text
Notebook UI surfaces
    ↓
Notebook client state/editor
    ↓
Notebook API/domain service
    ↓
Authorization + entity-link policy
    ↓
Canonical Notebook data

Recording → Storage → Transcription adapter → Transcript
AI request → Authorized context builder → AI provider adapter → Derivation
Suggestion → Typed action registry → Policy validation → Canonical Wewed service
Search → Authorized query/filter → text/semantic index → source-backed answer
```

Reusable concepts may include:

- `NotebookService`;
- `NotebookAuthorization`;
- `NotebookEntityLinkService`;
- `NotebookAutosave`;
- `NotebookRecordingService`;
- `TranscriptionProvider` adapter;
- `NotebookAiService`;
- `NotebookSuggestionService`;
- typed `NotebookActionRegistry`;
- `NotebookSearchService`;
- `NotebookAuditService`.

Names are illustrative. The architecture requirement is separation of concerns and shared policy enforcement.

---

# 23. Delivery phases

The phases below define implementation order. They do **not** delete later committed scope.

## Phase 0 — Architecture, policy and schema contract

### Goal

Make Notebook safe to build before UI complexity begins.

### Deliverables

- final schema/migration design;
- ownership and entity-link registry;
- server authorization matrix;
- note visibility/share policy;
- rich-text storage/serialization decision;
- autosave/versioning contract;
- attachment/object-storage contract;
- audit event contract;
- AI derivation/suggestion boundary;
- feature flags/entitlements if needed;
- test fixtures for Planner/Admin role boundaries.

### Gate

No UI implementation proceeds until a private note cannot be returned through a broader wedding/account query and Admin scope behavior is explicitly tested.

## Phase 1 — Notebook Foundation

### Goal

Ship a genuinely useful Notebook without requiring AI or voice.

### Deliverables

- Planner portfolio and wedding-scoped Notebook entry points;
- Admin Notebook entry point;
- Quick Note;
- create/edit/archive/delete/recover policy;
- rich-text editor basics;
- effectively unlimited note list with pagination;
- autosave with truthful state;
- version history/restore;
- tags/pin;
- ordinary search/filter;
- wedding/account scoping;
- entity links;
- private/team/selected/internal visibility;
- sharing where authorized;
- mobile UX;
- attachments if included in the foundation cut;
- audit and analytics basics.

### Phase 1 release definition

A Planner or Admin can rely on Notebook daily even if every AI provider is disabled.

## Phase 2 — AI Writing & Structured Note Intelligence

### Goal

Make existing notes smarter without granting AI write authority elsewhere.

### Deliverables

- rewrite/improve/shorten/expand/grammar;
- checklist conversion;
- summaries;
- meeting minutes;
- action-item extraction;
- decision extraction;
- unresolved question/risk extraction;
- suggested titles/tags;
- entity mention detection with explicit resolution;
- AI provenance/versioning;
- source-change invalidation.

### Gate

AI cannot retrieve content the requester cannot read and cannot mutate canonical Planner/Admin records.

## Phase 3 — Voice Notebook & Meeting Mode

### Goal

Enable phone-first meeting capture and trustworthy transcription.

### Deliverables

- Start Meeting flow;
- recording state UI;
- authorized audio upload/storage;
- transcription adapter/job flow;
- transcript with timestamps;
- optional diarization where reliable;
- transcript correction;
- recording/transcript retention and deletion behavior;
- post-meeting tabs;
- AI meeting derivations from transcript/notes;
- retry/error recovery.

### Gate

No recording/transcript may become visible outside the note's authorization scope; recording failure cannot cause silent source loss.

## Phase 4 — Wewed Action Intelligence

### Goal

Turn extracted meeting intelligence into user-approved operational updates.

### Deliverables

- `NotebookSuggestion` review model;
- typed action registry;
- Tasks integration;
- Budget integration;
- Timeline integration;
- Vendor relationship/follow-up integration;
- conservative Guest/Seating integration;
- Admin operational actions where canonical APIs exist;
- independent checkbox/select review;
- edit-before-apply;
- server reauthorization and target validation;
- idempotency;
- stale suggestion detection;
- result/source linking;
- action audit trail.

### Gate

There is no code path where LLM output directly becomes an authoritative database write without a deterministic typed action and user/policy approval.

## Phase 5 — Communications Integration

### Goal

Connect meetings, notes and Wewed-owned communication without creating duplicate sources of truth.

### Deliverables

- communication → linked note;
- authorized thread/selection summary;
- decision/action extraction from conversations;
- note → communication draft;
- meeting-summary follow-up;
- source/provenance links;
- user-controlled “save decision to Notebook” suggestions.

### Gate

Communications remains canonical for message history and send permissions.

## Phase 6 — Knowledge, Recall & Operational Memory

### Goal

Make accumulated authorized Notebook content genuinely searchable as organizational/wedding memory.

### Deliverables

- semantic search/embeddings or equivalent retrieval layer;
- permission-filtered retrieval before AI;
- source-linked answers;
- decision/commitment recall;
- “what changed since…” summaries;
- unresolved-decision/action queries;
- vendor/account historical recall where authorized;
- index lifecycle/rebuild tooling;
- quality/evaluation suite for hallucination and cross-scope leakage.

### Gate

Semantic recall cannot cross wedding/account/user/Admin scope in adversarial authorization tests.

---

# 24. UAT and regression matrix

Notebook is not complete because a note can be typed. Each phase must pass a structured test matrix.

## 24.1 Foundation UAT

Test at minimum:

- create 1 note;
- create many notes and paginate/load more;
- edit/autosave/refresh and confirm persistence;
- network failure during save;
- restore older version;
- pin/archive/search/tag;
- Quick Note in Planner wedding context;
- Quick Note from a linked vendor/task context;
- private note not visible to wedding collaborator;
- wedding-team note visible only to authorized members;
- selected-user share and revoke;
- loss of wedding membership removes access;
- Admin account-scope boundary;
- mobile create/edit/search;
- long note content;
- empty note/title edge behavior;
- attachment access if attachments are in Phase 1.

## 24.2 AI UAT

- rewrite preview does not overwrite until accepted;
- version history contains pre-AI text;
- summary grounded in source note;
- action/decision extraction identifies explicit statements;
- uncertain entity produces resolution UI;
- private-note content cannot be surfaced through broader AI query;
- AI outage leaves Notebook functional;
- source edit marks derivation stale where appropriate.

## 24.3 Voice UAT

- microphone allowed/denied;
- short and long recordings;
- pause/stop if supported;
- upload failure/retry;
- refresh/interruption recovery where supported;
- transcription success/failure;
- transcript timestamp/speaker behavior;
- correction of transcript;
- recording and transcript permissions;
- deletion/retention;
- mobile browser behavior.

## 24.4 Action Intelligence UAT

Using a controlled meeting fixture containing a task, budget change, timeline item and vendor follow-up:

- four suggestions generated;
- user can select only a subset;
- rejected item is not applied;
- edit-before-apply changes only the selected proposal;
- task created once;
- repeated apply does not duplicate;
- budget change requires correct permission and canonical validation;
- timeline ambiguity blocks unsafe apply;
- source note links to resulting canonical records;
- resulting canonical records link back to source where the product surface supports it;
- permission revoked after generation but before apply causes fail-closed behavior;
- stale target causes clear partial-failure result.

## 24.5 Communications UAT

- save permitted thread/selection as note;
- unauthorized thread cannot be imported;
- note-generated message remains a draft until communication send flow authorizes it;
- sent message exists canonically in Communications;
- deleting/archiving note does not delete original communication;
- conversation membership changes affect future Notebook extraction access.

## 24.6 Semantic recall UAT

Seed notes across multiple weddings, private/team scopes and Admin scopes.

Verify:

- correct answer retrieved from same wedding;
- source links open only for authorized user;
- private note excluded from team query;
- Wedding A content never appears in Wedding B query;
- out-of-scope Admin account content never appears;
- revoked share removed from recall;
- deleted/archived behavior matches policy;
- answer states uncertainty/no result instead of hallucinating when source support is absent.

---

# 25. Performance and scale expectations

The system should be designed so “unlimited notes” does not mean “load every note into the browser.”

Requirements:

- paginated/cursor note listing;
- indexed authorization/context/search fields;
- bounded AI context building;
- transcript segmentation for long meetings;
- async/background-style server jobs only where the platform actually supports durable job execution; user-facing state must remain explicit;
- object storage for binaries;
- no N+1 entity/link lookups on large lists;
- safe search result limits;
- lazy loading of heavy transcript/audio content;
- cost/usage instrumentation for transcription and AI operations.

---

# 26. Failure modes and required behavior

## AI provider unavailable

Notebook text editing/search still work. AI action shows retryable failure; source note is untouched.

## Transcription provider unavailable

Recording remains saved if upload succeeded. State is `transcription failed/pending retry`, not “no meeting.”

## Canonical target changed

Suggestion fails closed or returns to review. It must not overwrite newer task/budget/timeline state blindly.

## Permission changes

Revalidate on every request and at action apply time. Cached UI state cannot preserve revoked access.

## Ambiguous wedding/vendor/person

Ask user to resolve from authorized candidates. Do not guess.

## Partial action batch failure

Return per-item outcome. Successful items remain linked/audited; failed items remain actionable/reviewable as appropriate.

## Browser/network interruption during note edit

Preserve local draft where practical and clearly reconcile with server version on reconnect.

## Browser/network interruption during recording upload

Preserve recoverable recording state where technically possible and expose retry. Never show a completed transcript unless processing actually completed.

---

# 27. Rollout strategy

Notebook should be released incrementally behind explicit feature/permission gates.

Recommended rollout:

1. internal/Admin test accounts;
2. controlled Planner alpha/UAT accounts;
3. wider Planner availability after persistence/privacy qualification;
4. AI writing opt-in/feature gate;
5. Meeting/voice beta with storage/transcription monitoring;
6. Action Intelligence limited to low-risk actions first, then Budget/Guest/Admin-sensitive categories after dedicated qualification;
7. Communications integration;
8. semantic recall after cross-scope security evaluation.

Rollback/disable controls should allow AI, transcription and action intelligence to be turned off independently while preserving ordinary Notebook access.

---

# 28. Definition of benchmark quality

This feature should be considered benchmark-quality only when it satisfies all of the following:

### Capture

A user can take a note as quickly as a lightweight notes app and can record a meeting from mobile without fighting the UI.

### Durability

Refresh, navigation and ordinary network failures do not silently lose trusted note content.

### Context

Notes know the correct wedding/account/entities without forcing repeated manual filing or making unsafe guesses.

### Intelligence

AI produces useful, grounded meeting summaries, decisions and action items rather than generic prose.

### Actionability

The system can turn meeting intelligence into real Planner/Admin work through reviewable typed suggestions.

### Safety

No silent AI authority change, no cross-scope leakage, no uncontrolled Admin surveillance and no duplicate source-of-truth domains.

### Traceability

A user can determine where a decision/task/update came from and recover the source note/transcript.

### Recall

Months later, an authorized user can find or ask about important wedding/operational decisions and receive source-backed answers.

### Graceful degradation

Notebook remains a useful note system when AI, transcription or an external provider is unavailable.

---

# 29. Explicit implementation constraints for future agents

Future agents implementing or refining Notebook must follow these rules:

1. **Read this plan before changing Notebook behavior.**
2. Treat this file as the canonical product/architecture contract unless a later stamped revision explicitly supersedes it.
3. Do not collapse Notebook into one text column on Wedding or BusinessAccount.
4. Do not store all notes in one giant JSON blob.
5. Do not create a second task/budget/vendor/guest/timeline/message source of truth.
6. Do not give AI direct arbitrary database/API execution.
7. Do not allow AI to bypass authorization through retrieval, embeddings, summaries or tool calls.
8. Do not expose private user notes to Admin merely because Admin has broad platform authority.
9. Do not treat browser/local state as proof of durable save.
10. Do not overwrite note history when AI rewrites content.
11. Do not silently apply meeting-derived updates.
12. Do not silently omit later phases because Phase 1 is independently shippable.
13. Do not choose an AI/transcription provider in a way that hard-codes the domain to that vendor.
14. Do not store audio/files as large database/base64 content when governed object storage is appropriate.
15. Do not ship semantic recall without adversarial authorization tests.
16. Do not broaden sharing as a side effect of linking a note to a wedding/account/entity.
17. Do not use analytics events to copy full private note/transcript bodies.
18. Do not represent inference as a confirmed decision.
19. Do not apply a stale suggestion to newer canonical data without revalidation.
20. Preserve mobile usability as a primary requirement, not a cleanup task.

---

# 30. Required companion references

Implementation must be reconciled with the latest versions of these existing Wewed contracts rather than overriding them:

- `docs/PLANNER_WORKSHEET_UX_OPERATIONS_PLAN.md` — Planner usability, mobile and no-hidden-authority interaction rules;
- `docs/ADAPTIVE_WORKSPACE_NAVIGATION_SETTINGS_PLAN.md` — current Planner/Admin navigation and contextual action architecture;
- `docs/AI_WEDDING_ARCHITECT_ECOSYSTEM_PLAN.md` — canonical ownership, governed AI proposals and deterministic authoritative operations;
- `docs/AI_WORKSPACE_OPERATIONS.md` and current AI provider setup — AI provider/runtime conventions;
- `docs/WEWED_COMMUNICATIONS_PLATFORM_PLAN.md` — communications source of truth, relationships and staff/privacy boundaries;
- `docs/admin-rbac-account-segmentation-plan.md` — Admin least privilege and account-scope governance;
- `docs/WEWED_ADMIN_GOVERNANCE_ANALYTICS_PLAN.md` — Admin audit/governance analytics conventions;
- current security/auth/data-hardening documentation and migrations.

If these documents conflict because a later implementation changed the platform, the conflict must be documented and resolved through an explicit plan revision. An agent must not silently pick whichever rule makes implementation easiest.

---

# 31. Implementation-start checklist

Implementation may begin only after product-owner go-ahead and should start with the following sequence:

- [ ] Confirm current `main` and create a dedicated implementation branch.
- [ ] Reference stamp `WW-NOTEBOOK-AI-2026-08-18-01` in the branch/first implementation commit or implementation log.
- [ ] Re-audit current Planner/Admin/AI/Communications schemas and services for reusable canonical paths.
- [ ] Finalize Phase 0 schema and authorization matrix before UI writes.
- [ ] Add migrations additively; do not weaken existing RLS/server-only/private-table protections.
- [ ] Add policy tests before broad UI exposure.
- [ ] Implement Notebook Foundation independent of AI availability.
- [ ] Qualify persistence and privacy before advancing to voice/actions.
- [ ] Implement later phases against the same canonical domain rather than parallel prototypes.
- [ ] Maintain a status/closeout document mapping delivered functionality back to every phase and requirement in this plan.

---

# 32. Final product statement

Wewed Notebook is not successful merely when users can save text.

It is successful when a planner can leave a meeting, open one trusted Wewed record and see:

- what was discussed;
- the original notes and/or transcript;
- what was decided;
- what remains unresolved;
- who committed to what;
- what Wewed records may need to change;
- which changes were actually approved and applied;
- where those resulting tasks/budget/timeline/vendor/communication records now live;
- and, months later, retrieve the same knowledge without relying on memory, external email or scattered WhatsApp history.

That is the standard this implementation must preserve.