# QRO02B / CRED01 — Authenticated read-only Charity & Kudzie parity: receipt (2026-09-27)

**Status: IMPLEMENTATION / CERTIFICATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.**

**Result: NOT PROVEN.** Real authenticated server-side parity (desktop/PWA ↔ native account API) is
established for the Charity & Kudzie wedding, Planner authority and the real Guest. **Both native
apps failed to open the real private invitation**, so iOS/Android parity — and the required
four-client `wewed.parity.v1` check — did not pass. The iOS cause is proven (a native entry-path
defect); the Android cause is not yet isolated. Per this unit's rules neither was patched.

## 1. Repository

| Item | Value |
| --- | --- |
| Branch | `integration/phase13-live-account-data-convergence-20260926` |
| Start | `5e7a3162b910258ad1c88e5600543e556ad7ecc2` (= remote = local; `9241e37c→5e7a3162` adds only the QRO02A receipt; `apps/` unchanged) |
| Authority | docs `e51885aa`: **D-071** releases QRO02B; D-072 is a moderator-process rule |
| Final | this commit (reported in the return) |
| Changed | this receipt; `scripts/parity/wewed-parity.ts` (one-line collector fix, §6) |
| Product source / `apps/` | **unchanged** |

## 2. Preview

| Field | Value |
| --- | --- |
| Deployment | `dpl_4xEofdKh7qD29eMgboHq2mLkUmWi` |
| URL | `https://wewed-p6iz36xjk-11-11.vercel.app` |
| Branch alias | `wewed-git-integration-phase13-live-account-data-co-a8988a-11-11.vercel.app` |
| State / target | READY / Preview |
| Serving SHA | `5e7a3162…` (product-identical to qualified `b59893e0`; tooling = `98a16095`) |

## 3. Credential source

Category only: an **owner-provided mode-600 local file** (owned by the running user) containing the
real Guest invitation (label `G`) and a real **Planner** account (label `P`). Loaded by a literal
`KEY=VALUE` parser (no shell interpretation, no tracing, nothing printed). A separately staged Admin
file was **not read or used**. The existing Vercel automation bypass came from a mode-600 session
file (QRO02A). `WEWED_PARITY_ALLOW_PASS_GET` was unset throughout. All artifacts were scanned for the
password, email, invitation token/URL, bypass, WW2/JWT/cookie shapes: **0 occurrences**.

## 4. Preflight (credential-free)

`deploymentProtection: PASSED`, `nativeAuthorityRoute: LIVE` (401 from app), `nativeSigninRoute: LIVE`
(400 from app), `weddingDay: DISABLED` (503 `WEDDING_DAY_DISABLED` from app).

## 5. Authenticated server collection — ACCEPTED-READY (agent)

Network evidence (redacted; client, method, path, status, classification):

| UTC | Client | Request | Status |
| --- | --- | --- | --- |
| 19:20:15 | desktop:guest | `POST /api/weddings/charity-and-kudzie/guest-session` (invitation exchange) | 200 success |
| 19:20:17 | desktop:guest | `GET /api/weddings/charity-and-kudzie/guest-session` | 200 success |
| 19:20:19 | desktop:account | `POST /api/auth/signin` | 200 success |
| 19:20:21 | desktop:account | `GET /api/auth/me` | 200 success |
| 19:20:22 | desktop:account | `GET /api/planner/guests` | 200 success |
| 19:20:24 | native-api:account | `POST /api/native/account/signin` | 200 success |
| 19:20:25 | native-api:account | `GET /api/native/account/authority` | 200 success |
| 19:20:27 | native-api:account | `GET /api/native/account/workspace?grantId=<redacted>` | 200 success |
| 19:20:29 | native-api:account | `GET /api/native/wedding/guests?grantId=<redacted>` | 200 success |

(Corroborated by the Preview's own runtime logs for `dpl_4xEofdKh…`.)

Safe identifiers resolved (all clients that ran agree):

| Field | Value |
| --- | --- |
| Wedding | `cmqos70cb0004q6vxe9g9aiu5` (date 2026-12-23; title digest `5e9a19f054…`; venue digest `efc215b75c…`) |
| Couple | `cmqos70c00000q6vx5ytzkn0f` |
| Planner access user | `dea0757e-cc3d-42f6-a394-abf18e9cf742` (desktop = native-api) |
| Planner grant | `planner:wedding:cmqos70cb0004q6vxe9g9aiu5`, membership `planner` (desktop = native-api) |
| Guest | `cmuahx3ka0001js043cseq7z4` (Guest Session = desktop Planner list = native Planner list; name digest `e3317bba52…`) |
| RSVP | `pending` (all three) |
| Party size (server) | 1 (all three) |
| Seating table | `cmqpub1j0003dnyspfjfhfw3a` (all three) |
| Invitation style | `botanical` (Guest Session); authored message: none saved (digest null) |

Evidence digests (local artifacts, not committed): `run.json` sha256 `5e2f1a86…10d5d9`,
`network.json` sha256 `937844b6…66fe2`.

## 6. Collector defect found and fixed (tooling only)

The collector read the native `accessUserId` from `authority.accessUserId`; `WewedProductionAuthorityV1`
carries it at `authority.identity.accessUserId`. The first run therefore recorded `null` for the
native-api `P` identity (the account path could never be exercised locally in QRO01 — no Supabase).
Fixed; the re-collection shows desktop = native-api. Parity unit tests: 22 pass / 0 fail (local).
Not a product change.

## 7. iOS — NOT PROVEN (native entry-path defect, proven)

Build: DEBUG, ad-hoc signed simulator build of `apps/` at `5e7a3162` (bundle `pro.wewed.app.dev`),
`WEWED_NATIVE_ENV=production_preview`, `WEWED_PREVIEW_ORIGIN=https://wewed-p6iz36xjk-11-11.vercel.app`,
bypass + parity export label `G` injected by environment; a dedicated fresh iOS 27 / iPhone 18 Pro
simulator with only this app installed (deleted afterwards).

Outcome: the real `wewed://invite/…` link reached the app, which showed **"We couldn't reach Wewed"**;
no parity export. Device network log: the exchange task finished with `NSURLErrorCancelled (-999)`,
`request_bytes=0` — it never reached the Preview (no runtime log entry).

Root cause (source, `apps/ios/Wewed/Views/RootView.swift` ≈L490–501):

```swift
.task(id: appState.pendingInvitationEntry) {
    guard let entry = appState.consumePendingInvitationEntry() else { return }  // sets the task id to nil
    liveInvitation = .exchanging
    liveInvitation = await liveCoordinator.enter(entry)                         // SwiftUI cancels this task
}
```

Consuming the entry changes the task's own `id`, so SwiftUI cancels the task and its in-flight
invitation exchange. It affects any launch/arrival where the account workspace root handles an
invitation link — **including Release/UAT builds**. QRO01's local proof used the separate DEBUG
Guest shell and did not traverse this path. Classification: **P1 — real Guest cannot open the
invitation from the workspace entry path.** Not patched (certification unit).

## 8. Android — NOT PROVEN (cause not isolated)

Build: DEBUG `pro.wewed.app.dev` (`assembleDebug` of `apps/` at `5e7a3162`), emulator
`sdk_gphone64_arm64` (`emulator-5554`), explicit-component VIEW intent with the real link,
`wewed_native_env=production_preview`, `wewed_preview_origin=https://wewed-p6iz36xjk-11-11.vercel.app`,
bypass and export label `G` as extras; app data cleared first.

Outcome: **"We couldn't reach Wewed"** (`invitation-unavailable`); no export; **no request reached the
Preview runtime**. Checked and excluded: emulator DNS/network (host resolves and answers); the HTTP
exchange itself (a JVM `HttpURLConnection` replay of the same request with the bypass returns 200 and
both cookies; Android reads all `Set-Cookie` values via `headerFields`). The Android workspace root
(`ui/RootScreen.kt` ≈L145–156) contains the **same consume-inside-`LaunchedEffect(pendingInvitationEntry)`
pattern** as the iOS defect — the leading candidate — but the rendered screen is shared by both
shells, so which path ran is not proven without instrumentation (forbidden here).

## 9. Final parity check

- `--require desktop,native-api --same-wedding G,G-VIA-P,P`: **`wewed.parity.v1 FAIL (2)`** —
  `CLIENT_MISSING [G] native-api`, `REQUIRED_FIELD_MISSING [G] passAvailability`. Every compared
  field across desktop and native-api for `P` and `G-VIA-P` was equal.
- `--require desktop,native-api,ios,android --same-wedding G,G-VIA-P,P`: **`wewed.parity.v1 FAIL (8)`** —
  the two above plus `CLIENT_MISSING` for ios and android on `G`, `G-VIA-P`, `P`.

Contract observations for the moderator (not patched): (a) a Guest has no account/native-api path,
so `G` can never have a `native-api` record while one `requiredClients` list applies to every label;
(b) `guest` requires `passAvailability`, but this unit forbids the Pass read and Wedding Day is
disabled — the contract cannot express `BLOCKED-ACTIVATION`.

## 10. Mutation and environment accounting

- **Wewed wedding business-data writes: 0.**
- Preview requests: sign-ins (Supabase + signed sessions) and reads only; Preview desktop sign-in
  bookkeeping is suppressed and no writable wedding is configured.
- **Unintended production request (disclosed):** on the default shared simulator,
  `simctl openurl` routed the `wewed://` link to a previously installed **`pro.wewed.app.uatdev`**
  (Release-configured → `https://wewed.pro`). It performed **one** `POST /api/weddings/charity-and-kudzie/guest-session`
  on **production** (`dpl_BLD2JjcBEiBxMVHyVVUoUNUgkYKR`, `main`, 19:24:24 UTC, 200). `main`'s handler
  (`ba4b08f8`) performs only a lookup and sets signed cookies — **no business-data write**. Mitigated by
  moving to a dedicated simulator with only the DEBUG app installed.
- Production configuration changed: none. Preview configuration changed: none (QRO02A secret
  unchanged). No migration, WW2 activation, Pass/Gate/RSVP action.

## 11. Pass / WW2

**BLOCKED-ACTIVATION** — the application reports `WEDDING_DAY_DISABLED`; not `not_yet_issuable`.

## 12. Blockers / returned to moderator

1. iOS P1 entry-path cancellation defect (`RootView.task(id: pendingInvitationEntry)`), needs an
   implementation unit + requalification.
2. Android invitation failure: cause unproven; leading candidate the same pattern in
   `RootScreen` `LaunchedEffect(pendingInvitationEntry)`; needs instrumented diagnosis in an
   implementation unit.
3. Contract: per-label required clients and a representable `BLOCKED-ACTIVATION` Pass state.
4. Qualification hygiene: run native link tests on a simulator/emulator where only the qualification
   build handles `wewed://` (the UAT build on the shared simulator intercepted the link).
