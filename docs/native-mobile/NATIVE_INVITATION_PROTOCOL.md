# Native Invitation Protocol

**Task stamp:** `WW-NATIVE-IVORY-ENTRY-IDENTITY-RSVP-SHARING`
**Authority:** `origin/main` — the production web implementation
**Status:** Binding. Native speaks this protocol or refuses; it does not get to invent a second one.

---

## 1. Why this document exists

A private invitation is a **security protocol**, not a URL convention. A native implementation that
merely looks similar is a second auth model with none of the first one's guarantees.

Everything below is derived from the canonical modules and generated into
`mobile/contracts/invitation-protocol.json`, which both platforms assert against:

| Concern | Canonical source |
|---|---|
| Link and handoff shapes | `src/lib/invitation-links.ts` |
| Credential resolution | `src/lib/personal-invitation-access.ts` |
| Install handoff | `src/app/api/invitations/install-handoff/route.ts` |
| Handoff redemption | `src/app/invite/resume/route.ts` |
| Guest identity and RSVP | `src/app/api/weddings/[slug]/guest-session/route.ts` |
| Session credential | `src/lib/wedding-guest-session.ts` |

---

## 2. The shapes

```
https://wewed.pro/invite/<slug>?rsvp=<private token>    the link a guest is sent
https://wewed.pro/invite/resume?h=<opaque handoff>      after a deferred install
wewed://invite/resume  + extra wewed_handoff=<handoff>  the package-targeted bridge intent
Play install referrer: handoff=<handoff>                deferred install on Android
```

| Value | Shape | Meaning |
|---|---|---|
| RSVP token | opaque, server-issued | The guest's private credential. **Entry and exchange only.** |
| Install handoff | `[A-Za-z0-9_-]{43}` | One-time, opaque, names a pending invitation server-side. |
| Session credential | HMAC-signed, server-issued | What the device holds *after* exchange. |

`card=` in an invitation link is **advisory and ignored**. The wedding's saved
`invitationCardStyle` is authoritative, because a link may be long-lived or forwarded and must not
select someone else's stationery.

---

## 3. The refusals

These are the part most easily lost, so each has a test on both platforms.

| Input | Outcome | Why |
|---|---|---|
| `/invite/resume?...&rsvp=...` | **Refused** | `buildAndroidInvitationIntentUrl` will not emit one; a resume URL carrying a raw credential did not come from Wewed. |
| Handoff not 43 base64url chars | **Refused, before any network call** | It cannot be genuine, so it is not worth sending. |
| `/invite/<slug>` with no `rsvp` | **Refused** | Identifies nobody. |
| Install referrer containing `rsvp` | **Refused** | Play referrers are attacker-supplied. |
| Any non-`wewed.pro` origin | **Not invitation entry** | Including look-alikes such as `wewed.pro.evil`. |

A refusal is **visible** (`invitation-refused`). A link that quietly does nothing is
indistinguishable from the app opening as whoever was already active — which is how someone ends up
looking at another guest's invitation and believing it is theirs. The message is identical for every
reason: naming the failed check would help someone guessing at links.

---

## 4. Entry precedence

`InvitationEntryPolicy` is a pure function, because "which guest is this, and may they take over?"
is a security decision and one buried in a view is one nobody can test.

| Rank | Claim | Rule |
|---|---|---|
| 1 | Explicit link this launch | Wins over everything, **including a privileged workspace** — a guest tapping their own invitation on a planner's phone should see their invitation. |
| 2 | Unconsumed deferred-install record | Honoured at most once, and marked processed *before* it is acted on so an interrupted launch cannot replay it. |
| 3 | Remembered guest session | Restores an ordinary launch only, and **never** displaces a Couple/Planner/Admin/Vendor workspace. |
| — | Anything refused | Fails closed. Never falls back to rank 2 or 3. |

---

## 5. The session

`GuestSessionClient` is a first-class JSON client of the authority that already exists — not a
browser whose cookie jar is read, and not a second identity store.

```
POST /api/weddings/{slug}/guest-session   { token }        exchange the credential
GET  /api/weddings/{slug}/guest-session                    read the invitation
PUT  /api/weddings/{slug}/guest-session   { originGuestId, attending, … }   answer
```

Three rules, each with a test:

1. **The raw RSVP credential is never persisted.** It is a key for the door, not a name badge. Only
   the server-issued session is stored, in the Keystore/Keychain.
2. **The exchange presents no existing session.** It is how a *different* guest takes over; sending
   Guest A's session invites the server to keep Guest A.
3. **Replacement is atomic.** An invalid or expired Guest B link leaves Guest A exactly as they
   were. The server validates before the active guest is replaced.

`originGuestId` on the save is the binding that turns "save this answer" into "save this answer *for
the guest whose card is open*". A `409 STALE_GUEST_CONTEXT` is surfaced, never swallowed.

Nothing in the invitation layer logs. There is deliberately no logging statement in
`InvitationEntry`, `InvitationEntryPolicy` or `GuestSessionClient`, and credentials are redacted
from every description so a default `toString` cannot leak one.

---

## 6. Identifiers

Native adopts the **web component's own `data-testid` values**, so one element has one name across
web, Android and iOS rather than three dialects of the same card.

Shared with the web: `invitation-trifold` · `invitation-closed-cover` · `invitation-panel-left` ·
`invitation-panel-right` · `invitation-open-button` · `invitation-panel-centre` ·
`invitation-guest-personalization` · `invitation-details-button` · `invitation-interactive-details` ·
`invitation-cta-rsvp` · `invitation-cta-calendar` · `invitation-cta-venue` ·
`invitation-cta-registry` · `invitation-cta-note` · `invitation-cta-pass`

Native-only structure and status: `invitation-monogram` · `invitation-opening` ·
`invitation-couple-names` · `invitation-date` · `invitation-venue` · `invitation-details-cue` ·
`invitation-rsvp-confirmed` · `invitation-response-recorded` · `invitation-rsvp-prompt` ·
`invitation-rsvp-accept` · `invitation-rsvp-decline` · `invitation-note-sheet` ·
`invitation-back-to-invitation` · `invitation-continue` · `invitation-cta-couple-site` ·
`invitation-refused`

---

## 7. The two links are not interchangeable

| | Private guest invitation | Couple website |
|---|---|---|
| Path | `/invite/<slug>?rsvp=<token>` | `/w/<slug>` |
| Carries a credential | **Yes** | No |
| May establish RSVP identity | **Yes** | No |
| Safe to forward | **No** | Yes |

`invitation-cta-couple-site` and `invitation-cta-registry` both open `/w/<slug>` (the registry with
a `#registry` anchor, as `visitCoupleWebsite('#registry')` does on the web). Neither ever carries the
guest's credential.

`invitation-cta-pass` opens **this guest's own pass**. It is never the usher scanner, which belongs
to the separate Wedding Day gate project.

---

## 8. Typography

`.ivory-names` and `.ivory-tagline` are Great Vibes, loaded on the web as
`@font-face { font-family: IvoryScript }`. Everything else — including the seal monogram, which sets
no family of its own — inherits `.ivory-stage { font-family: Georgia, serif }`.

`GreatVibes-Regular.ttf` is imported byte-identical from `origin/main:public/fonts/` with its OFL
licence and pinned by SHA-256. A missing font does not crash; it silently falls back to a system
face, so both platforms assert the font is actually registered.

The open face also inherits one colour, `.ivory-stage { color: #70501f }`. Using a darker "ink" is
subtle enough to survive review and still be the wrong invitation.

---

## 9. What is verified, and what is not

Verified on a Pixel 8 emulator and an iPhone 17 simulator:

- the parser and its refusals, on both platforms;
- the session client's security rules, against a stub server that records what reached the wire;
- entry precedence, as a pure function;
- the card's four states against `origin/main`'s reference renders, including the script face;
- every CTA tapped for real, with its effect asserted;
- an invalid link failing closed while a guest was already active, cold **and** warm.

**Not verified here**, and needing production access to be:

- the full WhatsApp → OS → app → live server journey against real guest records;
- the Play Install Referrer path, which needs a Play-installed build;
- `GuestSessionClient` against the live `wewed.pro` API rather than a stub.

The client is written and tested against the real contract, but the app still runs on the SHADOW and
PRIVATE_REAL snapshot repositories. Selecting it as the live data source is a production-read
activation decision, not a code gap.
