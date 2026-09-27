# QRO05-PIQR01 — Planner Invitations & QR native read parity — implementation receipt

Master plan `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`. This is an implementation self-report; it does
not close the unit. Independent moderator review of the remote branch decides acceptance.

- Branch: `closure/phase13-qro05-planner-invitations-qr-read-parity-20260927`
- Start: `82507bf81746984148524c79f28a6758c6319a00` (QRO04-UI01 RC02 accepted head)
- Implementation head before this receipt: `bbd0b5867ac267fefa999f349794e64bab2eb5cd`
- No merge, no deploy, no production mutation, no migration, no secret or env change.

## Architecture

- `src/lib/planner-invitation-projection.ts`: `loadPlannerInvitationProjection(weddingId, origin)`
  and `loadPhysicalInvitationProjection(weddingId)`. The desktop Planner GET code was moved here
  verbatim, and read-only.
- Desktop `GET /api/planner/guests/invitations` (JSON and CSV) and `GET|POST …/physical` now read these
  functions. Their write handlers (PUT/PATCH/POST) are unchanged.
- New native routes are GET-only: `/api/native/wedding/invitations` and `/…/physical`. Each runs
  `resolveNativeGrantContext` → `requireWeddingScope` → `requireGrantPermission('guests.view')` and
  responds `private, no-store, max-age=0` + `Vary: Authorization`.
- iOS and Android `NativeDomainApiClient`: `plannerInvitations` and `plannerPhysicalInvitation`
  (Bearer + `grantId`).
- `ProductionWeddingRepository.loadPlannerInvitations()` is deliberately outside the repository
  protocol, and the wedding graph never calls it.
- Production Planner → More → Invitations & QR holds the snapshot only in screen state and shows
  three sections:
  - **Invitation design**: human style name, message, RSVP deadline, children policy.
  - **Printed Invitation Access**: configured state, shared code, guests listed and opens, QR
    `planner-physical-invitation-qr`, share.
  - **Guest Open Invitations**: name, table and RSVP status; Show QR `planner-guest-invitation-qr`;
    Share Invitation. Guests without a link show "No invitation link yet".
- A generic QR renderer was extracted (`WewedQRCodeView`, `WewedQrCode`). The Wedding Pass wrappers
  keep `wedding-pass-qr` and their existing label.
- Share hands over the server-provided `shareMessage` / `accessUrl` unchanged: iOS `ShareLink`,
  Android `ACTION_SEND` chooser.
- The "The app does not load them yet" placeholder is removed on both platforms.

## Private-link treatment

Invitation URLs, `qrValue` and `shareMessage` are:

- never rendered as text or put in accessibility labels or content descriptions;
- never stored in `WeddingGraphState` / `rememberWeddingGraph`;
- redacted from model descriptions (`description` / `debugDescription` / `toString`);
- never logged — the native routes log only the error name.

Source guards in the lane-regression suites enforce all of this. Fixture links in the tests are
synthetic `fixture.invalid` placeholders.

## Qualification

| Check | Result |
| --- | --- |
| Native read convergence (disposable PG, real handlers): native == desktop invitation and physical projections; configured and unconfigured; private/no-store; anonymous 401; other wedding 403; revoked 403; revoked mid-session 403; no `guests.view` 403; zero DB mutation; GET-only exports | 7 pass / 54 expects, re-runnable |
| Existing invitation, physical-QR, IA and privacy contracts + native account contract | 51 pass / 0 fail (4 source contracts now assert the shared projection) |
| RSVP ↔ Pass lifecycle integration (drives the desktop invitations route) | 4 pass / 0 fail |
| iOS `swift test` (full) | 544 / 0 failures (`PlannerInvitationsReaderTests` 7, `FinalNativeUiLaneRegressionTests` 14) |
| Android `testDebugUnitTest` | 526 / 0 failures (`PlannerInvitationsReaderTest` 7, `FinalNativeUiLaneRegressionTest` 15) |
| Android Compose UI `PlannerInvitationsQrUiTest` (Pixel_8 AVD) | 8 / 8 |
| iOS Debug (simulator) and Release (`CODE_SIGNING_ALLOWED=NO`) | BUILD SUCCEEDED ×2 |
| Android `assembleDebug`, `assembleUat`, `compileReleaseKotlin` | success |
| Wedding Pass convergence CI, run 36312274901 at `bbd0b586` | success |

TypeScript: `tsc --noEmit` reports no errors in any file this unit touched. The repository's existing
errors elsewhere are unchanged. ESLint on the changed TS is clean.

### Final-native lane (real apps, real backend, disposable data)

- **Setup:** `production_preview` lane at `http://127.0.0.1:3105`, serving this branch's Next.js
  backend on a disposable Postgres seeded by `scripts/native-mobile/qro05-invitations-lane/seed.sql`.
  Only Supabase's password check was replaced, by a loopback stand-in.
- **iOS** (visible simulator FC17FF48, `pro.wewed.app.dev`, gated XCUITest
  `PlannerInvitationsQrUITests`): pass. It verified:
  - sign-in → Planner shell → More → Invitations & QR;
  - Ivory Floral Gold shown;
  - printed QR configured, 6 guests listed, 11 opens;
  - Attending, Declined and Awaiting-reply rows;
  - no link or token text on any label;
  - Show QR gives the correct guest QR;
  - Share opens the system share sheet;
  - no `wedding-pass-qr`.
- **Android** (Pixel_8 AVD, explicit `pro.wewed.app.dev/pro.wewed.app.MainActivity`,
  `android_lane_driver.py`): 10/10 checks pass, including the `ACTION_SEND` chooser taking focus.
- **Backend request accounting:**
  - invitation routes served to the apps: 16 GET, all 200;
  - one anonymous GET (401) and one deliberate POST probe (405, no handler), both mine;
  - DB after all runs: RSVP, QR and Wedding `updatedAt` equal to the seed time, scan count 11,
    0 audit events.
- Screenshots and the `.xcresult` stay in the local scratchpad and are not committed.

## Real C&K production_preview read — BLOCKED-ENV

The established Preview (`wewed-jf9t9h8sz-11-11`, built from integration `fa7284fd`) does not contain
the new native routes. To serve them with native sign-in, one of these is needed:

1. deploy this branch to the integration Preview, which is a merge into the integration branch; or
2. give a branch Preview a `WEWED_SESSION_SECRET` — a project env or secret change (it is scoped to
   the integration branch only).

Both are outside this unit's authority. Therefore:

- no C&K invitation read was performed;
- no C&K comparison is claimed;
- C&K writes are 0 and production business writes are 0;
- no production or Preview invitation request of any method was made.

Once the moderator approves one of those paths, the identical gated iOS test and Android driver run
unchanged against the Preview origin, with expectations taken from that moment's backend GET.
Style, configured state, counts and representative RSVP states are passed as arguments and never
hard-coded.

## Defects found and patched in-unit

- The identifier on a SwiftUI container replaced its children's identifiers. The invitations screen
  container is now `.contain`, and the test anchors on inner rows. Pre-existing entry and shell
  containers show the same pattern; the tests fall back to labels there, and production code was not
  changed.
- The native read suite used a fixed printed code and could not be re-run on the same database; the
  code is now derived per run.
- Four source-contract tests pointed at code that moved into the shared projection; they now assert
  it there.
- An instrumented Android full-lane test conflicted with the animated splash under the Compose test
  clock. It was replaced by the external `uiautomator` driver and not committed.

## Recommended classification

- **PASS-WITH-BLOCKED-ENV:** backend parity, native clients, the UI, tests, builds and Pass CI are
  complete and verified.
- **BLOCKED-ENV:** the real C&K `production_preview` read, pending moderator approval of a Preview path
  for the new routes.
