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
