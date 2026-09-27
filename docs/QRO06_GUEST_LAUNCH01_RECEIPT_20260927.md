# QRO06-GUEST-LAUNCH01 — Charity & Kudzie Guest journey launch hardening — implementation receipt

Implementation self-report; independent moderator review decides acceptance.

- Branch: `closure/phase13-qro05-planner-invitations-qr-read-parity-20260927`
- Start: `2063bb7b11e4f9e2a91021d22df87b10ce942982` (verified after fetch)
- Final implementation head before this receipt: `5ce41588367533f3727aecbfa369b3501c4f05c7`
- No merge, deploy, migration, secret or env change. No token rotation, invitation send, Gate
  operator, check-in or C&K business-data write.

## Recommendation

**NOT PROVEN for broad C&K Guest distribution.** Two blockers remain.

1. **Production does not have these fixes.** On the real C&K link today, `wewed.pro` (main
   `646f0842`) shows an Android Chrome recipient only "Your invitation is waiting in Wewed … remains
   locked". There is no browser path, so Android web recipients cannot reach the invitation or
   RSVP. This branch fixes it (the personal gate auto-continues; the printed gate now continues too),
   but an owner-approved merge/deploy is required.
2. **Preview qualification of the new server routes.** The Preview route still needs an approved path.
   Reading the Vercel automation-bypass secret was refused by the session's safety policy, and no
   deploy is allowed in this unit. The real C&K handoff (Couple Website/Gifts preserving Guest
   authority) therefore could not be exercised on a Wewed server that has the new routes.

iPhone recipients can proceed on production today ("Continue in browser" → personalized Ivory
invitation → RSVP), proven on the real C&K link.

## A. Rich Guest Profile (moderator patch) — requalified

- Both platforms show real values only:
  - Name, invitation contact, RSVP, seating, party, meal, dietary notes, message.
  - Declined Guests: RSVP and message only — no seating, meal, party or dietary.
- iOS `GuestProfileUITests`: 5/5 (against the current fixture server).
- Android instrumented: 14/14.
- Android fixes, test-side only:
  - its in-test fixture never received the moderator's enrichment;
  - the new `assertTextContains` calls targeted non-merging `IACard` containers.

## B. Native → browser Guest handoff

- `POST /api/weddings/{slug}/guest-browser-handoff` — issue:
  - requires the `x-wewed-client: native` header;
  - requires a valid Guest session for that wedding, and uses the Guest the server resolves from
    that session (any `guestId` in the body is ignored);
  - accepts only the `site` or `registry` destination keys;
  - refuses a `private` wedding.
- The exchange:
  - a 90 s HMAC token with a domain-separated key;
  - carries weddingId, guestId, invitation-version fingerprint, destination, expiry and nonce;
  - carries no RSVP token and no session cookie.
- It is returned as the relative path `/guest-handoff/{slug}#h=…`. The fragment is never sent to a
  server, so it never appears in request logs, a proxy or a Referer.
- `/guest-handoff/{slug}` removes the fragment from history and POSTs it to `…/redeem`. Redeem:
  - re-reads the wedding, the Guest and the current invitation version (a rotated token,
    cross-wedding use, a now-`private` wedding, tampering or expiry all fail to the gateway);
  - issues the normal browser Guest session;
  - returns a server-derived path, `/w/{slug}?view=site` or `…#registry`.
- The page follows only `/w/` paths. The proxy allows exactly those two POSTs.
- Stateless: no table, no migration, no business write.
- Clients (iOS and Android, both invitation and More CTAs):
  - accept only `/guest-handoff/{slug}#h=…` and join it to their own lane origin;
  - on failure, show a plain message — never a fallback to an unauthorized URL.
- Proof:
  - disposable-DB suite 6 tests; proxy behavioural test;
  - client tests on both platforms;
  - the live lanes: Safari and Chrome open the site and Gifts as this Guest, while an anonymous
    browser gets the gateway.

## C. Android browser fallback

- **Personal link.** This branch's gate auto-continues to the browser card when deferred install is
  off. With deferred install on, "Continue in browser instead" is shown.
  - Real Chrome, local backend: lands on the personalized Ivory card.
  - Android/iPhone agents: RSVP dialog opens.
- **Printed-invitation link.** It no longer shows "remains locked":
  - deferred install off → the verified browser claim;
  - deferred install on → Open/Get Wewed plus "Continue in browser instead".
  - Real Chrome shows "Find my RSVP".

## D. Ivory CTA matrix

| CTA | iOS native | Android native | Web |
| --- | --- | --- | --- |
| RSVP / Update RSVP | ✓ (pending saves through the server; answered shows "Update RSVP") | ✓ | ✓ dialog |
| Add to Calendar | ✓ **fixed**: system event editor | ✓ calendar insert | ✓ .ics |
| Venue Location | ✓ map destination | ✓ map destination | ✓ |
| Gift / Contributions | ✓ handoff → honest state | ✓ handoff → honest state | ✓ |
| A Note from Us | only with a real message | only with a real message (Back fixed) | **fixed**: only with a real message |
| Guest Pass | pending → RSVP; answered → Pass | same | ✓ |
| View Invitation | ✓ | ✓ | ✓ |
| Couple Website | More, via handoff (NM03 keeps it off the Ivory gateway) | same | card button |

Real C&K contribution state: not accepting contributions, 0 campaigns. Guests see the honest
state, and editor prompts are no longer shown to Guests.

## E. Persistent shell — real backend, synthetic C&K-shaped data

| Area | What was proven |
| --- | --- |
| Home | Couple, date, **countdown (fixed)**, **venue (added)**, Guest name, pass status (**fixed**: server state, not "ready"), invitation reopen, next programme item |
| Pass — pending | RSVP required |
| Pass — declined | No admission |
| Pass — attending, outside window | `not_yet_issuable` with its opening date |
| Pass — attending, inside window | Verified WW2 QR |
| Pass — revoked/closed | Rendered as exact server copy (unit-tested) |
| Wedding Day | 4 real ProgrammeItem rows, table, party; announcements honestly empty |
| More | Rich profile; Help and Privacy & Legal open real routes |
| Forget | Clears only the device relationship; RSVP unchanged |

Lanes:
- iOS `GuestLaunchLaneUITests`: 8/8.
- Android `android_guest_lane_driver.py`: 16/16.

## F/G. Real C&K, read-only (production `wewed.pro`)

| Surface | Result |
| --- | --- |
| Android Chrome | **Blocked**: "remains locked", no browser path |
| iPhone Safari gate | "Continue in browser"; stale "coming soon" copy, fixed on this branch |
| iPhone web after Continue | `/w/charity-and-kudzie`, no token in the URL, Ivory tri-fold, personalized card, all CTAs, private RSVP dialog opened and closed unsubmitted |
| Native iOS (`ProductionGuestReadUITests`) | Right wedding, Ivory, personalized, CTAs (no Note — none exists), pending bound, Pass asks for RSVP, no QR, RSVP closed unsaved, Leave and Reopen work |
| Native Android | Same checks |

Real values read:
- Ivory Floral Gold, `link_only`;
- 2026-12-23, Imba Manor, with a map link;
- children welcome;
- no couple message and no RSVP deadline set.

After all runs: RSVP `attending: null`, `checkedIn: false`.

**Not run:** WhatsApp in-app browser (not installed on the qualification devices).

## Request and write accounting

- **Production:**
  - web: 0 non-GET requests;
  - native: guest-session exchange POSTs only (session issuance; the route writes nothing);
  - C&K RSVP unchanged;
  - 0 business-data writes.
- **Local disposable DB:** 8 PUT guest-session calls for the synthetic RSVP test; all other calls
  are reads, exchanges or handoff issue/redeem.
- **Credential handling:**
  - the real link lived only in a 600-mode scratch file, now deleted;
  - it was never printed;
  - XCTest's "Open URL" log line was redacted and the result bundle deleted;
  - the device sessions, the Chrome profile and the `.dev` keychain rows were cleared.

## Tests and builds

| Check | Result |
| --- | --- |
| iOS `swift test` | 552/0 |
| Android `testDebugUnitTest` | 534/0 |
| Integration (handoff, invitation read, RSVP↔Pass) | 17/0, on a UTC disposable DB |
| Contracts | 92/1 — pre-existing `assetlinks` signer test, untouched |
| iOS Debug + unsigned Release | Succeeded |
| Android Debug, UAT, Release compile | Succeeded |
| Wedding Pass CI, run 36323374315 at `5ce41588` | Success |

## Defects found and patched

1. Proxy refused the handoff routes.
2. Absolute redeem URL could name a different host.
3. Exchange appeared in request logs; moved to the fragment.
4. Handoff landed on the invitation cover instead of the site.
5. Guests were shown the couple's editor prompts in the registry section.
6. Home claimed "admission pass is ready" before issuance.
7. iOS ISO parsing broke the countdown and made Add to Calendar a no-op.
8. Android countdown dropped the time zone.
9. Android Back on the Note closed the app.
10. Web showed the tagline as the couple's note.
11. The Android rich-profile test fixture and its assertions.

## Observations for the moderator

- All three RSVP forms (web and both native) pre-select "accept" for a pending Guest. It's canonical
  web behaviour, so it was left unchanged; a product decision is needed.
- On web, the Couple Website button remains on the Ivory card for pending Guests. On native it lives
  in More (NM03).
- The existing `wewed.pro` universal-link and TWA association, and the `assetlinks` contract
  failure, are pre-existing and out of scope.
