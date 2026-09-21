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

---

## 10. The live runtime path

**Added by `WW-NATIVE-LIVE-GUEST-INVITATION-UAT-2026-09-21-02`.**

An earlier revision of this document described the client and claimed the wiring was done. It was
not: the client had good unit coverage and the running app never called it. The correction below is
the architecture that makes the claim true, and the test that keeps it true.

### 10.1 The path

```
incoming URL
  → AppState.handleIncomingUrl        parses with InvitationEntryParser
  → pendingInvitationEntry            carried, not dropped
  → Root consumes it exactly once     an exchange is not idempotent
  → LiveGuestInvitationCoordinator.enter()
      ├── PrivateInvitation → GuestSessionClient.exchangePrivateInvitation()
      └── Handoff           → GuestSessionClient.redeemHandoff()
  → GuestSessionClient.loadInvitation()
  → LiveInvitationState.Presenting(snapshot)
  → LiveInvitationPresentation        no credential survives here
  → NativeInvitationExperience
```

RSVP goes `LiveGuestInvitationScreen/View → coordinator.answer() →
GuestSessionClient.saveRsvp(weddingSlug, originGuestId, attending)`.

### 10.2 Guest-only production bootstrap

`GuestInvitationBootstrap` builds `SecureStorage → GuestSessionClient → coordinator` **outside**
`NativeRepositoryFactory`, one instance per process.

An invited guest needs the guest-session authority and nothing about tasks, budgets, vendors or
admin. Routing the invitation through the repository factory would mean a guest could not open
their card until the entire production workspace was enabled — far more production surface than the
invitation slice is authorized to turn on.

| Launch | Result |
|---|---|
| production + incoming invitation | guest-only live shell |
| production + ordinary launch | still unavailable, as before |

On Android the guest-only shell replaces the environment-unavailable screen when the launch carries
a credential. On iOS the app used to `preconditionFailure` on a production launch; it now degrades
to the same guest-only shell, because an invited guest deserves their card rather than a
termination.

### 10.3 Shadow and live never fall back to each other

Every legacy `repository.resolveInvitation` / `confirmRsvp` call is now guarded by
`allowsMutableNativeDevelopment`, at the function rather than only at the call site. If the live
guest-session authority refuses or cannot be reached, the guest is told — they are never shown
fixture data that looks like their invitation.

`Refused` and `Unavailable` are separate states throughout, because "this link is not yours" and
"try again in a moment" are opposite messages and showing the wrong one abandons a working
invitation.

### 10.4 The test that keeps it honest

`LiveInvitationRuntimePathTest` / `Tests` drive the same sequence the app does against a stub of the
real API, with a repository spy whose every legacy method **throws**. A plausible return value is
what let the old path masquerade as working, so the spy refuses to provide one. If anyone
reintroduces the repository into the live path, those tests go red.

### 10.5 iOS Keychain

`GuestSessionClient` stated the issued session was held in the Keychain. Until this task that was
false — the only implementation was in-memory, so the session did not survive a launch.
`KeychainSecureStorage` is now real, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (a guest
session is bound to the device that redeemed the invitation and must never sync), and round-tripped
by a test.

### 10.6 Guest Pass — an explicit backend gap

Traced on `origin/main@ba4b08f8`. `wedding-guest-pass-dialog.tsx` reads
`/api/weddings/{slug}/guest-session` and renders the guest's name, table number and a
checked-in/ready badge. Its `QrCode` is a **lucide icon, `aria-hidden`** — decoration, not a code.
`guest-session` returns no QR, serial or admission token, and there is no pass endpoint on main.

**There is no production Guest Pass QR authority.** Native's `WeddingPass.qrPayload` has no
counterpart. Per the standing rule, native does not generate one from the RSVP token, guest id,
email or name. This is a backend contract to be designed, not a native gap to be filled.
