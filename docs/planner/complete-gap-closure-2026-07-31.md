# Planner complete gap closure — 2026-07-31

Status: active corrective work
Base production commit: `0eafd203317d83f97e3a0ed78351530d77326af4`
Branch: `fix/planner-complete-gap-closure`

## Scope correction

The merged blocker repair is Phase 1 only. It fixed Vendor, Timeline, and core Guest worksheet persistence defects, but it did not close every gap discovered during planner UAT. This document is the authoritative release scope for the remaining work.

No future release may be described as complete while any item below is open, untested, or lacks production UAT evidence.

## Mandatory defect closure

### Navigation and mobile workspace

- `DEF-PLN-NAV-001`: browser refresh resets the lower workspace to Overview or leaves the module selector and workspace out of sync.
  - Required fix: persistent module routes or query-state, selected-wedding preservation, and restoration of active module/search/filter state after refresh.
  - Acceptance: direct URL, browser refresh, back/forward navigation, wedding switch, and mobile refresh all restore the same module without selector mismatch.

- `DEF-PLN-TASK-001`: task workspace state is not preserved across refresh.
  - Required fix: task route/state persistence, including active search and filter state where practical.
  - Acceptance: refresh retains Tasks and does not display Overview beneath a Tasks selector.

- `DEF-PLN-MOBILE-001`: toolbar and floating controls obscure planner content on mobile.
  - Required fix: responsive collapsible toolbar, non-overlapping floating controls, focused workspace layout, and accessible touch targets.
  - Acceptance: no control obscures forms, tables, buttons, alerts, or row actions at supported mobile widths.

### Tasks

- `DEF-PLN-TASK-002`: blank or spaces-only task titles are blocked without clear validation feedback.
  - Required fix: visible inline validation and accessible error announcement.
  - Acceptance: blank submission explains the problem and preserves the entered form state.

- `DEF-PLN-TASK-003`: existing tasks cannot edit title, category, priority, due date, or assignee.
  - Required fix: complete edit workflow with wedding-scoped validation and persistence.
  - Acceptance: every core field can be edited, persists after refresh, and remains isolated to the active wedding.

- `DEF-PLN-TASK-004`: meaningless punctuation-only titles can be accepted.
  - Required fix: semantic title validation after trimming and Unicode normalization.
  - Acceptance: punctuation-only and symbol-only titles are rejected with a clear message; legitimate names containing punctuation remain valid.

### Budget

- `DEF-PLN-BUDGET-002`: category badge has unreadable or low-contrast styling.
  - Required fix: accessible contrast in dark and light themes.
  - Acceptance: WCAG AA contrast for text and meaningful state indicators.

- `DEF-PLN-BUDGET-003`: no search or quick-find controls.
  - Required fix: search by item/vendor/category/notes plus practical status/category filters and reset behavior.
  - Acceptance: search/filter combinations work, persist during normal module use, and reset predictably.

### Guests

- `DEF-PLN-GUEST-001`: normal Guest records cannot edit name, email, phone, role, or side.
  - Required fix: complete edit UI for existing guests with duplicate-email protection and wedding isolation.
  - Acceptance: all core fields edit and persist; invalid or duplicate values produce field-specific feedback.

### Seating

- `DEF-PLN-SEATING-001`: no search or multi-filter controls.
  - Required fix: search by table and guest name; filters for assigned/unassigned, available/full, and occupancy/capacity.
  - Acceptance: filters combine correctly, reset cleanly, and do not alter assignments.

### Guest worksheet and templates

- `DEF-PLN-WS-GUEST-004`: the example Guest row can be treated as executable import data.
  - Required fix: example data must be non-importable by design, removed from the data range, or explicitly excluded by the parser.
  - Acceptance: uploading an untouched template produces zero create/update rows.

- `DEF-PLN-WS-GUEST-005`: formula handling documentation overstates parser protection.
  - Required fix: explicitly detect formula cells and reject or strip them with row/column errors.
  - Acceptance: formula cells never silently supply imported values; preview clearly reports them.

## Mandatory template redesign

The Guest workbook and shared worksheet generator must include:

- Real frozen header panes.
- Excel tables with filters.
- Data-validation dropdowns for enumerated fields.
- Numeric validation for attendance and child counts.
- Protected structural/header cells without blocking normal data entry.
- Clear blank data-entry area.
- Non-importable example content.
- Conditional formatting for invalid or incomplete rows where supported.
- Explicit first-sheet-only warning.
- Clear Excel and Google Sheets instructions.
- Formula-cell warning aligned with actual parser enforcement.
- Stable version metadata and compatibility rules.

Acceptance requires inspection of the generated `.xlsx`, upload preview, execution, export, Google Sheets round-trip, and unchanged reimport.

## Regression requirements

Before merge, all existing planner suites must remain green and new tests must cover:

- Persistent module routing and refresh restoration.
- Mobile overlap at representative viewport sizes.
- Task full-field editing and validation.
- Budget search/filter behavior and contrast contract.
- Guest full-field editing and duplicate protection.
- Seating search/filter combinations.
- Untouched-template zero-row preview.
- Formula rejection.
- Workbook structure: freeze panes, tables, filters, validation, protection, and version metadata.
- Cross-wedding isolation for every changed module.

## Production UAT evidence required

Each defect must have:

1. Controlled test data.
2. Exact steps and expected result.
3. Screenshot or exported-file evidence where relevant.
4. Refresh/persistence verification.
5. Cross-wedding isolation verification.
6. Cleanup confirmation.
7. Runtime-log review.

## Release rule

The release is complete only when every defect and template item above is marked passed in automated tests and controlled production UAT. Partial completion must be described as partial completion, never as full gap closure.
