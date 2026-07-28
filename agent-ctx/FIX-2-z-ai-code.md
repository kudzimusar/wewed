# Task FIX-2 — wewed: 3 fixes (navbar toggle, after-sections gallery, inline editing)

**Agent:** Z.ai Code
**Task ID:** FIX-2
**Status:** ✅ Complete — lint clean, tsc clean for project files

## Scope
Fix three issues reported by the user on the wewed wedding website:
1. Restore the BEFORE|AFTER toggle to a visible spot in the navbar (it had been moved into the "More" dropdown).
2. Ensure the gallery in `after-sections.tsx` NEVER shows a "Failed to fetch" / error state.
3. Add an inline-editing system so the couple can edit home-page content (names, date, venue, milestones, etc.) directly from the public site when they're logged in.

## Files Touched

### Modified
- `src/components/wedding/navbar.tsx` — moved `<BeforeAfterToggle />` out of the More dropdown into the right cluster, between the PLAN button and the More dropdown. Hidden on mobile (`hidden sm:block`), still rendered in the mobile Sheet. The More dropdown still contains secondary links, QR & Share, Theme toggle, Language toggle, and Logout (when admin).
- `src/components/wedding/after-sections.tsx` — confirmed no fetch calls and no error states exist (verified via grep). Removed unused `Filter` and `ChevronDown` imports. Upgraded the placeholder gallery to render real sample images (`/hero-wedding.png`, `/couple-silhouette.png`, `/ornament-frame.png`, `/icon-512.png`) with phase badges and hover captions, plus a defensive filter fallback so the grid is never empty. Added a doc-comment block making the "no fetch / no error" guarantee explicit.
- `src/components/wedding/our-story.tsx` — added `InlineEditButton` + `useInlineContent` to: section heading, section subtitle, every milestone title (5), every milestone body (5), family-portrait title, family-portrait names. Edits persist in localStorage and update the display instantly via the `wewed:content-change` event.
- `src/components/wedding/the-day.tsx` — added `InlineEditButton` + `useInlineContent` to: section heading, date/venue line, venue name, venue location, venue description, dress code, dress code note.
- `src/components/wedding/hero-section.tsx` — added `InlineEditButton` + `useInlineContent` to: bride's name, groom's name, wedding date, venue line, tagline. Pencil icons appear next to the names/date/venue only when `editMode === true` in the Zustand store.

### New
- `src/lib/inline-content.ts` — localStorage-backed inline content layer.
  - `getInlineContent(section, field): string`
  - `setInlineContent(section, field, value): void` (dispatches a `wewed:content-change` CustomEvent)
  - `clearInlineContent(section, field): void`
  - `useInlineContent(section, field, defaultValue)` hook returning `[value, setValue, reset]`
  - Keys: `wewed:content:{section}:{field}`
  - SSR-safe: initial state is `defaultValue` (same on server & client → no hydration mismatch); syncs from localStorage in a `useEffect` after mount.
  - Cross-component sync via CustomEvent so an edit in the InlineEditButton dialog updates the display instantly without a page reload.
- `src/components/wedding/inline-edit-button.tsx` — the pencil button + Dialog.
  - Reads `editMode` from `useWewedStore`; renders `null` when OFF.
  - Click → Dialog with `<Textarea>` pre-filled from localStorage (or `defaultValue`).
  - Save → `setInlineContent` + toast. Reset → `clearInlineContent` + toast. Cancel → close.
  - Props: `{ section, field, label, defaultValue?, size?, className? }` (matches spec; optional `defaultValue`/`size`/`className` are additive enhancements).
  - Uses Lucide `Pencil`, `Save`, `X`, `RotateCcw` icons and shadcn `Dialog`, `Button`, `Textarea`.

## Verification
- `bun run lint` → 0 errors, 0 warnings
- `npx tsc --noEmit` → 0 errors in `src/` (only pre-existing errors in `skills/` directory which is out of scope)
- Dev server (`bun run dev`) already running on port 3000, healthy
- `grep -n "fetch|error|catch|setError"` in `after-sections.tsx` → 0 matches (confirms no fetch/error code path)

## How it works end-to-end
1. Couple opens the site. The bottom-left CoupleLogin button is visible.
2. They click it, enter the password (`wewed-admin-2026`), and `verifyAdmin()` succeeds. `setAdminLoggedIn()` writes the cookie, `setEditMode(true)` flips the Zustand `editMode` flag (persisted to localStorage so it survives refreshes).
3. Every `<InlineEditButton>` across hero/our-story/the-day re-renders (Zustand subscription) and now renders its pencil button.
4. Couple clicks a pencil → Dialog opens, pre-filled with the current edited value (or original copy if never edited).
5. They edit the text and click Save → `setInlineContent(section, field, value)` writes to `localStorage["wewed:content:{section}:{field}"]` and dispatches `wewed:content-change`.
6. Every component using `useInlineContent(section, field, defaultValue)` for that exact (section, field) pair receives the event, updates its local state, and re-renders with the new text. No reload needed.
7. On page refresh, `useInlineContent` initialises to `defaultValue` (SSR-safe) then syncs from localStorage in `useEffect` — the edited text reappears.
8. Edit mode can be toggled off (the gold "Editing" pill at bottom-left), at which point all pencils disappear and the public site shows the edited content normally.
9. Reset to original: in the dialog, click "Reset to original" — clears localStorage for that field and restores the hardcoded default.

## Notes / Handoff
- The `defaultValue` prop on `InlineEditButton` is optional but recommended — without it the textarea opens empty when no edit has been made. All current call sites pass it.
- All edits are stored per-browser in localStorage. This is MVP-correct per the task spec ("saves to localStorage, simple, no backend needed for MVP"). A future agent could mirror edits to the `ContentRevision` Prisma model that already exists from the incremental-upgrade phase.
- The `useInlineContent` hook initialises to `defaultValue` to avoid SSR hydration mismatch, then syncs from localStorage after mount. This causes a brief flash from default → edited value on first paint when an edit exists. This is acceptable for an MVP and avoids hydration errors.
- The `eslint-disable-next-line react-hooks/set-state-in-effect` comments are intentional — reading from localStorage in `useEffect` and updating state is the canonical SSR-safe persistence pattern (same pattern used by `couple-login.tsx` for `setLoggedIn`).
