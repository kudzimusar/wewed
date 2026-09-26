# INV-CANON01 — Approved Native Digital Invitation Canonical Reference Closure

## Repository
`kudzimusar/wewed`

## Critical visual correction

The canonical invitation is **NOT** the flat generic web catalogue tile labelled:

`Ivory Floral Gold / TRI FOLD`

The canonical invitation is the previously approved native digital invitation whose CLOSED state is the ornate ivory-and-gold floral stationery with:
- sculpted/embossed ivory floral doors;
- champagne/gold edging and botanical detail;
- central circular monogram/seal;
- the text **“A SPECIAL INVITATION AWAITS”**;
- the interaction cue **“Tap to open”**.

Repository evidence for this approved object:
- canonical approved closed reference:
  `public/invitation-art/ivory/reference/closed.png`
- normalized/shipped artwork:
  `public/invitation-art/ivory/closed-master.webp`
  `public/invitation-art/ivory/closed-surface.webp`
  `public/invitation-art/ivory/left-door.webp`
  `public/invitation-art/ivory/right-door.webp`
- artwork provenance is recorded in:
  `public/invitation-art/ivory/manifest.json`
  where the closed source is identified as **“Original approved session PNG”**.
- Android native renderer:
  `apps/android/app/src/main/java/pro/wewed/app/ui/invitation/ivory/IvoryFloralGoldNative.kt`
- iOS native renderer:
  `apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift`

The flat web Premium Collection thumbnail is only a generic style-library representation. It is **not** acceptable as the canonical digital invitation.

## Purpose

Establish the approved native digital invitation artwork/state machine above as the one canonical invitation reference across web, iOS and Android before any further real visual invitation UAT.

## Root cause to close

Two different concepts were conflated:

1. a generic web catalogue/style tile;
2. the approved interactive native invitation object.

The web Premium Collection currently renders the Ivory catalogue tile through generic `DigitalInvitationCard(... compact)`, while the approved invitation exists separately through the Ivory artwork engine and native renderers.

The product must canonize the approved invitation object, not the generic catalogue tile.

## Mission

1. Make the approved native invitation CLOSED reference the visual authority for the corresponding web studio selection/preview.
2. The web preview must use the same approved artwork/state contract, not recreate the flat catalogue tile at larger size.
3. Preserve the approved state machine:
   `CLOSED -> OPENING -> OPEN -> DETAILS`.
4. Confirm Android and iOS use the approved native artwork/renderers.
5. Add tests that fail if the approved invitation is replaced by `DigitalInvitationCard` / generic motion.
6. Do not change Charity & Kudzie live saved style in this unit.
7. Do not visually qualify Botanical/Garden Romance.

## Canonical CLOSED acceptance

The closed-state proof must visually and structurally match:
`public/invitation-art/ivory/reference/closed.png`

Required characteristics:
- full-height invitation object;
- embossed/sculpted floral ivory stationery;
- gold/champagne botanical edging;
- centre circular monogram/seal;
- “A SPECIAL INVITATION AWAITS”;
- “Tap to open”;
- left/right opening doors;
- no flat generic couple/date/venue catalogue card substituted for this state.

## Web acceptance

- The web studio must clearly distinguish a catalogue thumbnail from the canonical invitation preview.
- Selecting the corresponding invitation must render the approved closed artwork object.
- Canonical preview exposes the real state machine and approved artwork.
- No generic `DigitalInvitationCard` or `GenericMotionCard` may be accepted as the canonical CLOSED state.
- If a thumbnail remains for browsing, it must not be used as proof of invitation equivalence.

## Native acceptance

Android:
`approved style -> IVORY_CUSTOM -> IvoryFloralGoldNative`

iOS:
`approved style -> .ivoryCustom -> IvoryFloralGoldNative`

Both must preserve:
`CLOSED -> OPENING -> OPEN -> DETAILS`

and use the approved invitation artwork assets/reference.

## Safety

No Charity & Kudzie business-data write.
No invitation token rotation.
No production deploy.
No merge to main.
No Wedding Day/WW2 change.
No RSVP mutation.

## Completion

`INV-CANON01 APPROVED NATIVE DIGITAL INVITATION CANONIZED — ORNATE IVORY/GOLD CLOSED REFERENCE + OPENING/OPEN/DETAILS CONTRACT PROVEN ACROSS WEB/IOS/ANDROID — RETURNING TO MODERATOR FOR QRO02C RELEASE.`
