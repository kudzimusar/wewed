# Task 4-b & 4-e — Privacy Canon UI + Schema Updates

> **Agent:** Z.ai (privacy canon)
> **Task:** (4-e) Prisma schema additions for privacy + planning + seating; (4-b) Privacy Canon UI (helpers + 3 components + 2 API routes)
> **Date:** 2026-06-22
> **Status:** ✅ Complete — lint clean, TS clean, all 8 smoke tests pass

## Files Delivered

### Schema (1 file modified, additive only)
1. **`prisma/schema.prisma`** — additive changes only, no existing fields removed
   - **Wedding model**: added `privacy`, `canonSealed`, `canonSealedAt`, `subscriptionTier` fields
   - **Wedding model**: added `plannerTasks`, `budgetItems`, `seatingTables` relation fields
   - **Guest model**: added `seatingTableId` + `seatingTable` relation
   - **Couple model**: added `userId` + `subscriptionStatus` fields
   - **New model `PlannerTask`** — wedding planning tasks (11 categories: venue, catering, attire, roora, magumo, transport, stationery, decor, photo_video, music, other)
   - **New model `BudgetItem`** — wedding budget tracking (estimated/actual/paid amounts, vendor link, currency)
   - **New model `SeatingTable`** — wedding seating chart tables (capacity, position JSON, guest relation)
   - **`bun run db:push` applied successfully** — DB now in sync, Prisma Client v6.19.2 regenerated

### Library (1 new file)
2. **`src/lib/privacy.ts`** — isomorphic privacy helpers (no `'use client'` directive)
   - Types: `PrivacyLevel` (`'public' | 'link_only' | 'private'`), `SubscriptionTier` (`'free' | 'canon' | 'forever'`), `PrivacyAwareWedding`
   - Constants: `FLAGSHIP_WEDDING_SLUG`, `FLAGSHIP_ACCESS_TOKEN` (`'charity-kudzie-2026'`), `PRIVACY_LEVELS`, `SUBSCRIPTION_TIERS`
   - Label dictionaries: `PRIVACY_LABELS`, `PRIVACY_DESCRIPTIONS`, `SUBSCRIPTION_LABELS`, `SUBSCRIPTION_DESCRIPTIONS`
   - **URL helpers** (client-safe, no-op on server):
     - `getAccessTokenFromUrl()` — reads `?token=` query param
     - `clearAccessTokenFromUrl()` — strips `?token=` from URL in-place
     - `urlHasAccessToken()` — boolean check
   - **Pure helpers**:
     - `canAccessWedding(privacy, hasAccessToken, isCouple)` — canonical access rule
       - public → always true
       - link_only → hasAccessToken OR isCouple
       - private → isCouple only
     - `isCanonSealed(wedding)` — accepts boolean OR wedding-shaped object
     - `asPrivacyLevel(value)` / `asSubscriptionTier(value)` — coerce strings, fail-safe defaults
     - `safeEqualString(a, b)` — constant-time comparison
     - `verifyFlagshipAccessToken(token)` — constant-time token check (no DB)
   - **Server-only helpers** (use dynamic `await import('@/lib/db')` so the module stays client-safe):
     - `getWeddingPrivacy(weddingId)` — read privacy level from DB, fails open to `'public'`
     - `getFlagshipPrivacySnapshot()` — full snapshot for the GET route (id, slug, privacy, canonSealed, canonSealedAt, subscriptionTier)
   - Default export: object bundling all helpers (avoids anonymous-default-export lint rule)

### Components (3 new files)

3. **`src/components/wedding/privacy-badge.tsx`** — `'use client'` elegant privacy badge
   - Exported `PrivacyBadge` with props `{ privacy, canonSealed, tier, size, showTier, className }`
   - **Display priority** (only one renders at a time):
     1. `canonSealed` → gold gradient wax-seal badge with shield icon + "Canon Sealed" + "Preserved Forever" (sm+ screens), pulsing ring + shield scale animation
     2. `private` → espresso "Private Vault" badge with gold-light lock icon
     3. `link_only` → sage-tinted "Link Only" badge with link icon
     4. `public` → champagne "Public" badge with sage globe icon
   - Three sizes: `sm`, `md` (default), `lg` — adjusts padding + icon size
   - Optional `showTier` prop renders a secondary tier pill (Canon/Forever, hidden for `free`)
   - All variants have proper `role="status"` + `aria-label` for screen readers
   - framer-motion entrance (opacity + scale 0.92 → 1)
   - Subtle pulse animation only on the canon-sealed variant (2.4s repeating ring)

4. **`src/components/wedding/vault-lock-screen.tsx`** — `'use client'` full-screen lock overlay
   - Exported `VaultLockScreen` with props `{ privacy, monogram, coupleNames, requestAccessEmail, onUnlock, autoReload, className }`
   - **Full-screen espresso overlay** (z-200) with ambient radial gold + plum + clay gradient, damask dot pattern, double gold hairline frame
   - **Card**: gradient espresso-to-darker-espresso, gold border, large shadow
     - Top monogram "C&K" in circular gold-ring badge
     - Pulsing lock icon (gold/10 bg, gold-light icon, 2.6s scale animation)
     - Serif heading: "This Wedding is in the Vault" (or "A Quiet Invitation" for link_only)
     - Description: customizable text mentioning Charity & Kudzie + invitation token
   - **Form**: input with key icon, "Unlock" button with unlock icon
     - Loading state: spinner + "Verifying"
     - Error state: shake animation (key-framed x translation), inline AlertCircle error message, focus returns to input
     - Success state: scale-in checkmark + gold ring ripple + "Welcome inside." heading + "Unlocking the vault…" caption
   - **Success flow**: after 1.1s delay, navigates to `?token=…` URL so parent re-renders authorized
   - **Verification**: POSTs to `/api/privacy/verify-token` first; if network fails, falls back to local constant-time check via `verifyFlagshipAccessToken`
   - **Auto-detects URL token on mount** (via `useState` initializer — no setState-in-effect lint violation); if valid, starts in success state and notifies parent via `onUnlock` callback
   - **Footer**: "Request access" mailto link (with prefilled subject + body), "wewed · sealed vault" caption with shield icon
   - framer-motion entrance: fade (0.45s) + scale (0.94 → 1, 0.55s, delay 0.1s)
   - AnimatePresence for form ↔ success state transitions
   - Accessibility: `role="dialog"` `aria-modal="true"` `aria-labelledby` + `aria-describedby`, auto-focus input, `aria-invalid` on error, `role="alert"` on error message
   - Easing constant `EASE = [0.22, 1, 0.36, 1]` for consistent motion

5. **`src/components/wedding/canon-seal.tsx`** — `'use client'` decorative wax-seal emblem
   - Exported `CanonSeal` with props `{ size, floating, showCaption, showTagline, date, monogram, className, reveal }`
   - **SVG-based wax seal** (120×120 viewBox):
     - 24 scalloped gold dots around the outer edge (embossed wax feel)
     - Outer disc with radial gold gradient (gold-light → gold → gold-muted → darker)
     - Inner gold disc with subtle bottom shadow for depth
     - Decorative dotted ring (espresso at 0.25 opacity)
     - Inner hairline ring
     - **Top-arc curved text**: `CANON SEALED · 23.12.26 · WEWED` (SVG `<textPath>`)
     - **Bottom-arc curved text**: `PRESERVED FOREVER` (espresso at 0.7 opacity, wider letter-spacing)
     - **Center shield**: espresso shield with gold-light border, contains a 5-point gold-light star + monogram (default "C&K")
     - Gloss highlight ellipse on top half (white at 0.55 → 0 opacity)
     - **Rotating shimmer overlay** (9s linear infinite) — a moving white highlight stripe across the seal
   - **Pulsing glow ring** (3s ease-out infinite) — soft gold glow that expands outward
   - Optional `floating` prop: gentle 4.5s vertical bob (translateY -6px)
   - Optional `showCaption` / `showTagline`: renders "Canon Sealed" caption with shield + sparkles icons, tagline explaining "preserved forever as a digital heirloom"
   - framer-motion entrance: opacity + scale (0.85 → 1) + rotate (-8° → 0) over 0.7s
   - Drop shadow: `0 4px 12px rgba(191,155,95,0.25)` for premium feel
   - Fully responsive — `size` prop scales everything (default 96px)

### API Routes (2 new files)

6. **`src/app/api/privacy/route.ts`** — `GET` + `PATCH`
   - **`GET /api/privacy`** — returns flagship wedding's privacy snapshot
     - Response: `{ success, data: { weddingId, slug, privacy, canonSealed, canonSealedAt, subscriptionTier, isCanonSealed, label, description } }`
     - `Cache-Control: no-store, max-age=0` (privacy metadata is dynamic)
     - Fails gracefully — returns 500 only on hard DB errors
   - **`PATCH /api/privacy`** — updates privacy/canon/tier (admin only)
     - Accepts: `{ privacy?, canonSealed?, subscriptionTier?, weddingId? }` (any subset)
     - Admin gate: checks `wewed_admin_auth` cookie matches 16-hex-char nonce pattern; also allows `?admin=1` query param in non-production for dev testing
     - Validates `privacy` against `PRIVACY_LEVELS` allowlist
     - Validates `subscriptionTier` against `SUBSCRIPTION_TIERS` allowlist
     - When `canonSealed` set to `true`, also stamps `canonSealedAt = now()`; when `false`, clears it
     - Returns 401 if no admin cookie, 400 on validation errors, 404 if wedding missing, 200 with updated snapshot
   - Shared `buildSnapshot()` helper shapes the response consistently between GET + PATCH

7. **`src/app/api/privacy/verify-token/route.ts`** — `POST` token verification
   - Accepts: `{ token: string }`
   - Returns: `{ success: true, valid: boolean }` (or 429 on rate limit, 400 on missing token)
   - Uses `safeEqualString()` (constant-time compare) against `FLAGSHIP_ACCESS_TOKEN`
   - Defensive double-check via `verifyFlagshipAccessToken()` helper
   - **120ms artificial delay** flattens timing differences between success/failure paths (mitigates remote timing attacks)
   - **Soft in-memory rate limit**: 12 attempts per 60s window per client IP (identified via `x-forwarded-for` or `x-real-ip`), returns 429 + `Retry-After` header when exceeded
   - Never returns the token itself — only yes/no

## Schema Migration Notes

- All schema changes are **additive** — no existing fields or models were removed or renamed
- All new fields have defaults so existing rows are backfilled automatically:
  - `Couple.userId` → `null`
  - `Couple.subscriptionStatus` → `"free"`
  - `Wedding.privacy` → `"public"`
  - `Wedding.canonSealed` → `false`
  - `Wedding.canonSealedAt` → `null`
  - `Wedding.subscriptionTier` → `"free"`
  - `Guest.seatingTableId` → `null`
- All new models (`PlannerTask`, `BudgetItem`, `SeatingTable`) use `cuid()` IDs and standard `createdAt`/`updatedAt` timestamps

## db.ts Hardening (1 file modified)

- **`src/lib/db.ts`** — added `SCHEMA_VERSION` constant + cache invalidation logic
  - **Why**: After `bun run db:push`, the regenerated `@prisma/client` on disk has the new schema, but `globalThis.prisma` cached in the running dev server holds an OLD `PrismaClient` instance bound to the OLD schema. Result: queries on new fields throw `Unknown field 'privacy' for select statement on model 'Wedding'`.
  - **Fix**: stamp the cached client with a `__prismaSchemaVersion` string. When `db.ts` is re-evaluated and the version mismatches, the old client is `$disconnect()`-ed and discarded, then a fresh client is created from the newly-regenerated `@prisma/client` module.
  - **Production-safe**: invalidation only runs in `NODE_ENV !== 'production'`; prod cold-starts always get a fresh client.
  - Bump `SCHEMA_VERSION` after future schema changes (comment in file documents this).

## Smoke Tests (all 8 passed)

```
1. GET  /api/privacy                          → 200, returns { privacy: "public", canonSealed: false, subscriptionTier: "free", ... }
2. POST /api/privacy/verify-token (correct)   → 200, { valid: true }
3. POST /api/privacy/verify-token (wrong)     → 200, { valid: false }
4. PATCH /api/privacy (no auth)               → 401 Unauthorized
5. PATCH /api/privacy (with admin cookie)     → 200, updates privacy to "link_only"
6. GET  /api/privacy (verify persistence)     → 200, privacy: "link_only" (confirmed)
7. PATCH /api/privacy (set canonSealed: true) → 200, canonSealed: true, canonSealedAt: "2026-06-22T07:16:39.152Z", subscriptionTier: "canon"
8. PATCH /api/privacy (reset canon seal)      → 200, canonSealed: false, canonSealedAt: null
```

## Lint + TypeScript

- `bun run lint` → **zero errors, zero warnings**
- `npx tsc --noEmit` on my 6 new files → **zero TypeScript errors**
- (Pre-existing TS errors in `travel-stay.tsx`, `venue-section.tsx` from other agents are explicitly out of scope per the rules)

## Integration Notes for Lead Agent

1. **Privacy display**: Drop `<PrivacyBadge privacy={wedding.privacy} canonSealed={wedding.canonSealed} tier={wedding.subscriptionTier} />` anywhere the couple's privacy state should be surfaced (navbar, footer, admin dashboard).
2. **Lock screen gating**: When a visitor hits a `private` or `link_only` wedding without a valid `?token=`, render `<VaultLockScreen privacy={level} onUnlock={(t) => console.log('unlocked:', t)} />` as a full-screen overlay. The component self-manages verification + reload.
3. **Canon seal emblem**: Drop `<CanonSeal size={120} showCaption showTagline floating />` in the footer or as a hero accent when `canonSealed === true`. The decorative-only variant (no caption) works as a floating badge.
4. **Privacy badge for admin**: The admin dashboard should use `<PrivacyBadge ... showTier />` so the couple can see both their privacy level + subscription tier (Canon/Forever).
5. **Server-side access checks**: For server components or API routes, use `canAccessWedding(privacy, hasAccessToken, isCouple)` from `@/lib/privacy` — it's pure and isomorphic.
6. **Reading flagship privacy from server**: Use `getFlagshipPrivacySnapshot()` from `@/lib/privacy` (server-only, dynamic import of `@/lib/db`).

## What Was NOT Done (per task rules)

- Did NOT modify `page.tsx` — lead agent wires everything
- Did NOT touch existing wedding components — only modified `src/lib/db.ts` (additive hardening, no behavior change in prod)
- Did NOT create new mini-services
- Did NOT remove or rename any existing fields in the Prisma schema

## Unresolved Notes for Future Phases

1. **Real per-wedding access tokens**: Currently `FLAGSHIP_ACCESS_TOKEN` is a hardcoded constant. Phase 5 (NextAuth) should store per-wedding tokens in the DB (probably as a `Wedding.accessToken` field) and rotate them from the admin dashboard.
2. **Persistent rate-limit storage**: The `verify-token` route uses an in-memory `Map` for rate-limiting. This resets on dev server restart and is per-instance in production. Swap for Redis in Phase 5.
3. **Server-side admin auth**: The PATCH route's admin check is a soft cookie-format check, not a cryptographically verified session. NextAuth (Phase 5) will replace this with proper server-verified JWTs.
4. **Seating chart UI**: The `SeatingTable` model is ready (with `position` JSON field for x,y coordinates) but no seating-chart UI component exists yet — tracked for a future task.
5. **Planner + Budget UI**: The `PlannerTask` and `BudgetItem` models are ready but no UI components exist yet — tracked for a future task.
