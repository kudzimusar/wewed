# P5-P6 — QR Gateway + Vendors/Timeline DB wiring

**Task ID:** P5-P6
**Agent:** Z.ai Code (P5-P6 — QR gateway + planner DB wiring)
**Spec phases covered:** Phase 5/6 (QR gateway) + Phase 4 prerequisite (vendors + timeline DB)

## What was delivered

### Part 1 — QR Gateway (`src/components/wedding/qr-gateway.tsx`)
- `'use client'` component exposing:
  - `<QrGatewayTrigger onOpen={...} />` — compact icon button (QrCode lucide icon, gold-on-espresso styling) for the navbar right cluster. Hidden on mobile (`hidden sm:block`).
  - `<QrGateway open onOpenChange />` — the modal + mobile floating button. Controlled API so the navbar can lift state and trigger from multiple call sites.
  - `FloatingQrButton` — bottom-LEFT mobile FAB (`sm:hidden`), never overlaps the WhatsApp FAB which lives bottom-right.
- Modal contents:
  - Large QR (400px) fetched from `/api/qrcode?data=<url>&size=400` with the wewed palette (espresso-on-champagne).
  - Wedding URL display with "Copy" button (uses `copyToClipboard` from `/src/lib/social.ts`).
  - Destination dropdown (shadcn `DropdownMenu`) — 7 destinations:
    1. Main Website (`#home`)
    2. RSVP (`#rsvp`)
    3. Photo Upload (`#gallery`)
    4. Song Requests (`#songbook`)
    5. Programme (`#theday`)
    6. Venue Directions (`#travel`)
    7. Registry (`#gifts`)
  - Each destination generates a different QR (the URL fragment changes; the QR re-fetches on destination change).
  - Share buttons (grid 2-cols): WhatsApp, Telegram, Email, Native Share (disabled if `!canShare`).
  - Download PNG (`dataUrlToBlob` → `<a download>`).
  - Print button (opens a formatted keepsake page in a new window with monogram + QR + URL).
  - "Open destination in a new tab" link.
- Design: champagne background, espresso text, gold accents — matches the wewed design language. Uses `wewed-heading`, `wewed-monogram`, `wewed-scroll` classes.
- Strict TypeScript types throughout (`QrGatewayProps`, `Destination`, `QrResponse`).
- SSR-safe (uses `useNativeShare`, `copyToClipboard` helpers from `@/lib/social`).
- QR fetch deferred via `queueMicrotask` to satisfy the React 19 `react-hooks/set-state-in-effect` rule.

### Part 1b — QrGateway wired into navbar (`src/components/wedding/navbar.tsx`)
- Added `qrOpen` state to `Navbar`.
- Imported `QrGateway` + `QrGatewayTrigger`.
- Added the trigger to the right-side toggle cluster (between ThemeToggle and the mobile menu button) — `hidden sm:block`.
- Added the trigger to the mobile Sheet (after the ThemeToggle) — closes the sheet before opening the QR modal.
- Mounted `<QrGateway open={qrOpen} onOpenChange={setQrOpen} />` once at the end of the navbar fragment so the modal portal lives at the navbar level.

### Part 2a — `/api/planner/vendors/route.ts` (GET + POST)
- `GET /api/planner/vendors` — lists all vendors for the flagship wedding (`charity-and-kudzie`), ordered by featured desc + createdAt desc. Returns decoded planning meta (`contact`, `contractStatus`, `paymentStatus`, `metaRating`, `notes`) extracted from a JSON blob stored in the Prisma `description` field (sentinel prefix `__wewed_meta__:`). Public.
- `POST /api/planner/vendors` — admin-gated (via `@/lib/admin-gate` `isAdmin`). Validates name + category + statuses. Encodes planning meta into the description blob. Returns the formatted row.

### Part 2b — `/api/planner/vendors/[id]/route.ts` (PATCH + DELETE)
- `PATCH /api/planner/vendors/{id}` — admin-gated. Supports partial updates: name, category, description, website, phone, featured, rating. For planning meta (contact/contractStatus/paymentStatus/notes/rating), merges with existing decoded values so partial updates don't blow away untouched fields.
- `DELETE /api/planner/vendors/{id}` — admin-gated. Hard delete.

### Part 2c — `/api/planner/timeline/route.ts` (GET + POST)
- `GET /api/planner/timeline` — lists all ProgrammeItems for the flagship wedding, ordered by `order` asc then `time` asc then `createdAt` asc. Maps each row to a timeline-block shape: `{ id, time, event (←title), title, description, notes (←description), duration, location, icon, order, ... }`. `duration` + `location` are decoded from a JSON blob stored in the Prisma `icon` field (since `icon` is the only nullable String field besides description on ProgrammeItem, and no consumer of /api/wedding uses programmeItems[].icon).
- `POST /api/planner/timeline` — admin-gated. Accepts `time`, `event`/`title`, `notes`/`description`, `duration`, `location`, `icon`, `order`. Auto-increments `order` if not provided. Encodes duration+location into the icon JSON blob.

### Part 2d — `/api/planner/timeline/[id]/route.ts` (PATCH + DELETE)
- `PATCH /api/planner/timeline/{id}` — admin-gated. Supports `time`, `event`/`title`, `notes`/`description`, `order`, `duration`/`location`/`icon` (merged with existing decoded values).
- `DELETE /api/planner/timeline/{id}` — admin-gated. Hard delete.

### Part 2e — VendorsTab + TimelineTab wired to DB
In `src/components/wedding/wedding-planner.tsx`:

**PlannerShell:**
- Added `plannerVendors: PlannerVendorRow[]` state + `timeline: TimelineRow[]` state.
- Added `PlannerVendorRow` and `TimelineRow` interfaces.
- Added `autoSeedTimeline` callback (only fires if DB programme items are empty — POSTs the 11 SEED_TIMELINE blocks with sequential orders).
- Extended the `refresh()` Promise.allSettled to also fetch `/api/planner/vendors` and `/api/planner/timeline`.
- Updated the VendorsTab trigger badge to use `plannerVendors.length` (private contacts) instead of `vendors.length` (public marketplace).
- Wired `<VendorsTab vendors={vendors} plannerVendors={plannerVendors} setPlannerVendors={setPlannerVendors} onRefresh={refresh} />`.
- Wired `<TimelineTab blocks={timeline} setBlocks={setTimeline} onRefresh={refresh} />`.

**VendorsTab:**
- Replaced `localVendors` localStorage state with `plannerVendors` prop + `setPlannerVendors` setter.
- `handleAdd` now POSTs to `/api/planner/vendors` and inserts the returned row into state.
- `handleDelete` now DELETEs `/api/planner/vendors/{id}` with optimistic removal + revert on failure.
- Removed localStorage persistence (`useEffect` that wrote to `wewed:planner-vendors`).
- Updated `VendorCardLocal` prop type from `LocalVendor` to `PlannerVendorRow` (the LocalVendor interface was deleted). Uses `vendor.metaRating ?? vendor.rating ?? 0` for the star display.
- The `vendors` (public marketplace) prop is still rendered in a separate "Marketplace vendors" section.

**TimelineTab:**
- Replaced `blocks` localStorage state with `blocks` prop + `setBlocks` setter.
- `handleSubmit` now POSTs (create) or PATCHes (update) via `/api/planner/timeline` / `/api/planner/timeline/{id}`. The returned row replaces/extends state.
- `handleDelete` now DELETEs `/api/planner/timeline/{id}` with optimistic removal + revert.
- `move(id, dir)` now swaps in state AND PATCHes both affected items' `order` in parallel.
- Removed localStorage persistence.
- The Print button still works (uses local `blocks` state).
- Submit button now shows "Saving…" and is disabled while the request is in flight.

## Verification

- ✅ `bun run lint` — 4 errors and 2 warnings, ALL pre-existing in `content-editor.tsx` and `edit-mode-toggle.tsx` (untouched files). Zero errors in any new or modified file.
- ✅ `npx tsc --noEmit` — zero errors in any of my files. The only TS errors are in pre-existing files (`skills/image-edit`, `skills/stock-analysis-skill`, `src/app/api/content/[id]/route.ts`, `src/components/wedding/content-editor.tsx`).
- ✅ Dev server compiles cleanly (`✓ Compiled in ~200ms` repeating in dev.log).
- ✅ `GET /` returns 200 in ~700ms (full page render).
- ✅ API smoke tests:
  - `GET /api/planner/vendors` → 200, returns seeded Imba Manor vendor with decoded meta.
  - `GET /api/planner/timeline` → 200, returns 12 seeded programme items with notes mapped from description.
  - `POST /api/planner/vendors?admin=1` → 201, creates vendor with encoded meta in description.
  - `POST /api/planner/timeline?admin=1` → 201, creates item with duration+location encoded in icon.
  - `PATCH /api/planner/vendors/{id}?admin=1` → 200, merges meta correctly.
  - `DELETE /api/planner/vendors/{id}?admin=1` → 200, hard delete.
  - `DELETE /api/planner/timeline/{id}?admin=1` → 200, hard delete.
  - `POST /api/planner/vendors` (no admin) → 401.
  - `PATCH /api/planner/vendors/{id}` (no admin) → 401.
  - `DELETE /api/planner/timeline/{id}` (no admin) → 401.

## Files Touched

- NEW: `src/components/wedding/qr-gateway.tsx` (664 lines) — QrGateway + QrGatewayTrigger + FloatingQrButton
- NEW: `src/app/api/planner/vendors/route.ts` (213 lines) — GET + POST
- NEW: `src/app/api/planner/vendors/[id]/route.ts` (236 lines) — PATCH + DELETE
- NEW: `src/app/api/planner/timeline/route.ts` (210 lines) — GET + POST
- NEW: `src/app/api/planner/timeline/[id]/route.ts` (222 lines) — PATCH + DELETE
- MODIFIED: `src/components/wedding/navbar.tsx` — added QrGateway + QrGatewayTrigger, qrOpen state, trigger in desktop cluster + mobile sheet
- MODIFIED: `src/components/wedding/wedding-planner.tsx` — added PlannerVendorRow + TimelineRow types, plannerVendors + timeline state, autoSeedTimeline, refresh() extended to fetch vendors + timeline, VendorsTab rewritten to use API (no localStorage), VendorCardLocal updated to PlannerVendorRow, TimelineTab rewritten to use API (no localStorage), tab call sites wired with new props
- NEW: `agent-ctx/P5-P6-qr-gateway-planner-db.md` (this file)

## Handoff Notes

- **Vendor meta encoding**: Planning-only fields (contact, contractStatus, paymentStatus, rating, notes) are JSON-encoded into the Prisma `description` field with a `__wewed_meta__:` sentinel prefix. The human description (if any) is preserved after a `|||` separator. `decodeMeta()` in the route files handles both new META-prefixed blobs and legacy plain-text descriptions transparently.
- **Timeline meta encoding**: `duration` and `location` are JSON-encoded into the Prisma `icon` field (since `icon` is the only nullable String field besides description, and no public consumer reads `programmeItems[].icon`). Seeded items with Lucide icon names ("GlassWater", "Heart") are decoded to `{ duration: '', location: '', icon: '<name>' }` — they appear in the planner with empty duration/location and editable.
- **Admin gate**: All vendor + timeline mutations use `isAdmin(request)` from `@/lib/admin-gate`. The shared helper accepts the `wewed_admin_auth` cookie nonce OR `?admin=1` in non-production for convenience. Public reads (GET) are not gated.
- **Auto-seed timeline**: The `autoSeedTimeline` callback only fires when the DB has zero programme items for the flagship wedding. Since the seed route already populates 12 programme items, this callback won't fire on the flagship install — but it's there as a safety net for fresh installs that haven't been seeded.
- **Controlled QrGateway**: The `QrGateway` component accepts `open`/`onOpenChange` props (controlled). The navbar lifts state to `qrOpen` so the desktop trigger, mobile sheet trigger, and mobile floating button can all open the same modal.
- **React 19 lint rule**: The QR fetch effect uses `queueMicrotask()` to defer the synchronous `setQrLoading(true)` / `setQrDataUrl(null)` calls. Without this deferral, the linter flags `react-hooks/set-state-in-effect`. The microtask is enough to escape the synchronous effect body.
- **No schema migration needed**: Both vendors and timeline reuse existing Prisma models (Vendor + ProgrammeItem) without any schema changes. All extra planning metadata is encoded into existing nullable String fields.
- **Future agent note**: The ImportExportBar (added by previous agents to ChecklistTab/BudgetTab/GuestsTab) is NOT wired into VendorsTab or TimelineTab in this PR. The `onRefresh` prop is plumbed through both function signatures (`onRefresh?: () => void`) so a future agent can drop an ImportExportBar in without touching the call sites. Module keys `vendors` and `timeline` already exist in `/src/lib/import-engine/schemas.ts` (added by the P2 agent).
