# QRO06-GUEST-LAUNCH01 — Moderator launch-hardening triage (2026-09-27)

**Goal:** make the Charity & Kudzie Guest journey complete enough for invitation distribution today,
while explicitly deferring non-Guest native breadth.

**Current classification: NOT PROVEN FOR BROAD GUEST LAUNCH — bounded profile gaps patched; CTA
authority handoff and real C&K final qualification remain.**

## 1. Starting point

| Item | Value |
| --- | --- |
| QRO05 branch | `closure/phase13-qro05-planner-invitations-qr-read-parity-20260927` |
| QRO05 agent receipt head | `4710896db0a6a5e542b43c469af42c410f685c69` |
| QRO05 C&K production_preview read | BLOCKED-ENV |
| PR #221 | untouched by QRO05 |
| Production/C&K business-data writes in this moderator pass | 0 |

## 2. Guest journey authority already present

The live Guest session already returns real wedding, guest and RSVP data:

- wedding title/monogram/tagline/date/venue/map/city/country;
- saved invitation style/message/RSVP deadline/children policy;
- guest name/email/table identity;
- attendance, meal, plus-one, children, dietary notes, message and check-in state.

The final Guest IA is:

`Home | Invitation | Pass | Wedding Day | More`

Pending Guests remain invitation-bound. Answered attending and declined Guests may enter the
persistent shell. Only attending Guests gain admission/pass/seating/check-in capabilities.

The Wedding Day endpoint already uses real ProgrammeItem rows and the Guest's real
table/check-in/household projection. Announcements remain an honest empty list because no separate
announcement authority exists on this backend line.

The Wedding Pass is deliberately not issued merely because RSVP is attending. The server opens
issuance 14 days before the wedding, and the clients already render the server's
`not_yet_issuable`, `issuance_closed`, `revoked`, declined and RSVP-required states.

## 3. Bounded profile gap found and patched

Before this pass, More/Profile discarded most data the Guest session already supplied and rendered
only Name + RSVP.

Patched both platforms to show real values when present:

- Name
- invitation contact email
- RSVP status
- seating (attending only)
- party summary (attending only)
- meal choice (attending only)
- dietary notes (attending only)
- message to the couple

Commits:

- Android profile: `340fdc91741f76424a08320a2f361fe9767dc09c`
- iOS profile: `7ab74408072cd63732343785b3904cc22a2cc2a7`
- enriched loopback qualification fixture: `a821fb7c10f7fe967dabecbfcd57d7225ec31927`
- Android UI assertions: `e06638e4644964d4a57b016450cf71c7cccfefae`
- iOS UI assertions: `5e3747ca4458c14bc5d990c45fc74f8adda42989`

These commits require fresh build/device qualification before acceptance.

## 4. Active-server-lane defect found and patched

Invitation Couple Site / Gifts URLs and Android More web URLs were hard-coded to
`https://wewed.pro`. That breaks production_preview qualification by jumping from Preview to
production.

Patched:

- Android invitation Couple Site/Gifts: `1cb916c80521e2b9c7091d0d7446b2d47ab88f2f`
- iOS invitation Couple Site/Gifts: `38fb19f5ae4b9e76b773e72da9b561a35b9bb237`
- Android More Couple Site/Gifts/Help/Legal: `e55af03eeabb8d332875a3940d2dff6ce6b9f4d5`

Release builds still use `https://wewed.pro`; Preview builds stay on their one validated Preview
origin.

## 5. P0 blocker: native -> browser Guest authority

The native Couple Website and Gift/Contribution CTAs currently open a normal browser URL. The
native Guest session credential lives in Keychain/secure storage and is sent as an HTTP Cookie by
the native client; it is not automatically installed into Safari/Chrome.

For a `link_only` wedding, `resolveWeddingAccessFromTokens` correctly refuses an anonymous
browser. Therefore these CTAs can lose the Guest's authority after leaving the native app.

This must be closed before claiming every Guest CTA works.

Required resolution: a short-lived, non-token-leaking native-to-browser handoff that revalidates
the active Guest server-side, establishes the normal browser Guest session, and redirects only to
an allowlisted destination such as Couple Site or Registry. Do not put the RSVP credential in the
URL.

## 6. P0 blocker for broad distribution: Android web entry

The current personal-invitation web gate gives iOS/web a browser continuation but Android remains
app-first. If secure deferred app handoff is not enabled/available, an Android recipient can be
told that the invitation remains locked.

For broad guest distribution today, Android must also have a secure **Continue in browser** path
while retaining Open/Get Wewed as an enhancement. This does not require the rest of the native app
to be complete.

## 7. CTA/data audit

| Surface | Current source state | Launch action |
| --- | --- | --- |
| Personal Ivory invitation | real saved style + guest identity | qualify C&K |
| RSVP / Update RSVP | full live RSVP fields, server-bound to guest | qualify safe test path |
| Add to Calendar | real date + venue | qualify on both platforms |
| Venue / Directions | real venueMapUrl or real venue query | qualify |
| Note from couple | only shown when real invitation message exists | qualify C&K |
| Guest Pass | real server availability; WW2 only when issuable | preserve 14-day rule |
| Home | real couple/date/countdown/venue/guest + live day summary | qualify |
| My Digital Invitation | reopens canonical invitation | qualify |
| Wedding Day | real programme/table/party/check-in; no fabricated announcements | qualify |
| Profile/More | rich live profile now patched | requalify |
| Couple Website | target exists, but browser authority handoff missing | **P0 fix** |
| Gifts/Contributions | real web registry/campaign authority exists; browser handoff missing | **P0 fix** |
| Help | real /help route | qualify |
| Privacy & Legal | real /legal route | qualify |
| Forget this wedding | clears local Guest relationship only | qualify |
| Android recipient from shared link | app-first web gate | **P0 browser fallback** |

## 8. Non-blocking later increments

The following should not hold today's invitation launch:

- native rendering of contribution campaigns instead of the authenticated web destination;
- a dedicated announcement domain;
- richer guest profile editing beyond RSVP-owned fields;
- Planner portfolio completeness;
- Vendor/Admin parity;
- Gate visual qualification.

## 9. Safety

This moderator pass performed:

- C&K business-data writes: **0**
- production business-data writes: **0**
- migrations: **0**
- merges/deployments: **0**
- token rotations: **0**
- RSVP mutations: **0**

The next unit must close the two P0 authority/entry gaps, re-run the full Guest lane, and perform the
real C&K read-only qualification before broad distribution is certified.
