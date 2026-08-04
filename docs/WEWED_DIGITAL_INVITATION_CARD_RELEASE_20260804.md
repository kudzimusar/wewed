# Wewed Digital Invitation Card Release — 4 August 2026

## Certified implementation

- Core invitation-card release: `b37608c55717b0b24c7f13b46303bab8ab03c2b6`
- Invitation response hardening: `dda9411b02ae0aea4b4f500703a915eeb7cf0617`
- Protected API cache guard: `a09b37316696491eba1d4b1899c7eb2e795c5a6c`

## Delivered behavior

- Botanical, Editorial and Midnight digital wedding-card templates.
- Wedding-level invitation message and RSVP deadline.
- Guest-specific card, QR, share message, CSV row and reminder-email URL using one revocable RSVP credential.
- Signed HttpOnly guest-session exchange with the raw credential removed from the address bar.
- Card-first guest experience followed by the scoped RSVP form.
- Couple and authorized-planner design, preview, export, share and rotation controls.
- Link-only wedding gateway with neutral no-index metadata and no wedding-identity disclosure.
- Non-flagship wedding data isolation.
- Raw RSVP tokens excluded as standalone JSON properties.
- Protected dashboard APIs marked `private, no-store, max-age=0` and `Vary: Cookie` at both route and shared proxy layers.
- Live email delivery fails closed unless an email provider is configured.

## Release gates

The exact executable heads completed:

- Prisma validation and clean PostgreSQL migrations.
- Zero managed-schema drift.
- Production builds.
- Stage 2–10 and Phase 2–6 planner contracts.
- Retained planner Chromium workflow.
- Desktop/mobile marketplace, privacy and invitation Chromium.
- Card selection, persistence, export, reminder preview, QR exchange, RSVP and rotation.
- Presentation-ready card sample generation.

This documentation-only commit exists to retrigger the production deployment after Vercel rejected the original main-branch build at its account-level build-rate limit. It does not alter executable application behavior.
