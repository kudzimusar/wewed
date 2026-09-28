# QRO 01 — Phase 13 Guest live-data integration foundation: implementation receipt (2026-09-26)

**Status: IMPLEMENTATION-AGENT SUBMISSION — NOT A MODERATOR VERDICT.** Independent moderator review
(governance §3), reviewer-owned closure and local device certification are still required. Nothing
here was merged, deployed to production, activated, or run against production data.

```text
MASTER PLAN
Plan ID:            WW-P13-LIVE-DATA-GUEST-CONVERGENCE-2026-09-26-01 (under WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01)
Checkpoint:         D-068 (not rewritten; acceptance is the moderator's)
Phase:              P13-LIVE-1 … P13-LIVE-6 foundation + P13-LIVE-8 foundation (QRO 01)
Plan sections:      live-data plan §1–§13, §17–§20, §22–§26; QRO 01 task §3–§38
```

Evidence levels are used exactly as defined in the task (§34). **Everything below is SOURCE PROVEN
unless stated.** A local, synthetic-data, three-client integration run is reported separately and is
**not** LIVE PARITY. **No LIVE PARITY and no END-TO-END claim is made.**

## 1. Start state (verified before any edit)

| Ref | Expected | Actual remote tip |
| --- | --- | --- |
| `main` | `ba4b08f8…` | `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887` ✅ |
| `closure/phase13-global-qr-convergence-lqr01-20260926` | `926d89a1…` | `926d89a106b2c85cef064933626a39872fa171e9` ✅ |
| `closure/phase13-global-qr-convergence-native-lqr01-20260926` | `7efd2d7e…` | `7efd2d7ea62bbb5afee0b4218388a9ee6cbb79f0` ✅ |
| `native-mobile/phase13-ios-invitation-pass-closure-nm06-20260926` | `a978470a…` | `a978470a0ff190d162ded4d6d6c6c4dd6c524f70` ✅ |
| `backend/native-workspace-parity-phase8-20260922` | `ba38cf3c…` | `ba38cf3c66105f5a7326bef27aecf428e47f3f5e` ✅ |
| `docs/native-pwa-production-convergence-plan-20260922` | `eaa7922c…` | `eaa7922cb3a48bd32f16cf9a5e998d4123d4dad6` ✅ |

- `ba38cf3c` (Phase 8) **is an ancestor** of `926d89a1` → not merged separately.
- `a978470a` (NM06) **is an ancestor** of `7efd2d7e` (native companion is NM06 + 3 commits).
- Native (`7efd2d7e`) and backend (`926d89a1`) diverge from merge-base `8c6fdfe0`
  (1094 / 577 commits). The backend candidate has **no `apps/` tree**; the native line carries an
  **older, divergent server stack** (see §2).
- No `integration/*` branch existed. D-068 was the latest checkpoint; nothing supersedes it.

## 2. Integration

- Branch: `integration/phase13-live-account-data-convergence-20260926`
- Base: `closure/phase13-global-qr-convergence-lqr01-20260926` @ `926d89a1`
- Method: **merge commit `d9809197` of `7efd2d7e` with file-level resolution** (history of NM06 and the
  native companion is preserved; both remain ancestors of the integration branch).

| Area | Resolution |
| --- | --- |
| `src/`, `prisma/`, `tests/`, `package.json`, `bun.lock`, `next.config.ts` | **Backend candidate verbatim** (asserted byte-identical to `926d89a1` after the merge). |
| Native-line server stack | **Not imported**: `/api/mobile/*`, `/api/wedding-day/{announcements,check-in,manifest,planner,vendors}`, `prisma/models/wedding-day.prisma`, migrations `20260910053500_native_push_devices` and `20260917114500_wedding_day_domain`, the legacy app-session Bearer `proxy.ts` change and their e2e specs. No native client calls any of these routes (endpoint inventory of `apps/ios` + `apps/android`). The dropped `/api/wedding-day/check-in` was a second, unguarded check-in writer. |
| `apps/`, `.maestro/`, `mobile/contracts`, `mobile/fixtures`, `docs/native-mobile` | Native companion verbatim (asserted identical except deliberate exclusions). |
| Local fixture servers / stale tests | Excluded: `mobile/shadow/tools/guest_session_stub.py`, `scripts/native-mobile/guest-profile-ui-server.py`, `mobile/acceptance-tests/*` (targeted the stale server). |
| Workflows | Excluded (they execute excluded files): `native-bearer-ci`, `native-app-links-ci`, `native-maestro-ci`, `wedding-day-isolated-qualification`. |
| `.gitignore` | Union. The backend's bare `test` rule would have ignored the native test trees; the native `/test` anchor, test-tree un-ignores and Private-Real-Shadow exclusions are kept. |
| `apps/mobile` (Expo) | Kept as-is: it is referenced by the backend candidate's own `native-gate-g-release.yml`; deleting a product tree is not this unit's call. Its `/api/mobile/*` server was never on `main` either. |

Shadow snapshots/fixtures remain DEBUG-only development data and are not release authority;
productionPreview cannot reach them (§4).

## 3. Preview live-data safety (P13-LIVE-1)

Every relevant mutation path was enumerated (domain SQL writers, all `/api/native/*` handlers, their
library call graphs one level deep, all RSVP writers, and the desktop auth routes).

| Path | Before | After |
| --- | --- | --- |
| **P0-LIVE-01** `POST /api/native/gate/wedding-day/check-in` (writes `WeddingCheckIn`, RSVP check-in) | unguarded | route 423 from the server-resolved grant before parsing input + domain backstop in `checkInWeddingGuest` |
| **P0-LIVE-02** `POST /api/native/gate/wedding-day/pass/revoke` | unguarded | route 423 + backstop in `revokeWeddingPassCredential` |
| **P0-LIVE-03** `GET /api/wedding-day/pass` (inserts `WeddingPassKey` / `WeddingPassCredential`) | unguarded (safe-method exemption) | backstop at the exact supersede/insert step of `ensureWeddingPassCredential` and at `ensurePassKey`'s insert; route maps to 423. An existing credential stays readable; a pre-window wedding still returns its real `not_yet_issuable` |
| `withdrawWeddingPassesForAttendance` | route-guarded callers only | backstop |
| Gate management (`create/disable/assign/revoke`) | guarded at context | + backstop in each writer |
| `applyGuestRsvpUpdate` | guarded callers | returns 423 itself |
| native tasks POST/PATCH, `rsvp` POST, guest-session PUT, `rsvp/[token]` PATCH, planner Pass view | guarded | unchanged (verified) |
| every other `/api/native/*` handler | GET, read-only | verified write-free incl. library call graph (catalog, bookings, deal-room, engagements, contributions, vault, admin overview, manifest, authority) |
| `/api/native/account/signin` | POST, no DB write | verified-exempt (the exemption test fails if a write appears) |
| **Desktop sign-in side effects** (`/api/auth/signin`, `/me`, `/wedding`) | `lastLoginAt`, `UserProfile` upsert, `currentWeddingId`, and `acceptPendingMemberships` on **every** wedding | On Preview: account bookkeeping suppressed (signed cookie stays the per-request wedding authority, so switching still works); invitations accepted **only** for `WEWED_PREVIEW_WRITABLE_WEDDING_ID`, none if unset. Production unchanged. |

Guard key is always the authoritative wedding **ID** (a test gives the UAT wedding the LIVE
wedding's ID as its *title* and proves LIVE stays blocked).

Tests: `src/lib/preview-live-data-safety.integration.test.ts` (8 — non-UAT refused and writes nothing,
exact UAT ID allowed, no configuration read-only, production/local never blocked, backstop on every
direct writer, pre-window real state, existing Pass readable, sign-in acceptance scoping). **Red
check: 6 of 8 fail on the unpatched merge, 8/8 pass here.** Static coverage guards in
`preview-write-safety.test.ts` (8 → 14): every exported domain writer must call the backstop; every
non-GET `/api/native` handler must reference a guard.

## 4. productionPreview (P13-LIVE-2)

One lane policy per platform (`apps/ios/Wewed/App/NativeServerLane.swift`,
`apps/android/.../state/NativeServerLane.kt`) feeds **every** real client: account authority, domain
API, Guest session, Wedding Day/Gate transport.

- **Release:** always `.production` = `https://wewed.pro`; all launch inputs ignored (tested on both).
- **DEBUG** `WEWED_NATIVE_ENV=production_preview` / Android extra `wewed_native_env`: data environment
  stays **`.production`** — same clients, same server-issued authority; Shadow, fixture and persona
  switching are impossible (tested) — against one origin passing a compiled allowlist:
  `https://wewed-<id>-11-11.vercel.app` or http(s) loopback. Rejected: arbitrary hosts, look-alike
  suffixes, other projects/teams, ports, paths, queries, credentials, `http` non-loopback, and the
  production host itself. **A rejected origin fails closed** — no client is built and nothing can
  reach any server; it never falls back to production.
- **Vercel Deployment Protection** is active on Previews (unauthenticated requests 302 to
  `vercel.com/sso-api`). Seam: DEBUG-only bypass secret (iOS env `WEWED_PREVIEW_PROTECTION_BYPASS`,
  Android extra `wewed_preview_protection_bypass`, collector env `WEWED_PARITY_PROTECTION_BYPASS`),
  sent only to the lane origin, redacted in every textual form, never compiled in.
- Preview credentials live in separate Keychain services / preference files.
- Host checks (invitation entry, deep links, Guest resume redirect) accept production hosts plus only
  the one active Preview host.
- Android's DEBUG `wewed_guest_base_url` previously accepted **any** host; it now uses the same
  allowlist and fails closed.

**Release defect found and fixed (both platforms, P1 class).** Production resolved `baseURL == nil`,
so `AppState.dataBaseURL` was nil and `RootView`/`RootScreen` never bound a `NativeDomainApiClient`:
in a Release build, real Couple/Planner/Coordinator/Vendor/Admin domain data could not load. Tests
had only ever injected `https://example.test`. Two tests that asserted the nil origin now assert
`https://wewed.pro`.

## 5. Guest parity, invitation and Pass authority

- **`wewed.parity.v1`** (`src/lib/parity/wewed-parity-v1.ts`, shared fields + cross-language digest
  vectors in `mobile/contracts/wewed-parity-v1.json`). Clients: `backend`, `desktop`, `native-api`
  (the exact HTTP surface the apps call), `ios`, `android`. Roles incl. `guest` (invitation-bound)
  and `guest_record` (account-side view of that Guest). Fails on: different wedding/Guest ID (named
  `LABEL_MATCH_ID_MISMATCH` when the displayed digest is identical), missing client, missing
  grant/relationship, permission difference, engagement difference, RSVP/party/table/invitation
  style/message difference, Pass availability difference, Pass digest difference (required when
  active, forbidden otherwise). Refuses any token/cookie/password/bypass/JWT/PEM/private-link-shaped
  data. 20 deterministic tests.
- **Guest identity from the server, not labels:** the Guest-session payload now carries `wedding.id`,
  `guest.seatingTableId` (same cross-wedding containment as the table name) and `rsvp.partySize`
  (canonical Gate household). The Pass GET already returned `weddingId`/`guestId` to the Guest.
- **Collector/CLI** `scripts/parity/wewed-parity.ts` (`collect` / `check`) — Preview/loopback only,
  credentials only from the environment, Pass reads opt-in (inside T-14 a retrieval can issue).
- **In-app exporters** (iOS/Android, DEBUG + productionPreview only) record what the app itself
  parsed; digests byte-identical to the server (asserted against shared vectors incl. NFC).
- **Invitation vs Pass:** Open Invitation (`invitation-manager`) and Wedding Pass
  (`wedding-pass-administration`) remain separate surfaces with separate QR trust domains; the list
  never exposes tokens; View Wedding Pass is the explicit, audited path.
- **Credential vs arrival (§19) — defect fixed.** The Planner/Couple Pass state compressed both into
  one status and evaluated arrival first, so a *revoked* Pass with a partly admitted party read only
  "Partially checked in" (the convergence test asserted exactly that). Now `credentialState` and
  `arrivalState` are separate ("Wedding Pass: Revoked · Arrival: 1 of 2"); View Wedding Pass depends on
  the credential alone.
- **Pre-T14:** the canonical window (open T-14, cutoff +24h, expiry ceiling +36h) is unchanged (tests
  assert it). Outside it the state is `not_yet_issuable` on every client — never a dummy QR or a
  generic transport error, and never a Preview error.
- **Duplicate rules removed:** iOS and Android re-derived party size locally; they now prefer the
  server's value (local expansion only as an older-server fallback).

## 6. RSVP mutation authority (§25) — defect fixed

Every RSVP writer in `src/` is now classified by test. **`rollbackGuestWorksheetImport` restored
non-attending RSVPs (or removed the RSVP) without withdrawing the live Wedding Pass** — it now does,
in-transaction after the Guest lock, exactly as the import does (red on the unpatched merge, green
here). Lifecycle-aware: `applyGuestRsvpUpdate`, worksheet apply, worksheet rollback. Attendance-
neutral (must never write `attending`): staff/event-day arrival flags, token rotation, empty-RSVP
creation, Guest deletion, WW2 check-in.

## 7. Domain-authority reuse (§24)

One Guest-record projection (`src/lib/guest-record-authority.ts`: RSVP status, containment-checked
seating identity, canonical party size) used by `/api/native/wedding/guests`, `/api/planner/guests`
and the Guest session. The native list previously took the table name without same-wedding
containment. **Remaining duplication (P2, not on the Guest corridor, documented not expanded):**
native `overview` counts, `seating`, `timeline`, `vendors` still run their own Prisma reads.

## 8. Coordinator foundation (§23)

Shared rules in `src/lib/wedding-relationship-eligibility.ts`, consumed by the native grant builder
(behavior identical; grants suites 35/0) and desktop sign-in admission. Coordinator stays a
`WeddingMembership` role — no global role, no client role selector. A full matrix test (account class
× membership role × status × governed) pins **exactly three** remaining divergences; any other, or a
pinned one silently vanishing, fails. They are owner/product decisions (§12), not code gaps:

- **D-COORD-ACCOUNT-CLASS** — viewer/vendor-class account with an active governed Coordinator
  membership: native grant, no desktop workspace.
- **D-COORD-INVITATION-LIFECYCLE** — desktop sign-in accepts invitations; native counts only active
  memberships. (On a Preview without a writable wedding the two now agree.)
- **D-VIEWER-WORKSPACE** — viewer membership: desktop read-only workspace, no native grant.

## 9. Tests (local, this machine)

Throwaway PostgreSQL 16 set to UTC (as CI); no production database, key or deployment used.

| Suite | Baseline (untouched merge `d9809197`) | Final |
| --- | --- | --- |
| Server, every `*.test.ts` in its own process | 158 files · 1138 pass · 9 fail | 164 files · **1188 pass · 9 fail** — failing set **identical**, no file lost a pass |
| TypeScript `tsc --noEmit` | 463 errors | 463 errors, **0 new** |
| iOS `swift test` | — (NM06 accepted: 473 executed) | **515 executed, 0 failures** |
| iOS `swift build`, XcodeGen bundle IDs, simulator app, unsigned Release | — | **all succeeded** |
| Android `testDebugUnitTest` | 483 · 0 failures | **497 · 0 failures** |
| Android `assembleDebug`, `assembleUat` (Release config) | ✅ | ✅ |
| Android `assembleRelease` | requires owner upload-signing credentials (by design) | same — **not run: owner signing** |

Baseline server failures (pre-existing, unchanged): 6 files `Cannot find package 'server-only'` in the
bare bun context (ENV); `android-production-wrapper-contract` (assetlinks fingerprints),
`canonical-wedding-social-template` (stale route string) — stale source contracts on the backend
candidate.

## 10. Remote CI

Temporary workflow `qro01-temporary-integration-qualification.yml` (server suites against a CI
PostgreSQL, the accepted macOS-14/Xcode-16.2 iOS job, Android unit + debug + UAT assembly), removed
before return.

| Item | Value |
| --- | --- |
| Workflow | `QRO01 temporary integration qualification` |
| Run | `36242916755` — **success** |
| Qualified SHA | `b59893e07a853a70abd4d6283e547d6ec9602e92` |
| Job `108406687752` server | success — 23 suites, **272 pass / 0 fail** (CI PostgreSQL, disposable keys) |
| Job `108406687656` iOS (macOS-14, Xcode 16.2) | success — `swift test` **515 executed, 14 skipped, 0 failures**; `swift build`; XcodeGen bundle IDs; simulator app **BUILD SUCCEEDED**; unsigned Release **BUILD SUCCEEDED** |
| Job `108406687509` Android | success — `testDebugUnitTest assembleDebug assembleUat` BUILD SUCCESSFUL, 0 failures |

Vercel built a Preview of the qualified SHA: `https://wewed-bedqbzju1-11-11.vercel.app` (passes the
compiled productionPreview allowlist; protected by Vercel SSO — native/collector access needs the
owner-issued bypass secret).

`wedding-pass-convergence-ci.yml` also reports a zero-job `push` failure on this branch; the identical
zero-job failure occurs on the untouched backend candidate `926d89a1` (run `36230133963`) — pre-existing
workflow configuration, not introduced here.

## 11. Real-data activity

- **Reads of real data: none.** No real account, Guest, invitation or Preview credential was available
  to this agent; nothing was authenticated against wewed.pro or any Preview.
- **Writes to real data: none.** No wedding affected; nothing to restore.
- Unauthenticated, non-mutating probes only: a Preview root and `/api/native/account/authority` →
  302 to Vercel SSO (Deployment Protection confirmed).
- Pushing this branch lets the Vercel Git integration build a Preview of it (Preview environment,
  never production). The P0 Preview guards are part of every pushed commit.
- **Local synthetic three-client run (NOT LIVE PARITY):** a local Next server in Preview mode against
  the throwaway database; the real DEBUG iOS app (simulator, productionPreview lane) and the real
  DEBUG Android app (emulator, `pro.wewed.app.dev`; the installed `pro.wewed.app` untouched) opened a
  synthetic Guest's private invitation. The checker compared `desktop` (collector), `ios` and
  `android` records: **PASS** on wedding ID, Guest ID, table ID, party 2, attending, Guest-name digest,
  `ivory-floral-gold`, `not_yet_issuable`; no credential issued, no invitation token written. An
  unsigned simulator build cannot use the Keychain and shows "This invitation link can't be opened"
  (the Guest session cannot be stored) — ENV; ad-hoc signed builds work.

## 12. Open items

**LIVE PARITY — `REAL ACCOUNT AUTHENTICATED PARITY EXECUTION OPEN — IMPLEMENTATION READY`.**
Prerequisites (owner/Vercel):

1. The Preview URL of this branch, and a Vercel *Protection Bypass for Automation* secret for it
   (DEBUG/qualification only).
2. Preview environment: `WEWED_PREVIEW_WRITABLE_WEDDING_ID` = Charity & Kudzie's ID (only for the
   later controlled write); `WEWED_SESSION_SECRET`; for Pass-state parity `WEWED_WEDDING_DAY_WW2_ENABLED`
   plus `WEDDING_DAY_WW2_*` / `WEDDING_DAY_ROOT_*` keys **for Preview**. Pass-state parity is impossible
   while WW2 is disabled (the Pass GET answers `WEDDING_DAY_DISABLED`).
3. **Migrations** `20260923210000_wedding_gate_authority` and `20260924000000_wedding_day_ww2_authority`
   (plus the two `20260922*` fixes) applied to the database the Preview uses — the live database.
   Owner decision; not performed.
4. Controlled real accounts via secure storage: the Guest's private invitation link (label `G`), the
   Couple (`CA`) and/or Planner (`P`) with a legitimate Charity & Kudzie membership.
5. Then: `bun scripts/parity/wewed-parity.ts collect` + DEBUG app exports (iOS
   `WEWED_PARITY_EXPORT_LABEL=G`, Android `wewed_parity_export_label`) + `check --require
   desktop,native-api,ios,android --same-wedding G,G-VIA-P,P`.

Also open:

- **END-TO-END** controlled Charity & Kudzie RSVP write — not performed (requires §12.1–4 and explicit
  authorization). Recommended sequence and restoration: plan §10; record the pre-snapshot (RSVP,
  party, table, Pass state, audit baseline), accept from native, verify desktop + other native, then
  restore through `PUT /api/weddings/<slug>/guest-session`; never delete audit rows; revoked
  credentials stay revoked.
- **Early WW2 X→revoke→Y qualification (§22):** do it on an isolated synthetic wedding (the
  `wedding-day*.integration` / `global-qr-convergence` suites already do exactly this against a
  throwaway DB) or a separately scoped synthetic Preview wedding. Never move the Charity & Kudzie
  date, spoof time, or issue a premature credential.
- Native Couple/Planner **Wedding Pass administration surface**: none exists natively yet
  (desktop-only) → `G-VIA-P` parity covers identity/RSVP/party/table, not Pass state.
- Native `overview`/`seating`/`timeline`/`vendors` duplicated reads (P2, §7).
- Coordinator decisions D-COORD-ACCOUNT-CLASS, D-COORD-INVITATION-LIFECYCLE, D-VIEWER-WORKSPACE.
- Legacy `role=admin` all-wedding desktop access vs native (Admin phase; parked).
- Visual device certification of NM06 presentation on this SHA (LNM, moderator-released).

## 13. Security

No password, invitation token, Guest Session cookie, Supabase or native session token, raw WW2
credential, private key or bypass secret was printed, committed or written to evidence. Synthetic
test keys were generated locally per run and discarded.

## 14. Git

- Branch: `integration/phase13-live-account-data-convergence-20260926` (pushed; not merged; not deployed to production).
- Qualified product SHA: `b59893e07a853a70abd4d6283e547d6ec9602e92` (run `36242916755`).
- Final commit: this receipt plus removal of the temporary workflow — **no product source changed
  after qualification**; the final SHA is reported in the moderator return.
- No temporary workflow remains in the final tree.

Commits (oldest first): `d9809197` reconciliation merge · `40163083` Preview P0 guards · `a9166ea5`
RSVP rollback lifecycle · `7f0acbcb` productionPreview + Release origin fix · `e406ce78` parity
contract + credential/arrival split · `5712a2e5` Coordinator eligibility foundation · `53eed2ba`
shared Guest-record projection · `3965c662` collector/CLI + in-app exporters · `b59893e0` temporary
qualification workflow.
