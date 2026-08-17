# Wewed Adaptive Workspace Navigation & Settings Plan

**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN  
**Stamp:** `WW-ADAPTIVE-NAV-2026-08-18-01`  
**Baseline:** `f45486cba0780dbb05be28a49c2ae37bacafba57` (`main`, after PR #136)  
**Implementation branch:** `feat/adaptive-workspace-navigation-20260818`  
**Date:** 2026-08-18

This document is the authoritative implementation and regression reference for the Wewed adaptive authenticated-workspace navigation initiative. Future implementation commits, pull requests, UAT notes, fixes and release closeout records for this scope must reference stamp `WW-ADAPTIVE-NAV-2026-08-18-01`.

If an implementation choice conflicts with this document, either bring the implementation back into conformance or amend this document explicitly before the conflicting change is merged. Do not silently reinterpret the plan after code has been written.

---

## 1. Problem statement

The Wewed Planner now has a strong visual language and increasing operational capability, but the authenticated workspace is accumulating too many persistent control surfaces. Current Planner screens can simultaneously expose project identity, wedding switching, Team, Planner tools, Worksheet Recovery, Switch worksheet, Worksheet tools, horizontal worksheet tabs, Refresh, global workspace navigation, account/history controls and the new Print / Arrange / Select command centre.

The issue is no longer cosmetic. At compact desktop widths and on mobile, independently floating and stacked controls compete for the same viewport area, obscure content, increase cognitive load, and make a capable system feel harder to use than it should.

The product objective is therefore:

> **Keep Wewed's full capability while making only the controls relevant to the user's current task persistently visible. Everything else must remain obvious and reachable through progressive disclosure.**

The initiative must not achieve simplicity by removing required functionality, weakening authorization, hiding important operational state, or creating different data behaviour on different viewport sizes.

---

## 2. Evidence and UAT context

This plan was triggered by live UAT evidence on the Planner workspace after the Planner worksheet UX release.

Observed UX symptoms:

- fixed bottom global navigation competes with other floating controls;
- Back / Forward / Account controls occupy a second persistent floating region;
- the Planner worksheet command trigger (`Print · Arrange · Select`) occupies a third persistent floating region;
- Planner project controls and worksheet controls create several stacked rows before primary worksheet data begins;
- the wide desktop layout remains usable but becomes visually dense;
- compact desktop and mobile layouts experience collisions, covered content and excessive control density.

The UX finding is tracked conceptually as **`UX-NAV-001 — excessive persistent controls / mobile viewport congestion`**.

### Current functional UAT checkpoint

This navigation release must not erase or rewrite the active functional UAT record.

- Task Test 10: **PASS**.
- Task Test 11 — Priority filter: **FAIL**.
  - UAT task visible: yes.
  - Other priorities hidden: no.
  - Status still In progress: yes.
  - Error: none.
  - Classification: filter-function defect; no task mutation or data-integrity failure observed.

The Task Test 11 defect is a separate functional issue. It may be fixed in a dedicated follow-up unless a navigation change directly touches the filter implementation. Do not hide its failure behind this UX release.

---

## 3. Non-negotiable design tenets

1. **Progressive disclosure, not feature removal.** Existing actions remain available unless separately deprecated through an explicit product decision.
2. **One control, one home.** A capability should not appear as multiple competing persistent controls simply because it was added by a different feature stream.
3. **Mobile is a primary product surface.** Mobile must not be treated as desktop compressed to a narrower viewport.
4. **Hide controls, not important state.** Budget totals, payment state, capacity warnings, selected counts, filters and other operational signals remain visible when relevant.
5. **No silent side effects.** Moving navigation must not change data semantics, permissions, saved values, ordering, print behaviour or invitation authority.
6. **Server authority remains authoritative.** Client navigation and settings never become an authorization source.
7. **Plain language first.** Non-technical users should understand where to go without learning Wewed's internal architecture.
8. **Accessible alternatives remain.** A drawer, menu or compact layout must remain keyboard-operable and screen-reader-labelled.
9. **No new floating-surface sprawl.** New authenticated-workspace functionality must integrate into the defined navigation hierarchy rather than adding another permanent floating pill or toolbar.
10. **Preserve recoverability.** Users must remain able to reach import/export/history/recovery, account actions and project controls after visual consolidation.

---

## 4. Information architecture contract

Every authenticated-workspace control must be classified into one of these layers.

| Layer | Purpose | Examples |
| --- | --- | --- |
| **Global navigation** | Move around Wewed | Workspace, Brief, Messages, AI, Business, Wewed/home |
| **Project navigation** | Manage the active wedding/project | Wedding switcher, Team, project invitations, Planner tools, project settings |
| **Worksheet navigation** | Move within Planner | Overview, Tasks, Budget, Vendors, Guests, Timeline, Seating |
| **Worksheet actions** | Act on the current worksheet/data | Print, Arrange, Select, Refresh, Import, Export, Templates, History/Recovery |
| **Account & settings** | Configure the user/application | Profile, appearance, accessibility, notifications, preferences, account security, sign out |

A control may be contextually surfaced from another layer only when doing so reduces steps for a frequent task without recreating persistent duplication.

---

## 5. Target navigation architecture

### 5.1 Adaptive Wewed navigation shell

Introduce one shared authenticated-workspace navigation surface with two responsive behaviours:

- **Wide/compact desktop:** a collapsible navigation rail/drawer. It should default to a compact footprint and expand on request.
- **Phone:** an off-canvas drawer opened by a single obvious menu control.

The navigation surface should provide global destinations plus context-aware project/account destinations without permanently consuming large horizontal or vertical space.

Expected global destinations include:

- Workspace;
- Brief;
- Messages;
- AI;
- Business;
- Wewed / wedding site or appropriate home destination;
- Settings;
- Account / sign out.

The exact destination availability must continue to respect current route/access rules.

### 5.2 Project controls

Project controls belong together. For Planner, consolidate or expose through the adaptive shell/project section:

- All weddings / portfolio return;
- active wedding selector;
- Team;
- Invitations & secure QR where permitted;
- Planner tools;
- project settings;
- wedding site.

High-frequency context such as the active wedding name/date should remain visible in the workspace header. Low-frequency project management controls should not all remain permanently expanded.

### 5.3 Worksheet navigation

Planner worksheet switching must remain easy while consuming less space.

- Wide desktop may retain a compact horizontal worksheet row when there is room.
- Compact desktop/tablet may use a scrollable or condensed selector.
- Phone should use a clear `Switch worksheet` selector/menu instead of six or seven always-visible tabs.

Existing route semantics and test identifiers should be preserved where practical so this UX release does not cause unnecessary regression churn.

### 5.4 Worksheet actions

Replace multiple worksheet-control regions with one contextual **Actions** entry point.

The actions surface should group:

- Print / Save PDF;
- Arrange;
- Select & act;
- Refresh;
- Import;
- Export;
- Templates;
- Import history / recovery.

The existing Planner worksheet command-centre dialog remains the behavioural authority for Print / Arrange / Select. This release should change its trigger placement and presentation, not reimplement its data logic.

The current fixed `Print · Arrange · Select` trigger must be retired as a persistent overlay and invoked from the worksheet's contextual actions area instead.

On phone, action detail should prefer a modal/bottom-sheet pattern with proper focus management rather than another fixed horizontal toolbar.

---

## 6. Settings architecture

Wewed now requires a durable Settings destination rather than allowing account and preference controls to accumulate in workspace chrome.

### 6.1 Settings v1 sections

The initial Settings hub should provide a clear information architecture even where some advanced preference persistence remains future work:

1. **Profile & account**
   - current display identity;
   - account email where available;
   - account/security entry points already supported by Wewed;
   - sign out / switch-account actions where appropriate.

2. **Appearance & accessibility**
   - theme selection using the existing Wewed theme system;
   - system/light/dark choices where supported;
   - explanatory accessibility guidance;
   - future-safe space for density/text/reduced-motion preferences without pretending unsupported persistence already exists.

3. **Planner preferences**
   - current project context;
   - links to Planner and relevant existing configuration;
   - documented future home for default worksheet, print and density preferences.

4. **Project & team**
   - current wedding/project settings entry points;
   - Team and secure project invitations where authority permits.

5. **Notifications & communication**
   - clear home for communication preferences and future notification controls; do not manufacture backend preferences that are not currently supported.

6. **Privacy & security**
   - account/security explanations and existing security actions;
   - platform-administrator authority remains separate from project membership settings.

### 6.2 Settings implementation boundary

This navigation release may create the Settings hub and wire existing capabilities into it. It must **not** introduce speculative database fields merely to make every planned settings row editable on day one.

Unsupported future settings should be labelled as informational/future capability or omitted until a persistence contract exists.

---

## 7. Existing-control relocation matrix

| Current surface | Target home | Rule |
| --- | --- | --- |
| Persistent global bottom navigation | Adaptive shell; compact phone navigation only where useful | Avoid duplicate full global nav surfaces |
| Back / Forward / Account floating control | Integrated adaptive shell/top account control | Preserve browser-history actions without a competing permanent pill |
| Planner project header controls | Project section / compact header | Keep active context visible; disclose low-frequency management controls |
| `Planner tools` panel | Project actions | Preserve functions, reduce permanent chrome |
| `Worksheet recovery` banner | Worksheet Actions → Data & recovery | Recovery remains reachable; banner need not consume a row continuously |
| `Switch worksheet` + full worksheet tabs | Responsive worksheet navigation | Desktop compact row; phone selector |
| `Worksheet tools` | Worksheet Actions | One entry point for operational tools |
| `Refresh` | Worksheet Actions; optional compact icon on wide screens | No separate full-width control row required |
| Fixed `Print · Arrange · Select` | Worksheet Actions | Preserve existing command-centre behaviour; remove fixed overlay |
| Sign out | Account / Settings | Keep accessible but not visually dominant |
| Wedding site | Project/global navigation | Retain one obvious route |

---

## 8. Responsive contract

Use the existing responsive framework, with these behavioural modes as the acceptance contract.

### Wide desktop — approximately 1200 px and above

- compact/expandable side navigation is available;
- worksheet tabs may remain horizontally visible;
- worksheet actions may show text labels;
- no floating control competes with the bottom edge of primary content.

### Compact desktop/tablet — approximately 768–1199 px

- navigation defaults collapsed;
- project management actions collapse into menus/drawer;
- worksheet actions become one compact entry point;
- worksheet navigation may condense or scroll safely;
- no control overlap at 768, 1024 or similar intermediate widths.

### Phone — below approximately 768 px

- global navigation is off-canvas or compact bottom navigation, not both in full form;
- worksheet switching uses a selector/menu;
- worksheet actions open from one clear control;
- modal/bottom-sheet actions respect safe areas and keyboard height;
- primary content is not covered by persistent controls.

Exact CSS breakpoints may follow Wewed's existing Tailwind conventions; the behavioural distinctions above are authoritative.

---

## 9. Accessibility and interaction requirements

- Menu/drawer trigger has an explicit accessible name.
- Drawer is keyboard reachable and closes with Escape.
- Focus is moved into the opened surface and returned to the invoking control on close where the UI primitive supports it.
- Navigation items expose current/active state semantically.
- Touch targets should be at least approximately 44 px where practical on phone.
- Hidden controls must not remain keyboard-focusable.
- Action grouping must use meaningful labels rather than icon-only ambiguity.
- Reduced-motion/system preferences must not be broken by the navigation shell.
- No horizontal document overflow at supported phone/compact widths.

---

## 10. Data, authorization and security invariants

This is an information-architecture release, not a permission rewrite.

The implementation must preserve:

- active-wedding server authority;
- Planner role and permission checks;
- wedding-switching isolation;
- owner/planner/coordinator/viewer boundaries;
- secure QR invitation authority and the platform-admin boundary introduced by PR #136;
- worksheet save/edit/delete APIs;
- A4 Print / Save PDF behaviour;
- durable worksheet presentation ordering;
- safe bulk-action exclusions for financial/time data;
- seating capacity and RSVP semantics;
- Messages/communications behaviour;
- production-domain isolation.

No client-side drawer/menu state may be used as evidence of authorization.

---

## 11. Implementation sequence

### Release A — Inventory and stamped foundation

1. Commit this document before runtime changes.
2. Inventory current persistent authenticated-workspace controls and their owning components.
3. Add regression contract describing the relocation rules.

### Release B — Adaptive navigation shell and Settings hub

1. Add shared adaptive navigation/menu primitive using existing UI components.
2. Integrate Back/Forward/Account functionality into the adaptive shell where Planner uses it.
3. Add `/settings` as the stable Settings destination.
4. Add actual theme switching using the current theme provider; avoid unsupported settings persistence.

### Release C — Planner chrome consolidation

1. Reduce stacked worksheet header rows.
2. Preserve active worksheet/project context.
3. Consolidate Import/Export/Templates/History/Recovery/Refresh under Worksheet Actions.
4. Move Print/Arrange/Select invocation from fixed overlay into the worksheet action entry point.
5. Preserve existing command-centre implementation and APIs.

### Release D — Responsive mobile/compact behaviour

1. Wide desktop layout verification.
2. Compact desktop/tablet collapse rules.
3. Phone drawer/worksheet selector/action presentation.
4. Remove or suppress duplicate Planner floating navigation surfaces.
5. Add no-overlap/no-horizontal-overflow browser gates.

### Release E — Regression, UAT, merge and production verification

1. Static/source contract passes.
2. Existing CI/regression matrix passes on the exact PR head.
3. New browser viewport/navigation gates pass.
4. Vercel preview is READY.
5. UAT checks Planner at representative wide, compact and phone widths.
6. Merge only the exact qualified head.
7. Verify production deployment and smoke-test the navigation shell and Planner actions.

---

## 12. Regression matrix

At minimum verify:

### Geometry

- 320 px phone;
- 375 px phone;
- 390 px phone;
- 768 px compact/tablet;
- 1024 px compact desktop;
- 1280 px desktop;
- 1440 px desktop.

For each applicable viewport:

- no horizontal document overflow;
- no overlapping persistent control surfaces;
- primary Planner content remains reachable and unobscured;
- drawer/menu can open and close;
- worksheet switching remains possible;
- Worksheet Actions remain reachable.

### Planner functional preservation

- Tasks;
- Budget;
- Vendors;
- Guests;
- Timeline;
- Seating;
- Refresh;
- Import/export/templates/history;
- Print / Save PDF;
- Arrange and saved order;
- multi-select/bulk actions;
- Team and secure project invitations;
- wedding switching.

### Theme

- system/light/dark where supported;
- Planner fixed-dark worksheet form controls remain readable regardless of OS theme.

### Permissions

- owner;
- planner;
- coordinator;
- viewer/member where supported;
- project/wedding admin where supported;
- platform administrator remains a separate privileged workflow.

---

## 13. Completion criteria

A non-technical tester should be able to:

1. understand what wedding/project and worksheet they are in;
2. move to another Wewed area through one obvious navigation control;
3. open and close the adaptive menu without losing work;
4. reach Settings and change the supported theme preference;
5. switch Planner worksheet on phone without dealing with a crowded tab row;
6. find Print / Save PDF, Arrange, Select, Refresh and data/recovery actions from one contextual worksheet-actions location;
7. use Planner at phone, compact desktop and wide desktop widths without controls covering primary data;
8. reach account/sign-out actions without a separate competing floating toolbar;
9. complete existing Planner operational workflows with no permission or data-semantic regression;
10. understand where advanced controls live without developer guidance.

---

## 14. Agent continuation rule

If an implementation session is interrupted, the next agent must:

1. read this stamped plan;
2. inspect the current branch head and open PR status;
3. continue from the closest incomplete implementation/checklist item;
4. preserve already-passed tests and documented UAT results;
5. never restart the initiative from an older baseline unless a rollback is explicitly authorized;
6. record any deviation or discovered blocker in the PR/closeout record.

This rule exists specifically to prevent regression and duplicated work across interrupted agent sessions.

---

## 15. Release rule

**Do not merge merely because the UI looks cleaner.**

The release is complete only when the exact implementation head satisfies the existing Wewed regression matrix, the new adaptive-navigation contract, the relevant browser viewport gates and a READY Vercel preview. Production verification must then confirm that the qualified merged commit is actually serving on `wewed.pro`.
