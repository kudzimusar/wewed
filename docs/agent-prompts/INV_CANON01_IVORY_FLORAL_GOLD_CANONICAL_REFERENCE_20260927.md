# INV-CANON01 — Ivory Floral Gold Canonical Reference Closure

## Repository
`kudzimusar/wewed`

## Purpose
Establish the **actual closed Ivory Floral Gold stationery** as the one canonical invitation reference across the Planner/Couple web studio and native apps before any further real visual invitation UAT.

## Root cause to close
The dedicated Ivory implementation already exists:
- web: `src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx`
- Android: `apps/android/app/src/main/java/pro/wewed/app/ui/invitation/ivory/IvoryFloralGoldNative.kt`
- iOS: the corresponding native Ivory renderer on the accepted integration lineage.

But the web Premium Collection currently renders every library tile through:
`DigitalInvitationCard(... compact)`

That generic thumbnail visually substitutes a flat card for Ivory instead of showing the real closed tri-fold object.

## Mission
1. Make the Ivory Floral Gold tile/selection in the web Invitation Studio use an exact closed-state preview of `IvoryFloralGoldTriFold`, not the generic compact card.
2. Ensure the interactive Ivory preview starts in the true `closed` state.
3. Preserve the approved state machine:
   `closed -> opening -> open -> details`.
4. Prove Android and iOS dedicated Ivory renderers still implement that same object/state contract.
5. Do not change Charity & Kudzie live saved style in this unit.
6. Do not visually qualify Botanical/Garden Romance.
7. Add regression tests so Ivory cannot silently fall back to the generic thumbnail/renderer.

## Web acceptance
- Premium Collection Ivory tile visibly represents the closed Ivory stationery.
- Selecting Ivory shows the dedicated `IvoryFloralGoldTriFold`.
- `data-invitation-style="ivory-floral-gold"`.
- `data-testid="invitation-trifold"`.
- `data-testid="invitation-closed-cover"` exists before opening.
- left/right door artwork is present.
- opening leads to the approved open state, then details.
- no generic `DigitalInvitationCard` is used as the Ivory canonical preview.

## Native acceptance
- Android dispatch for `ivory-floral-gold` remains `IVORY_CUSTOM -> IvoryFloralGoldNative`.
- iOS dispatch remains `.ivoryCustom -> IvoryFloralGoldNative`.
- no generic-motion fallback for Ivory.
- closed/opening/open/details semantics remain aligned.

## Safety
No Charity & Kudzie business-data write.
No invitation token rotation.
No production deploy.
No merge to main.
No Wedding Day/WW2 change.
No RSVP mutation.

## Completion
`INV-CANON01 IVORY FLORAL GOLD CANONICAL REFERENCE ESTABLISHED — WEB STUDIO + IOS + ANDROID SHARE THE APPROVED CLOSED/OPENING/OPEN/DETAILS CONTRACT — RETURNING TO MODERATOR FOR QRO02C RELEASE.`
