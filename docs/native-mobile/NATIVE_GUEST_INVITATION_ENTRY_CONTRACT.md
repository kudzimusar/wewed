# Native Guest Invitation Entry Contract

**Task stamp:** `WW-NATIVE-INVITATION-EXACT-PARITY-RULE-2026-09-20-08`
**Applies to:** Android (Jetpack Compose) and iOS (SwiftUI)
**Status:** Binding. A change that contradicts this document is a defect, not a variation.

---

## 1. The rule

> An invited Guest enters Wewed through **the actual configured digital invitation design selected
> for that wedding**. Native Android and iOS must not invent or substitute a simplified "ceremonial
> card", summary card, generic ivory card, or other invitation-like UI.

The invitation is a **wedding-configured product object**, not a native screen. Which design a
guest meets is the couple's saved choice — `wedding.invitationCardStyle` — and native renders *that*
design or says plainly that it cannot yet.

### 1.1 What this rule replaced

Before this task, native had two competing invitations and neither was the approved one:

| Removed | What it was | Why it was wrong |
|---|---|---|
| `GuestCeremonialCardScreen.kt` / `GuestCeremonialCardView.swift` | An invented summary card shown to guests who had already answered | Not a Wewed invitation design at all |
| `IvoryInvitationScreen.kt` / `IvoryInvitationView.swift` | An approximation: ivory background, gold border, ornament backdrop | Resembled the approved stationery without reproducing it |

Both are deleted. There is now exactly one path to an invitation on each platform.

### 1.2 What does not count as parity

**`ivory background + gold border + floral ornament = Ivory Floral Gold` is explicitly a FAIL.**

Resemblance is not reproduction. A native invitation passes only when it uses the approved artwork,
the approved geometry and the approved motion. Redrawing the flowers with `WeddingOrnamentBackdrop`,
generic vector shapes, SF Symbols or Material icons is a FAIL wherever the approved artwork exists.

---

## 2. The architecture

```
Guest entry (deep link, recognised session, persona launch)
   │
   ▼
GuestInvitationJourneyScreen / GuestInvitationJourneyView     ← owns the JOURNEY
   │   splash · RSVP submission · pass · the couple's note
   │
   ▼
NativeInvitationExperience(style:)                            ← owns the CHOICE of design
   │
   ├── ivory-floral-gold ──▶ IvoryFloralGoldNative            ← owns the APPEARANCE
   └── any other style   ──▶ "<Design name> isn't available on mobile yet"
```

No screen below `NativeInvitationExperience` decides which invitation to show, and no screen above
it decides how one looks. That separation is what makes the rule enforceable rather than aspirational.

---

## 3. Presentation state is orthogonal to RSVP state

This is the correction at the heart of the task. The two axes were collapsed, and that is precisely
how an answered guest came to be handed a different object.

| | `PENDING` | `ATTENDING` | `DECLINED` |
|---|---|---|---|
| `CLOSED` | ✅ | ✅ | ✅ |
| `OPENING` | ✅ | ✅ | ✅ |
| `OPEN` | ✅ | ✅ | ✅ |
| `DETAILS` | ✅ | ✅ | ✅ |

Every cell is reachable. A returning confirmed guest is `CLOSED` + `ATTENDING`, and that is ordinary
and correct: they meet their invitation shut, and open it again.

RSVP state changes **what the card offers**, never which card it is:

| RSVP state | Status line | RSVP action | Pass |
|---|---|---|---|
| `PENDING` | *(none — the details cue stands here)* | Offered | No |
| `ATTENDING` | "RSVP confirmed" (`ivory-card-rsvp-confirmed`) | **Never re-asked** | Offered |
| `DECLINED` | "Response recorded — not attending" (`ivory-card-response-recorded`) | **Never re-asked** | **Never** |

A declined guest keeps their invitation and the wedding's public content. They never get a pass.

---

## 4. The style registry

`src/lib/digital-invitation-card.ts` is the authority. It is generated into
`mobile/contracts/invitation-styles.json` by
`mobile/contracts/generate_invitation_style_contract.py`, and both platforms assert against it.

| Style id | Name | Native renderer |
|---|---|---|
| `ivory-floral-gold` | Ivory Floral Gold | ✅ exact |
| `midnight` | Midnight Gold | ✗ |
| `botanical` | Garden Romance | ✗ |
| `royal-emerald` | Royal Emerald | ✗ |
| `classic-white` | Classic White | ✗ |
| `blush-romance` | Blush Romance | ✗ |
| `african-luxe` | African Luxe | ✗ |
| `editorial` | Modern Editorial | ✗ |
| `black-tie` | Black Tie | ✗ |
| `watercolour-garden` | Watercolour Garden | ✗ |
| `sunset-terracotta` | Sunset Terracotta | ✗ |
| `celestial` | Celestial | ✗ |

**Aliasing is forbidden.** An earlier native build mapped `botanical`, `ivory`, `ivory-floral`,
`floral-gold` and an empty value all onto Ivory Floral Gold. `botanical` is *Garden Romance* — a
different palette, motif and reveal — so every guest of a Garden Romance wedding would have been
shown another couple's stationery while the build reported invitation parity.

The fallback for an absent value mirrors the server's `normalizeInvitationCardStyle`: it is
`botanical`, **not** whichever design native happens to be able to draw.

---

## 5. Artwork provenance

`mobile/contracts/ivory-invitation-art-provenance.json` pins six files by SHA-256 against
`origin/main:public/invitation-art/ivory/`:

| Asset | Canvas | Android | iOS |
|---|---|---|---|
| `left-door` | 540 × 2340 | `drawable-nodpi/ivory_left_door.webp` | `Resources/ivory-left-door.png` |
| `right-door` | 540 × 2340 | `drawable-nodpi/ivory_right_door.webp` | `Resources/ivory-right-door.png` |
| `open-surface` | 1080 × 2340 | `drawable-nodpi/ivory_open_surface.webp` | `Resources/ivory-open-surface.png` |
| `details-surface` | 1080 × 2340 | `drawable-nodpi/ivory_details_surface.webp` | `Resources/ivory-details-surface.png` |
| `closed-surface` | 1080 × 2340 | `drawable-nodpi/ivory_closed_surface.webp` | `Resources/ivory-closed-surface.png` |
| `paper` | 900 × 200 | `drawable-nodpi/ivory_paper.webp` | `Resources/ivory-paper.png` |

Android copies are byte-identical; iOS copies are lossless WebP→PNG. `drawable-nodpi` is deliberate:
density rescaling would resample the couple's stationery.

---

## 6. Geometry and motion

Also pinned in the provenance contract, asserted by
`IvoryInvitationGeometryTest` (Android) and `IvoryInvitationGeometryTests` (iOS).

- Stage aspect `9 / 19.5`, canvas 1080 × 2340
- Perspective `1900px`
- Opening `1800ms`, easing `cubic-bezier(0.3, 0.1, 0.2, 1)`
- Doors 50% width each, hinged on the **outer** edge

Door keyframes (magnitudes; the left door takes the negative sign on both axes):

| Progress | translateX | rotateY | translateZ |
|---|---|---|---|
| 0% | 0 | 0° | 0 |
| 12% | 0 | 2° | 5px |
| 60% | 24% | 44° | 0 |
| 100% | 112% | 82° | 0 |

Text sits in percentage boxes `[left, top, width, height]` over the artwork, exactly as the web lays
it out, so the two implementations are comparable line by line rather than approximately.

---

## 7. Data the card renders

Nothing on the card is written by the app. Everything is resolved from the wedding graph through
`invitationConfigurationForSlug`, in one read, so the card is never drawn with half the couple's
choices and defaults for the rest.

| On the card | Source | Absent means |
|---|---|---|
| Couple names | `wedding.title` | — |
| Monogram / seal | `wedding.monogram` | Initials derived from the names |
| Date | `wedding.date` | — |
| Venue, city, country | `wedding.venue`, `venueCity`, `venueCountry` | — |
| Tagline | `wedding.tagline` | The line is not drawn |
| Invitation line | `wedding.invitationCardMessage` | The standard invitation sentence |
| RSVP deadline | `wedding.rsvpDeadline` | No deadline line |
| Guest personalisation | The guest's own record | — |
| Venue Location | `wedding.venueMapUrl`, else a venue search | — |
| Gift / Contributions | An active contribution QR destination | **The action is not offered** |
| A Note from Us | `wedding.invitationCardMessage` | **The action is not offered** |

"Absent means the action is not offered" is load-bearing. An invitation that always has "a note from
us" would be inventing words on the couple's behalf.

---

## 8. When the card is staged

Per the Guest Ceremonial Entry Contract, on **every entry session**:

- ✅ Cold launch · relaunch after process death · invitation deep link · persona launch
- ✗ Returning from a background switch within the same entry session
- ✗ An ordinary download by someone who is not a guest — asserted by
  `native-invitation-not-for-ordinary-download.yaml`, which requires `ivory-card-stage` to be absent

---

## 9. Test identifiers

These are contract, not incidental. Both platforms expose all of them.

`ivory-card-stage` · `ivory-card-closed` · `ivory-card-left-door` · `ivory-card-right-door` ·
`ivory-card-monogram` · `ivory-card-open-button` · `ivory-card-opening` · `ivory-card-open` ·
`ivory-card-couple-names` · `ivory-card-guest-personalization` · `ivory-card-date` ·
`ivory-card-venue` · `ivory-card-details-button` · `ivory-card-details` · `ivory-card-rsvp` ·
`ivory-card-calendar` · `ivory-card-venue-action` · `ivory-card-contributions` · `ivory-card-note` ·
`ivory-card-rsvp-confirmed` · `ivory-card-response-recorded` · `ivory-card-view-pass`

Plus, added because the journeys need them: `ivory-card-view-invitation`, `ivory-card-continue`,
`ivory-card-rsvp-prompt`, `ivory-card-rsvp-accept`, `ivory-card-rsvp-decline`,
`ivory-card-note-sheet`, `ivory-card-details-cue`, `invitation-style-unsupported`,
`invitation-style-name`.

### 9.1 Two platform notes worth keeping

Both are cases where the card rendered correctly but could not be *proved* to — which is the more
dangerous failure, because a blank ivory rectangle would then pass every assertion.

**iOS — `accessibilityIdentifier` is inherited.** Set on the stage container it overwrote every
descendant's identifier, so the doors, the seal, the couple's names and the RSVP hits all reported
as `ivory-card-stage`. Each state now marks itself with a one-point leaf element (`IvoryMarker`)
instead, and only real controls and text carry identifiers of their own.

**Android — Compose drops fully-covered semantics nodes.

** A described full-surface tap overlay hid the doors and
the seal from the accessibility tree. The full-surface tap target now carries **no** semantics
(`pointerInput`), and the named `ivory-card-open-button` sits on the cue region the artwork draws.

---

## 10. Runtime evidence

### 10.1 Two defects this qualification surfaced

Neither was a rendering fault; both meant the contract was not actually in force.

| Defect | Effect | Fix |
|---|---|---|
| iOS read the Guest's credential from `SessionStore.passToken`, which nothing ever assigns | `resolveRecognisedGuestCard` always found nil, so the workspace always won and the invitation was silently skipped on every persona entry | The credential is resolved from the verified assignment at the root, the same place the Guest workspace gets it |
| The root committed to the workspace while the card was still resolving | A slow repository skipped the ceremony non-deterministically | The root holds on `entry-staging-invitation` until the lookup has been made |
| The reference repositories implemented no `weddingSlug`, so a slug lookup could never match | The couple's monogram, tagline, note and RSVP deadline never reached the card | Both shadow reference repositories now answer by slug |
| Android and iOS named the guest's own RSVP card `guest-rsvp-status` and `guest-rsvp-state` | One thing under two names; a shared flow asserted an id only one platform had | Aligned on `guest-rsvp-status` |

### 10.2 Two lanes quarantined, not fixed

`native-public-smoke` and `native-authenticated-smoke` were failing before this task and cannot pass
against the native apps: they target the retired Expo / React Native shell (Metro bundling waits,
React Navigation tab ids, a LogBox overlay, the `Aurora & Blake` fixtures). They were moved to
`.maestro/superseded/` with a README explaining what would replace them, so the sweep reports the
truth rather than two permanent reds. Rewriting them against the native shell is a new test surface,
not a repair, and was deliberately left out of this task.

### 10.3 Runtime results

Android, `pro.wewed.app.dev`, Pixel 8 emulator, SHADOW reference environment:

| Flow | Result |
|---|---|
| `native-shadow-deep-link-invitation` | PASS |
| `native-shadow-invitation-accept` | PASS |
| `native-shadow-invitation-decline` | PASS |
| `native-invitation-returning-attending` | PASS |
| `native-invitation-returning-declined` | PASS |
| `native-invitation-not-for-ordinary-download` | PASS |

iOS, iPhone 17 simulator (iOS 27.0): `ios-couple-journey`, `ios-guest-pass-identity` and
`ios-role-traversal` all PASS, including both guest personas walking CLOSED → OPEN → DETAILS →
continue and resolving distinct identities.

### 10.4 Visual qualification

Captured from the running apps and compared against
`origin/main:public/invitation-art/ivory/reference/{closed,opening,open,details}.png`:

| State | Result |
|---|---|
| CLOSED | Sculpted floral doors, gold contours, circular seal, **A SPECIAL INVITATION AWAITS**, **Tap to open ⌄** — matches the reference. The monogram differs (`C\|K` vs the reference's `C\|S`) because it is data-driven, which is correct. |
| OPENING | Doors swing away around their outer hinges over 1800ms. |
| OPEN | **TOGETHER WITH OUR FAMILIES**, *Charity & Kudzie*, the invitation line, **WEDNESDAY DEC 23 2026**, **Imba Manor / Harare, Zimbabwe**, *Especially for Guest G011*, and **RSVP confirmed** in place of the details cue. |
| DETAILS | The approved surface with RSVP, ADD TO CALENDAR, VENUE LOCATION (real venue overlaid), GIFT / CONTRIBUTIONS, A NOTE FROM US, and the View invitation · Guest Pass · Continue footer. |

---

## 11. Known limitation, stated plainly

The real UAT wedding (Charity & Kudzie) is saved as **`botanical` — Garden Romance**, not Ivory
Floral Gold. Native has no Garden Romance renderer, so on the Private Real graph a guest sees
"Garden Romance isn't available on mobile yet" rather than a card.

This is the correct behaviour under this rule and is **not** a pass for that wedding. Card 1 (Ivory
Floral Gold) is complete and exact; Garden Romance is the next renderer required, and until it
exists the Private Real guest invitation route is **FAIL — native renderer missing**, not
"unsupported". The website has the capability; native has not built it yet.

The approved website invitation was not changed to make native easier, and the wedding's saved style
was not changed to make native pass.
