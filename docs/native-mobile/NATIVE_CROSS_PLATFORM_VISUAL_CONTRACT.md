# Wewed Native — Cross-Platform Visual Contract

**Document ID:** WW-NATIVE-VISUAL-CONTRACT-2026-09-20-01
**Status:** AUTHORITATIVE for native visual implementation
**Applies to:** Android (Jetpack Compose) + iOS (SwiftUI)
**Companion documents:** `WEWED_NATIVE_INFORMATION_ARCHITECTURE_V2.md` (navigation),
`PRIVATE_REAL_SHADOW_ENTITY_COVERAGE_2026-09-20.md` (what data actually exists)

The Wedding Identity design already implemented on Android is the **approved direction**. This
document records it so that future agents extend one system instead of inventing a second one in
the other toolkit. It is descriptive of what is built, and prescriptive about the rules that were
violated in practice.

---

## 1. Why this document exists

Android and iOS drifted because the visual system lived only in code. Two concrete failures:

1. **Screen overflow on iOS.** `hero-wedding` used `scaledToFill().frame(height: 390)` with no
   parent-width constraint. `.frame(maxWidth: .infinity)` does *not* bound a view when the
   proposal it receives is itself unbounded — it resolves to the child's ideal width. The image
   reported its own aspect-driven width (~800pt), the enclosing stack adopted it, and every
   sibling was laid out and clipped at that width. Android's containers use
   `fillMaxWidth()`/`fillMaxSize()`, so the same design was correct there.
2. **Duplicate navigation.** The reference planner screen owned its own Overview/Tasks/Budget/
   Vendors picker while IA V2 already owned the Plan taxonomy, producing two stacked chip rows.

Both were invisible in unit tests and only appeared when the app was actually run.

---

## 2. The responsive screen contract

```text
Role Shell
    ↓
Safe / available viewport
    ↓
Wewed Screen Container      ← measures once, publishes an explicit width
    ↓
bounded content width
    ↓
role workspace / page
```

**Rule: parent width controls media; media never controls screen width.**

| Requirement | Android | iOS |
|---|---|---|
| Page is bounded to the viewport | `Modifier.fillMaxSize()` on the shell content | `WewedScreenContainer` publishes `wewedContentWidth` |
| Screen body cannot be widened by one child | `Modifier.fillMaxWidth()` on the body | `.wewedBoundedWidth(horizontalInset:)` |
| Media fills, never dictates | `Modifier.fillMaxWidth()` + `ContentScale.Crop` | `.wewedMedia(height:horizontalInset:)` |
| Cards respect available width | `fillMaxWidth()` | bounded body + `frame(maxWidth: .infinity)` |

Additional rules:

- Phone content must **never** scroll horizontally. Level-2 taxonomy chips may scroll
  horizontally; the screen body may not.
- Metric/tile rows must compress, not force a fixed width. Four tiles must fit a 402pt viewport.
- Controls below the fold are acceptable when the body scrolls, but UI automation must scroll to
  them rather than assume visibility (this was the Android invitation-decline failure).
- Tablet may promote Level-1 into a navigation rail. The IA stays identical — presentation adapts,
  taxonomy does not.

---

## 3. Wedding identity system

Both platforms implement the same tokens. Android `WeddingIdentityPalette` / iOS
`WeddingIdentityPalette` are the single source; `WewedColors` is legacy and must not be extended.

| Token | Value | Use |
|---|---|---|
| Ivory | `#FBF7EF` | screen background |
| Ivory Soft | `#FFFDF8` | cards, bars, chips |
| Champagne | `#D5B47A` | ornament, borders, brand mark |
| Champagne Deep | `#A77322` | selected state, primary action, accents |
| Forest | `#0E5A3F` | progress, positive status |
| Forest Soft | `#EAF3EE` | status pills |
| Ink | `#13212B` | primary text |
| Muted | `#667381` | secondary text, unselected state |
| Hairline | `#E9E1D5` | 1pt/1dp borders and dividers |

**Typography.** Serif for wedding identity (couple names, screen titles, card titles); system
sans for body, labels and metadata. Sizes in use: screen title 19–28, card title 14–17,
body 12–13, metadata 10–11.

**Geometry.** Cards 12–18 radius, 1dp hairline border, generous internal padding (13–16).
Chips are fully rounded. Icon containers are rounded squares with a champagne tint at ~15% alpha.

---

## 4. Navigation behaviour

- Level-1 is rendered **only** from `IANavigationContract`. No screen may add its own primary bar.
- Level-2 is owned by IA V2 and rendered as horizontally scrollable chips. A workspace screen may
  *report* which section it wants (`onOpenSection`) but may not own a second picker.
- Selected chip: Champagne Deep fill, Ivory Soft text. Unselected: Ivory Soft fill, Muted text,
  hairline border.
- Level-2 selection persists per role + wedding + workspace (`WorkspaceSectionMemory`).

---

## 5. State presentation

Blank is not automatically a defect — the Private Real Shadow graph legitimately has zero rows for
many domains. These five states must be visually distinguishable without reading logs:

| State | Meaning | Presentation |
|---|---|---|
| `LOADING` | request in flight | centred progress indicator in Champagne Deep |
| `EMPTY` | contract exists, returned zero rows | card stating the domain is empty |
| `UNSUPPORTED` | no native/backend contract in this environment | `IAUnsupportedSection` — names the section, says why, states the environment |
| `ERROR` | should work, loading failed | error text plus a retry affordance |
| `ACCESS_DENIED` | entitlement refused | `AccessBoundaryNotice` — explains the boundary, leaks no destination data, offers a safe return |

`UNSUPPORTED` must never be dressed as `EMPTY`, and neither may show fabricated rows.

---

## 6. Accessibility

- Practical touch targets ≈48dp/pt. Bottom-bar items use `minHeight: 48`.
- Text must tolerate scaling/Dynamic Type; labels use `maxLines` with scaling rather than clipping.
- Status is never colour alone — `IACard` carries a `status` text line beside any colour.
- Interactive controls carry stable identifiers (`testTag` / `accessibilityIdentifier`).
- **iOS caveat:** an accessibility identifier applied to a container propagates to its descendants
  and overrides nested identifiers. Put identifiers on leaves, or on a dedicated marker element.
  This is why `shadow-source-*` is attached to a 1pt marker rather than the authenticated tree.
- Horizontal chip rows must remain reachable by screen readers.

---

## 7. Platform divergence that is allowed

Same product, native mechanics:

- icon glyphs (SF Symbols vs Material), navigation/back mechanics, sheet behaviour, share sheets,
  map intents, safe-area and system-bar handling, and the platform's own tab-bar chrome.

Not allowed: different taxonomy, different labels, different ordering, different data source,
different authorization model, or a second colour/type system.

---

## 8. Known remaining divergence

| Item | Android | iOS | Action |
|---|---|---|---|
| Bottom-bar label | "Wedding Day" truncates to "Wedding" | renders in full | Android label needs scaling/2-line support |
| Legacy palette | `WewedColors` still used by older planner/vendor/admin destinations | same | migrate as those screens are brought under IA V2 |
| Legacy screens | `HomeScreen`, `GuestsScreen`, `PassScreen` retained | equivalents retained | remove once no IA V2 route reaches them |

---

## 9. The invitation is outside this contract

**Task stamp:** `WW-NATIVE-INVITATION-EXACT-PARITY-RULE-2026-09-20-08`

Everything above governs the **app's** visual language: Wewed's palette, type scale, spacing and
component vocabulary, applied consistently across Android and iOS.

The digital invitation is governed by a different authority and is deliberately exempt.

| | The app | The invitation |
|---|---|---|
| Visual authority | This contract | The couple's saved `wedding.invitationCardStyle` |
| Palette | `WeddingIdentityPalette` | The style's own palette, from the web registry |
| Imagery | Wewed's own components and ornament | Approved artwork, imported by SHA-256 |
| Platform adaptation | Expected and allowed | **None.** Android and iOS must render the same object |

### Why the exemption exists

The invitation is not a Wewed screen wearing Wewed's brand. It is **the couple's stationery**, and
the couple chose it. Styling it with Wewed's palette, drawing its flowers with
`WeddingOrnamentBackdrop`, or substituting SF Symbols and Material icons for approved artwork would
replace the couple's design with ours — which is the defect this rule was written to correct.

### Consequences for this contract

1. `WeddingOrnamentBackdrop`, `WewedColors` and `WeddingIdentityPalette` must not appear inside an
   invitation renderer. `IvoryPalette` is derived from the approved artwork, not from Wewed's brand.
2. The platform adaptations §7 permits — icon glyphs, sheet behaviour, native chrome — **do not
   apply inside the card**. Both platforms use the same artwork, the same percentage geometry and
   the same 1800ms `cubic-bezier(0.3, 0.1, 0.2, 1)` reveal.
3. The surrounding journey (RSVP sheet, note sheet, pass, splash) is ordinary app UI and **is**
   governed by this contract.

See [NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md](./NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md) for the
artwork provenance, geometry table and door keyframes both platforms assert against.
