# QRO03 / RSVP01 — Controlled reversible Charity & Kudzie RSVP write: receipt (2026-09-27)

**Status: STOPPED BEFORE ANY WRITE — NOT A MODERATOR ACCEPTANCE DECISION.**

**Result: NOT PROVEN.** Required propagation view #3 (the marker through the native account API /
Planner Guest list) is structurally impossible at `fb2e2f24`: the native account guest API never
returns the RSVP message. It was found before the write corridor was opened. The prompt forbids a
product change in this run, and inconsistent visibility across the required views is a listed stop
condition.

**Writes: test mutations 0 · restoration writes 0 · other wedding business-data writes 0.
Preview environment: unchanged (no writable ID configured).**

## 1. Identity

| Gate | Evidence |
| --- | --- |
| Integration HEAD | `fb2e2f2483c15c99e63e3a3e7219a6f63b821e17` (= QRO02B2 receipt `454bca9b` + #219 RSVP-dialog server-authority fix) |
| Preview | `dpl_93NtUPp41dmQQExo2MUDjLkuHi74`, `https://wewed-8kz7ymsle-11-11.vercel.app`, Ready, Preview, built from `fb2e2f24` |
| Production main | `646f08421d778cf6f85bf12195581228ae3fbccc` |
| Release | docs `3b4048a8` (D-079) |

## 2. Safe pre-snapshot (00:10:21Z, read-only)

Taken through Wewed's real iOS `GuestSessionClient` (see §4). Free-text fields are recorded as a
null flag or digest only.

| Field | Pre-state |
| --- | --- |
| weddingId / guestId | `cmqos70cb0004q6vxe9g9aiu5` / `cmuahx3ka0001js043cseq7z4` |
| attending | null (RSVP `pending`) |
| mealChoice / plusOneName / plusOneMeal / dietaryNotes | null |
| plusOne / kidsAttending / kidsCount | false / false / 0 |
| **message** | **null** (so restoration would send an explicit `""`) |
| checkedIn / checkedInAt | false / null |
| server party size | 1 |
| seatingTableId | `cmqpub1j0003dnyspfjfhfw3a` |
| invitation style | `ivory-floral-gold` |
| Guest token sha256 | `92277a97…182f0ac9` |

Planner views (00:11:32Z): desktop `/api/planner/guests` and native `/api/native/wedding/guests`
agree on wedding, Guest, `pending`, party 1 and table. Desktop `rsvp.message` = null. **This matches
the QRO02B2-certified Guest.**

Read-only refusal probe: `PUT /api/weddings/charity-and-kudzie/guest-session` with body `{}` and the
Guest session returned **`423 PREVIEW_WRITE_BLOCKED`**. The guard runs before body parsing, so the
probe cannot write even when writable (it would get 409, missing `originGuestId`).

## 3. Blocking finding — native account API does not expose the RSVP message

`src/app/api/native/wedding/guests/route.ts` loads the RSVP (`include: { … rsvp: true }`) but
projects only `rsvpStatus` (L50), `partySize` (L51) and `checkedIn` (L52). The live row keys are:
`checkedIn, createdAt, id, name, partySize, role, rsvpStatus, seatingTableId, side, tableName,
tableNumber, updatedAt`. No other `/api/native/wedding/*` route carries the RSVP message.

Which required views can show the marker:

| Required view | Can show the marker? |
| --- | --- |
| 1. Guest-session GET | yes (`message`) |
| 2. Planner/Couple desktop | yes (`/api/planner/guests` → `rsvp.message`) |
| 3. Native account API / Planner Guest list | **no, the field is not returned** |
| 4. Other native platform (Android Guest RSVP sheet, prefilled from the server snapshot) | yes (`invitation-rsvp-message`) |

Performing the forward write would spend the single authorized test mutation on a run that cannot
meet the prompt's success criteria. So the corridor was not opened.

Moderator options:
- **(a)** A closure unit that adds a digest-safe RSVP message field (or `rsvpMessageDigest`) to the native account guest projection, then re-release QRO03.
- **(b)** Amend QRO03 so view #3 proves the unchanged non-message authority (wedding, Guest, status, party, seating, checked-in) plus the change in the row's `updatedAt`, with the marker proven in views 1, 2 and 4.

## 4. Readiness prepared (no write performed)

- **Writer choice.** The iOS app's RSVP form cannot do a message-only save: `LiveGuestInvitationView.swift:569` always builds `GuestRsvpUpdate(attending: accepting, …)`.
  - The compliant writer is the real iOS `GuestSessionClient.saveRsvp(weddingSlug:originGuestId:update: GuestRsvpUpdate(message:))`. It sends only the set fields (`GuestSessionClient.swift` L437–446).
  - A local harness drives it. It is built with SwiftPM from `apps/ios` at `fb2e2f24` (Debug), on the `NativeServerLane.productionPreview` lane validated by `NativeServerOrigin.validatePreviewOrigin`, with in-memory storage.
  - A recording `URLProtocol` captures the transmitted body keys and whether `attending` is present.
  - Its guards refuse to write unless the current message and all authority fields equal the pre-snapshot.
  - The harness is untracked, outside the repository.
- **Session hygiene for the corridor.** While a writable ID is configured, Planner sign-in (`/api/auth/signin`) and `/api/auth/me` accept pending memberships for the writable wedding (`pendingMembershipAcceptanceScope`). The plan was to create every Planner and native-account session **before** opening the corridor and make only GETs during it. The session material saved for this was deleted at stop.
- **"Another wedding stays blocked" can be proven live.** The Planner holds grants on six other weddings. `POST /api/native/wedding/tasks` checks the preview guard after grant/permission and **before** reading the body. A **body-less** POST on another wedding's grant returns `423` when blocked, or `400` (no JSON) if not, so it cannot write either way.

## 5. Other findings for the moderator

- A pre-existing `WEWED_PREVIEW_WRITABLE_WEDDING_ID` (Preview, 15 days old) is scoped to branch `feature/private-invitation-android-delivery-20260912`. Not created or touched by this unit. It may be a stale write corridor worth reviewing.
- For the eventual re-run: Vercel bakes env into each build. The writable redeploy's unique URL stays writable after the variable is removed and the branch is redeployed read-only. It is behind deployment protection, but whether to delete that deployment (it holds runtime-log evidence) is a moderator decision.

## 6. Production and secrets

- Window 00:10:12Z–00:12:33Z: production received **0** Guest RSVP PUTs, Guest exchanges or native requests. The only production traffic was the existing 60-second Planner dashboard polling and cron jobs.
- Credentials were read from the owner's mode-600 file with a literal parser. None printed. Admin credential file not read. `WEWED_PARITY_ALLOW_PASS_GET` unset. The Wedding Day Pass was not called.

QRO03 CONTROLLED RSVP WRITE NOT PROVEN — native account guest API (`/api/native/wedding/guests`) does not return the RSVP message, so required propagation view #3 cannot observe the marker without a product change; stopped before the write corridor, 0 writes — RETURNING TO MODERATOR.

---

# Attempt 2 — re-release under D-080 (2026-09-27, 00:36:50Z–00:43:15Z)

**Status: STOPPED BEFORE THE WRITE CORRIDOR — NOT A MODERATOR ACCEPTANCE DECISION.**

**Result: BLOCKED-ENV.**
- The stale Preview write corridor was found and its env entry removed.
- 313 already-built Ready deployments still carry that corridor's baked-in writable wedding ID, which is unreadable (Vercel `sensitive` type).
- Retiring them means permanently deleting 313 deployments and their logs. The prompt classifies that as an uncertain/destructive action (STOP), and forbids opening a second corridor while the old one remains.

**Writes: test 0 · restoration 0 · other wedding business-data 0. QRO03 corridor never opened.**

## A1. Identity

| Gate | Evidence |
| --- | --- |
| Integration HEAD | `38a59ad73e5de89051144fb625253e38f0101df6` (= `80babf11` + #220: `af3cd647` exposes `rsvpMessage` in the native guest projection, `a54e7cec` test) |
| Preview | `dpl_5dNPfgevPH43Ksn9HyReqfL2kWL9`, `https://wewed-ks9kthy96-11-11.vercel.app`, Ready, Preview, built from `38a59ad7` |
| Production main | `646f08421d778cf6f85bf12195581228ae3fbccc` |
| Release | D-080 |

## A2. Pre-state (00:36:50Z, real iOS `GuestSessionClient`, read-only)

Identical to attempt 1 and to the QRO02B2-certified Guest:
- wedding `cmqos70c…`, Guest `cmuahx3k…`;
- attending null (`pending`); meal, plus-one name/meal and dietary null;
- plusOne false, kids false/0, **message null**;
- checkedIn false / null;
- party 1, table `cmqpub1j0003dnyspfjfhfw3a`;
- style `ivory-floral-gold`, token sha256 `92277a97…182f0ac9`.

Read-only probe `PUT …/guest-session` `{}` returned **`423 PREVIEW_WRITE_BLOCKED`**.

## A3. Blocker closure confirmed

Planner sessions were created on the read-only Preview (sign-in bookkeeping and membership acceptance are suppressed there).

`GET /api/native/wedding/guests?grantId=planner:wedding:cmqos70cb0004q6vxe9g9aiu5`: the target row **contains the `rsvpMessage` key, value `null`**. Status `pending`, party 1 and table `cmqpub1j…` equal desktop `/api/planner/guests` (`rsvp.message` null).

## A4. Stale Preview write corridor — disposition

| Item | Evidence |
| --- | --- |
| Entry | `WEWED_PREVIEW_WRITABLE_WEDDING_ID`, env id `wZX2F4Y7Ks5o7riQ`, type `sensitive`, target Preview, branch `feature/private-invitation-android-delivery-20260912`, created 2026-09-12 (epoch ms 1789187756165) by `kudzimusar`, never updated. A sibling `WEWED_UAT_ANDROID_SHA256` was created at the same time. |
| Value | Not recoverable. `sensitive` values come back as the literal `[SENSITIVE]` placeholder from `vercel env pull` and as empty from the API. Circumstantial: the first deployment built after it (`dpl_8xy88…`, `7c81726e`) is titled "fix(uat): isolate invitation writes and prepare PR 202 test host", which suggests a dedicated PR 202 UAT wedding. |
| Deployments on the branch | 330 total. **313 Ready deployments built after the entry existed** (2026-09-12T04:38Z `dpl_8xy88wBwqQ2bv5wwPAWHvTtsBY3L` → 2026-09-19T18:35Z `dpl_9mUqyqyNY12kk8QuT5cnbYpCWJ5U`, branch tip `62107e20`). All target Preview, behind deployment protection. Metadata preserved locally (sha256 `461de268a50b7592…`). |
| C&K exposure | **Not writable.** Because the entry was never updated, all 313 share one value. The newest (`wewed-111ibn2g5`) returned **`423 PREVIEW_WRITE_BLOCKED`** for the certified Guest's `{}` probe. Guard-before-body was verified at `62107e20`, so the probe could not write. |
| Other exposure | The 313 deployments remain reachable (with deployment-protection access) and writable for the single unknown wedding the value names. Planner-grant probing is not possible there (that branch has no native tasks route). |
| Action taken | **Entry removed** (`vercel env rm … preview feature/private-invitation-android-delivery-20260912`). No `WEWED_PREVIEW_WRITABLE_WEDDING_ID` remains in any Preview scope. This stops future builds only. |
| Not done (STOP) | Retiring the 313 built deployments = permanent deletion of deployments and their runtime logs. That is destructive and uncertain (the owner may still use that UAT branch), so it is returned to the moderator. |

## A5. Readiness preserved for the next run

The iOS-client harness (real `GuestSessionClient.saveRsvp`, recording `URLProtocol`, pre-state guards) is unchanged. `apps/ios` is identical at `38a59ad7`. The corridor plan is unchanged: Planner sessions created before the corridor, only GETs during it, and a live other-wedding probe via a body-less native tasks `POST` on another Planner grant. The Planner session material saved in this attempt was deleted at stop.

## A6. Production and secrets

- Window 00:36:50Z–00:43:15Z: production received **0** Guest RSVP PUTs, Guest exchanges or native requests. Its only traffic was other users' `/api/notifications/count` polling, one `/api/today` and cron jobs.
- Credentials came from the owner's mode-600 file via a literal parser, none printed. The Admin credential file was not read. `WEWED_PARITY_ALLOW_PASS_GET` unset. No Pass or Gate call.

QRO03 CONTROLLED RSVP WRITE BLOCKED-ENV — stale branch-scoped Preview write corridor removed, but 313 already-built deployments still carry its unreadable writable-wedding ID (C&K proven not exposed); retiring them requires destructive deletion, so the QRO03 corridor was not opened, 0 writes — RETURNING TO MODERATOR.

---

# Attempt 3 — re-release under D-081 (2026-09-27, 01:02:42Z–01:13:20Z)

**Status: IMPLEMENTATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.**

**Result: PROVEN.** A message-only write through the native iOS Guest client reached the Guest session, desktop Planner, the native Planner API and the Android Guest client. It was then restored exactly, and the Preview returned to read-only.

**Writes: test 1 · restoration 1 · other wedding business-data 0.**

## B1. Identity

| Item | Value |
| --- | --- |
| Starting HEAD | `fadc62feaa11acc69a3bf1aa4fdb428255c4f37d` (production main `646f08421d778cf6f85bf12195581228ae3fbccc`, unchanged) |
| Starting Preview | `dpl_3pbzmgGW35aB4T2Gc7boxocPzbo1`, `https://wewed-pwc2l9wee-11-11.vercel.app`, Ready, built from `fadc62fe` |
| **Writable (corridor) deployment** | `dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu`, `https://wewed-q3hssjdtx-11-11.vercel.app`, Ready, Preview, redeploy of `fadc62fe` (`githubCommitSha` match) |
| Final read-only deployment | `dpl_GLSWXAcNX3uQp7XAu6DXGz5C1xKT`, `https://wewed-3ugogxge1-11-11.vercel.app`, Ready, redeploy of `fadc62fe`, holds the integration branch alias |
| Final HEAD | this receipt commit (docs only; no product/test source changed) |

## B2. PR202 residual disposition (D-081)

The 313 historical PR202 deployments were **not deleted**. They are accepted as a bounded synthetic-UAT residual (`wewed-pr202-uat-20260912`, per moderator forensics). Before opening the corridor:
1. The old branch has no current `WEWED_PREVIEW_WRITABLE_WEDDING_ID`.
2. The integration branch had none.
3. C&K returned **`423 PREVIEW_WRITE_BLOCKED`** on `pwc2l9wee`.

## B3. Pre-state (01:02:42Z, real iOS `GuestSessionClient`, read-only)

| Field | Value |
| --- | --- |
| weddingId / guestId | `cmqos70cb0004q6vxe9g9aiu5` / `cmuahx3ka0001js043cseq7z4` |
| attending | null (`pending`) |
| mealChoice / plusOneName / plusOneMeal / dietaryNotes | null |
| plusOne / kidsAttending / kidsCount | false / false / 0 |
| **message** | **null** |
| checkedIn / checkedInAt | false / null |
| partySize / seatingTableId | 1 / `cmqpub1j0003dnyspfjfhfw3a` |
| invitationCardStyle | `ivory-floral-gold` |
| Guest token sha256 | `92277a97cabb5e848d42d26ca6cc4de2d3ea4ce899085bb0042b81a9182f0ac9` |

Native blocker closure: `/api/native/wedding/guests` (grant `planner:wedding:cmqos70cb0004q6vxe9g9aiu5`) target row **has `rsvpMessage: null`**. Status, party and seating equal desktop.

Android baseline (read-only): the RSVP sheet's message field was empty.

## B4. Corridor

- Set at 01:04:47Z: `WEWED_PREVIEW_WRITABLE_WEDDING_ID=cmqos70cb0004q6vxe9g9aiu5`, Preview only, branch `integration/phase13-live-account-data-convergence-20260926` only.
- Redeployed `fadc62fe` → `dpl_q6Qdp…`, Ready.
- **Another wedding still blocked:** body-less `POST /api/native/wedding/tasks?grantId=…` on the corridor deployment. Wedding `wewed-planner-uat-20260804` → **423** `PREVIEW_WRITE_BLOCKED`. Wedding `cmquiz3bn0040o3drgqktrwdj` → **423**. The guard precedes body parsing, so there was no write either way.
- **C&K in scope:** Guest `PUT {}` returned **409** `STALE_GUEST_CONTEXT` (no `originGuestId`, no write).
- Session hygiene: Planner desktop and native sessions were created on the read-only `pwc2l9wee` **before** the corridor opened. Only GETs were made during it, with no sign-in or `/api/auth/me`. All Planner, Guest and Android reads targeted read-only deployments on the same database. Only the two RSVP writes targeted the corridor deployment.

## B5. Writer and wire body

**Writer:** iOS. The untracked harness drives the repository's real `GuestSessionClient.saveRsvp(weddingSlug:originGuestId:update: GuestRsvpUpdate(message:))`:
- built from `apps/ios` (unchanged since `ba38a362`) with SwiftPM Debug;
- lane `NativeServerLane.productionPreview`, validated by `NativeServerOrigin.validatePreviewOrigin`;
- guest session from the real `exchangePrivateInvitation`.

The ordinary iOS form always sends `attending` (`LiveGuestInvitationView.swift:569`), so the harness path is used as D-080/D-081 allow. A recording `URLProtocol` captured the transmitted bodies:

| Write | Body keys | attendingPresent | message |
| --- | --- | --- | --- |
| Forward | `["message", "originGuestId"]` | **false** | 28 chars, sha256 `20cf47662542155f86b4c5d83a55cc5aa20a2a3bd8b6963b3e0f0328acefd8a7` (= "QRO03 live convergence check") |
| Restore | `["message", "originGuestId"]` | **false** | `""` (empty string) |

Harness incident (no write): the first forward attempt at 01:08:00Z was refused by the harness's own pre-state guard. The guard compared a Swift `Bool` with a JSON-decoded number, so it was a harness type bug, not drift. It sent only the Guest exchange `POST` and snapshot `GET`, with **no `PUT`** (corridor logs confirm). A re-read confirmed the state was identical to the pre-snapshot. The guard was fixed to compare JSON-normalized values and widened to every RSVP field and the token digest.

## B6. Forward write

- `PUT /api/weddings/charity-and-kudzie/guest-session` at 01:08:50Z → **200**, `saved`.
- Before/after diff: **only `message`** changed (null → marker).
- attending null, party 1, seating `cmqpub1j…`, checkedIn false, style `ivory-floral-gold` and token digest `92277a97…` were all unchanged.

## B7. Propagation (before restoration)

| # | View | Endpoint / client | weddingId | guestId | message | status | party | seating |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Guest session | iOS client `GET /api/weddings/charity-and-kudzie/guest-session` | `cmqos70c…` | `cmuahx3k…` | **= marker** (sha256 match) | pending (attending null) | 1 | `cmqpub1j…` |
| 2 | Planner/Couple desktop | `GET /api/planner/guests` → `rsvp.message` | `cmqos70c…` | `cmuahx3k…` | **= marker** | pending | 1 | `cmqpub1j…` |
| 3 | Native Planner API | `GET /api/native/wedding/guests?grantId=planner:wedding:cmqos70c…` → `rsvpMessage` | `cmqos70c…` | `cmuahx3k…` | **= marker** | pending | 1 | `cmqpub1j…` |
| 4 | Other native Guest client | Android DEBUG `pro.wewed.app.dev` (explicit component, `ba38a362`-equivalent `apps/`), cold relaunch → invitation → details → RSVP sheet | `cmqos70c…` (export) | `cmuahx3k…` (export) | **"QRO03 live convergence check"** in `invitation-rsvp-message` (screenshot + UI dump); Save not tapped | pending | 1 | `cmqpub1j…` |

## B8. Restoration

- `PUT /api/weddings/charity-and-kudzie/guest-session` at 01:11:08Z, `message: ""` → **200**, `saved`.
- **Final state equals the pre-snapshot on every recorded field:** message null, attending null, party 1, seating, checkedIn false/null, style `ivory-floral-gold`, token digest `92277a97…`. Checked on the corridor response, again on the final read-only deployment, and via desktop and native Planner reads (both equal pre-state, message null).

## B9. Corridor closed and Preview read-only

- Removed at 01:11:30Z: `vercel env rm WEWED_PREVIEW_WRITABLE_WEDDING_ID preview integration/phase13-live-account-data-convergence-20260926`. **No** writable entry remains in any Preview scope.
- Redeployed `fadc62fe` → `dpl_GLSWXAcNX3uQp7XAu6DXGz5C1xKT`, Ready, holding the branch alias.
- **Final proof:** Guest `PUT {}` on it → **`423 PREVIEW_WRITE_BLOCKED`**.
- Residual for the moderator: Vercel bakes env into each build, so the corridor deployment `dpl_q6Qdp…` (`wewed-q3hssjdtx`) remains writable for C&K at its own unique URL, behind Deployment Protection. It is not deleted (it holds this run's runtime-log evidence). Retiring it is a moderator decision.

## B10. Write accounting and evidence

- **test writes 1 · restoration writes 1 · other wedding business-data writes 0.**
- Corridor-deployment runtime logs show exactly:
  - two C&K RSVP `PUT`s with 200 (01:08:50, 01:11:08);
  - one scope-probe `PUT` with 409;
  - two body-less native-tasks `POST`s with 423;
  - Guest exchange/snapshot reads.
- No Pass, WW2, Gate, style, token, Guest, seating or date action. Wedding Day remains BLOCKED-ACTIVATION (untouched).

## B11. Production and secrets

- Window 01:02:42Z–01:13:20Z: production received **0** Guest RSVP PUTs, Guest exchanges or native requests. Its only traffic was other users' `/api/notifications/count`, one `/` and cron jobs.
- Credentials from `~/.wewed-qa/qro02b.env` via literal parsers, never printed. The Admin file was not read. `WEWED_PARITY_ALLOW_PASS_GET` unset.
- The saved Planner session material was deleted at the end.
- This receipt scanned clean for tokens, passwords, bearer/cookie values and the invitation URL.

QRO03 CONTROLLED REVERSIBLE CHARITY & KUDZIE RSVP WRITE PROVEN — NATIVE WRITE PROPAGATED TO PLANNER + NATIVE ACCOUNT API + OTHER NATIVE AND RESTORED EXACTLY — PREVIEW RETURNED READ-ONLY — RETURNING TO MODERATOR FOR QRO04 RELEASE DECISION.
