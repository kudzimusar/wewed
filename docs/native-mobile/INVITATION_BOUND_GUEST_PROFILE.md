# The invitation-bound Guest Profile

**Task stamp:** `WW-NATIVE-INVITATION-BOUND-GUEST-PROFILE-2026-09-21-01`
**Status:** Binding. A change that contradicts this is a defect, not a variation.

---

## The rule

> A private Wewed invitation is both a wedding invitation and the onboarding credential for an
> invitation-bound Guest Profile. A verified Guest does not require ordinary Wewed account
> onboarding. The Guest session restores their own wedding experience until expiry or revocation;
> RSVP determines attendee capabilities.

## Two authorization domains, not one

| | Account session | Guest session |
|---|---|---|
| Who | Couple, Planner, Vendor, Coordinator, Usher, Admin | An invited Guest |
| Credential | Email + password | Their private invitation |
| Provisioned by | Themselves, at signup | The couple, as a Guest record |
| Restores | Their workspace | Their wedding |

These never merge. An invited Guest is **not** inserted into `User` / `UserProfile` /
`WeddingMembership`, and `isAuthenticated` is never set with a fabricated account token to get
through routing. The Guest record already represents them.

## What the invitation does and does not do

**The private invitation establishes identity. RSVP determines capability. It does not create the
identity.**

That distinction is the whole design, and it is easy to get backwards. A guest who has not replied
is not a stranger at the door — they are an invited guest who has not replied. They may see their
wedding, their invitation and their own profile. What they cannot do is walk in.

## Capability matrix

`GuestCapabilityPolicy` is a pure function, tested on both platforms, because scattering
`attending == true` through views is how a declined guest ends up holding an admission credential
in one place and not another.

| | Pending | Attending | Declined |
|---|:--:|:--:|:--:|
| Home, Invitation, Wedding details, Venue, Couple Website, Registry, Profile | ✅ | ✅ | ✅ |
| RSVP asked | ✅ | — *never re-asked* | — *never re-asked* |
| Wedding Pass | ✗ | ✅ | ✗ |
| Party, Seating, Programme, Announcements, Check-in | ✗ | ✅ | ✗ |

Declining does not un-invite anyone. They keep their invitation and their profile, because they
were invited and that does not stop being true. What they do not get is admission.

## Entry precedence

Unchanged from the invitation protocol, and deliberately so:

| Rank | Claim | Outcome |
|---|---|---|
| 1 | Explicit private invitation this launch | That Guest's invitation, even on a planner's phone |
| 2 | Valid privileged account session, ordinary launch | The account workspace wins |
| 3 | Remembered Guest session, no privileged account | The Guest experience |
| 4 | Neither | Welcome / Sign In |

A remembered Guest never displaces a Couple, Planner, Admin or Vendor. Leaving an invitation opened
over a privileged workspace returns to that workspace rather than destroying it.

## Two ways in, deliberately different

```
private link  → splash → configured invitation FIRST → RSVP or Continue → Guest Home
app icon      → splash → validate remembered session → Guest Home
```

The ceremony belongs to the link. Replaying the full opening every time someone checks their table
would be tiresome rather than ceremonial — so an ordinary relaunch goes to Home, and **Invitation
is always one tap away**, reopened from the current server snapshot rather than by re-exchanging
the raw credential.

## The dead end this replaced

The production guest path used to finish with `onContinue = {}` on both platforms. A guest could
open their invitation and then had nowhere to go — no wedding, no profile, no way back to the card
once they left it. That single empty lambda was the onboarding problem in code.

## No signup wall

Inside the Guest experience there is no "create account", "set password" or "complete onboarding".
Email and phone may be *displayed*; they are never *required*. Cross-device recovery is a separate,
future design.

## Forgetting a wedding

Guest access is device-persistent, so there is an explicit way to remove it: **Forget this wedding
on this device**. It clears the Guest session and nothing else — forgetting a wedding on a
planner's phone cannot sign the planner out of Wewed. It is deliberately not called Sign Out.

## Where the data comes from

| Surface | Authority |
|---|---|
| Guest identity, RSVP, party, meal, dietary, message, table, check-in | `GET /api/weddings/{slug}/guest-session` |
| The invitation itself | the same session's snapshot |
| Wedding content, programme, songs, gallery | `GET /api/wedding-content?slug=` *(guest-authorized)* |
| Wedding Day guest context, announcements | `GET /api/wedding-day/guest` *(pending backend promotion)* |
| Wedding Pass credential | `GET /api/wedding-day/pass` *(pending backend promotion)* |

The guest-session endpoint is scoped to *me*. Native never loads a guest roster and searches it,
and never receives a database credential of any kind.
