# Wewed Booking UI/UX Hardening

Status: **UAT candidate — do not merge until visual approval and exact-head CI pass**

This document records the interaction problems identified during Shandy booking UAT and the acceptance rules for PR #185.

## Problems observed

1. Provider profiles behaved like long information documents rather than interactive marketplace pages.
2. Booking/catalogue discovery was weak and previously rendered after the public footer.
3. The permanent enquiry form dominated first impressions and created unnecessary psychological friction.
4. The service booking route displayed operational dates, pickup/return, delivery/setup and other logistics simultaneously.
5. Missing vendor media produced large empty blocks.
6. Gallery treatment consumed too much vertical space.
7. Planner and Vendor booking workspaces exposed too much secondary information before the next required action.
8. Contextual Back / Forward / Marketplace navigation was inadequate.
9. QR controls could appear while the QR payload contract was mismatched (`qr` vs `qrCode`).
10. Broad route CSS overrides made visual behavior difficult to reason about.

## Acceptance rules

### Provider marketplace profile

- Hero contains contextual navigation and clear Book / Ask calls to action.
- Booking catalogue is one of the first intentional sections after the hero, inside the profile flow and before the footer.
- Sticky section navigation exposes Book, Overview, Services, Policies and FAQ.
- Enquiry is progressive disclosure: drawer/bottom sheet, not a permanent full-height form.
- Optional wedding detail fields stay collapsed until requested.
- Service detail, packages, policies and FAQ use disclosures rather than permanent information walls.
- Mobile receives persistent Services / Ask actions.

### Media

- Vendor-uploaded/published photography is labelled `Vendor photo`.
- Wewed-owned category artwork may fill visual gaps but is labelled `Wewed editorial`/`Wewed visual` and must never be presented as vendor inventory.
- Visual rail is horizontally browsable and opens a lightbox rather than creating a vertically oversized gallery.
- Wewed editorial art remains ownable/licensing-safe and follows ivory/champagne/gold/espresso brand direction.

### Direct booking

- Booking uses three progressive decisions: Choose → Logistics (when applicable) → Review.
- Rental/delivery logistics are not shown before the user has selected the primary service/date.
- Non-logistics services skip the logistics step.
- Pricing, availability, booking, payment and funding semantics remain unchanged.
- Context navigation includes vendor profile, Vendor Marketplace, and a functional Share / QR control.

### Planner bookings

- First view prioritizes status, counterparty, service/date/value and next required action.
- Quote, contract and deposit gates remain immediately actionable.
- Budget, payments, contributions, funding, agreement and operational details are secondary disclosure content.
- Booking status never implies payment or couple funding.

### Vendor bookings

- Inbox prioritizes pending decision/fulfilment action.
- Commercial quote entry is collapsed until the vendor chooses to create a quote.
- Lifecycle action appears in a dedicated `Next action` strip.
- Secondary booking metadata is collapsed.
- `Open Messages` remains directly reachable.

### QR

- `/api/qrcode` returns canonical `qr` plus backward-compatible `qrCode` alias.
- Provider profile and exact service share controls consume the same QR contract.
- QR represents canonical `wewed.pro` URLs even when tested from a preview deployment.

### Regression rule

`src/lib/provider-booking-ux-contract.test.ts` must remain in Provider Forms CI so the interaction architecture above cannot silently regress to the original information-dump implementation.
