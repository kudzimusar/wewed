# Wewed Africa-ready product remediation

Status: implementation in progress
Owner: Wewed product release
Date: 2026-08-04

## Purpose

This document is the implementation source of truth for the authenticated-product redesign following preview review. The current release must not be merged until the internal planner, invitation, QR and marketplace surfaces meet the same visual and usability standard as the public acquisition experience.

## Confirmed defects

1. The original remote hero film contains scenes that may be culturally misread in the Zimbabwean market.
2. Remote stock photography does not satisfy Wewed ownership and local-media requirements.
3. Planner marketplace fields and empty states have insufficient contrast.
4. Invitation templates are compressed into narrow columns, causing clipped and overlapping text.
5. Guest QR cards are too narrow for names, statuses, table details and action controls.
6. Daily Planner Operations metrics collapse into unreadable columns and tabs wrap unpredictably.
7. Fixed navigation and overlays can cover working content.
8. Authenticated product interiors have not yet received a complete system-wide visual pass.

## Product rules

- Use Wewed-owned local media only on redesigned surfaces.
- Represent joyful Black opposite-gender wedding couples in culturally appropriate Zimbabwean and African settings.
- Do not change schema, API contracts, privacy rules, authorization, wedding isolation or business logic.
- Meet WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text and controls.
- No text clipping, horizontal page overflow, hidden actions or overlapping modal content.
- Dialogs own their scrolling and remain inside the dynamic viewport.
- Forms use visible labels, readable values, helpers and validation states.

## Implementation phases

### Phase 1 — media safety and ownership

- Remove the remote hero film from the rendered experience.
- Replace it with a local Wewed-owned Black Zimbabwean couple visual.
- Keep an accessible static hero until a Wewed-owned video can be generated on the approved free tier.
- Remove third-party media from the redesigned route set as local replacements are completed.

### Phase 2 — shared visual foundations

- Add route-aware product surface markers.
- Standardize light and dark surface contrast.
- Standardize input, textarea, select, disabled, focus and helper states.
- Increase dialog width and establish responsive internal scrolling.
- Add fixed-navigation clearance and safe-area padding.

### Phase 3 — planner marketplace

- Add visible labels for every profile field.
- Use white inputs with dark text and clear borders.
- Keep enquiry and appointment empty states readable.
- Prevent the planner dock from obscuring the last form controls.
- Rebalance profile and inbox columns.

### Phase 4 — invitations and QR

- Present invitation templates in responsive cards with stable aspect ratios.
- Use one column on constrained viewports and increase card width before adding columns.
- Keep names, metadata and controls inside each QR card.
- Stack action controls when horizontal space is insufficient.
- Keep QR images at a stable readable size.

### Phase 5 — Daily Planner Operations

- Use a wide desktop dialog and full-width mobile sheet.
- Change metrics to responsive cards with minimum widths.
- Keep long currency values visible.
- Use horizontally scrollable tabs rather than wrapped fragments.
- Give priority tasks and timeline panels adequate width.

### Phase 6 — remaining authenticated surfaces

Apply the same standards to Tasks, Budget, Vendors, Guests, Timeline, Seating, Couple invitations, Couple planner discovery, Vendor surfaces and Admin governance.

## Validation

The release gate includes:

- source contracts for this document and local media;
- desktop, laptop, tablet and mobile Chromium;
- no horizontal overflow;
- no clipped or overlapping text;
- contrast and keyboard checks;
- populated, empty and large-value states;
- retained planner CRUD, priority-filter persistence, marketplace, privacy, invitation and wedding-isolation tests;
- exact-head preview review before merge;
- production route and runtime verification after merge.

## Merge rule

Do not merge this release until the exact branch head passes all automated gates and the corrected authenticated surfaces have been visually reviewed in the exact-head Vercel preview.