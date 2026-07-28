# CONTRIB-1 — Collaborative Guest Contributions (Backend)

**Agent:** Z.ai Code
**Task ID:** CONTRIB-1
**Status:** ✅ Complete

## Files Created
1. `/src/lib/contribution-utils.ts` — utilities, constants, anti-abuse validation, sanitization, revision history
2. `/src/app/api/contribute/route.ts` — GET + POST guest editor (token-gated)
3. `/src/app/api/contributions/route.ts` — GET (admin list) + POST (bulk token + sample data)
4. `/src/app/api/contributions/[id]/route.ts` — PATCH (admin moderation)
5. `/src/app/api/contributions/public/route.ts` — GET (public approved feed)

## API Surface

### `/api/contribute?token=TOKEN` (guest-facing, no admin gate)
- **GET** → `{ guest: {id, name, role, roleDetail, side}, contribution: {...} | null, status: 'none'|'draft'|'pending'|'approved'|... }`
  - 404 on invalid/missing token.
- **POST** body `{ type, displayName, relationship?, message?, favoriteSong?, privacy?, action: 'draft'|'submit' }`
  - Validates type / displayName / privacy.
  - Sanitizes all text fields (HTML-escaped).
  - For `submit`: requires message + runs full validation (HTML/URL/phone/email/profanity/word-cap/char-cap).
  - For `draft`: validation only runs if message is non-empty.
  - Rate-limit: `editCount <= 10` enforced on drafts (HTTP 429).
  - Appends previous version to `revisionHistory` JSON.
  - Upserts `GuestContribution` (keyed by `guestId`).
  - Syncs `Guest.contributionStatus` to `draft` or `pending`.
  - Returns `{ success, contribution: {...} }`.

### `/api/contributions` (admin-gated)
- **GET** `?status=pending|approved|rejected|draft|featured|hidden|all` (default: all)
  - Returns `{ success, count, data: AdminContributionRow[] }` with joined guest info.
- **POST** — bulk setup:
  1. Ensures bridal party guests exist (from `bridal-party-data.ts`).
  2. Generates 32-char hex contribution tokens for guests without one.
  3. Creates 8 sample bridal party contributions (3 featured + 5 approved) using real bio data.
  - Returns `{ success, generated, samplesCreated, tokens: [{guestId, guestName, token, url}] }`.

### `/api/contributions/[id]` (admin-gated)
- **PATCH** body `{ status: 'approved'|'rejected'|'featured'|'hidden', moderatorNotes? }`
  - Sets `reviewedAt=now`, `reviewedBy='admin'`.
  - Syncs `Guest.contributionStatus` to match.
  - Returns `{ success, contribution: {...} }`.

### `/api/contributions/public` (no auth)
- **GET** → `{ success, count, data: PublicContribution[] }`
  - Only `approved` + `featured` statuses.
  - Excludes `privacy='couple_only'`.
  - Returns only public-safe fields (no `moderatorNotes`, no `editCount`, no `guestId`, no `reviewedBy`).
  - Anonymizes `privacy='anonymous'` rows (displayName → 'Anonymous', nulls relationship/photo/song).
  - Sort: featured first, then `submittedAt desc`.
  - Never errors to client — returns empty array on DB failure.

## Constants (in contribution-utils.ts)
- `MAX_WORDS = 500`
- `MAX_CHARS = 2500`
- `MAX_EDITS = 10`
- `MAX_PHOTO_SIZE = 5 * 1024 * 1024` (5 MB)
- `CONTRIBUTION_TYPES = ['memory', 'advice', 'blessing', 'funny_story', 'wish']`
- `PRIVACY_OPTIONS = ['public', 'couple_only', 'anonymous']`
- `ALL_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'featured', 'hidden']`
- `PUBLIC_STATUSES = ['approved', 'featured']`

## Anti-abuse rules enforced by `validateMessage(text)`
1. Word count ≤ 500
2. Char count ≤ 2500
3. No HTML tags (`<[a-zA-Z/]`)
4. No URLs (`http://`, `https://`, `ftp://`, `www.`)
5. No phone numbers (country codes `\+\d{1,4}`, 10+ consecutive digits)
6. No email addresses
7. No profanity (~36-word built-in English list, word-boundary regex)

## Verification
- ✅ TypeScript: `npx tsc --noEmit` — 0 errors on all 5 files
- ✅ ESLint: `bun run lint` — 0 errors on all 5 files (1 pre-existing warning in another agent's file)
- ✅ Direct smoke-test of `contribution-utils.ts` via Bun script — all functions behave correctly (token format, word/char counts, validation of HTML/URL/phone/email/profanity, sanitization escaping, type guards, revision history)

## Cross-agent fix
- Fixed JSX syntax error in `/src/components/wedding/guest-contribution-editor.tsx` line 483 that was blocking the entire app's lint + Turbopack compile. Changed `placeholder='e.g. "Charity\'s university friend"'` → `placeholder={"e.g. \"Charity's university friend\""}`. No logic change.

## Handoff notes for next agent
- The `guest-contribution-editor.tsx` component (CONTRIB-2's work) should POST to `/api/contribute?token=TOKEN` with the body shape described above.
- The public guest wall component should GET from `/api/contributions/public`.
- The admin moderation UI should GET from `/api/contributions?status=...` and PATCH `/api/contributions/[id]`.
- To seed demo content, an admin can POST to `/api/contributions` (this generates tokens + 8 sample bridal party contributions in one call).
- The `contributionToken` is `@unique` on `Guest` — `db.guest.findUnique({where:{contributionToken: token}})` is the canonical lookup.
- `revisionHistory` is a JSON-encoded `String?` column — use `appendRevision()` to mutate it safely.
- The dev server (`bun run dev`) was not running on port 3000 at completion time, so live HTTP smoke-tests couldn't be run. The route handlers follow the exact same Next.js 16 patterns as existing working routes (`/api/rsvp`, `/api/planner/tasks/[id]`).
