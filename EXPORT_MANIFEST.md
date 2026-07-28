# wewed — Export Manifest

> Generated during the export/handoff operation from the Z.AI workspace to the
> private GitHub repository `https://github.com/kudzimusar/wewed.git`.
> This document is a point-in-time snapshot of the application baseline.

---

## 1. Pre-Export Repository State

| Field | Value |
|-------|-------|
| Project root | `/home/z/my-project` |
| Branch (before export) | `main` |
| Commit SHA (before export) | `6c2c7e532c7d1fb50fcec05ca245f9e58f9c35e4` |
| Remotes (before export) | none configured |
| Tracked files (before export) | 391 |
| Modified files (unstaged) | 12 |
| Untracked files | 0 |
| Git history | Preserved (multiple prior commits, oldest = `2c6527e deploy: fresh build for new deployment link`) |

### Modified files (unstaged at export time)

- `.zscripts/dev.pid` (runtime PID file — will be untracked)
- `SUPABASE_SETUP.md`
- `bun.lock`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/signin/route.ts`
- `src/app/api/auth/signout/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/comments/route.ts`
- `src/lib/inline-content-db.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/storage.ts`

### Previously ignored project files that matter

The `.gitignore` excludes the following categories. Some of these were tracked
before the ignore rules were added and are untracked during this export (see
§7 below):

- `.env*` (all env files — `.env` was tracked, now untracked)
- `db/*.db`, `db/*.db-journal`, `prisma/*.db` (SQLite local dev databases — `db/custom.db` was tracked, now untracked)
- `upload/` (runtime uploads — 8 files were tracked, now untracked)
- `public/uploads/` (runtime media uploads — directory does not exist)
- `tool-results/` (scratch/debug output — 44 files were tracked, now untracked)
- `.next/`, `node_modules`, `/build`, `/out` (build artifacts)
- `*.log`, `dev.log`, `server.log` (logs)
- `/coverage` (test coverage)
- `.DS_Store`, `*.pem` (misc)
- `local-*`, `.claude`, `.z-ai-config` (workspace-specific)
- `/skills/` (Z.AI skills directory)

---

## 2. Framework and Exact Versions

| Component | Version | Source |
|-----------|---------|--------|
| Next.js | `^16.1.1` (installed 16.1.3) | `package.json` |
| React | `^19.0.0` | `package.json` |
| TypeScript | `^5` | `package.json` |
| Tailwind CSS | `^4` | `package.json` |
| Prisma | `^6.11.1` (installed 6.19.2) | `package.json` |
| `@prisma/client` | `^6.11.1` | `package.json` |
| NextAuth.js | `^4.24.11` (installed but NOT used — see PROJECT_STATUS.md) | `package.json` |
| `@supabase/supabase-js` | `^2.110.8` | `package.json` |
| `@supabase/ssr` | `^0.12.3` | `package.json` |
| framer-motion | `^12.23.2` | `package.json` |
| zustand | `^5.0.6` | `package.json` |
| `@tanstack/react-query` | `^5.82.0` | `package.json` |
| next-intl | `^4.3.4` | `package.json` |
| next-themes | `^0.4.6` | `package.json` |
| socket.io / socket.io-client | `^4.8.3` | `package.json` |
| zod | `^4.0.2` | `package.json` |
| eslint | `^9` | `package.json` |
| `eslint-config-next` | `^16.1.1` | `package.json` |
| sharp | `^0.34.3` | `package.json` |
| qrcode | `^1.5.4` | `package.json` |
| xlsx | `^0.18.5` | `package.json` |
| `z-ai-web-dev-sdk` | `^0.0.18` | `package.json` |

### Runtime tool versions

| Tool | Version |
|------|---------|
| Bun | `1.3.14` |
| Node.js | `v24.18.0` |

---

## 3. Package Manager

**Bun** (`bun.lock` present, `bun --version` = `1.3.14`).

The `bun.lock` file is a JSON-format lockfile (342 KB). It is preserved and
committed. No `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` exists.

### Available scripts (`package.json` → `scripts`)

| Script | Command |
|--------|---------|
| `dev` | `next dev -p 3000 2>&1 \| tee dev.log` |
| `build` | `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/` |
| `start` | `NODE_ENV=production bun .next/standalone/server.js 2>&1 \| tee server.log` |
| `lint` | `eslint .` |
| `db:push` | `prisma db push` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:reset` | `prisma migrate reset` |

**Note:** There is no `test` script and no `typecheck` script. See §6 for
validation results.

---

## 4. High-Level Directory Structure

```
/home/z/my-project/
├── .env                          # SECRET — untracked during export (was tracked)
├── .env.example                  # Created during export (variable names only)
├── .gitignore                    # Updated during export
├── .zscripts/                    # Z.AI workspace dev scripts (7 files)
│   ├── build.sh
│   ├── dev.log                   # runtime log (untracked)
│   ├── dev.pid                   # runtime PID (untracked)
│   ├── dev.sh
│   ├── mini-service-wewed-live.log  # runtime log (untracked)
│   ├── mini-services-build.sh
│   ├── mini-services-install.sh
│   ├── mini-services-start.sh
│   └── start.sh
├── Caddyfile                     # Gateway config (port 81 → 3000)
├── EXPORT_MANIFEST.md            # This file
├── PROJECT_STATUS.md             # Application status assessment
├── SUPABASE_SETUP.md             # 9-section Supabase setup guide
├── USER_MANUAL.md                # End-user guide
├── agent-ctx/                    # Agent context documents (14 .md files)
├── bun.lock                      # Bun lockfile (preserved)
├── components.json               # shadcn/ui config
├── db/                           # SQLite local dev database
│   └── custom.db                 # RUNTIME DATA — untracked (was tracked)
├── download/                     # QA screenshots (67 PNG files, tracked)
├── eslint.config.mjs
├── examples/                     # WebSocket demo (frontend.tsx, server.ts)
├── mini-services/                # Socket.io live service
│   ├── .gitkeep
│   └── wewed-live/
│       ├── bun.lock
│       ├── index.ts
│       └── package.json
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── prisma/
│   └── schema.prisma             # 25+ models, provider = "sqlite" (→ "postgresql" for prod)
├── public/                       # Application-owned static assets (9 files, tracked)
│   ├── couple-silhouette.png
│   ├── hero-wedding.png
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── logo.svg
│   ├── manifest.json
│   ├── ornament-frame.png
│   ├── robots.txt
│   └── sw.js
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page (only user-visible route)
│   │   ├── globals.css           # Global styles + print stylesheet
│   │   └── api/                  # 50+ API route files (see §5)
│   ├── components/
│   │   ├── ui/                   # 48 shadcn/ui components
│   │   └── wedding/              # 78 wewed-specific components
│   ├── hooks/                    # 2 custom hooks
│   └── lib/                      # 18 lib files (see §6-8)
├── tailwind.config.ts
├── tool-results/                 # SCRATCH — untracked (44 files were tracked)
├── tsconfig.json
├── upload/                       # RUNTIME uploads — untracked (8 files were tracked)
└── worklog.md                    # 4,378-line development worklog
```

---

## 5. Application Routes and API Routes

### User-visible pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Single-page wedding site (all sections rendered here) |

Only `/` is a user-visible route. All other functionality is on this single
page (sections, modals, dashboards, planners).

### API routes (50+ route files)

| Path | Method(s) | Purpose |
|------|-----------|---------|
| `/api` | GET | API health/root |
| `/api/ai/chat` | POST | AI assistant chat |
| `/api/ai/speech` | POST | AI speech synthesis |
| `/api/ai/summary` | POST | AI summary generation |
| `/api/auth/signup` | POST | Supabase user signup + UserProfile creation |
| `/api/auth/signin` | POST | Supabase user signin |
| `/api/auth/signout` | POST | Supabase user signout |
| `/api/auth/me` | GET | Current user profile |
| `/api/comments` | GET, POST | Comments (list public, post auth-required) |
| `/api/content` | GET, POST | Content revisions (admin-gated) |
| `/api/content/[id]` | GET, PUT, DELETE | Single content revision |
| `/api/content/[id]/restore` | POST | Restore a content revision |
| `/api/contribute` | POST | Guest contribution submission |
| `/api/contributions` | GET, POST | Contributions list/create |
| `/api/contributions/[id]` | GET, PUT, DELETE | Single contribution |
| `/api/contributions/public` | GET | Public contributions |
| `/api/exports` | GET | Data export |
| `/api/imports` | POST | Data import (preview/execute) |
| `/api/imports/[jobId]` | GET, DELETE | Import job status/rollback |
| `/api/media` | GET, POST | Media list (GET) + upload (POST, local filesystem) |
| `/api/media/[id]` | GET, DELETE | Single media item |
| `/api/messages` | GET, POST | Wall/capsule messages |
| `/api/onboarding` | POST | New couple + wedding + seed creation |
| `/api/planner/budget` | GET, POST | Budget items |
| `/api/planner/budget/[id]` | GET, PUT, DELETE | Single budget item |
| `/api/planner/guests` | GET, POST | Guests |
| `/api/planner/guests/[id]` | GET, PUT, DELETE | Single guest |
| `/api/planner/tasks` | GET, POST | Planner tasks |
| `/api/planner/tasks/[id]` | GET, PUT, DELETE | Single task |
| `/api/planner/timeline` | GET, POST | Timeline blocks |
| `/api/planner/timeline/[id]` | GET, PUT, DELETE | Single timeline block |
| `/api/planner/vendors` | GET, POST | Vendors |
| `/api/planner/vendors/[id]` | GET, PUT, DELETE | Single vendor |
| `/api/privacy` | GET, POST | Privacy settings |
| `/api/privacy/verify-token` | POST | Token verification |
| `/api/qrcode` | GET | QR code generation |
| `/api/royalty` | GET | Royalty dashboard |
| `/api/royalty/dispute` | POST | Dispute filing |
| `/api/royalty/ledger` | GET, POST | Royalty ledger |
| `/api/royalty/ledger/[id]` | GET | Single ledger entry |
| `/api/royalty/payout` | POST | Payout request |
| `/api/royalty/payout-account` | GET, POST | Payout account setup |
| `/api/royalty/preferences` | GET, POST | Royalty preferences |
| `/api/royalty/revenue-event` | POST | Revenue event |
| `/api/royalty/webhook` | POST | Webhook handler |
| `/api/rsvp` | POST | RSVP submission |
| `/api/rsvp/[token]` | GET | RSVP by token |
| `/api/seed` | POST | Seed flagship wedding data |
| `/api/songs` | GET, POST | Songs list/request |
| `/api/songs/[id]/vote` | POST | Vote for a song |
| `/api/telegram` | GET, POST | Telegram bot integration |
| `/api/templates` | GET | Import templates |
| `/api/wedding` | GET | Wedding info |
| `/api/wedding-content` | GET, POST | Multi-couple content (GET public, POST admin) |
| `/api/wedding-content/seed` | POST | Seed content for a wedding |

---

## 6. Database and Prisma Files

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | 24 KB, 25+ models. Current `provider = "sqlite"`. Documented instructions to switch to `"postgresql"` for Supabase. |
| `prisma/migrations/` | **Does NOT exist.** The project uses `prisma db push` (schema push) exclusively — no migration history. |

### Prisma models (25+)

`Couple`, `Wedding`, `Guest`, `RSVP`, `Song`, `MediaItem`, `Message`, `Product`,
`Vendor`, `ProgrammeItem`, `Kid`, `PlannerTask`, `BudgetItem`, `SeatingTable`,
`User`, `ImportJob`, `ContentRevision`, `ContentSubmission`, `AuditEvent`,
`GoogleSheetsConnection`, `QRDestination`, `ThemePreference`,
`GuestContribution`, `WeddingContent`, `UserProfile`, `Comment`.

### Database client

`src/lib/db.ts` exports `db` (Prisma Client singleton).

### Local SQLite database

`db/custom.db` (487 KB) — contains seeded flagship wedding data for Charity &
Kudzie. **This file is runtime data and is untracked during export.** It
requires a separate private backup and later data migration to PostgreSQL
when Supabase is connected (see SUPABASE_SETUP.md §2).

---

## 7. Supabase Integration Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser client (`createBrowserClient` from `@supabase/ssr`) |
| `src/lib/supabase/server.ts` | Server client (`createServerClient` + `getCurrentUser()` helper) |
| `src/lib/supabase/storage.ts` | Storage helper (`uploadToSupabaseStorage`, `isSupabaseStorageConfigured`, `buildMediaPath`) |
| `src/app/api/auth/signup/route.ts` | Creates Supabase auth user + UserProfile row |
| `src/app/api/auth/signin/route.ts` | Supabase password signin |
| `src/app/api/auth/signout/route.ts` | Supabase signout |
| `src/app/api/auth/me/route.ts` | Returns current user profile |
| `src/app/api/comments/route.ts` | Comments API (auth-required POST, public GET) |
| `src/lib/inline-content-db.ts` | DB-backed content editing hook (falls back to localStorage) |
| `SUPABASE_SETUP.md` | 9-section setup guide (project creation, Prisma migration, env vars, auth, storage, comments, domain, GitHub, Vercel) |

### Supabase env variables (names only — no values)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, secret)
- `DATABASE_URL` (PostgreSQL connection string for Prisma — currently points to local SQLite)

**Current state:** These env vars are NOT set in `.env` (which only has
`DATABASE_URL` pointing to SQLite). Supabase is scaffolded but not connected.
See PROJECT_STATUS.md for details.

---

## 8. Authentication Implementation

### Current auth (flagship MVP — client-side)

| File | Description |
|------|-------------|
| `src/lib/admin-auth.ts` | Hardcoded password (`wewed-admin-2026`), localStorage + cookie nonce. Client-side only. |
| `src/lib/admin-gate.ts` | Server-side admin gate (checks `wewed_admin_auth` cookie nonce). Used by admin-gated API routes. |
| `src/components/wedding/couple-login.tsx` | Login UI for the couple (uses `admin-auth.ts`) |

### Supabase Auth (scaffolded — not yet wired to UI)

| File | Description |
|------|-------------|
| `src/app/api/auth/signup/route.ts` | Supabase signup + UserProfile creation |
| `src/app/api/auth/signin/route.ts` | Supabase signin |
| `src/app/api/auth/signout/route.ts` | Supabase signout |
| `src/app/api/auth/me/route.ts` | Current user profile |

**No login/signup UI components exist** that call these Supabase auth APIs.
The only login UI (`couple-login.tsx`) uses the old hardcoded password.

### NextAuth.js

`next-auth@^4.24.11` is installed in `package.json` but is **NOT used
anywhere** in the source code (only referenced in comments as a future
"Phase 5" plan).

---

## 9. Storage and Upload Implementation

### Current media upload (local filesystem)

`src/app/api/media/route.ts` POST handler:
- Saves uploaded files to `public/uploads/` via `fs.writeFile`
- Records metadata in the `MediaItem` Prisma model
- Does NOT use Supabase Storage (the `uploadToSupabaseStorage` helper exists
  in `src/lib/supabase/storage.ts` but is NOT imported or called by the media
  route)

### Supabase Storage (scaffolded — not wired)

`src/lib/supabase/storage.ts` provides:
- `uploadToSupabaseStorage(file, path)` — uploads to `wedding-media` bucket
- `isSupabaseStorageConfigured()` — checks env vars
- `buildMediaPath(slug, type, filename)` — builds storage path

**These helpers are NOT called by any route or component.** The media route
still uses local filesystem only.

### Upload directories

| Directory | Contents | Git status |
|-----------|----------|------------|
| `public/uploads/` | Does NOT exist (no runtime uploads have been saved here) | N/A |
| `upload/` | 8 runtime files (screenshots, pasted content, agent prompts) | **Untracked** (was tracked — these are runtime/scratch files, not app assets) |

### Application-owned static assets (in `public/`)

These ARE committed (they are design assets, not runtime uploads):
- `couple-silhouette.png` (157 KB)
- `hero-wedding.png` (198 KB)
- `icon-192.png`, `icon-512.png` (PWA icons)
- `logo.svg`
- `manifest.json` (PWA manifest)
- `ornament-frame.png` (173 KB)
- `robots.txt`
- `sw.js` (service worker)

---

## 10. Tests and Scripts

### Tests

**No test files exist** in the project source (`src/`). There is no `__tests__/`
directory, no `*.test.ts` / `*.spec.ts` files, and no `test` script in
`package.json`.

### Scripts

See §3 for the full list of `package.json` scripts. The key ones:
- `bun run dev` — start dev server
- `bun run build` — production build
- `bun run lint` — ESLint
- `bun run db:push` — push Prisma schema to DB
- `bun run db:generate` — generate Prisma client

### Z.AI workspace scripts (`.zscripts/`)

| File | Purpose |
|------|---------|
| `start.sh` | Workspace boot script |
| `dev.sh` | Dev server startup |
| `build.sh` | Build script |
| `mini-services-build.sh` | Build mini-services |
| `mini-services-install.sh` | Install mini-service deps |
| `mini-services-start.sh` | Start mini-services |
| `dev.pid` | Runtime PID (untracked) |
| `dev.log`, `mini-service-wewed-live.log` | Runtime logs (untracked) |

---

## 11. Environment Variables (names only — no secret values)

### Currently in `.env` (untracked)

```
DATABASE_URL=<REDACTED — SQLite connection string>
```

### Required for Supabase (documented in SUPABASE_SETUP.md, not yet set)

```
DATABASE_URL=<PostgreSQL connection string for Supabase>
NEXT_PUBLIC_SUPABASE_URL=<https://your-project.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — SECRET, server-only>
NEXT_PUBLIC_SITE_URL=<https://wewed.app>
NEXT_PUBLIC_WEWED_ADMIN_PASSWORD=<optional admin password override>
```

### `.env.example`

Created during this export with variable names only (no values). See §3 of
PROJECT_STATUS.md.

---

## 12. Runtime Data Requiring Separate Backup

The following files/directories are **untracked** (excluded from Git) because
they contain runtime data, secrets, or scratch output. They require a
**separate private backup** and are NOT included in this GitHub export:

| Path | Type | Size | Why excluded | Backup needed? |
|------|------|------|-------------|----------------|
| `.env` | Secret | 50 B | Contains `DATABASE_URL` (SQLite path, no real secret, but pattern must be established) | YES — contains env config |
| `db/custom.db` | Runtime DB | 487 KB | SQLite local dev database with seeded wedding data | **YES — must be migrated to PostgreSQL** when connecting Supabase |
| `upload/` | Runtime uploads | ~300 KB (8 files) | Screenshots, pasted content, agent prompts from development | Optional — these are dev scratch files |
| `tool-results/` | Scratch | ~44 files | Debug output from bash tool runs | NO — scratch output |
| `.zscripts/dev.pid` | Runtime | 5 B | Process ID file | NO — regenerated on start |
| `.zscripts/dev.log` | Runtime log | ~3.5 KB | Dev server log | NO — regenerated on start |
| `.zscripts/mini-service-wewed-live.log` | Runtime log | ~400 B | Mini-service log | NO — regenerated on start |
| `node_modules/` | Dependencies | — | Can be reinstalled via `bun install` | NO — reinstall from `bun.lock` |
| `.next/` | Build cache | — | Can be rebuilt via `bun run build` | NO — rebuild from source |

### Data migration note

The `db/custom.db` SQLite database contains the seeded flagship wedding data
for Charity & Kudzie (couple, wedding, 70+ content items, 99 checklist tasks,
14 budget items, 11 timeline blocks, 8 seating tables, sample media, songs,
etc.). **This data must be migrated to PostgreSQL** when connecting Supabase.
The `SUPABASE_SETUP.md` guide documents how to re-seed via the
`/api/wedding-content/seed` and `/api/onboarding` endpoints after switching
to PostgreSQL.

---

## 13. Known Unfinished or Partially Integrated Work

Based on the worklog (`worklog.md`, 4,378 lines, 24 task IDs) and source code
inspection:

| Feature | Status | Details |
|---------|--------|---------|
| Supabase DB connection | **Scaffolded, not connected** | Prisma `provider` is still `"sqlite"`. Env vars not set. |
| Supabase Storage for photos | **Scaffolded, not wired** | `uploadToSupabaseStorage()` exists but media route uses `fs.writeFile` |
| Supabase Auth (signup/signin) | **API built, no UI** | 4 auth API routes exist. No login/signup form components call them. |
| User profiles | **Model exists, no profile UI** | `UserProfile` model in schema. No profile editing page. |
| Comments | **API built, no UI** | `/api/comments` GET+POST exists. No comment components on photos/contributions. |
| DB-backed content edits | **Hook built, not wired** | `useInlineContentDB` exists. 21 components still use localStorage-only `useInlineContent`. |
| Per-couple theming for ambient music | **Not started** | Documented as a future task in worklog. |
| NextAuth.js | **Installed, not used** | `next-auth@4.24.11` in deps. Only referenced in comments. |
| Prisma migrations | **Not used** | Project uses `db:push` only. No `prisma/migrations/` directory. |
| Tests | **None exist** | No test files, no test script. |
| `WEDDING_SLUG` hardcoded | **TODO** | `'charity-and-kudzie'` is hardcoded in `inline-content-db.ts` and `comments/route.ts` — marked `// TODO: make dynamic per-couple` |

See `PROJECT_STATUS.md` for a detailed feature-by-feature assessment.

---

## 14. Validation Baseline Results

All validation commands were run during this export. Results recorded
honestly — no failures hidden.

| Check | Command | Result |
|-------|---------|--------|
| Dependency install | `bun install` (using existing `bun.lock`) | ✅ PASS (exit 0) — 917 installs across 985 packages, no changes |
| Lint | `bun run lint` (`eslint .`) | ✅ PASS (exit 0) — 0 errors, 0 warnings |
| TypeScript typecheck | `npx tsc --noEmit` | ❌ FAIL (exit 1) — 90 errors (see below) |
| Tests | N/A | ⏭️ SKIPPED — no test files or test script exist |
| Production build | `bun run build` | ⏭️ SKIPPED — per project rules ("never use `bun run build`"). Build would succeed because `next.config.ts` has `typescript: { ignoreBuildErrors: true }`. The dev server compiles and serves HTTP 200. |
| Prisma schema validation | `npx prisma validate` | ✅ PASS (exit 0) — "The schema at prisma/schema.prisma is valid 🚀" |
| Prisma client generation | `bun run db:generate` | ✅ PASS (exit 0) — Prisma Client generated successfully |
| Dev server | `curl http://127.0.0.1:3000/` | ✅ PASS — HTTP 200 |

### TypeScript errors (90 total — all pre-existing, NOT introduced by this export)

The typecheck fails with 90 errors. These are **pre-existing** issues in the
source code — this export operation did NOT introduce them and did NOT fix
them (per instructions: "Do not redesign, refactor, upgrade dependencies,
rewrite features, or change application behavior").

**Error categories:**

1. **Royalty routes reference non-existent Prisma models** (~70 errors):
   - Files: `src/app/api/royalty/route.ts`, `src/app/api/royalty/webhook/route.ts`
   - Models referenced but NOT in `prisma/schema.prisma`: `royaltyAttribution`,
     `qualifyingRevenueEvent`, `royaltyProgramme`, `royaltyTermsAcceptance`,
     `monetisationPreference`, `royaltyAuditEvent`, `royaltyLedgerEntry`
   - The royalty feature was built against models that were never added to the
     Prisma schema. This is incomplete work documented in the worklog.

2. **`isContentEditable` on `Element` type** (2 errors):
   - Files: `src/components/wedding/keyboard-section-nav.tsx` (line 67),
     `src/components/wedding/keyboard-shortcuts-help.tsx` (line 115)
   - The DOM `Element` type doesn't have `isContentEditable` — it's on
     `HTMLElement`. A type narrowing issue.

3. **Supabase server.ts naming collision** (~8 errors):
   - File: `src/lib/supabase/server.ts`
   - The function `createServerClient` is imported from `@supabase/ssr` AND
     declared as a local function with the same name, causing a collision.
   - This cascades to `src/lib/supabase/storage.ts` (3 errors) because the
     return type of the colliding function is `never`.

4. **Other type errors** (~10 errors):
   - Various minor type mismatches in royalty and other files.

### Why the app runs despite TS errors

`next.config.ts` contains:
```ts
typescript: {
  ignoreBuildErrors: true,
},
```

This tells Next.js to skip type checking during builds. The dev server
(Turbopack) also doesn't block on type errors. ESLint passes because its
TypeScript rules are less strict than `tsc --noEmit`.

**These errors should be fixed in a future development round, but fixing them
is outside the scope of this export operation.**

### Dev server verification

The dev server was running during export (PID 1044, port 3000). `curl`
returned HTTP 200. No cross-origin warnings in `dev.log`.

---

## 15. Export Operation Summary

### Files untracked (removed from Git index, kept locally)

| File/Dir | Reason | Count |
|----------|--------|-------|
| `.env` | Secret (contains `DATABASE_URL`) | 1 |
| `db/custom.db` | Runtime SQLite database (requires separate backup + migration) | 1 |
| `upload/*` | Runtime uploads (dev scratch files) | 8 |
| `tool-results/*` | Scratch/debug output | 44 |
| `.zscripts/dev.pid` | Runtime PID file | 1 |
| `.zscripts/dev.log` | Runtime log | 1 |
| `.zscripts/mini-service-wewed-live.log` | Runtime log | 1 |
| **Total untracked** | | **57** |

### Files preserved in Git

All source code (`src/`), configuration, Prisma schema, Supabase integration
files, documentation (`SUPABASE_SETUP.md`, `USER_MANUAL.md`, `worklog.md`,
`agent-ctx/`), application assets (`public/`), QA screenshots (`download/`),
mini-services, examples, lockfile (`bun.lock`), and all config files.

### Commit message

```
chore: import complete GLM 5.2 application baseline
```

### Branch

`main`

---

*Generated by the Z.AI Code export operation. This manifest is committed to
the repository as a permanent record of the baseline state at handoff.*
