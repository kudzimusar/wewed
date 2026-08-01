# Planner responsive UX system repair — 2026-08-01

## Incident

Production UAT showed that planner overlays, sticky action bars, and scroll regions were not consistently usable across phone, tablet, laptop, and desktop viewports. The blank Guest template preview also exposed a disabled Review action without explaining that an empty template is intentionally non-executable.

This repair is system-wide. It must not be accepted as an Import Dialog-only patch.

## Scope

### Shared interaction primitives

- Dialog and dialog overlay
- Sheet and sheet overlay
- Select menus
- Popovers
- Dropdown menus
- Tab bars
- Toast notifications
- Native and Radix scroll regions
- Safe-area padding and coarse-pointer target sizes
- Planner fixed header and internal viewport model

### Planner features and tools

- Wedding context selector and team access
- Worksheet Recovery across Tasks, Budget, Vendors, Guests, Timeline, and Seating
- Import preview, mapping, confirmation, execution, result, rollback, and recent-import history
- Core planner Overview
- Tasks create, edit, status, search, category/status/priority filters, delete
- Budget create, search/filter, amount updates, payment state, delete
- Vendors create, edit, status, notes, delete
- Guests create, edit, RSVP data, table assignment, search/filter, delete
- Timeline create, edit, reorder, print, delete
- Seating table create/edit/delete, assignment, search/filter
- Team Collaboration Hub
- Client Profile and Venue
- Daily Operations
- RSVP link export notifications
- Wedding Day Command Centre
- Intelligence / release centre

## Device contracts

Automated browser coverage must exercise at least these viewport classes:

1. Compact phone: 390 × 667
2. Large phone: 430 × 932
3. Tablet portrait: 820 × 1180
4. Tablet landscape / small laptop: 1024 × 768
5. Desktop: 1440 × 900

The layout may change by breakpoint. It must not merely shrink the desktop composition.

## Mandatory acceptance criteria

### Overlay geometry

- Every dialog and sheet stays within the visual viewport.
- Phone dialogs use a viewport-bound surface with no hidden header, close control, or footer.
- Tablet and desktop dialogs remain centered and bounded.
- Nested selects, popovers, and dropdowns render above the parent overlay.
- Toasts render above planner surfaces and outside the fixed header.

### Scrolling

- The planner shell may lock document scrolling only when each active feature owns a working internal scroll boundary.
- Every long dialog, sheet, tab panel, form, table, and module list must support wheel, trackpad, touch, Page Up/Down, and keyboard focus scrolling.
- Nested table scrolling must not disable vertical dialog scrolling.
- Scrollable tab bars must work horizontally on compact devices.
- No `min-height`, sticky footer, or nested Radix viewport may trap content outside the visible area.

### Actions

- Primary and secondary actions must remain visible and reachable.
- Phone action groups stack; tablet/desktop action groups may be horizontal.
- Sticky or fixed action bars must not cover the final content row.
- Disabled actions must always have a visible reason.
- A blank template preview must not show an unexplained disabled Review action. It must explain that no rows can be executed and provide active Close, Back, and Choose another file controls.
- A populated valid import must allow Review → Confirm without executing data during the browser gate.

### Accessibility

- Close controls are at least 44 × 44 CSS pixels on coarse-pointer layouts.
- Focus remains trapped in an open modal and returns to the trigger on close.
- Escape closes a nested menu before closing its parent dialog.
- Dialog titles and descriptions remain available to assistive technology.
- Alerts and disabled reasons are programmatically associated.

### Non-regression

- Existing planner migration, parity, blocker, complete-gap, Stage 8–10, Phase 2–6, build, and browser gates remain green.
- No database migration is required for this UI repair.
- No real planner record is created, changed, or deleted by responsive browser tests.

## Release rule

Do not merge or describe this repair as complete until the full CI pipeline passes on the exact PR head and the production deployment is READY at the canonical planner URL. Production UAT resumes only after a short overlay and scroll smoke test on the deployed build.
