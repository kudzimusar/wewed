# Wewed AI Product Areas Plan

Status: Phases 1–4 implemented on `feature/ai-provider-router`; automated validation and Preview review are the release gates. Production remains unchanged.

## Purpose

Wewed AI is organised as four explicit product areas rather than one generic assistant. Each area has its own users, permissions, source data, prompts, expected outputs, persistence model, and safety rules.

The implementation follows one operating principle: **AI may analyse and draft freely inside an authorised boundary, but changes to wedding data require a separate human-reviewed action proposal.**

## Shared principles

1. **Wewed is the product brand.** User-facing surfaces say “Powered by Wewed AI”. Provider and model names remain internal diagnostics.
2. **Permission filtering happens before generation.** The model receives only data the current user is allowed to access.
3. **Structured application data comes first.** Wedding, task, RSVP, budget, vendor, programme, template, and communication data are retrieved from governed application records.
4. **Documents are supplemental evidence.** Indexed documents are retrieved only inside the correct wedding and visibility boundary, with inline source labels.
5. **Draft before action.** Generated templates and communications remain durable drafts until reviewed.
6. **No silent writes.** Chat generation routes never mutate wedding records.
7. **Human confirmation is explicit.** A proposed action must be approved before it can be executed; execution is audited.
8. **Clear failure behaviour.** Provider failures return a useful fallback without claiming an action succeeded.
9. **Compact, readable output.** Markdown is rendered safely; compact guest responses avoid tables and excessive headings.
10. **Production isolation.** Preview-only provider configuration and branch deployments are used until release approval.

---

## Product area 1: Guest Concierge

### Users

Guests viewing a guest-accessible wedding page (`public`, `unlisted`, or `link_only`). Private weddings are excluded.

### Primary jobs

- Answer ceremony and reception timing questions.
- Explain venue, transport, accommodation, dress code, menu, accessibility, RSVP, registry, and programme information.
- Explain approved cultural etiquette and traditions.
- Use approved public wedding documents when they are relevant.
- Direct guests to the correct page section when information is unavailable.

### Data boundary

Guest Concierge receives only:

- the wedding identified by the current `/w/<slug>` page or explicit request slug;
- published wedding fields;
- published programme items;
- an allowlist of guest-facing page sections;
- indexed document chunks explicitly marked `public`.

It never receives:

- private planner or couple notes;
- budget data;
- vendor negotiations or contracts;
- guest contact details;
- private or unpublished indexed documents;
- unpublished seating decisions;
- internal incident or risk information.

### Implemented

- Safe Markdown rendering instead of visible formatting symbols.
- “Powered by Wewed AI” product branding.
- Dedicated `guest_concierge` prompt profile.
- Dynamic wedding resolution from the guest page.
- Live, permission-filtered published wedding context.
- Public-only document retrieval with `[S1]`, `[S2]` source labels.
- Safe grounding diagnostics at `/api/ai/context/health?slug=<slug>`.
- Compatibility support for current `link_only` wedding pages without admitting `private` weddings.

---

## Product area 2: Planner Copilot

### Users

Authenticated wedding members with `planner.view`. Individual data domains require their matching permissions.

### Primary jobs

- Produce a daily attention brief.
- Summarise RSVP movement and dietary risks.
- Prioritise overdue, blocked, and high-priority tasks.
- Identify vendor follow-ups and timeline conflicts.
- Explain budget pressure and upcoming payments.
- Prepare meeting agendas and operational checklists.
- Search authorised workspace documents such as contracts and venue manuals.

### Data boundary

Planner Copilot builds context from the active wedding and checks permissions before each domain is loaded:

- tasks: `planner.view`;
- guests and RSVPs: `guests.view`;
- budget: `budget.view`;
- vendors: `vendors.view`;
- programme/timeline: `timeline.view`;
- private indexed documents: authenticated planner boundary only.

Guest email addresses, phone numbers, secrets, and unrelated weddings are excluded from AI context.

### Implemented

- Live server-built planner context.
- Existing RSVP and task analysis preserved.
- Budget, vendor, and timeline context added where permitted.
- Read-only recommendations in the chat surface.
- Private document retrieval with source citations.
- Dedicated AI operations page at `/planner/ai-workspace`.

---

## Product area 3: Template Intelligence

### Users

Authenticated planners and authorised wedding workspace users.

### Primary jobs

- Draft a planning template from wedding characteristics.
- Adapt an existing template for guest count, culture, location, budget, ceremony type, and reception type.
- Compare a live wedding against a template and identify missing work.
- Suggest realistic dates and dependencies.
- Convert a completed wedding into an anonymised reusable template.

### Data and action boundary

- AI output is stored as a versioned template draft in `ContentRevision`.
- Template output may contain a validated machine-readable `items` block.
- Only supported item types are accepted: `task`, `timeline`, and `reminder`.
- Invalid item types, empty titles, and unsafe values are discarded.
- Template application is never performed from chat.
- A human creates an `apply_template` proposal, reviews it, approves it, and separately executes it.
- Execution uses a database transaction, skips duplicates, and writes an audit event.

### Implemented

- Dedicated Template Intelligence area and prompt profile.
- Versioned durable template records.
- Structured item extraction and validation.
- Template preview and review queue.
- Human-confirmed template application to tasks, timeline, and planner reminders.
- Duplicate prevention and audit logging.

---

## Product area 4: Communication Assistant

### Users

Authenticated planners, couples, and authorised wedding team members.

### Primary jobs

- Draft vendor follow-ups.
- Draft guest announcements and RSVP reminders.
- Draft weekly couple or planner updates.
- Draft wedding-week briefings.
- Draft speeches, vows, and post-wedding thank-you messages.

### Data and action boundary

- Generated communication is always labelled as a draft.
- Drafts are stored durably and remain editable.
- Approval changes only the draft state; it does not send anything.
- A reviewed email draft may be converted into an existing planner reminder through a confirmed action proposal.
- Reminder delivery remains in Wewed’s existing preview/send flow and is never triggered directly by AI chat.
- WhatsApp, SMS, email, notifications, and public updates are not sent automatically.

### Implemented

- Dedicated Communication Assistant area and prompt profile.
- Durable draft storage with audience, channel, subject, body, and status.
- Review and approval proposals.
- Controlled conversion to planner reminders.
- Speech and vows generation retained.
- Audit events for creation, approval, and action execution.

---

## Cross-area technical architecture

### Request contract

`POST /api/ai/chat` accepts:

```ts
{
  context: 'guest' | 'couple'
  area?:
    | 'guest_concierge'
    | 'planner_copilot'
    | 'template_intelligence'
    | 'communication_assistant'
  weddingSlug?: string
  useDocuments?: boolean
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}
```

Client-provided system messages are discarded. Public requests are forced to `guest_concierge`. Authenticated planner requests may select a planner area.

### Prompt composition

```text
shared Wewed safety and output rules
+ area-specific role and boundaries
+ permission-filtered application context
+ permission-filtered retrieved sources
+ recent sanitized conversation messages
```

Application context and retrieved documents are explicitly treated as untrusted data, not as instructions.

### Durable records

Wewed reuses governed application tables rather than creating an isolated AI database:

- `ContentRevision`
  - `ai_template_version`
  - `ai_communication_draft`
  - `ai_action_proposal`
- `WeddingContent`
  - `ai_document`
  - `ai_document_chunk`
- `AuditEvent`
  - creation, approval, rejection, execution, failure, ingestion, deletion, and reindex events

### Controlled action state machine

```text
proposed -> approved -> executed
         -> rejected
approved -> failed -> approved or rejected
```

Execution is unavailable until approval. Every transition is wedding-scoped, permission-checked, and audited.

### Document retrieval

- Browser import accepts extracted TXT, Markdown, CSV, and JSON text, or pasted text.
- Documents are chunked, checksummed, and indexed with PostgreSQL full-text search.
- Visibility defaults to `private`.
- Publishing a document to guests requires an approved action proposal.
- Private chunks are never eligible for Guest Concierge retrieval.
- Search results receive deterministic source labels.
- Documents support retention dates, deletion, and reindexing.

### Rendering and branding

- `react-markdown` is used without raw HTML.
- Guest styling is restricted to compact paragraphs, emphasis, lists, code, and safe links.
- Provider/model metadata stays out of user-facing copy.

---

## Delivery status

### Phase 1 — Product separation and presentation

- [x] Provider router and Z.AI Preview configuration.
- [x] Safe Markdown in Guest Concierge.
- [x] “Powered by Wewed AI” branding.
- [x] Four visible AI product areas.
- [x] Area-aware prompts and request contracts.
- [x] Read-only and draft-only boundaries.

### Phase 2 — Real application context

- [x] Published guest-information context builder.
- [x] Planner context builder for tasks, RSVPs, vendors, budgets, and timeline.
- [x] Permission checks before domain retrieval.
- [x] Versioned template records.
- [x] Durable communication drafts.

### Phase 3 — Controlled actions

- [x] Action proposal schema and review queue.
- [x] Human approval and rejection controls.
- [x] Audited template application.
- [x] Audited draft approval and reminder conversion.
- [x] Transactional execution and duplicate protection.

### Phase 4 — Document retrieval

- [x] Document text ingestion and chunking.
- [x] Permission-aware PostgreSQL retrieval.
- [x] Inline source citations.
- [x] Public/private visibility controls.
- [x] Retention, deletion, and reindexing controls.
- [x] Human-reviewed publication to Guest Concierge.

---

## Release acceptance criteria

1. Guest responses render Markdown without visible formatting syntax.
2. Guest and planner surfaces display Wewed branding rather than a model version.
3. Guest responses are grounded in the current guest-accessible wedding, not a global hard-coded wedding.
4. Private weddings and private document chunks are excluded from public retrieval.
5. Planner context respects active-wedding membership and domain permissions.
6. All four AI areas are accessible from the planner ecosystem.
7. Templates and communications persist as durable records.
8. No chat request directly writes wedding data or sends a communication.
9. Action execution requires a proposed, then approved, record.
10. Template execution is transactional and duplicate-aware.
11. Document search, publication, deletion, retention, and reindex paths are available.
12. Prisma validation, migrations, PostgreSQL contracts, unit tests, production build, and built-runtime smoke tests pass in CI.
13. The Vercel branch Preview is `READY` and production is unchanged.

## Deliberate limitations

- Binary PDF and DOCX parsing is not performed in the browser; text must be extracted before indexing.
- Document retrieval uses PostgreSQL full-text search rather than embeddings. This keeps the first release inspectable, wedding-scoped, and operationally simple.
- External communication delivery remains in Wewed’s existing explicit preview/send systems.
- AI-generated actions are limited to supported, validated action types.
- Preview write-safety controls may block mutation tests in Preview; write-path automation runs against isolated CI PostgreSQL instead.
