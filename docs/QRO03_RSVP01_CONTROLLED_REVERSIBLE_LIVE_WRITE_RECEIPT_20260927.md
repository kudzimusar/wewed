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
