# Native Shadow Acceptance Test Identifiers

These identifiers are a cross-platform acceptance contract for the Shadow Real-Wedding sprint.

They are intentionally semantic and stable. Maestro and platform UI tests should use these identifiers instead of coordinate taps or ambiguous visible text.

## Planner

| Capability | Identifier |
|---|---|
| Planner root | `planner-root` |
| Planner identity | `planner-identity-card` |
| Planner source/environment evidence | `planner-source-card` |
| Tasks module | `planner-module-tasks` |
| Budget module | `planner-module-budget` |
| Contributions module | `planner-module-contributions` |
| Vendors module | `planner-module-vendors` |
| Guests module | `planner-module-guests` |
| Seating module | `planner-module-seating` |
| Timeline module | `planner-module-timeline` |
| Budget destination | `planner-budget-root` |
| Contributions destination | `planner-contributions-root` |
| Vendors destination | `planner-vendors-root` |
| Seating destination | `planner-seating-root` |
| Timeline destination | `planner-timeline-root` |

## Guest invitation journey

| Stage/action | Identifier |
|---|---|
| Wewed splash | `guest-journey-splash` |
| Ivory invitation root | `ivory-invitation-root` |
| Open invitation | `ivory-invitation-open` |
| Accept RSVP | `ivory-rsvp-accept` |
| Decline RSVP | `ivory-rsvp-decline` |
| View issued Wedding Pass | `ivory-view-wedding-pass` |
| Declined state | `guest-journey-declined` |
| Leave confirmed journey | `guest-journey-done` |

## Gate scanner

Existing qualified gate identifiers remain authoritative and must not be renamed without requalifying the Wedding Journey.

## Rules

1. Do not use coordinates when one of these identifiers exists.
2. iOS uses `accessibilityIdentifier`.
3. Android uses Compose `testTag`.
4. A UI wording change must not force an identifier change.
5. Any identifier rename is a shared acceptance-contract change and requires both platforms plus Maestro to be updated in the same tested commit.
