# QRO04 / PASSGATE01 — Isolated WW2 Wedding Pass + Gate convergence: receipt (2026-09-27)

**Status: IMPLEMENTATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.** Released by
`docs/agent-prompts/QRO04_PASSGATE01_ISOLATED_WW2_GATE_CONVERGENCE_20260927.md` (docs `45c6d2fc`).

**Result: PROVEN.** The X → revoke → Y lifecycle, the exact-token Gate, the issuance window,
the RSVP ↔ Pass lifecycle, Planner/Couple administration, Gate authority and the iOS/Android
contracts all pass. They ran on a disposable PostgreSQL database with ephemeral P-256 keys, locally
and in the repository's CI workflow. Charity & Kudzie is unchanged.

One bounded defect was found and fixed: **the Wedding Pass convergence CI workflow had never been
able to run.**

## 1. Repository

| Item | Value |
| --- | --- |
| Starting HEAD | `integration/phase13-live-account-data-convergence-20260926` @ `fa7284fd9b60f927ab28eb6ec627d3ac4a38d4cd` (exact) |
| Production main | `646f08421d778cf6f85bf12195581228ae3fbccc` (unchanged) |
| Closure branch | `closure/phase13-qro04-pass-gate-ci-path-filter-20260927` |
| Fix commit | `7be03e99f097a26549f5fb28d1aa04f6e7e2d6c3` (1 line, `.github/workflows/wedding-pass-convergence-ci.yml`) |
| Final SHA | this receipt commit on the closure branch |
| Product/test source changed | **none** |

## 2. Defect found and fixed — CI gate unparseable

- **Symptom.** `gh workflow run wedding-pass-convergence-ci.yml` returned `HTTP 422: … pull_request event contained invalid paths patterns: src/app/api/weddings/[[]slug]/guest-session/**`. Every push-triggered run of the workflow concluded `failure` with no jobs. Recent examples: `36286812478` (fa7284fd), `36284946358`, `36283379838`, `36282409398`, `36282361743`.
- **Scope.** The pattern has been present since the workflow was created (`188094c7`, 2026-09-26), so the gate had **never executed a job**.
- **Fix.** `'src/app/api/weddings/[[]slug]/guest-session/**'` → `'src/app/api/weddings/*/guest-session/**'`. The `*` matches the single `[slug]` segment. No other change.
- **Proof.** Dispatch was then accepted. Run **`36289886247`** (`workflow_dispatch`, head `7be03e99`) concluded **success**. Every step passed: clean migrations on a PostgreSQL 16 service; token-containment contracts; global Pass/QR convergence; WW2 domain authority; WW2 route handlers; activation rehearsal; Guest RSVP convergence; Guest Session non-admission; Preview live-data safety; RSVP writers preserve the Pass lifecycle.

## 3. Charity & Kudzie — read-only readiness (unchanged)

Integration Preview `dpl_GG31VmHJUcTeYorQy6EPBNmehhAn` (`wewed-jf9t9h8sz`), Ready, built from `fa7284fd`. No `WEWED_PREVIEW_WRITABLE_WEDDING_ID` in any Preview scope. Window 02:53:31Z–03:01:26Z. Only GETs after Preview sign-in (bookkeeping and membership acceptance are suppressed on Preview).

| Check | Before | After |
| --- | --- | --- |
| Wedding ID / date | `cmqos70cb0004q6vxe9g9aiu5` / 2026-12-23T14:00Z | same |
| Guest | `cmuahx3ka0001js043cseq7z4` | same |
| RSVP | `pending` (attending null) | same (full RSVP field set equals the certified QRO03 pre-state) |
| Invitation style | `ivory-floral-gold` | same |
| Guest token sha256 | `92277a97…182f0ac9` | same |
| Wedding Day | `503 WEDDING_DAY_DISABLED` (BLOCKED-ACTIVATION) | same |
| `GET /api/planner/wedding-passes` | 500 (twice) | 500 |

**Why the Pass list returns 500, and what it proves.** The Preview runtime log shows `Raw query failed. Code: 42P01 … relation "public.WeddingPassCredential" does not exist` and `… "public.WeddingCheckIn" does not exist`. The shared live database has **no WW2 Pass or check-in tables**: the integration branch's WW2 migrations have never been applied to it. So:

1. C&K `WeddingPassCredential` / `WeddingCheckIn` rows are zero before and after, structurally. They cannot exist.
2. Listing Pass metadata cannot mint anything (the route is GET-only; its SQL selects only serial, version, issueSeq, timestamps and revocation fields, never token, nonce or signature; see `route.ts` L40–71).
3. The responses carried 0 WW2-shaped strings and no `token`/`nonce`/`signature`/`qrPayload` keys.

Readiness note: the Planner Pass list, and WW2 generally, cannot work on live data until the WW2 migrations are applied to production. That requires explicit approval and is out of scope here.

No Gate, check-in or revoke request reached any deployment in the window. Project runtime logs show only the unauthenticated Wedding Day probe (503).

## 4. Isolated qualification environment

- **Database.** Local PostgreSQL 16.15 (Homebrew), fresh database `wewed_qro04_passgate`, timezone UTC. Recorded classification: `DATABASE_URL`, `DIRECT_URL` and `AUTHORITY_TEST_DATABASE_URL` all `host=localhost db=wewed_qro04_passgate localhost/disposable = True`. Only `.env.example` exists in the worktree, so no live values can be loaded.
- **Migrations.** `prisma migrate deploy` (Prisma 6.19.2, locked dependencies via `bun install --frozen-lockfile`): **102 applied**, "All migrations have been successfully applied".
- **Session secret.** The CI synthetic `ci-session-secret-not-for-production`.
- **Keys.** Generated per test process with `generateKeyPairSync('ec', { namedCurve: 'prime256v1' })` (P-256) for both roles (WW2 credential signing, Wedding Day root/manifest). Synthetic key IDs `ww2-lqr01-<run>` / `root-lqr01-<run>`. generated-for-test = true. They are held only in process env, never written or committed. No production key was read or used.
- **Leak scan.** Logs contain **0** raw WW2-shaped tokens and **0** private-key blocks. The disposable database contains **0** C&K wedding rows.

## 5. Server qualification (local, disposable DB, `fa7284fd`)

| Suite | Result |
| --- | --- |
| `wedding-pass-availability.test.ts` | 13 pass / 0 fail |
| `global-qr-convergence.integration.test.ts` | 6 / 0 |
| `wedding-day.integration.test.ts` | 7 / 0 |
| `wedding-day-routes.integration.test.ts` | 6 / 0 |
| `wedding-day-activation-rehearsal.integration.test.ts` | 10 / 0 |
| `guest-rsvp-convergence.integration.test.ts` | 16 / 0 |
| `unified-navigation-privacy.test.ts` | 7 / 0 |
| `preview-live-data-safety.integration.test.ts` | 8 / 0 |
| `rsvp-pass-lifecycle-writers.integration.test.ts` | 4 / 0 |
| `gate-authority-boundary.test.ts` | 3 / 0 |
| `wedding-day-key-preflight.test.ts` | 11 / 0 |
| `wedding-pass-issuance-window.test.ts` | 14 / 0 |
| **Total** | **105 pass / 0 fail** (each file in its own process, as in CI) |
| QR/invitation separation: `digital-invitation-card.test.ts`, `physical-invitation-access.test.ts`, `personal-invitation-mobile-entry.test.ts` | 10 + 9 + 7 pass / 0 fail |
| CI workflow run `36289886247` (fixed gate) | success |
| Typecheck `tsc --noEmit` | 463 errors = the recorded repository baseline (QRO02B1), **0 new**. Pass-area lines are pre-existing (e.g. `native/gate/wedding-day/check-in/route.ts:178` TS2783, test-file env typings). |

The integration suites genuinely executed against the database. After the run it held 16 `WeddingPassCredential` and 10 `WeddingCheckIn` synthetic rows, and no test was skipped.

## 6. WW2 lifecycle — X → revoke → Y (`global-qr-convergence`, "every Wedding Pass surface converges on X, rejects X after revocation, and converges on Y")

Synthetic wedding at **now + 5 days** (inside T-14). Synthetic attending Guest with a plus-one household. Synthetic usher assigned via `WeddingGateAssignment` (`gate.manifest.read`, `gate.checkin.write`, `gate.pass.revoke`).

| | X | Y |
| --- | --- | --- |
| credentialId | `8897b219-ab29-4387-9137-2e55beb98160` | `66876d14-e7c0-4411-9147-3fb16f95851a` |
| passSerial | `WWADA87741-001` | `WW91E13790-002` |
| issueSeq | 1 | 2 |
| tokenVersion / segments | `WW2` / 6 | `WW2` / 6 |
| **sha256(token)** | `17da138cca08e2865874829bcbd351d4ae097e05feec60767555b7c8165e7ff8` | `01f1711ceb00acb87d8414b810ff0d921b0a90c6b6109d807caacec3271d60e5` |
| sha256(nonce) | `81ac6e40…` | `4d0f71e3…` (different) |
| expiresAt | wedding + **36h** | wedding + **36h** (reissue does not move the ceiling) |
| final state | revoked, reason "LQR01 contract revocation", row preserved | live |

Test assertions and disposable-DB cross-checks (stored tokens re-hashed to the logged digests):

- **X issued, then reused everywhere.** A Guest retrieval returns `active` X with `issueSeq` 1. Re-retrieval returns byte-identical X, and the credential count stays 1. The Planner metadata row shows the same serial, `WW2`, `issueSeq` 1 and no token. The Planner exact-view returns byte-for-byte X (`Buffer.compare = 0`). The view audit event `wedding_pass.viewed` does not contain X. The fresh manifest carries X unrevoked.
- **Gate accepts X.** Primary attendee admitted (admittedCount 1). A duplicate `clientEventId` is idempotent. The row records credentialId X, gate, operator and `offline-sync`. Planner shows credential `active` and arrival `partially_checked_in`, two independent dimensions.
- **Serial-only is refused.** `SERIAL_ONLY_ADMISSION_UNSUPPORTED` (400), and a batch legacy item lands in `blockedLegacyIds`. Scanner whitespace around X is the same credential. A tampered payload returns 400. A wrong wedding throws `PASS_WEDDING_MISMATCH`.
- **X revoked** through the Gate operator revoke route (200). Planner shows `revoked` with `revokedAt`, and arrival stays `partially_checked_in`. The Planner exact-view refuses (409) and nothing is re-minted. The online Gate rejects X with `PASS_REVOKED_OR_EXPIRED`. An offline replay of X lands in `rejectedIds`. The fresh manifest marks X revoked. `verifyWeddingPassToken(X)` throws `PASS_REVOKED_OR_EXPIRED`.
- **Y issued on the next Guest retrieval.** Y ≠ X, with a new credential ID, serial and nonce, and `issueSeq` 2. X is preserved as revoked. DB check: **1 live of 2** credentials for the Guest.
- **Convergence on Y.** The Planner exact-view returns Y, and the metadata shows serial Y, `issueSeq` 2, unrevoked. The manifest carries Y. The Gate admits the plus-one with Y (`qr`). Arrival becomes `checked_in` and `RSVP.checkedIn` becomes true. X remains rejected.

## 7. Policy and lifecycle coverage (all passing)

| Requirement | Evidence |
| --- | --- |
| T-14 opening; `not_yet_issuable` / `PASS_NOT_YET_ISSUABLE` before; exactly T-14 permitted | `wedding-pass-issuance-window.test.ts` (14); `global-qr-convergence` "availability states…" (a wedding at +120 days is `not_yet_issuable`, `opensAt` in the future) |
| +24h cutoff `issuance_closed` / `PASS_ISSUANCE_CLOSED`; +36h ceiling; issuance never moves the ceiling | `wedding-pass-issuance-window.test.ts`; wedding at −3 days; DB check above (both expire at wedding + 36h) |
| Pending → `rsvp_required`; declined → `declined`; no Pass | `global-qr-convergence` "availability states are structured and identical for Guest and Planner"; `wedding-day.integration` "guest RSVP eligibility gates pass issuance" |
| Message/meal/dietary edits never rotate; attendance withdrawal supersedes; re-acceptance never revives; next retrieval issues fresh; old rejected | `global-qr-convergence` "attendance withdrawal supersedes the Pass; re-acceptance never revives it; other edits never rotate"; `rsvp-pass-lifecycle-writers` (4) |
| Concurrent withdrawal vs retrieval serializes safely | `global-qr-convergence` "concurrent attendance withdrawal and Pass retrieval…" |
| Planner list read-only, cannot mint, no token/nonce/signature | `global-qr-convergence` "opening the Planner/Couple Wedding Pass list issues nothing and exposes no token"; `wedding-pass-availability.test.ts` token-containment contracts |
| Exact-view requires `guests.edit`; viewer cannot reveal; returns stored token, never reissues; audit token-free | `wedding-day-routes.integration` (grant authorization); §6 (byte-for-byte X/Y, 409 after revoke, audit free of X) |
| Guest Session is not admission authority | `global-qr-convergence` "a valid Guest Session cannot check in or create a WeddingCheckIn" (PATCH returns 405 `GUEST_SESSION_NOT_ADMISSION_AUTHORITY`; a smuggled `checkedIn` stays false); `unified-navigation-privacy.test.ts` |
| Gate authority freshly server-resolved; no client override; revoked/expired assignment loses access; no-store; no admin shortcut | `gate-authority-boundary.test.ts` (3); `wedding-day-routes.integration` "enabled feature gate enforces authentication and grant authorization", "valid gate operator can fetch manifest and post check-in"; `preview-live-data-safety.integration` (8) |
| Exact token mandatory; offline exact-token reconciliation; legacy entries blocked | §6; `wedding-day.integration` "gate admission, household expansion, offline sync, and signed manifest"; rehearsal stages 7–10 |
| Feature flag off fails closed; key preflight | rehearsal stages 1–3, 11; `wedding-day-key-preflight.test.ts` (11); `wedding-day-routes` "disabled feature gate returns 503", "enabled feature remains unavailable until both signing roles pass preflight" |
| Invitation QR ≠ Wedding Pass QR | The web Guest Pass dialog and Planner Pass admin render the stored WW2 token locally (`qrcode` → `toDataURL`). iOS `WeddingQRCodeView(payload: pass.qrPayload)` and Android ZXing `QRCodeWriter` do the same. No generic QR service is used on any Pass surface. Invitation-QR contracts pass (`digital-invitation-card`, `physical-invitation-access`, `personal-invitation-mobile-entry`). iOS `testActivePassKeepsTheExactSignedTokenAsTheQrPayload`. |

## 8. Native qualification (exact source; `apps/` unchanged since `ba38a362`)

- **iOS `swift test`: 523 tests, 0 failures.** Includes:
  - `GuestWeddingPassAvailabilityTests`: exact token as QR payload; another Guest's or a bad-signature pass never returned; revoked never yields a Pass; every availability state mapped; attendance precheck without requesting a Pass; distinct Pass-tab copy per state.
  - `WeddingDayOfflineTests`: P-256 P1363 verification accepts canonical, rejects tampering; revoked rejected offline.
  - `WeddingDayExactTokenQueueTests`: 18 exact-token queue, legacy-block and reconciliation tests.
- **Android `testDebugUnitTest`: 504 tests, 0 failures, 0 skipped.** Includes `WeddingDayExactCredentialQueueTest` (15), `WeddingDayOfflineTest` (9), `WeddingPassAvailabilityCopyTest` (4), `GuestSessionClientTest` (24), `GuestCeremonialEntryTest` (15), plus `Ww2TestSigner`-based verification tests.
- **Simulator/emulator Guest Pass identity flows** ran against the local `shadow` environment only (a bundled synthetic dataset, no server). Never C&K, never a live Preview.
  - iOS `.maestro/ios/ios-guest-pass-identity.yaml` on the user-visible iPhone 18 Pro simulator: **13/13 steps passed**. Two personas resolve distinct identities across Home, Invitation and Pass, and the Pass tab renders "Wedding Pass".
  - Android `.maestro/native-guest-pass-identity.yaml` on `emulator-5554`: **25/25 steps passed**. The Pass root and `wedding-pass-qr` render, and table, admission state and party are bound to the right persona with no cross-persona leak.

## 9. Observations for the moderator (not patched)

1. **WW2 schema is absent on the live database** (§3). Production migrations are required before any real Pass/Gate use; this needs approval.
2. **The shadow fixture mirrors C&K.** `mobile/fixtures/shadow-reference/reference-wedding-sanitized.json` (and the Android `ShadowReference*Repository` values) carry C&K's real wedding name, venue and date under a "Sanitized Shadow" badge. Guests are pseudonymous. Pre-existing; flagged by the owner during this run.
3. **Shadow Invitation screen shows a raw date.** The iOS shadow Guest Invitation screen renders `2026-12-23 14:00:00`, whereas the live Ivory invitation formats it properly. Owner-observed during this run. Cosmetic, shadow environment only.

## 10. Safety accounting

- Charity & Kudzie: **0** Pass, Key, Credential, CheckIn, Gate or assignment writes (the tables do not exist live), and no RSVP, date, style or token change.
- No production deployment, env, migration or key change. No WW2 enablement outside the disposable test processes. No real Gate operator created.
- Credentials came from the owner's mode-600 file via a literal parser, never printed. The Admin credential file was not read. `WEWED_PARITY_ALLOW_PASS_GET` unset. Guest Pass GET was never called on the shared Preview.
- This receipt contains no raw WW2 token, private key, RSVP token, cookie, bearer or bypass.

QRO04 ISOLATED WW2 WEDDING PASS + GATE CONVERGENCE PROVEN — X/REVOKE/Y + EXACT-TOKEN GATE + IOS/ANDROID CONTRACTS PASS — CHARITY & KUDZIE UNCHANGED — RETURNING TO MODERATOR.
