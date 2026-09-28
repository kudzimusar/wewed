# QRO02B2 / CERT02 — Final independent Charity & Kudzie Ivory live parity: receipt (2026-09-27)

**Status: INDEPENDENT CERTIFICATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.**
Released by the governance prompt `QRO02B2_CERT02_FINAL_IVORY_LIVE_PARITY_20260927.md` (docs `9fee3ab4`,
decision D-078). No product or test source was patched. This receipt is the only tracked change.

**Result: CERTIFIED.** Web/PWA, native account API, iOS and Android all resolve one Charity & Kudzie
authority with invitation style `ivory-floral-gold`. `wewed.parity.v1 PASS`. Wedding business-data
writes: **0**.

## 1. Identity and preflight

| Gate | Evidence | Result |
| --- | --- | --- |
| Integration HEAD | `origin/integration/phase13-live-account-data-convergence-20260926` = `ba38a3624581899a4999ac8d221346ec11a1f504` (= INV-CANON01 receipt `a2db3e24` + merge of NLC01 closure #218) | exact |
| Integration Preview | `dpl_2sHasSHCbDnFAHRgBH4HyNHvo98v`, `https://wewed-gpm1zgeds-11-11.vercel.app`, Ready, Preview, `githubCommitSha` = `ba38a362…`; every collected record reports `commitSha` `ba38a362…` | exact |
| Production main | `origin/main` = `646f08421d778cf6f85bf12195581228ae3fbccc` (merge #217; tree identical to INV-CANON01 `04ce1d70`) | exact |
| Production deployment | `dpl_ApFS83c3F2MtqNFvCQEF8Pdg1UwL`, Ready, target production, aliases `wewed.pro`, `www.wewed.pro` | Ready |
| Credential-free preflight | `deploymentProtection: PASSED`, `nativeAuthorityRoute: LIVE` (401), `nativeSigninRoute: LIVE` (400), `weddingDay: DISABLED` (503) | pass |
| Wedding Day | `503 WEDDING_DAY_DISABLED` → run blocker `wedding-day-activation / BLOCKED-ACTIVATION` | BLOCKED-ACTIVATION |
| iOS environment | dedicated simulator "NLC01 iPhone 18 Pro", **erased**, only `pro.wewed.app.dev` (built from `ba38a362`) installed; sole `wewed://` handler verified before every launch | clean |
| Android environment | `emulator-5554`; `pro.wewed.app.dev` reinstalled from `ba38a362` and data cleared; `pro.wewed.app.uatdev` also claims `wewed://`, so every launch used the explicit component, and `am start` resolved `pro.wewed.app.dev/pro.wewed.app.MainActivity` | isolated |

## 2. Credential source

Category only: the owner-provided mode-600 file (real Guest invitation = label `G`, real Planner =
label `P`), read with a literal `KEY=VALUE` parser. Never shell-sourced, and no values printed. The
Admin credential file was not read. `WEWED_PARITY_ALLOW_PASS_GET` was unset for every command. The
Preview bypass came from a mode-600 session file.

Secret scan of all artifacts (run, network log, native exports, check output, web/Android logs,
preflight) for the password, email, RSVP token, invitation URL and bypass, plus JWT, bearer and
session-cookie shapes: **0 hits**.

## 3. Certification A — production Planner canonical source

Source and deployment identity only, as the prompt allows. The production studio was not opened,
because its loader calls the legacy token-backfill POST.

- `646f0842`'s tree is byte-identical to `04ce1d70`.
- `premium-invitation-studio.tsx`:
  - `CANONICAL_INVITATION_STYLE: InvitationCardStyle = 'ivory-floral-gold'`;
  - `CANONICAL_INVITATION_CLOSED_ART = '/invitation-art/ivory/closed-master.webp'`;
  - the tile renders `theme.id === CANONICAL_INVITATION_STYLE ? <CanonicalIvoryTile /> : <DigitalInvitationCard … />`, so the Ivory tile never uses the generic card.
- `premium-invitation-experience.tsx`: `isIvoryBenchmark = style === 'ivory-floral-gold'` dispatches to `<IvoryFloralGoldTriFold` (L402) ahead of `<GenericMotionCard` (L409).
- `https://wewed.pro/invitation-art/ivory/closed-master.webp`: 200, 573,376 bytes.

## 4. Certification B — real server authority (integration Preview, read-only)

Collected 22:26:14–22:26:30Z. Every request was read-only or created a session:

| UTC | Client | Request | Status |
| --- | --- | --- | --- |
| 22:26:14 | desktop:guest | `POST /api/weddings/charity-and-kudzie/guest-session` (exchange) | 200 |
| 22:26:16 | desktop:guest | `GET …/guest-session` | 200 |
| 22:26:19 | desktop:account | `POST /api/auth/signin` | 200 |
| 22:26:20 | desktop:account | `GET /api/auth/me` | 200 |
| 22:26:22 | desktop:account | `GET /api/planner/guests` | 200 |
| 22:26:23 | native-api:account | `POST /api/native/account/signin` | 200 |
| 22:26:25 | native-api:account | `GET /api/native/account/authority` | 200 |
| 22:26:27 | native-api:account | `GET /api/native/account/workspace` | 200 |
| 22:26:30 | native-api:account | `GET /api/native/wedding/guests` | 200 |
| 22:26:30 | activation-probe (unauthenticated) | `GET /api/wedding-day/pass` | 503 `WEDDING_DAY_DISABLED` |

| Field | Value | Agreement |
| --- | --- | --- |
| Wedding | `cmqos70cb0004q6vxe9g9aiu5` (date 2026-12-23; title digest `5e9a19f0…`; venue digest `efc215b7…`) | all records |
| Couple | `cmqos70c00000q6vx5ytzkn0f` | desktop = native-api |
| Guest | `cmuahx3ka0001js043cseq7z4` (name digest `e3317bba…`) | G desktop/ios/android = G-VIA-P desktop/native-api |
| RSVP | `pending` | all |
| Server-computed party size | 1 | all |
| Seating-table authority | `cmqpub1j0003dnyspfjfhfw3a` | all |
| Invitation style | **`ivory-floral-gold`** | G desktop/ios/android |
| Invitation message digest | `null` (no authored message saved) | G desktop/ios/android |
| Planner accessUserId | `dea0757e-cc3d-42f6-a394-abf18e9cf742` | desktop = native-api |
| Planner grant / membership / permissions | `planner:wedding:cmqos70cb0004q6vxe9g9aiu5` / `planner` / `["*"]` | desktop = native-api |

## 5. Certification C — real Guest web/PWA (same credential, not rotated)

Playwright Chromium at a mobile viewport (430×932, touch) against the integration Preview. The real
link was used with its host swapped to the Preview and its query kept exactly, including the stale
**`card=botanical`**. The browser was set to abort any mutating request other than the Guest
session exchange; **0 requests were aborted**.

- Path: `GET /invite/charity-and-kudzie` 303 → `/invite/charity-and-kudzie/open` (the "Your invitation is ready · Open wedding invitation" gate) → `/invite/charity-and-kudzie/continue` → `/w/charity-and-kudzie?invitation=1&card=ivory-floral-gold`.
- **Server authority wins over the stale link.**
  - `resolvePersonalInvitation` ignores `requestedCard` and uses the wedding's saved style.
  - The final query carries `card=ivory-floral-gold`.
  - The rendered `data-invitation-style` is `ivory-floral-gold`.
- States (from `data-invitation-view`): `closed` → `opening` → `open` → `details`, each screenshotted. CLOSED is the ornate doors with the C&K seal, "A special invitation awaits" and "Tap to open".
- Personalization: the open card reads "Especially for <real Guest name>". Evidence is kept locally and not committed.
- Hard failures: no Botanical or Garden Romance, no raw ISO date (body scan), no GenericMotion node, no Home/workspace before the invitation (gate → blank ivory transition → CLOSED), no token rotation.

Observation, not a failure: the legacy `invitation-rsvp-dialog.tsx` prefers a `card=` query value over
the server's style (`requestedStyle || data.wedding.invitationCardStyle`). It only runs with
`?invitation=1` on `/w/`, and the continue route always rewrites `card` to the server's style, so the
real journey is unaffected. A hand-edited `/w/…?invitation=1&card=botanical` URL could still render
Botanical there. That is for the moderator to triage; it was not patched.

## 6. Certification D — iOS (DEBUG `productionPreview`, built from `ba38a362`)

Build: `xcodegen` + `xcodebuild` Debug, iphonesimulator, ad-hoc signed, `pro.wewed.app.dev`,
**BUILD SUCCEEDED**.

Launch method:
- **Cold** explicit Guest link `wewed://invite/charity-and-kudzie?<original query incl. card=botanical>` via `simctl openurl`.
- The lane settings (`WEWED_NATIVE_ENV=production_preview`, Preview origin, bypass, parity label `G`, commit `ba38a362`) were placed in the dedicated simulator's launchd environment for the run and removed afterwards.
- The whole run was video-recorded.

Maestro, 24 steps, **rc 0** (22:43–22:44Z):

| Check | Result |
| --- | --- |
| `invitation-trifold` visible | pass |
| `invitation-style-ivory-floral-gold` visible | pass |
| `invitation-motion-tri-fold` visible | pass |
| `premium-invitation-experience` (GenericMotion container) not visible | pass (checked at CLOSED and at DETAILS) |
| `invitation-monogram`, "A special invitation awaits … Tap to open", `invitation-closed-cover` visible (CLOSED) | pass |
| after tap: `invitation-closed-cover` gone, `invitation-panel-centre` and `invitation-guest-personalization` visible (OPEN) | pass |
| `invitation-details` visible after `invitation-details-button` (DETAILS) | pass |
| no `YYYY-MM-DD`, no "botanical", no "garden romance" | pass |

Video frames (0.5 s steps):
- 2.5–3.5 s: the iOS home screen (the OS, before launch) and the app zoom.
- 4.0–5.5 s: launch screen, then the **Wewed splash**.
- 8.5 s: **ornate CLOSED gateway**. No Wewed workspace or Home appears at any frame.
- **53.0 s: OPENING captured**, doors folding back from the centre card.
- 53.5 s: OPEN.
- 58.5 s: DETAILS ("You're Invited" hub: RSVP, Calendar, Venue, Gifts, Note; Guest Pass "RSVP required").

Parity export `G-ios.json`:
- Wedding, Guest, `pending`, party 1, table `cmqpub1j…` and `ivory-floral-gold` all equal the server.
- Message digest null. `commitSha` `ba38a362…`. Secret-free.
- sha256 `2dd7f9bfd3af…`.

Environment notes (ENV, no product effect):
- The erased simulator shows iOS's one-time "Open in 'Wewed'?" confirmation. The flow accepts it.
- Two earlier attempts failed for tooling reasons: the XCUITest driver was not yet installed, and one text assertion was wrong because Maestro matches the whole accessibility string. Neither was a product failure.

## 7. Certification E — Android (DEBUG `productionPreview`, built from `ba38a362`)

Build: `./gradlew assembleDebug` succeeded. Installed with `-r`, data cleared.

Launch: **cold**, explicit component `pro.wewed.app.dev/pro.wewed.app.MainActivity`, VIEW intent
with the original link query (stale `card=botanical`) and the lane/parity extras. `am start`:
`Status: ok`, `Activity: pro.wewed.app.dev/pro.wewed.app.MainActivity`. Screen recorded. Run
22:46Z.

| State | Evidence |
| --- | --- |
| Splash | Wewed splash, then the exchange spinner (0.7 s screencaps). No workspace. |
| CLOSED | ornate doors, C&K seal, "A special invitation awaits", "Tap to open". Nodes: `invitation-trifold`, `invitation-closed-cover`, `invitation-monogram`, `invitation-panel-left`, `invitation-panel-right`, `invitation-open-button` |
| OPENING | video frames 26.6–26.8 s show the doors parting over the centre card |
| OPEN | `invitation-panel-centre`, `invitation-couple-names`, `invitation-date` ("Wednesday · Dec 23 · 2026"), `invitation-venue`, `invitation-guest-personalization` ("Especially for …" present) |
| DETAILS | `invitation-details`, `invitation-cta-rsvp/-calendar/-venue/-registry/-pass`, `invitation-back-to-invitation` |
| Raw ISO date / Botanical / Garden Romance | absent in all three dumps |
| GenericMotion | `premium-invitation-experience` absent. Every node above is defined only in `IvoryFloralGoldNative.kt`. |

Style-marker evidence gap (classified):
- Android's `invitation-style-<id>` and `invitation-motion-<id>` hooks are zero-size `Box` nodes (`NativeInvitationExperience.kt` L126–129). Neither `uiautomator dump` nor Maestro's hierarchy exposes them, so the literal `invitation-style-ivory-floral-gold` marker could not be observed at runtime on Android.
- The style is instead proven by:
  1. the Android parity export `invitationStyle: ivory-floral-gold`;
  2. the Ivory-only renderer nodes above;
  3. the absence of the GenericMotion container;
  4. the deterministic dispatch test `CanonicalInvitationDispatchTest` (NLC01, in `ba38a362`).
- On iOS the same marker is observed directly (§6).

Parity export `G-android.json`: equal to the server on every field, `commitSha` `ba38a362…`,
secret-free, sha256 `6767bc8e5deb…`.

## 8. Certification F — `wewed.parity.v1`

Native iOS/Android exporters only support the Guest record (`NativeParityExporter.guestRecord` and
`NativeParityRecord.guestRecord`, role `guest`). There is no native `P` or `G-VIA-P` export path in
`ba38a362`, so none was fabricated.

Declared `requiredClientsByLabel`: `G` = desktop, ios, android · `P` = desktop, native-api ·
`G-VIA-P` = desktop, native-api. Run blocker: `wedding-day-activation / BLOCKED-ACTIVATION`
(evidence `WEDDING_DAY_DISABLED`). It is not a `passAvailability` business value; `passAvailability`
is null in every record.

```
bun scripts/parity/wewed-parity.ts check cert02-run.json cert02-G-ios.json cert02-G-android.json \
  --require-for G=desktop,ios,android --require-for P=desktop,native-api \
  --require-for G-VIA-P=desktop,native-api --same-wedding G,G-VIA-P,P

compared G: android, desktop, ios
compared G-VIA-P: desktop, native-api
compared P: desktop, native-api
wewed.parity.v1 PASS
```

Negative control, requiring ios and android for `P`: `FAIL CLIENT_MISSING [P] … ios`,
`… android`, `wewed.parity.v1 FAIL (2)`. The checker is not passing trivially.

Artifact digests (local, not committed): run `d273cf7fee71…`, network `b437da844502…`.

## 9. Production safety (qualification window 2026-09-26T22:22:18Z – 22:50:01Z)

Vercel runtime logs, grouped by path:

- **Production** (`dpl_ApFS83c3…`): **0** requests to `/api/weddings/*/guest-session`, `/invite/*` or `/api/native/*`. **Zero accidental native qualification invitation-exchange requests.**
  - Other production traffic in the window was unrelated to this unit: `/api/planner/*` GETs at exact 60-second intervals (an open Planner dashboard tab), cron jobs, and a few public pages.
- **Integration Preview** (`dpl_2sHasSHCbDnFAHRgBH4HyNHvo98v`): received the intended Guest traffic. Counts: `/api/weddings/charity%2Dand%2Dkudzie/guest-session` 8 (native), `/api/weddings/charity-and-kudzie/guest-session` 5 (web and collector), `/invite/charity-and-kudzie` 3, `/open` 3, `/continue` 1, `/w/charity-and-kudzie` 1, plus the collector's account routes.

## 10. Mutation accounting

- **Wedding business-data writes: 0.**
- A read-only post-certification snapshot on the Preview matches the pre-certification state:
  - style `ivory-floral-gold`, message null, RSVP deadline null, children policy `welcome`;
  - Guest `pending`, table number null;
  - Guest token sha256 `92277a97…182f0ac9`, unchanged, so **no rotation**.
- No RSVP, Guest, style, party, seating, date, Pass, Gate or WW2 action. No environment change, deployment, merge, or source patch.
- Sessions created: Preview Guest sessions (web, collector, iOS, Android) and Preview account sign-ins. Preview sign-in bookkeeping is suppressed server-side.

## 11. Unresolved evidence gaps

1. Android `invitation-style-ivory-floral-gold` / `invitation-motion-tri-fold` markers cannot be observed at runtime (zero-size nodes). Covered by the export, Ivory-only nodes and the dispatch test (§7). Suggested follow-up: give the hooks a semantics node that uiautomator retains.
2. Native account-side (`P`, `G-VIA-P`) records for iOS/Android: no exporter exists in `ba38a362`, so these are not required (§8).
3. Legacy `invitation-rsvp-dialog` stale-`card` precedence on a hand-edited `/w/` URL (§5). Not reachable through the real journey.

QRO02B2 FINAL CHARITY & KUDZIE IVORY LIVE PARITY CERTIFIED — WEB/NATIVE API/IOS/ANDROID RESOLVE ONE AUTHORITY — 0 WEDDING BUSINESS-DATA WRITES — RETURNING TO MODERATOR FOR QRO03 RELEASE DECISION.
