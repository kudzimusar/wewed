# wewed — Project Status Assessment

> An honest, code-verified assessment of what is actually implemented,
> scaffolded, or missing. This document does NOT describe something as
> complete merely because files exist — each claim is verified against the
> actual source code.

---

## 1. Features Actually Implemented in Code

These features have working code that is wired into the UI and exercised by
the running application.

### Core wedding site (BEFORE mode)

| Feature | Verification |
|---------|-------------|
| Hero section with names, date, venue, countdown | ✅ `src/components/wedding/hero-section.tsx` — renders on `/`, countdown ticks live |
| Our Story (5 milestones + family portrait) | ✅ `src/components/wedding/our-story.tsx` — renders, data-driven via wedding content |
| The Venue (Imba Manor, image, features, directions) | ✅ `src/components/wedding/venue-section.tsx` |
| The Day (11 programme items, add-to-calendar, .ics download) | ✅ `src/components/wedding/the-day.tsx` + countdown-banner |
| RSVP form (name, attendance, meal, +1, kids, song request, message) | ✅ `src/components/wedding/rsvp-section.tsx` — POSTs to `/api/rsvp`, saves to DB |
| Travel & Stay (directions, hotels, shuttle, dress code) | ✅ `src/components/wedding/travel-stay.tsx` |
| Gift Registry (3 cards: honeymoon, foundation, store) | ✅ `src/components/wedding/gift-registry.tsx` |
| Songbook (26 songs, tabs, Spotify/Apple links, voting) | ✅ `src/components/wedding/songbook.tsx` + `songbook-enhanced.tsx` |
| Wedding Party (8 members, profile modals, kids highlighted) | ✅ `src/components/wedding/guests.tsx` + `bridal-profile-modal.tsx` |
| Cultural Guide (Shona traditions, cuisine, phrases accordion) | ✅ `src/components/wedding/guests.tsx` |
| Vendor Marketplace (4 vendors, contact links, apply CTA) | ✅ `src/components/wedding/vendor-marketplace.tsx` |
| QR Check-In (QR display, check-in button, confetti) | ✅ `src/components/wedding/qr-checkin.tsx` |
| Photo Gallery (8 sample photos, filter chips, lightbox) | ✅ `src/components/wedding/photo-gallery.tsx` — GETs from `/api/media` |
| Media Upload (file upload, caption, moment tag) | ✅ `src/components/wedding/media-upload.tsx` — POSTs to `/api/media` (local filesystem) |
| Memory Time Capsule (record button, sealed-until date) | ✅ `src/components/wedding/memory-capsule.tsx` |
| Live Wall (messages, applause, burst animation) | ✅ `src/components/wedding/live-wall.tsx` |
| Contribution Gallery (8 sample contributions, filter chips) | ✅ `src/components/wedding/contribution-gallery.tsx` |
| FAQ (8 questions, accordion) | ✅ `src/components/wedding/faq-section.tsx` |
| Share Section (editable message, ShareBar, WhatsApp CTA, QR, follow row) | ✅ `src/components/wedding/share-section.tsx` |
| Pricing (3 tiers: Free, Canon, Forever) | ✅ `src/components/wedding/pricing-section.tsx` |
| Platform Vision | ✅ `src/components/wedding/platform-vision.tsx` |
| Merch Teaser | ✅ `src/components/wedding/merch-teaser.tsx` |
| Footer (monogram, tagline, back-to-top, copyright) | ✅ `src/components/wedding/footer.tsx` |
| Navbar (6 primary links, BEFORE/AFTER toggle, PLAN, More dropdown, mobile sheet) | ✅ `src/components/wedding/navbar.tsx` — with scroll-spy active section highlighting |

### AFTER mode (memory)

| Feature | Verification |
|---------|-------------|
| After sections (recap, gallery, playback, guest wall, keepsakes) | ✅ `src/components/wedding/after-sections.tsx` — rendered when lifecycle = "after" |

### Interactive features (Tasks 16-23)

| Feature | Verification |
|---------|-------------|
| Scroll progress bar (top, gold gradient, spring-smoothed) | ✅ `src/components/wedding/scroll-progress.tsx` — wired in `layout.tsx` |
| Back-to-top floating button | ✅ Same file — appears after 600px scroll |
| Ambient music player (Web Audio API, drone + bells) | ✅ `src/components/wedding/ambient-music-player.tsx` — wired in `layout.tsx` |
| Section tracker chip (shows current section + reading %) | ✅ `src/components/wedding/section-tracker.tsx` — wired in `layout.tsx` |
| Keyboard section navigation (↑/↓/Home/End) | ✅ `src/components/wedding/keyboard-section-nav.tsx` — wired in `layout.tsx` |
| Keyboard shortcuts help overlay (? key + floating button) | ✅ `src/components/wedding/keyboard-shortcuts-help.tsx` — wired in `layout.tsx` |
| Skip-to-content link (accessibility) | ✅ `src/components/wedding/skip-to-content.tsx` — wired in `layout.tsx` |
| Help tour (non-blocking hint pill + on-demand modal) | ✅ `src/components/wedding/help-popups.tsx` — wired in `layout.tsx` |
| Section eyebrows (10 sections with gold label accents) | ✅ `src/components/wedding/section-eyebrow.tsx` — applied in 7 section components |
| Print stylesheet (hides UI, page breaks, print-only header/footer) | ✅ `src/app/globals.css` `@media print` block + `page.tsx` print-only elements |
| Per-couple theming (CSS variables from Wedding model) | ✅ `src/components/wedding/theme-applier.tsx` |
| Multi-couple data layer (WeddingContent model, onboarding, seed) | ✅ `src/lib/wedding-data.ts` + `src/components/wedding/wedding-data-provider.tsx` |
| Onboarding wizard (4-step couple creation) | ✅ `src/components/wedding/onboarding-wizard.tsx` |

### Admin / couple tools

| Feature | Verification |
|---------|-------------|
| Couple login (hardcoded password `wewed-admin-2026`) | ✅ `src/components/wedding/couple-login.tsx` + `src/lib/admin-auth.ts` |
| Inline content editing (26 pencil icons, localStorage) | ✅ `src/components/wedding/inline-edit-button.tsx` + `src/lib/inline-content.ts` — 21 components use it |
| Wedding planner dashboard (8 tabs: checklist, budget, vendors, guests, timeline, seating, import/export, AI) | ✅ `src/components/wedding/wedding-planner.tsx` |
| Admin dashboard (6 tabs: overview, RSVPs, songs, messages, ceremony, contributions) | ✅ `src/components/wedding/admin-dashboard.tsx` |
| AI planner assistant | ✅ `src/components/wedding/ai-planner-assistant.tsx` |
| AI chat | ✅ `src/components/wedding/ai-assistant.tsx` + `/api/ai/chat` |
| Progress tracker | ✅ `src/components/wedding/progress-trigger.tsx` |
| Import/export engine (CSV/Excel) | ✅ `src/lib/import-engine/` + `/api/imports` + `/api/exports` |
| Royalty dashboard | ✅ `src/components/wedding/royalty-dashboard.tsx` + `/api/royalty/*` |
| Telegram bot widget | ✅ `src/components/wedding/telegram-widget.tsx` + `/api/telegram` |

### Mini-services

| Feature | Verification |
|---------|-------------|
| Socket.io live service (song votes, live wall, applause) | ✅ `mini-services/wewed-live/index.ts` — runs on port 3003 |

---

## 2. Features Only Documented or Scaffolded (NOT wired to UI)

These features have code files and/or API routes, but are NOT connected to
the user-facing UI. They exist as infrastructure waiting for integration.

### Supabase Auth — API built, NO UI

| What exists | What's missing |
|-------------|----------------|
| `POST /api/auth/signup` — creates Supabase user + UserProfile | No signup form component. No link to trigger signup. |
| `POST /api/auth/signin` — Supabase password signin | No signin form component. The existing `couple-login.tsx` uses the old hardcoded password, NOT this API. |
| `POST /api/auth/signout` — Supabase signout | No signout button wired to this API. |
| `GET /api/auth/me` — returns current user profile | Not called by any component on mount. No auth context provider. |

**Status:** The auth APIs are fully built and compile cleanly, but no user
can actually sign up or sign in because there is no UI that calls them.

### Comments — API built, NO UI

| What exists | What's missing |
|-------------|----------------|
| `GET /api/comments?targetType=media&targetId=xxx` — list comments | No comment list component on any photo, contribution, or song. |
| `POST /api/comments` — post a comment (auth-required) | No comment form component. No "add comment" button anywhere. |

**Status:** The comments API is fully built, but no user can post or view
comments because there is no comment UI.

### DB-backed content editing — hook built, NOT wired

| What exists | What's missing |
|-------------|----------------|
| `src/lib/inline-content-db.ts` — `useInlineContentDB` hook that saves to DB via `/api/wedding-content` POST | 21 components still import and use `useInlineContent` (localStorage-only) instead. Zero components import `useInlineContentDB`. |

**Status:** The DB-backed hook exists and is backward-compatible with the
old hook's signature, but no component has been switched to use it. All
inline content edits are still saved to browser localStorage only.

### Supabase Storage — helper built, NOT wired

| What exists | What's missing |
|-------------|----------------|
| `src/lib/supabase/storage.ts` — `uploadToSupabaseStorage()`, `isSupabaseStorageConfigured()` | The media upload route (`/api/media` POST) does NOT import or call these functions. It still uses `fs.writeFile` to save to `public/uploads/`. |

**Status:** The Storage helper exists, but photo uploads still go to the
local filesystem. Supabase Storage is not used by any route or component.

### User profiles — model exists, NO profile UI

| What exists | What's missing |
|-------------|----------------|
| `UserProfile` model in Prisma schema (id, email, displayName, avatarUrl, bio, role, coupleId) | No profile page, no profile editing form, no avatar upload. |

**Status:** The data model is ready, but users cannot view or edit their
profile.

---

## 3. Supabase Migration Status (Exact)

### What is done

1. ✅ Supabase packages installed: `@supabase/supabase-js@2.110.8`, `@supabase/ssr@0.12.3`
2. ✅ Supabase client libraries created:
   - `src/lib/supabase/client.ts` (browser)
   - `src/lib/supabase/server.ts` (server, with `getCurrentUser()`)
   - `src/lib/supabase/storage.ts` (upload helper)
3. ✅ Prisma schema updated with `UserProfile` and `Comment` models
4. ✅ `userId` field added to `MediaItem` and `Message` (links to `UserProfile`)
5. ✅ Auth API routes created: signup, signin, signout, me
6. ✅ Comments API route created: GET (public), POST (auth-required)
7. ✅ DB-backed content hook created: `useInlineContentDB`
8. ✅ Setup guide written: `SUPABASE_SETUP.md` (9 sections)

### What is NOT done

1. ❌ **Prisma `provider` is still `"sqlite"`** — not switched to `"postgresql"`.
   The schema has comments documenting how to switch, but the actual
   `provider = "postgresql"` change has not been made.
2. ❌ **No Supabase project exists** — no `NEXT_PUBLIC_SUPABASE_URL` or
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
3. ❌ **No Supabase Storage bucket created** — the `wedding-media` bucket
   does not exist (would need to be created in the Supabase dashboard).
4. ❌ **Media route does NOT use Supabase Storage** — still uses
   `fs.writeFile` to `public/uploads/`.
5. ❌ **`useInlineContentDB` is NOT imported by any component** — 21
   components still use the localStorage-only `useInlineContent`.
6. ❌ **No auth UI** — no signup/signin forms. The couple login still uses
   the hardcoded password.
7. ❌ **No comment UI** — no comment components on any page.
8. ❌ **No profile UI** — no profile page or editing form.
9. ❌ **No data migration performed** — the SQLite `db/custom.db` data has
   not been migrated to PostgreSQL (no PostgreSQL DB exists yet).

### SQLite-to-PostgreSQL migration status

**NOT STARTED.** The Prisma schema is PostgreSQL-compatible (all field types
work in both SQLite and PostgreSQL). The migration would require:
1. Create a Supabase project (get PostgreSQL connection string)
2. Change `provider = "sqlite"` → `"postgresql"` in `prisma/schema.prisma`
3. Set `DATABASE_URL` to the Supabase connection string
4. Run `bun run db:push` to create all tables in PostgreSQL
5. Re-seed the flagship wedding data via `/api/seed` and `/api/wedding-content/seed`

None of these steps have been performed.

---

## 4. Known Errors, Failing Tests, Incomplete Routes, TODOs, Mocked Functionality

### Tests

**No tests exist.** There are no `*.test.ts`, `*.spec.ts`, or `__tests__/`
directories in `src/`. The `package.json` has no `test` script. No testing
framework is configured.

### Known TODOs in source code

| File | Line | TODO |
|------|------|------|
| `src/lib/admin-gate.ts` | 55 | `// TODO: Phase 6 — check role-based permissions via session` |
| `src/lib/inline-content-db.ts` | 29 | `// TODO: make dynamic per-couple` (WEDDING_SLUG hardcoded) |
| `src/app/api/comments/route.ts` | 19 | `// TODO: make dynamic per-couple` (WEDDING_SLUG hardcoded) |
| `src/app/api/royalty/webhook/route.ts` | 27 | `// TODO: future task — for registered partner record` |

### Mocked / sample / placeholder data

| File | What's mocked |
|------|---------------|
| `src/app/api/media/route.ts` | 6 hardcoded `SAMPLE_MEDIA` entries returned as fallback before real photos exist |
| `src/app/api/messages/route.ts` | Sample messages (verified by grep for "sample") |
| `src/app/api/seed/route.ts` | Seed data (intentional — this IS the seeder) |
| `src/app/api/contributions/route.ts` | Sample contributions |
| `src/lib/bridal-party-data.ts` | Hardcoded bridal party members (8 people with names, roles, sides) |
| `src/lib/social.ts` | Social platform config (intentional config, not mock) |
| `src/components/wedding/ai-planner-assistant.tsx` | AI responses (uses `z-ai-web-dev-sdk`) |
| `src/components/wedding/admin-dashboard.tsx` | Admin data display |
| `src/components/wedding/telegram-widget.tsx` | Telegram widget |

### Incomplete / partially integrated features

| Feature | What works | What's incomplete |
|---------|------------|-------------------|
| Inline content editing | Edits save to localStorage, display correctly | Does NOT save to DB (the DB hook exists but isn't wired) |
| Media upload | Files upload to local filesystem, display in gallery | Does NOT use Supabase Storage (helper exists but isn't called) |
| User accounts | Auth APIs exist (signup/signin/signout/me) | No UI calls them; no user can actually sign up |
| Comments | API exists (GET/POST) | No UI displays or posts comments |
| User profiles | Model exists in schema | No profile page or editing UI |
| NextAuth.js | Installed in `package.json` | NOT used anywhere (only referenced in comments as "Phase 5") |
| Prisma migrations | Schema is valid | No `migrations/` directory; uses `db:push` only |
| Per-couple theming for ambient music | Documented in worklog | Not implemented |

### Known runtime issues (from worklog)

| Issue | Status | Source |
|-------|--------|--------|
| Turbopack HMR cache staleness | Intermittent dev-only | Worklog Tasks 18, 23 — client DOM may show fewer elements than SSR HTML until cache is cleared |
| Dev server process persistence | Resolved (double-fork pattern) | Worklog Task 19 — server was dying between bash calls; fixed with `nohup setsid` |
| Hydration mismatch in ShareSection | Resolved | Worklog Task 18 — `useNativeShare` hook fixed to use `useState` + `useEffect` |
| HelpPopups auto-show blocking modal | Resolved | Worklog Task 17 — replaced with non-blocking hint pill |

### Failing tests

**N/A** — no tests exist to fail.

### Failing routes

No routes are known to fail. All API routes return 200 in the dev log during
the export operation. The dev server is running and serving HTTP 200 on `/`.

---

## 5. Exact Supabase Migration Status

| Step | Status |
|------|--------|
| 1. Install Supabase packages | ✅ DONE |
| 2. Create Supabase client libraries | ✅ DONE |
| 3. Add UserProfile + Comment models to Prisma | ✅ DONE |
| 4. Add userId to MediaItem + Message | ✅ DONE |
| 5. Create auth API routes | ✅ DONE |
| 6. Create comments API route | ✅ DONE |
| 7. Create DB-backed content hook | ✅ DONE |
| 8. Write setup guide | ✅ DONE |
| 9. Create Supabase project | ❌ NOT DONE (user action required) |
| 10. Set env vars | ❌ NOT DONE |
| 11. Switch Prisma to postgresql | ❌ NOT DONE |
| 12. Run db:push against PostgreSQL | ❌ NOT DONE |
| 13. Create Storage bucket | ❌ NOT DONE |
| 14. Wire media route to Supabase Storage | ❌ NOT DONE |
| 15. Wire useInlineContentDB into components | ❌ NOT DONE |
| 16. Build login/signup UI | ❌ NOT DONE |
| 17. Build comment UI | ❌ NOT DONE |
| 18. Build profile UI | ❌ NOT DONE |
| 19. Migrate SQLite data to PostgreSQL | ❌ NOT DONE |

**Summary:** Steps 1-8 (infrastructure) are DONE. Steps 9-19 (connection +
UI integration) are NOT DONE. The Supabase integration is ~40% complete
(infrastructure built, connection + UI pending).

---

## 6. SQLite-to-PostgreSQL Migration Status

**NOT STARTED.**

- Prisma `provider` = `"sqlite"` (unchanged)
- `DATABASE_URL` in `.env` points to `file:/home/z/my-project/db/custom.db` (SQLite)
- No PostgreSQL connection string exists in any env file
- No `prisma/migrations/` directory (project uses `db:push`, not `migrate`)
- The `db/custom.db` SQLite file (487 KB) contains seeded data that would
  need to be re-seeded into PostgreSQL after migration

The schema is PostgreSQL-compatible. Migration would be straightforward
(change provider, set connection string, run `db:push`, re-seed) but has
not been performed.

---

## 7. Whether Supabase Storage Is Actually Used by the Media Route

**NO.** The media upload route (`src/app/api/media/route.ts`) does NOT use
Supabase Storage.

Verified by grep:
```
src/app/api/media/route.ts:
  line 9:   const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
  line 223: await fs.mkdir(UPLOAD_DIR, { recursive: true });
  line 227: const filepath = path.join(UPLOAD_DIR, filename);
  line 231: await fs.writeFile(filepath, buffer);
```

The route imports `fs` and `path` (Node.js filesystem modules) and writes
files directly to `public/uploads/`. It does NOT import
`uploadToSupabaseStorage` or `isSupabaseStorageConfigured` from
`src/lib/supabase/storage.ts`.

The Supabase Storage helper exists but is dead code (not called by any
route or component).

---

## 8. Whether DB-Backed Inline Content Is Actually Wired into the UI

**NO.** The `useInlineContentDB` hook is NOT imported by any component.

Verified by grep:
```
grep -rn "useInlineContentDB" src/components/ → (no results)
```

21 components still import and use the localStorage-only `useInlineContent`
hook from `src/lib/inline-content.ts`. Zero components use the new
`useInlineContentDB` from `src/lib/inline-content-db.ts`.

All inline content edits (the couple's pencil-icon edits to names, stories,
dates, etc.) are saved to browser localStorage only. They are NOT persisted
to the database. If the couple clears their browser data or switches
devices, all edits are lost.

The DB-backed hook exists and has the same API signature as the old hook
(`[value, setValue, reset]`), so switching is a one-line import change per
component — but this switch has not been performed.

---

## 9. Whether Signup, Signin, Signout, Profile, and Comments Flows Are Exercised by Tests

**NO TESTS EXIST.**

- No `*.test.ts` or `*.spec.ts` files in `src/`
- No `__tests__/` directory
- No `test` script in `package.json`
- No testing framework (Jest, Vitest, Playwright, etc.) installed or configured

None of the following flows are exercised by any test:

| Flow | API exists? | UI exists? | Tested? |
|------|------------|-----------|---------|
| Signup | ✅ `POST /api/auth/signup` | ❌ No signup form | ❌ No tests |
| Signin | ✅ `POST /api/auth/signin` | ❌ No signin form (couple login uses old hardcoded password) | ❌ No tests |
| Signout | ✅ `POST /api/auth/signout` | ❌ No signout button | ❌ No tests |
| Profile | ✅ `GET /api/auth/me` | ❌ No profile page | ❌ No tests |
| Comments | ✅ `GET/POST /api/comments` | ❌ No comment UI | ❌ No tests |

**No auth flow, profile flow, or comment flow can be exercised by a user**
because no UI components call these APIs. And even if they could, there are
no tests to verify correctness.

---

## 10. Summary Assessment

### What's production-ready

The **wedding website itself** (the guest-facing experience) is fully
functional:
- All 22+ sections render correctly
- RSVP, songbook voting, QR check-in, photo gallery, media upload, live wall,
  contribution gallery all work
- The couple can log in (hardcoded password) and edit content inline
  (localStorage only)
- The planner and admin dashboards work
- Print stylesheet, keyboard nav, scroll progress, ambient music, section
  tracker all work
- Multi-couple data layer is architecturally sound

### What's NOT production-ready

The **backend infrastructure** for a real multi-user platform is scaffolded
but not connected:

1. **No persistent database** — still on SQLite (local file). Need Supabase
   PostgreSQL.
2. **No persistent content edits** — saved to localStorage, not DB. The
   DB hook exists but isn't wired.
3. **No persistent photo storage** — saved to local filesystem. The Supabase
   Storage helper exists but isn't wired.
4. **No user accounts** — auth APIs exist but no UI calls them. Only the
   hardcoded couple password works.
5. **No comments** — API exists but no UI.
6. **No profiles** — model exists but no UI.
7. **No tests** — zero test coverage.

### To reach production

The user needs to (in priority order):
1. Create a Supabase project and set env vars (see `SUPABASE_SETUP.md`)
2. Switch Prisma to PostgreSQL and run `db:push`
3. Wire `useInlineContentDB` into the 21 components (replace `useInlineContent`)
4. Wire the media route to use `uploadToSupabaseStorage`
5. Build login/signup UI components
6. Build comment UI components
7. Build profile UI
8. Write tests

The infrastructure code for steps 1-7 is already written. The remaining work
is UI integration and env configuration.

---

*This assessment was verified by direct source code inspection during the
export operation. No claim of completion is made based solely on file
existence — each feature was checked for actual wiring to the UI or API.*
