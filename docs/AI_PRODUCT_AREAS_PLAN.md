# Wewed AI Product Areas Plan

Status: implementation started on `feature/ai-provider-router`

## Purpose

Wewed AI will be presented and maintained as four explicit product areas rather than one generic assistant. Each area has its own users, permissions, source data, prompts, expected outputs, and safety rules.

The first implementation is intentionally read-only. AI may analyse data and create drafts, but it must not update wedding records, send messages, publish guest information, or apply templates without a separate user confirmation flow.

## Shared principles

1. **Wewed is the product brand.** User-facing surfaces say “Powered by Wewed AI”. Provider and model names remain internal diagnostics.
2. **Permission filtering happens before generation.** The model receives only data the current user is allowed to access.
3. **Structured data first.** Tasks, guests, budgets, vendors, timelines, and templates should be retrieved from application APIs and supplied as bounded context. Document retrieval can be added later.
4. **Draft before action.** Generated plans, template changes, and communications remain drafts until a user reviews and confirms them.
5. **No silent writes.** AI routes do not directly mutate the database.
6. **Clear failure behaviour.** Provider failures return a useful fallback without pretending an action succeeded.
7. **Compact, readable output.** Markdown is rendered safely; compact guest responses avoid tables and excessive headings.

---

## Product area 1: Guest Concierge

### Users

Public wedding guests.

### Primary jobs

- Answer ceremony and reception timing questions.
- Explain venue, transport, accommodation, dress code, menu, accessibility, RSVP and programme information.
- Explain approved cultural etiquette and traditions.
- Direct guests to the correct page section when information is unavailable.

### Data boundary

Guest Concierge may use only information explicitly published for guests. It must never expose:

- private planner or couple notes;
- budget data;
- vendor negotiations or contracts;
- guest contact details;
- unpublished seating decisions;
- internal incident or risk information;
- unpublished documents.

### First implementation

- Keep the existing public guest chat.
- Render safe Markdown instead of displaying formatting symbols.
- Replace provider-specific branding with “Powered by Wewed AI”.
- Give the API a dedicated `guest_concierge` prompt profile.
- Keep responses concise and prevent claims that private data was checked.

### Next data milestone

Replace hard-coded wedding facts with a server-built, permission-filtered snapshot of published wedding content.

---

## Product area 2: Planner Copilot

### Users

Authenticated planners and authorised wedding workspace users.

### Primary jobs

- Produce a daily attention brief.
- Summarise RSVP movement and dietary risks.
- Prioritise overdue, blocked and high-priority tasks.
- Identify vendor follow-ups and timeline conflicts.
- Explain budget pressure and upcoming payments.
- Prepare meeting agendas and operational checklists.

### Data boundary

Planner Copilot may analyse authorised workspace data. It must not claim to update records. Any future write operation must use a separate confirmation screen that shows the exact proposed changes.

### First implementation

- Make Planner Copilot one of four visible AI workspace areas.
- Retain live RSVP and task summarisation.
- Add explicit read-only prompt rules.
- Label outputs as analysis or recommendations rather than completed actions.

### Next data milestone

Build a server-side planner context endpoint that returns bounded summaries of tasks, RSVPs, vendors, budget and timeline data for the active wedding.

---

## Product area 3: Template Intelligence

### Users

Planners, planning teams and authorised couples using reusable planning templates.

### Primary jobs

- Draft a planning template from wedding characteristics.
- Adapt an existing template for guest count, culture, location, budget, ceremony type and reception type.
- Compare a live wedding against a template and identify missing work.
- Suggest realistic dates and dependencies.
- Convert a completed wedding into an anonymised reusable template.

### Data boundary

Template Intelligence must remove names, contact details, private messages, prices tied to identifiable vendors, and other client-specific information before proposing a reusable template.

### First implementation

- Add a dedicated Template Intelligence workspace and prompt profile.
- Provide quick actions for starter-template creation, checklist gap analysis and timeline adaptation.
- Return drafts only; do not write or apply templates.

### Next data milestone

Introduce versioned template records, template preview/diff, and an explicit “Apply template” confirmation workflow.

---

## Product area 4: Communication Assistant

### Users

Planners, couples and authorised wedding team members.

### Primary jobs

- Draft vendor follow-ups.
- Draft guest announcements and RSVP reminders.
- Draft weekly couple or planner updates.
- Draft wedding-week briefings.
- Draft speeches, vows and post-wedding thank-you messages.

### Data boundary

Generated communication is always a draft. The assistant must not send email, WhatsApp, SMS, notifications or public updates automatically.

### First implementation

- Add a dedicated Communication Assistant workspace and prompt profile.
- Provide quick actions for vendor follow-up, guest announcement, progress update and speech/vow drafting.
- Clearly label generated text as a draft for review.

### Next data milestone

Add recipient selection, preview, editable draft storage, approval history and explicit send actions through supported communication channels.

---

## Technical design

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
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}
```

Public requests are always forced to `guest_concierge`. Authenticated planner requests may select any of the four areas.

### Prompt composition

```text
shared Wewed safety and output rules
+ area-specific role and boundaries
+ permission-filtered application context
+ recent conversation messages
```

### Rendering

- Use `react-markdown` without raw HTML.
- Restrict compact guest styling to paragraphs, emphasis, lists and safe links.
- Keep provider/model metadata out of user-facing copy.

### Observability

Continue returning provider, model and token usage from API responses for diagnostics, but do not display them to guests. Add area metadata to logs and responses later without logging prompt contents.

---

## Delivery sequence

### Phase 1 — Product separation and presentation

- [x] Provider router and Z.AI preview configuration.
- [ ] Safe Markdown in Guest Concierge.
- [ ] “Powered by Wewed AI” branding.
- [ ] Four visible AI product areas in the planner workspace.
- [ ] Area-aware API prompt profiles.
- [ ] Read-only and draft-only boundaries in prompts and UI.

### Phase 2 — Real application context

- [ ] Published guest-information context builder.
- [ ] Planner context builder for tasks, RSVPs, vendors, budgets and timeline.
- [ ] Template catalogue and versioning.
- [ ] Draft communication storage.

### Phase 3 — Controlled actions

- [ ] Proposed-change schema.
- [ ] Human review and confirmation UI.
- [ ] Audited template application.
- [ ] Audited communication send flow.

### Phase 4 — Document retrieval

- [ ] Ingest contracts, venue manuals, proposals and wedding briefs.
- [ ] Permission-aware retrieval and source citations.
- [ ] Retention, deletion and re-indexing controls.

---

## Acceptance criteria for the first implementation

1. Guest responses render bold text and lists without visible Markdown symbols.
2. Guest and planner surfaces display “Powered by Wewed AI”, not a model version.
3. The planner AI workspace visibly exposes all four product areas.
4. Each planner request sends an explicit area identifier to `/api/ai/chat`.
5. The API applies the correct area prompt and enforces authentication for planner areas.
6. Template and communication outputs are described as drafts and do not write to the database.
7. Existing RSVP and task analysis remains available under Planner Copilot.
8. The Vercel Preview build succeeds and the guest chat still reaches Z.AI.
