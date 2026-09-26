# Guest Ceremonial Entry Contract

> **SUPERSEDED IN PART — 2026-09-22, master plan `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01` §6.2, §6.3,
> §8.11 (Phase 1).**
>
> The "card on each new Guest app-entry session" rule below was never production behaviour. Only the
> Shadow workspace root implemented it, while the production Guest shell opened remembered Guests on
> Home. The single contract is now:
>
> - explicit private invitation → splash → configured Digital Invitation FIRST → Guest journey;
> - ordinary app-icon return by a remembered Guest → Guest Home;
> - My Digital Invitation stays one tap away and reopens the same saved card.
>
> It is stated once in `GuestCeremonialEntry.opensOnInvitation` on both platforms and read by the
> production Guest shells and the Shadow root alike. The RSVP-dependent *presentation* rules in this
> document (what the card asks, pass eligibility, lifecycle phases) remain in force.

**Status: release invariant (entry-session rule superseded — see banner).**
Added to the Master Plan release gate 2026-09-20.

> **Amended 2026-09-20 by `WW-NATIVE-INVITATION-EXACT-PARITY-RULE-2026-09-20-08`.**
>
> This document says *when* the invitation is staged and *what it asks*. It does not decide **which
> invitation**. That is the wedding's saved `invitationCardStyle`, and native must render that exact
> approved design — see
> [NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md](./NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md).
>
> Where this document previously described "the personalised card", read: *the wedding's configured
> digital invitation*. The `GuestCeremonialCardScreen` / `GuestCeremonialCardView` built against
> this contract were an invented design and have been deleted.

---

## The rule

> An officially invited Guest always enters a wedding through its configured digital invitation
> experience.
>
> The invitation is both identity entry and recurring wedding entry presentation.
>
> It precedes the normal Guest workspace on each new Guest app-entry session.
>
> RSVP state alters the actions displayed by the invitation, but does not remove the invitation
> from the Guest entry flow.

---

## Why

The invitation was being treated as an onboarding page: shown once, answered, discarded. That is
wrong about what the card *is*.

The Couple recognised this person. The card is that recognition — it is how they were let into the
wedding, and it is how they come back to it. Retiring it after the first RSVP turns a ceremony into
a form, and leaves a guest entering through a dashboard.

So the card stays. What changes is **what it asks**.

```
Wewed launch -> motion splash -> the personalised card -> the Guest continues from it
```

---

## What the card asks

The same card across the whole life of one wedding. A guest who has replied is **never asked
again**.

| Phase | RSVP | Headline | Primary action | Pass? |
|---|---|---|---|---|
| Before | Pending | You're invited | **RSVP Now** | No |
| Before | Attending | You're going · *RSVP confirmed* | **View My Wedding Pass** | Yes |
| Before | Declined | Response recorded · *Not attending* | **View Wedding Site** | **Never** |
| Wedding day | Attending | Today · *You're expected today* | **View My Wedding Pass** | Yes |
| Wedding day | Pending | Today · *We haven't heard from you yet* | **RSVP Now** | No |
| Wedding day | Declined | Today · *Response recorded* | **View Wedding Site** | **Never** |
| After | any | Thank you for celebrating with us | **View Gallery** | No |

A declined guest keeps the wedding — its site, the couple's story — and may change their answer
where the couple allows it. They are **never** issued an admission pass. That is an invariant of
the model, not a rendering choice.

The reminder line is derived from the wedding date, never written down: *93 days to go* → *This
week* → *Tomorrow* → *Today*.

---

## What "every time the app opens" means

An **entry session**, not a foreground event:

| Presents the card | Does not |
|---|---|
| Cold launch | Returning from a brief background switch |
| Relaunch after termination | Navigating inside the app |
| Fresh deep link | Recomposition / view update |
| Restore after process death | |

Interrupting someone with a ceremony every time they glance at another app would be an irritation,
not a welcome. On both platforms the boundary is the root view's own state — it survives
backgrounding and dies with the process, which is exactly the right scope.

---

## Precedence

```
incoming invitation link          (a link opened right now)
  > recognised Guest card         (standing recognition, once per entry session)
  > valid session -> workspace
  > welcome
```

An invitation link outranks everything, including an active session of any role. The card outranks
the Guest workspace, the wedding site and the pass — it *is* the way in to all three.

## Replacing the active Guest

Opening Guest B's invitation while Guest A is active leaves **nothing** of A behind: not their
party, their table, their pass, or a half-filled RSVP form.

If B's claim is invalid, the app **clears A and restores nothing**. Showing one person another
person's invitation is the worst outcome available here, so fallback is refused by construction.

---

## Answering is not admission

The old contract was `confirmRsvp(...) -> WeddingPass`: answering an invitation *returned an
admission pass*. Two untruths in one signature. A guest who declines is still answering, and has no
pass. And whether an attending guest may be admitted is the server's decision — capacity,
revocation and signing all live there.

`RsvpSubmissionResult` separates them: `status`, `partySize`, `passEligible`, and an optional
`pass` the **server** issued. A declined result carrying admission material is **not
constructible** on either platform.

It also carries an `idempotencyKey`, because a double tap or a retry after a timeout must produce
one answer, not several.

## What an invitation permits

"Party of 4" does not mean the guest may invent three names. `RsvpFormPermissions` states what the
couple actually issued — how many may come, whether a plus-one is allowed and named, whether
children are included, which questions are asked at all. The form is built from that, not from a
party-size number. An unstated permission defaults **narrow**, so a gap in the server's answer
cannot become a licence.

---

## Status

| | Android | iOS |
|---|---|---|
| Card first on every entry session | ✅ | ✅ |
| Never re-asks an answered guest | ✅ | ✅ |
| Declined guest never issued a pass | ✅ | ✅ |
| Lifecycle-aware card | ✅ | ✅ |
| Guest A → Guest B, no fallback | ✅ model | ✅ model |
| Answering decoupled from admission | ✅ | ✅ |
| Invitation-stated RSVP permissions | ✅ model | ✅ model |
| **Secure claim exchange** | ⬜ MOBILE ADAPTER MISSING | ⬜ MOBILE ADAPTER MISSING |
| **Guest session in secure storage** | ⬜ MOBILE ADAPTER MISSING | ⬜ MOBILE ADAPTER MISSING |
| **Server validation on restore** | ⬜ MOBILE ADAPTER MISSING | ⬜ MOBILE ADAPTER MISSING |
| **Account linking after RSVP** | ⬜ | ⬜ |
| **Deferred install handoff** | ⬜ MOBILE ADAPTER MISSING (/api/invitations/install-handoff exists) | ⬜ MOBILE ADAPTER MISSING |

### Correction — 2026-09-20

An earlier version of this document stated that *"there is no claim exchange endpoint, so no
`GuestInvitationSession` can be minted"*. **That was wrong, and wrong in the direction that
matters.** The endpoints exist:

| Capability | Backend route |
|---|---|
| Exchange an RSVP claim for a guest session | `GET /api/weddings/[slug]/guest-session/exchange?token=…` |
| Guest session lifecycle | `GET/POST/PUT/PATCH/DELETE /api/weddings/[slug]/guest-session` |
| Invitation access exchange | `GET /api/weddings/[slug]/invitation-access/exchange` |
| Deferred install handoff | `POST /api/invitations/install-handoff` |

`setWeddingGuestSessionCookie` already mints a guest session carrying the wedding, the guest and
the RSVP token. Wewed web has done this the whole time.

So the classification is **MOBILE ADAPTER MISSING**, not *server contract absent*. The distinction
is the entire point: one is a gap in our work, the other would be a gap in the product. Recording
it as the latter would have quietly retired it from the queue.

The native models and routing are in place and asserted; the mobile client for these endpoints is
not written. Guest entry remains unqualified for production until it is.
