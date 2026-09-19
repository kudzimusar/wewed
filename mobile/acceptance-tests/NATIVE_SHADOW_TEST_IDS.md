# Native Shadow Acceptance Test Identifiers

These identifiers are the cross-platform acceptance contract for the native Shadow / Private Real Shadow wedding experience.

They are intentionally semantic and stable. Maestro and platform UI tests should use these identifiers instead of coordinate taps or private guest names.

## Couple shell

### Environment provenance

| Capability | Identifier |
|---|---|
| Explicit Private Real Shadow source | `shadow-source-private-real-shadow` |
| Explicit Sanitized Shadow source | `shadow-source-sanitized-shadow` |

These identifiers expose only the selected data environment. They must never contain guest names, tokens, file paths, or other private snapshot values.

### Home

| Capability | Identifier |
|---|---|
| Home root | `home-root` |
| Open invitation | `home-open-invitation` |
| Continue planning | `home-continue-planning` |
| Wedding metrics | `home-metrics` |
| Tasks quick action | `home-metric-tasks` |
| Budget quick action | `home-metric-budget` |
| Guests quick action | `home-metric-guests` |
| Vendors quick action | `home-metric-vendors` |

### Planner

| Capability | Identifier |
|---|---|
| Planner root | `planner-root` |
| Planner identity | `planner-identity-card` |
| Tasks module | `planner-module-tasks` |
| Budget module | `planner-module-budget` |
| Contributions module | `planner-module-contributions` |
| Vendors module | `planner-module-vendors` |
| Seating module | `planner-module-seating` |
| Timeline module | `planner-module-timeline` |
| Documents module | `planner-module-documents` |
| Budget destination | `planner-budget-root` |
| Contributions destination | `planner-contributions-root` |
| Vendors destination | `planner-vendors-root` |
| Seating destination | `planner-seating-root` |
| Timeline destination | `planner-timeline-root` |

### Guests

| Capability | Identifier |
|---|---|
| Guests root | `guests-root` |
| Guest search | `guests-search` |
| All filter | `guests-filter-all` |
| Attending filter | `guests-filter-attending` |
| Pending filter | `guests-filter-pending` |
| Declined filter | `guests-filter-declined` |
| Add guest | `guests-add` |
| Save local Shadow guest | `guests-add-save` |

### Wedding Pass

| Capability | Identifier |
|---|---|
| Pass root | `pass-root` |
| Pass card | `wedding-pass-card` |
| Functional QR | `wedding-pass-qr` |
| Open gate scanner | `pass-open-scanner` |

### More

| Capability | Identifier |
|---|---|
| More root | `more-root` |
| Wedding profile | `more-wedding-profile` |
| Our Story | `more-story` |
| Gallery | `more-gallery` |
| Honeymoon / Contributions | `more-honeymoon` |
| Settings | `more-settings` |
| Settings shortcut | `more-settings-shortcut` |
| Help & Support | `more-support` |

## Guest invitation journey

| Stage/action | Identifier |
|---|---|
| Wewed splash | `guest-journey-splash` |
| Ivory invitation root | `ivory-invitation-root` |
| Accept RSVP | `ivory-rsvp-accept` |
| Toggle invitation details | `ivory-details-toggle` |
| Decline RSVP | `ivory-rsvp-decline` |
| View issued Wedding Pass | `ivory-view-wedding-pass` |
| Declined state | `guest-journey-declined` |
| Leave confirmed journey | `guest-journey-done` |

## Gate scanner

Existing qualified gate identifiers remain authoritative:

| Capability | Identifier |
|---|---|
| iOS Done | `gate-scanner-done` |
| Scanner exit | `gate-scanner-exit` |

Android may continue to expose the visible `Close` fallback where the iOS-only toolbar identifier is not applicable.

## Rules

1. Do not use coordinates when one of these identifiers exists.
2. iOS uses `accessibilityIdentifier`.
3. Android uses Compose `testTag`.
4. A UI wording change must not force an identifier change.
5. Tests must not depend on Private Real Shadow guest names or other PII.
6. `PRIVATE_REAL_SHADOW` and `SANITIZED_SHADOW` must exercise the same structural identifiers even when displayed identities differ.
7. Any identifier rename is a shared acceptance-contract change and requires both platforms plus Maestro to be updated in the same tested state.
