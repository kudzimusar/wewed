# LQR01 — Global Wedding Pass / QR convergence implementation receipt (2026-09-26)

**Status: IMPLEMENTATION-AGENT SUBMISSION — NOT A MODERATOR VERDICT.** Independent moderator
source/test review, reviewer-owned closure and a separate simulator/device certification agent are
still required (governance §3). Nothing here was merged, deployed, activated or run against
production.

Master plan: `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`, Phase 13 (Wedding Pass authority
convergence closure, following D-059/D-060/D-067).

## Canonical authority (unchanged)

One venue-admission authority: `WeddingPassCredential.token` (signed WW2, six-part dot wire
format, P-256 IEEE-P1363). WW2 was not redesigned. Trust domains remain separate:

| Domain | Purpose | QR payload |
| --- | --- | --- |
| Open Invitation | private invitation / Guest Session bootstrap | personal invitation link |
| Printed Invitation Access | shared physical-card access | shared access URL |
| Wedding Website | public/share navigation | website URL |
| **Wedding Pass** | **venue admission** | **exact `WeddingPassCredential.token`** |
| Vendor / Booking Page | marketplace navigation | provider URL |

## Branches

| Branch | Base | Purpose |
| --- | --- | --- |
| `hotfix/guest-checkin-authority-lqr01-20260926` | `main` `ba4b08f8` | QR-P0-01 only |
| `closure/phase13-global-qr-convergence-lqr01-20260926` | backend `55cadd94` | backend/web Workstreams 1–5, 7, 8 + QR-P0-01 port |
| `closure/phase13-global-qr-convergence-native-lqr01-20260926` | native NM06 `a978470a` | iOS/Android Workstreams 1, 4, 6, 8 |

**Branching deviation (flagged for moderator decision).** The task asked for native files to be
reconciled file-by-file into the backend branch. The backend authority line `55cadd94` contains no
native tree at all (`apps/` is absent), while NM06 carries `apps/` (446 files) plus an older backend
copy. Importing the native files into the backend line would amount to importing the whole native
tree — the merge the task forbids — and would create a third divergent copy of native code. Native
work was therefore done on a companion branch from the exact NM06 tip, following the established
backend/native branch-pair convention (e.g. NM01 backend `55cadd94` + native `0b6ecea6`). No
native file was copied into the backend line, and no unrelated NM06 UI history was touched.

## QR-P0-01 — Guest Session is not admission authority

Root cause: `PATCH /api/weddings/[slug]/guest-session` wrote `RSVP.checkedIn = true` for any holder
of a Guest Session cookie; its only caller was the web `QrCheckin` "Confirm my arrival" button.

Fix (both backend branches): PATCH returns a non-mutating `405 GUEST_SESSION_NOT_ADMISSION_AUTHORITY`
and performs no database access; `QrCheckin` is read-only arrival status. Guest Session RSVP PUT is
unchanged and still cannot write `checkedIn`. On `main` the authoritative operator path is the
permission-gated `POST /api/planner/event-day` (`guests.edit`, audited); on the Phase-13 line it is
the Gate grant + exact WW2 credential (`WeddingCheckIn`). No native client calls the PATCH.

## Workstream 1 — exact-token offline reconciliation

Root cause: native Gate verified the exact WW2 token offline but queued only `passSerial`; the
server admitted serial-only sync after a revocation/expiry/key check, i.e. without proof that the
exact issued credential had been scanned.

Server: `checkInWeddingGuest` requires the token and re-runs `verifyWeddingPassToken` (signature,
key lifecycle, byte-for-byte match with the issued row, revocation/expiry). Serial-only single
requests get `400 SERIAL_ONLY_ADMISSION_UNSUPPORTED` (or `PASS_TOKEN_REQUIRED`); in batch form they
are reported as `blockedLegacyIds` and never admitted. Terminal verification failures are reported
as `rejectedIds` separately from retryable `failedIds`. Wedding/Gate/operator are still derived
from the operational grant; `clientEventId` idempotency and attendee keys are unchanged. No manual
serial-admission feature was added (no product requirement found).

### Threat model and storage decision

- The WW2 token is a bearer credential: whoever can present it can be admitted until it is revoked
  and the revocation reaches the Gate.
- Threats considered: exfiltration of queued credentials from an ordinary cache/backup; forged or
  replayed sync events; a legacy serial-only queue being upgraded to trusted admission; loss of the
  secure store.
- Decision: queue **metadata** (event id, wedding, serial for display, attendee keys, device id,
  state) stays in the existing durable offline cache; the **token** is written only to the existing
  OS-protected store under `ww2.offline.<eventId>`:
  - iOS: Keychain via `KeychainSecureStorage`, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
    (not synced/backed up to other devices), dedicated service
    `pro.wewed.app.wedding-day.offline-credentials`;
  - Android: `AndroidKeystoreSecureStorage` (non-exportable Keystore AES-GCM key, per-value IV),
    preferences `wewed_wedding_day_offline_credentials`.
  No custom cryptography. The token is deleted from the vault once the event is synced or
  terminally rejected, and when the wedding's manifest is cleared.
- Fail-closed classes, never sent: `legacyCountOnly` (no attendee keys), `legacySerialOnly`
  (pre-LQR01 record — the exact credential was never retained, so it cannot be migrated to a trusted
  QR event), `credentialUnavailable` (vault lost the token). They surface as `blockedLegacyIds` for
  operator resolution.

Native (both platforms, same classes and codes):
- `recordOfflineCheckIn(weddingId, token, count)` replaces the serial-based call (removed from the
  protocol). The serial is parsed from the token; non-WW2 payloads are refused; admission/household
  logic is unchanged. The token is secured in the vault after the admission checks and before the
  queue record is persisted (iOS reads it back; Android writes synchronously via `commit()` and
  refuses the admission if the write fails).
- Sync posts `{token, attendeeKeys, clientEventId, deviceId}` — no `passSerial`. Only
  `exactCredential` events are sent (attendee keys present, `credentialRef` present, vault token is
  WW2 and its serial equals the record's). 2xx → synced; HTTP 400 with one of the 11 terminal codes
  → `rejectedIds` (no longer pending, never resent); anything else → `failedIds` (retried).
- Persistence: iOS Codable optional fields; Android appends `credentialRef`, `rejectionCode` and a
  `v3` trailer to queue lines while still loading 12-column `v2` lines.
- Production factories: iOS `OfflineManifestStore.shared` / `deviceProtected(...)`; Android
  `OfflineManifestStore.deviceProtected(context, storageDir)`. Plain constructors default to an
  in-memory vault so unit tests never touch Keychain/Keystore.
- The Gate runtime is still opt-in: no production code constructs `ManifestBackedWeddingDayGate`.
  Whoever wires it must use the device-protected factory; with the plain constructor a restart
  would make queued events `credentialUnavailable` (fail closed, but unsyncable).

## Workstream 2 — RSVP ↔ Pass lifecycle

`applyGuestRsvpUpdate` (used by Guest Session PUT and `/api/rsvp`) now runs in one transaction with
the Guest → RSVP → credential lock order already used by issuance and Gate check-in. When attendance
goes from `true` to anything else, every live credential is revoked and superseded
(`revocationReason = rsvp_attendance_withdrawn`, audited as `wedding_pass.revoked` with no actor).
Re-accepting issues nothing; the next authorized Pass retrieval mints a fresh credential (new
`issueSeq`, serial, nonce, token). Non-attendance edits never rotate. Pending → declined creates
nothing. The Planner worksheet import (the other attendance writer) calls the same single helper
(`wedding-pass-attendance.ts`, re-exported by `wedding-day.ts`). No second lifecycle service.

## Workstream 3 — Couple/Planner Wedding Pass surface

InvitationManager still shows invitation-access QR. New, separate:
- `GET /api/planner/wedding-passes` (`guests.view`): per-Guest state (Pending RSVP, Declined, Pass
  not yet issuable, Pass not yet issued, Pass active, Pass revoked, Pass superseded, Issuance closed,
  Partially checked in, Checked in) and metadata (serial, tokenVersion, issueSeq, issued/expiry,
  revocation, party, table, check-in). Never issues; never selects token/nonce/signature.
- `POST /api/planner/wedding-passes/view` (`guests.edit`): deliberate, audited
  (`wedding_pass.viewed`, no token in the audit) retrieval of the exact active token, re-verified as
  the Gate would. Never mints — `409 NO_ACTIVE_WEDDING_PASS` otherwise.
- `WeddingPassAdministration` renders that token verbatim as the QR payload (`qrcode.toDataURL`
  locally, never `/api/qrcode?data=`), as its own "Wedding Pass · venue admission" tab in Planner
  "Invitations & QR" and in the Couple invitations centre. No CSV/export/analytics path reads
  credential tokens (source-contract tested).

## Workstream 4 — issuance-window coherence

Policy unchanged: opens 14 days before, issuance closes 24h after, credential expiry 36h after.
`/api/wedding-day/pass` responses always carry `availability {state, code, opensAt, cutoffAt,
expiresAt}`:

| state | code | HTTP |
| --- | --- | --- |
| `rsvp_required` | `ATTENDANCE_REQUIRED` | 403 |
| `declined` | `ATTENDANCE_DECLINED` | 403 |
| `not_yet_issuable` | `PASS_NOT_YET_ISSUABLE` | 409 |
| `active` | `PASS_ACTIVE` | 200 |
| `issuance_closed` | `PASS_ISSUANCE_CLOSED` | 410 |
| `revoked` | `PASS_REVOKED` | 410 |

The web Guest Pass dialog, iOS and Android render the same sentences per state; the bearer token is
never issued early to avoid a state.

## Workstream 5 — terminology

Planner dialog explains the four domains; tabs read "Open Invitation · Guest cards, RSVP & guest QR",
"Wedding Pass · venue admission", "Invite project team member". Physical card QR is "Printed
Invitation Access"; InvitationManager is "Open Invitation"; the couple-site QR is "Wedding Website
QR". "Invitations & QR" remains as the entry label because the contained UI now separates each domain.

## Workstream 6 — selective native convergence

Native work was done in place on the authoritative native line, not copied into the backend line
(see "Branching deviation"). Source for every native file: NM06 `a978470a0ff190d162ded4d6d6c6c4dd6c524f70`.

| Requested file | iOS | Android |
| --- | --- | --- |
| GuestSessionClient | changed — availability → `passUnavailable`; live contract kept | changed — same |
| LiveGuestInvitationCoordinator | changed — exhaustive switch cases only | changed — same |
| WeddingPass | unchanged (model reused) | changed — `WeddingPassAvailability(State)` added |
| WeddingReferencePassView / Screen | unchanged | unchanged |
| WeddingQRCodeView / WeddingQrCode | unchanged | unchanged |
| WeddingDayGateOperations | changed — exact token; `authorityStatus(now)` | changed — same |
| WeddingDaySyncService | changed — exact-token sync, `rejectedIds` | changed — same |
| OfflineManifestStore | changed — vault, classification, rejection | changed — same + v3 lines |
| UsherScannerView / Screen | changed — authority-age line when a Gate is wired | changed — same |

Also changed: iOS `WeddingDayManifestTrustStore.swift`, `LiveGuestShellView.swift` (Pass-tab state
copy only); Android `WeddingDayManifestTrustStore.kt`, `LiveInvitationPresentation.kt`,
`LiveGuestShell.kt` (failure branch only), `AndroidKeystoreSecureStorage.kt` (opt-in durable writes).

Live contract preserved and unit-tested on both platforms with real P-256-signed WW2 tokens:
`GET /api/wedding-day/pass` → returned `guestId` must equal the presented Guest → token must start
`WW2.` → asymmetric verification with `publicKeyDerBase64` → `WeddingPass.qrPayload == token`
byte-for-byte → the canonical QR view encodes `pass.qrPayload`. A non-active availability (or a bad
signature / another Guest's pass) never yields a `WeddingPass`. Pass-tab sentences are identical to
the web copy.

## Workstream 7 — global convergence contract

`src/lib/global-qr-convergence.integration.test.ts` (real route handlers, disposable PostgreSQL).
Local evidence run (digests only; raw tokens never printed):

- X: passSerial `WW3E059A4E-001`, issueSeq 1, sha256 `5dc810fd126a972313a2128134ce0669de75d926e33be907faf897514bd38215`
- Y: passSerial `WWE219DF38-002`, issueSeq 2, sha256 `6dda0177931f8cd3cf885ffc160412352f541e652e604bb1d0a9359aaff0fa60`

(Identifiers are from a disposable local database and differ on every run.)

Proven server-side: web Guest Pass payload == X; Planner view payload == X byte-for-byte; Planner
metadata matches; fresh manifest admits X; online Gate accepts X (partial household) and the
duplicate offline event is idempotent; serial-only replay refused; cross-wedding refused. After
revocation: Planner reports revoked and refuses to show X without minting; online Gate rejects X;
offline replay of X is terminally rejected; fresh manifest marks X revoked. Reissue: Y ≠ X,
issueSeq 2, new serial and nonce; web, Planner view/list, manifest and Gate all converge on Y;
completing the household marks the Guest checked in.

iOS/Android client payload == token is proven by native unit harnesses against the same response
contract (see Workstream 6). **Simulator/device runtime proof of X → revoke → Y on iOS and Android
remains OPEN** for the certification agent.

## Workstream 8 — stale offline authority observability

TTL unchanged (12h). Both native platforms add `WeddingDayAuthorityStatus` (manifest generatedAt, expiresAt, age,
`isStale` at ≥ 2 h, `isExpired`, `relyingOnCachedAuthority = true`), exposed as
`WeddingDayGateOperations.authorityStatus(now)` (protocol default nil) and rendered in the usher
scanner as e.g. "Offline authority · generated HH:mm · expires HH:mm · age 3h (stale)" plus "Admission
is being checked against this device's cached list; revocations made after it was generated are not
visible until refresh." It never blocks admission. The scanner line only appears when a Gate runtime
is injected (none is in production builds yet). Server manifests already carry `generatedAt` /
`expiresAt`.

Do not describe offline revocation as instantaneous: a Gate relying on a cached manifest admits a
pass revoked after that manifest was generated; the server rejects the later sync (`rejectedIds`),
so the ledger stays correct but the physical admission has already happened.

**Recommendation for the owner/moderator (not implemented as policy):** keep the 12h signed
manifest TTL as the cryptographic ceiling, but set an operational maximum offline authority age of
**4 hours** for admission on the wedding day, with the 2-hour stale warning as the prompt to refresh;
refresh at gate opening and at least every 15 minutes whenever connectivity exists. Beyond 4 hours
the Gate should require an explicit operator acknowledgement (or refuse) rather than silently
continuing. Final value is an owner decision.

## Test evidence (local, this machine)

Disposable PostgreSQL 16 databases set to UTC; CI-only session secret; P-256 keys generated in-process
per run and never persisted (the e2e key file was deleted after use).

Branch A (`main` + QR-P0-01):
- `bun test src/lib/guest-session-admission-authority.integration.test.ts` — 6 pass; against the
  unpatched route 4 of 6 fail (red→green proven).
- with `unified-navigation-privacy` + `digital-invitation-experience` — 26 pass.
- full `bun test`: before 829 pass / 58 fail, after 829 pass / 59 fail; the failing-test name sets are
  identical. The extra count is the new file reporting as a Bun "unhandled error between tests" in the
  single-process run, because another suite in the same process fails to load `server-only` and
  poisons the shared module cache. Run on its own (as CI does), it passes 6/6.
- `tsc --noEmit`: no errors in changed files (208 pre-existing elsewhere).
- production `next build`: success.

Branch B (backend convergence), each file in its own process:
- `wedding-pass-availability.test.ts` 12 pass; `global-qr-convergence.integration.test.ts` 6 pass;
  `wedding-day.integration.test.ts` 7; `wedding-day-routes.integration.test.ts` 6;
  `wedding-day-activation-rehearsal.integration.test.ts` 10; `guest-rsvp-convergence.integration.test.ts` 16;
  `unified-navigation-privacy.test.ts` 7; `planner-stage8-information-architecture.test.ts` 7;
  `planner-worksheet-ux-regression.test.ts` 10; `digital-invitation-experience.test.ts` 13;
  `personal-invitation-mobile-entry.test.ts` 7; `planner-production-blockers.integration.test.ts` 1.
- Mutation check: removing the attendance withdrawal fails 2 of the 6 contract tests.
- full `bun test`: before 1119 pass / 57 fail, after 1136 pass / 58 fail. The only new named failure,
  `communications rate limit policy`, fails identically on the pristine baseline when run alone
  (pre-existing, previously masked in the single-process run).
- `tsc --noEmit`: 241 errors before and after, identical set (zero new).
- production `next build`: success. `e2e/wedding-pass-convergence.chromium.spec.mjs` against that
  build with WW2 enabled and disposable keys: 1 passed (Ivory → Guest Pass shows the real signed WW2
  credential).

Native (companion branch):
- iOS `swift test`: 500 executed, 0 failures (baseline 473); `swift build` OK; XcodeGen OK;
  simulator Debug `xcodebuild` BUILD SUCCEEDED; unsigned generic-device Release BUILD SUCCEEDED.
- Android `./gradlew testDebugUnitTest assembleDebug`: 483 tests, 0 failures, 0 errors
  (baseline 458); debug APK assembled.
- Existing native tests that encoded serial-only sync were converted to the exact-token API; every
  prior assertion was kept and `passSerial` was added to the forbidden sync-body keys. The native
  implementers also mutation-checked the new suites.
- Not run: instrumented Android tests, XCUITest, simulator or device journeys.

## Migrations

No new migrations. No schema change. Review targets unchanged and not applied anywhere but local
disposable databases: `20260923210000_wedding_gate_authority`,
`20260924000000_wedding_day_ww2_authority`. Behavioural note for activation review: after these
changes an existing serial-only offline queue on a device will not sync; it must be resolved by an
operator (none exists in production because Gate admission was never activated).

## Production prerequisites still unproven

Production WW2/root keys; `WEWED_WEDDING_DAY_WW2_ENABLED`; production application of the two
migrations; production `WEWED_SESSION_SECRET`; release-signed native builds; live Gate; release-mode
parity against `https://wewed.pro`; iOS/Android simulator and device certification of this change;
owner decision on offline authority age.

## Observed but out of scope

- `DELETE` of a Guest that holds any `WeddingPassCredential` will fail on the `Restrict` FK
  (`src/app/api/planner/guests/[id]/route.ts`); pre-existing, untouched.
- `GET /api/qrcode?data=` renders arbitrary payloads server-side, placing them in URLs/logs. No
  Wedding Pass surface uses it (contract-tested); it should stay that way.
- Local PostgreSQL defaulted to `Asia/Tokyo`; `timestamp without time zone` + SQL `now()` then
  reads back shifted and WW2 keys appear not yet active. Test databases were set to UTC (CI parity);
  production must stay UTC.
