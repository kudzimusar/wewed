# Planner Worksheet UX & Operations Plan

## Document stamp

- **Stamp ID:** WW-PLANNER-UX-2026-08-17-01
- **Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN
- **Issued:** 2026-08-17
- **Repository baseline:** `main` at `70502eda89edeef6a93e76b768d8a4ce7c1bd4f0`
- **Branch:** `plan/planner-worksheet-ux-operations-20260817`
- **Change authority:** This document is the implementation and regression-control reference for the Planner worksheet UX work described below. Implementation commits, agent hand-offs, UAT notes, and release closeout must reference this plan or a later stamped revision.

This plan intentionally combines immediate usability remediation with the next Planner productivity features so they are implemented as one coherent operating system rather than isolated page fixes.

---

## Product objective

The Planner Workspace must feel usable by a non-technical person under real wedding-day pressure.

A user should be able to:

1. read and edit every field without theme-dependent contrast failures;
2. print or save every worksheet as a professionally formatted A4 document;
3. change the working order of worksheet records without editing data manually;
4. select multiple records and act on them safely in one operation;
5. invite trusted collaborators through a secure QR/link flow instead of relying only on manual invitation entry;
6. understand what each action will do before committing it;
7. recover safely from mistakes through confirmation, clear status, durable ordering, and auditability.

The guiding UX rule is:

> **Simple first interaction, powerful second layer, no hidden authority changes.**

---

## Current confirmed baseline

### Planner worksheet modules

The detailed Planner Workspace currently exposes:

- Overview
- Tasks
- Budget
- Vendors
- Guests
- Timeline
- Seating

The Planner relationship model remains wedding-centred. Professional access is derived from wedding membership rather than attaching planners directly to couple records.

### Seating is the reference implementation

Seating already demonstrates several behaviours that should become shared Planner patterns:

- a visible **Print plan** action;
- a print-only document created from current saved seating data;
- bulk guest selection;
- moving selected guests to a destination table;
- capacity-aware prevention of invalid moves;
- confirmation before destructive table deletion;
- clear operational status and summaries.

The new work should generalise those strengths instead of creating six unrelated UX patterns.

### Existing libraries already available

The repository already includes:

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for accessible drag/reorder interactions;
- `qrcode` and its TypeScript types for QR generation.

No new drag/drop or QR dependency should be added unless a concrete gap is demonstrated.

### Theme/contrast regression

The Planner Portal is a fixed espresso/champagne workspace, while shared form inputs use global theme foreground tokens. When the global/system theme is light, dark Planner fields can inherit a dark foreground and become effectively unreadable.

The existing Wewed form-surface remediation contract protects selected dark forms, but the Planner itself is not yet governed as a complete fixed-dark form surface. This is a release blocker and Phase 0 below.

---

# Scope

## Phase 0 — Immediate Planner form readability and theme contract

### Goal

Restore readable, predictable forms across the entire Planner Workspace before adding productivity features.

### Requirements

1. The Planner must not depend on the user's OS light/dark preference for core form readability.
2. Inputs, textareas, selects, date/time fields, placeholders, caret, disabled states, autofill states, and browser-native control icons must remain legible.
3. The fix must apply at a governed Planner surface level rather than adding one-off text classes to Budget fields.
4. The solution must preserve the existing espresso/champagne Planner visual identity.
5. The same contract must be audited on other fixed-dark Wewed surfaces so the underlying defect is not merely moved elsewhere.

### Regression gate

Run representative form entry under both forced light-system and dark-system browser themes on:

- Tasks;
- Budget;
- Vendors;
- Guests;
- Timeline;
- Seating;
- at least one dark Admin form;
- at least one dark Couple/Vendor/Business form where applicable.

A release fails if entered values or placeholders cannot be read without selecting/highlighting the text.

---

# Phase 1 — Shared A4 Print / Save-PDF system for every worksheet

## Product behaviour

Every worksheet must expose a consistent document action:

- **Print / Save PDF**

The action opens a clean document view sized for standard A4 output and invokes the browser print flow. The same A4 view must be suitable for **Save as PDF**, avoiding two different document renderers that can drift apart.

A later direct-download PDF renderer may be added only if the business needs server-generated attachments or batch PDF generation. The first release should prioritise one canonical print/PDF layout.

## Shared document contract

Create one Planner document/export layer rather than embedding long HTML strings independently in each module.

The export layer should receive:

- wedding title;
- wedding date;
- venue/location where available;
- worksheet name;
- generated date/time;
- active filters or a clear choice between **Current view** and **Full worksheet**;
- saved worksheet records;
- optional summary totals;
- print orientation recommendation;
- document-specific columns/sections.

### Required print controls

For every worksheet:

1. `Print / Save PDF` is visible from the worksheet action area.
2. User chooses, where relevant:
   - **Full worksheet**; or
   - **Current filtered view**.
3. The document title identifies the selected wedding and worksheet.
4. Records must not be cut through awkwardly across pages where CSS paged-media rules can prevent it.
5. Repeating table headers should be used for long tabular worksheets.
6. Page margins must be A4-safe and printable on ordinary office printers.
7. Colour must not be necessary to understand the document; statuses require text labels.
8. URLs, notes, names and long text must wrap instead of overflowing.
9. Empty data produces a meaningful printable empty-state, not a broken page.
10. Sensitive/internal fields are included only when the current user's authorization permits them.

## Worksheet formatting matrix

### Overview

**Purpose:** management summary / handover sheet.

Include:

- wedding identity and date/location;
- task progress;
- budget headline totals;
- guest/RSVP headline totals;
- vendor attention counts;
- timeline/seating headline counts;
- generated timestamp.

Recommended orientation: **Portrait**.

### Tasks

Include:

- order;
- task;
- description where present;
- category;
- status;
- priority;
- due date;
- assignee.

Recommended orientation: **Portrait** for compact list, with landscape fallback if extended fields are enabled.

### Budget

Include:

- order;
- description;
- category;
- linked/manual vendor;
- estimate;
- actual;
- paid;
- outstanding;
- due date;
- notes.

Include totals at the beginning and/or end.

Recommended orientation: **Landscape A4**.

### Vendors

Include:

- order;
- vendor;
- category;
- primary contact;
- phone/email;
- contract status;
- payment status;
- notes;
- relevant linked budget summary if already available in the module contract.

Recommended orientation: **Landscape A4**.

### Guests

Include:

- order/name;
- role;
- side;
- email/phone where authorized;
- RSVP status;
- plus-one/kids count summary;
- dietary notes where required for operations;
- table assignment;
- check-in state.

Provide explicit presets when practical:

- Full guest list;
- RSVP list;
- Catering/dietary list;
- Check-in list;
- Seating assignment list.

Recommended orientation: **Landscape A4**.

### Timeline

Include:

- order/time;
- activity/title;
- duration where available;
- location;
- owner/contact where available;
- operational notes/status.

Use clear time-group separation and avoid splitting one timeline record over a page where possible.

Recommended orientation: **Portrait** unless dense operational fields require landscape.

### Seating

Retain the current operational seating print capability, but move it onto the shared document contract so wedding identity, A4 rules, typography and print controls are consistent with the other worksheets.

Recommended orientation: **Portrait**, with table cards allowed to flow naturally across pages.

## Print quality gates

Test at minimum:

- 1 record;
- 20 records;
- 100+ records where realistic;
- long names/notes;
- empty optional fields;
- mobile browser initiating print;
- desktop Chrome/Chromium print preview;
- Save as PDF output;
- black-and-white/grayscale readability.

---

# Phase 2 — Reorderable worksheet records

## Product behaviour

Users must be able to deliberately change the working order of records without rewriting the record itself.

Desktop should support drag handles where useful. Mobile and keyboard users must always have non-drag alternatives.

### Required interactions

For reorderable records provide:

- drag handle;
- Move up;
- Move down;
- Move to top;
- Move to bottom;
- optional `Move to position…` for long lists;
- keyboard-accessible reorder actions;
- saved/persisted position after refresh.

### Accessibility rule

Drag-and-drop is an enhancement, not the only control. Every reorder operation must be possible without precision dragging.

### Data rule

Before implementation, audit each worksheet's persistence model and add a durable order field only where one is absent.

Existing semantic ordering must not be destroyed:

- timeline clock time remains authoritative data even when a custom display order is offered;
- guest alphabetical/filter views remain available even if a custom order is stored;
- seating table grouping/type/capacity rules remain valid;
- financial values are never changed by a reorder action.

### Default behaviour

Where historical rows have no explicit order, backfill deterministically from the existing stable sort so deployment does not scramble current customer data.

---

# Phase 3 — Bulk selection and bulk actions

## Shared interaction pattern

Every record-based worksheet should adopt a common selection model inspired by Seating:

- checkbox/select control per record;
- `Select all in current view`;
- visible selected count;
- sticky bulk action bar when selection is non-empty;
- `Clear selection`;
- filters/search remain usable while selected state is clearly explained;
- destructive operations require consequence confirmation.

Selections should normally be scoped to the current wedding and current worksheet.

## Bulk action matrix

The exact actions remain permission- and data-model-dependent, but the intended release matrix is:

### Tasks

- change status;
- change priority;
- change category;
- assign/reassign owner;
- move/reorder selected records;
- delete selected.

### Budget

- move/reorder selected items;
- change category;
- update due date where safe;
- assign/link vendor where the same destination is valid;
- export/print selected;
- delete selected with financial consequence warning.

Do not provide a casual bulk overwrite of actual/paid monetary values.

### Vendors

- change contract status;
- change payment status;
- move/reorder selected;
- export/print selected;
- delete selected only when relationship/link consequences are explicitly shown.

### Guests

- change side;
- change role;
- assign table;
- unassign table;
- move/reorder selected when custom order is active;
- print selected;
- delete selected with RSVP/seating consequence warning.

### Timeline

- move/reorder selected;
- change location/owner/status only where supported by the data model;
- print selected;
- delete selected.

Bulk changing event times must be a separate guarded operation, not a generic field overwrite.

### Seating

Preserve the existing multi-select and move-to-table flow, then align its selection bar, select-all semantics, print-selected behaviour and accessibility language with the shared pattern.

## Safe destructive UX

Bulk delete confirmation must state:

- number of records;
- record type;
- important downstream consequences;
- whether the operation is reversible;
- exact wedding context.

Do not use a generic `Are you sure?` dialog for high-impact bulk actions.

---

# Phase 4 — Secure QR collaborator invitations

## Product goal

Allow a trusted person to join a wedding/project by scanning a QR code or opening a secure link, without requiring the inviter and invitee to manually copy long identifiers or rely on technically complex steps.

This is a **team access invitation system**, separate from guest RSVP/invitation QR codes.

## Supported intended roles

Subject to the existing permission model and policy checks, the invitation UX should support appropriate wedding/project roles such as:

- owner/partner;
- planner;
- coordinator;
- member/viewer;
- wedding-level admin where current authority rules permit it.

### Critical admin boundary

A QR invitation must **never grant platform-wide Wewed administrator authority**.

If `admin` is used for a wedding/project membership role, the UI and API must label and enforce it as **wedding/project admin**. Platform administrator elevation remains a separate privileged Wewed process.

## Security design

The QR must contain only an opaque Wewed join URL, for example conceptually:

`https://wewed.pro/join/<opaque-token>`

The token must:

- be cryptographically random;
- be stored server-side in hashed/non-recoverable form where practical;
- be scoped to one wedding/project;
- carry the intended role only through server-side invitation state;
- have an expiry;
- support revocation;
- support rotation/regeneration;
- default to one successful acceptance unless an explicitly multi-use invite type is later introduced;
- record creator, creation time, acceptance time and accepted account;
- fail closed when invalid, expired, revoked or already consumed.

Do not encode raw authority claims, passwords, emails or reusable session credentials inside the QR itself.

## Acceptance flow

Scanning/opening an invite should show a human-readable confirmation page before authority changes:

> **Join Charity & Kudzie**
>
> You have been invited as **Planner**.
>
> Invited by: [authorized inviter]
>
> This gives access to: [plain-language permission summary]

Then:

1. existing user signs in, or new user creates/verifies an account;
2. server re-validates invitation state;
3. user explicitly accepts;
4. membership is created/activated according to the current membership contract;
5. audit event is written;
6. inviter sees Accepted / Pending / Expired / Revoked status;
7. invitee is routed directly to the correct wedding/project context.

No membership should be activated merely because a camera scanned a QR.

## Invitation UX

From a clear **Invite team member** action, allow:

- choose role;
- optional invitee name/email note for human context;
- choose expiry from safe presets;
- generate QR;
- copy secure link;
- share through device share sheet where supported;
- download/print QR card;
- revoke;
- regenerate/rotate;
- view acceptance status.

The UI should explain access in plain language instead of exposing internal role codes.

## Audit and abuse controls

Log at least:

- invite created;
- QR/link rotated;
- invite revoked;
- acceptance attempted;
- acceptance succeeded;
- acceptance rejected due to invalid/expired state;
- membership role and wedding context.

Rate-limit invitation creation/acceptance endpoints and ensure only authorized actors can create invitations for roles at or below their grant authority.

---

# Phase 5 — Context and simplicity layer

Power features must not make the workspace intimidating.

## UX principles

1. **Progressive disclosure:** one obvious primary action; advanced actions live in a menu/bulk bar.
2. **Plain language:** `Move selected to table` instead of implementation terminology.
3. **Context first:** destructive and authority-changing operations always show wedding/project name.
4. **Useful defaults:** common filters, print preset and invitation expiry should not require configuration.
5. **Mobile first:** touch targets, sticky action bars and modal heights must work on phones.
6. **Feedback:** every save/move/delete/invite returns clear success or failure state.
7. **No silent side effects:** reorder does not edit financial/time data; scan does not grant access; print does not mutate records.
8. **Recoverability:** selection can be cleared, invitation can be revoked, ordering remains stable, and destructive effects are described before execution.
9. **Consistent verbs:** Add, Edit, Select, Move, Print / Save PDF, Invite, Revoke, Delete.
10. **Operational density without clutter:** summaries can be compact, but controls must remain readable and finger-friendly.

---

# Architecture principles

## One worksheet action contract

Create reusable Planner primitives rather than duplicating behaviour in each module, for example conceptually:

- `PlannerWorksheetActions`
- `PlannerSelectionBar`
- `PlannerReorderControl`
- `PlannerPrintDocument`
- `PlannerPrintPreset`
- `PlannerTeamInvite`

Exact names may change, but implementation should preserve one behavioural contract.

## One authorization source

All mutations continue to use server-authoritative wedding context. Client-provided wedding IDs, role names, record IDs and invite tokens must never bypass authorization checks.

## One saved-data truth

Print/PDF, reorder, bulk actions and QR memberships must operate on durable server data. UI-only state must not become a parallel source of truth.

## Filters versus mutations

Search/filtering changes what the user sees. It must not mutate or reorder hidden records unless the user explicitly chooses a scoped bulk action and the UI states that scope.

---

# Delivery sequence

## Release A — Restore safe work immediately

1. Fix Planner form contrast/theme scope.
2. Add regression tests for light-system and dark-system contexts.
3. Preview deployment.
4. UAT Budget, Tasks, Guests, Vendors, Timeline and Seating.
5. Merge and production smoke test.

This release is independent and should not wait for the productivity features.

## Release B — Shared Print / Save PDF

1. Extract seating print behaviour into shared document primitives.
2. Add print actions to Tasks, Budget, Vendors, Guests, Timeline, Overview.
3. Reconnect Seating to the shared exporter.
4. Test A4 output at realistic large datasets.
5. Preview/UAT/merge/production verify.

## Release C — Reorder persistence

1. Audit schema/order semantics per worksheet.
2. Add/backfill durable order fields only where needed.
3. Add accessible reorder controls and DnD enhancement.
4. Validate refresh/import/export/template interactions.
5. Preview/UAT/merge/production verify.

## Release D — Bulk operations

1. Extract the Seating selection pattern.
2. Add shared selection bar.
3. Implement one worksheet at a time with permission/consequence tests.
4. Add select-all-current-view semantics and destructive confirmations.
5. Preview/UAT/merge/production verify.

## Release E — Secure QR team invitations

1. Document final membership/grant matrix.
2. Add scoped invitation persistence/token lifecycle.
3. Add create/revoke/status API.
4. Add join/accept flow.
5. Add QR/share/print UI.
6. Add audit/rate-limit/security tests.
7. Preview cross-account UAT.
8. Merge and production verify.

---

# Regression matrix

Every release must preserve:

- current Planner authorization boundaries;
- wedding switching isolation;
- save/edit/delete behaviour;
- guest RSVP data;
- seating capacity rules;
- budget integrity;
- vendor links;
- timeline time values;
- template/import/export functionality;
- unsaved-form protection;
- mobile bottom navigation clearance;
- accessibility labels and keyboard operation;
- current Messages/communications behaviour;
- production domain isolation (`wewed.pro`, no accidental `.vercel.app` user-facing links).

### Theme matrix

- light OS/browser preference;
- dark OS/browser preference;
- mobile Chrome/Chromium;
- desktop Chromium.

### Data-size matrix

- empty;
- small;
- realistic;
- large/high-density.

### Permission matrix

At minimum, verify relevant operations for:

- owner;
- planner;
- coordinator;
- viewer/member where supported;
- wedding/project admin where supported;
- platform admin through its separate privileged workflow.

---

# UAT completion criteria

The initiative is not complete until a non-technical tester can, without developer guidance:

1. enter and read data in every worksheet;
2. print/save an A4 worksheet document;
3. reorder at least one record using touch/mouse and one using non-drag controls;
4. select several records and complete an allowed bulk operation;
5. understand the consequence of a bulk delete before confirming it;
6. generate a team invitation QR;
7. scan it on a second device/account;
8. see the intended wedding and role before accepting;
9. accept successfully and arrive in the authorized context;
10. revoke another unused invitation and prove it can no longer be accepted.

---

# Agent implementation rules

Any agent continuing this work must:

1. read this file before editing Planner worksheet UX code;
2. state which Release/Phase it is implementing;
3. keep implementation additive and compatible with current saved weddings;
4. avoid page-local shortcuts when a shared contract is required by this plan;
5. add regression coverage with each behavioural change;
6. verify the exact branch head in Vercel Preview before merge;
7. not merge a release with unresolved data-loss, authorization, theme-readability, print-overflow or QR-authority defects;
8. update this document's **Implementation ledger** when a phase is completed or materially re-scoped.

---

# Implementation ledger

| Phase | Status | Evidence / release note |
| --- | --- | --- |
| Phase 0 — Form readability/theme | Planned | Confirmed regression; implementation pending |
| Phase 1 — A4 Print / Save PDF | Planned | Seating reference exists; shared exporter pending |
| Phase 2 — Reordering | Planned | `dnd-kit` already installed; schema audit pending |
| Phase 3 — Bulk operations | Planned | Seating reference exists; generalisation pending |
| Phase 4 — QR team invitations | Planned | `qrcode` already installed; secure membership-token flow pending |
| Phase 5 — Simplicity/context | Planned | Must be applied throughout Releases A–E |

---

## First implementation goal

**Release A / Phase 0:** restore Planner form readability across all worksheets under both light and dark system themes, add the regression gate, deploy a Preview, and return the workspace to safe daily use before the larger productivity features are layered on top.
