# Complete Classic Presentation Retrofit

## Purpose

This document is the governing contract for the second-stage recovery of Wewed's canonical wedding social template.

The first recovery restored the largest structural regressions but did not restore the complete client-approved presentation from golden master commit `71963e5ba89d5dc95c8e2d7ccac58c6fb8b40100`. The remaining defects fall into two categories:

1. presentation code or visible interaction states that still differ from the golden master; and
2. presentation code that is already correct but renders generic or empty states because wedding-scoped presentation data was never applied to the active database.

The retrofit must repair both categories together as one release unit.

## Golden masters

- Presentation golden master: `71963e5ba89d5dc95c8e2d7ccac58c6fb8b40100`
- Current architecture/security baseline: current `main` at branch creation (`70502eda89edeef6a93e76b768d8a4ce7c1bd4f0`)

The implementation rule is:

> Preserve the classic presentation and interaction density wherever it is safe, while sourcing wedding identity, editorial content, media, programme data, social channels, messages and uploads from the active wedding and its authorized data paths.

## Non-negotiable invariants

- Do not wholesale revert the canonical-template/privacy work.
- Do not reintroduce hardcoded Charity/Kudzie/Imba/Musarurwa identity into reusable components.
- Keep couple/planner/admin/guest authorization server-enforced.
- Keep private invitation/RSVP Guest rows separate from public wedding-party editorial profiles.
- Keep all messages and media wedding-scoped.
- Do not expose owner/planner/private-workspace controls to ordinary guests or public visitors.
- Do not solve authorization by unnecessarily flattening or removing the approved presentation. Locked/read-only states should preserve visual richness where practical.
- Established weddings must not silently degrade to generic starter placeholders merely because required presentation records are absent.

## Gap register and required repairs

### Hero

Current renderer still has the original image, Ken Burns, sheen, dark overlay and radial glow, but only renders the image if `hero.imageUrl` exists.

Required:
- restore Charity's `hero.imageUrl=/hero-wedding.png` as wedding-scoped data;
- keep the image data-driven for all other weddings;
- restore the missing classic countdown eyebrow (`Counting the moments until forever`) in the hero composition;
- preserve current partner/date/venue/tagline database binding and inline-edit keys.

### Our Story portrait

Required:
- restore Charity's `story.familyImageUrl=/couple-silhouette.png` as wedding-scoped data;
- retain the current data-driven renderer and neutral fallback for genuinely new weddings.

### Gift Registry

Required:
- restore Charity's flagship registry heading, subtitle, cultural note and three classic registry cards from the canonical migration;
- keep current component data-driven and wedding-scoped;
- preserve existing couple edits through conflict-safe migration semantics.

### Wedding Party

Required:
- restore the eight public flagship wedding-party profiles and cultural guide as WeddingContent;
- never source these profiles from private Guest/RSVP operational records;
- preserve the restored role accents/profile presentation.

### Telegram

Required:
- restore Charity's wedding-scoped Telegram URL and handle so the classic Telegram card appears again;
- keep the component hidden for weddings that have no configured Telegram channel rather than inventing another couple's identity.

### Gallery and after-wedding gallery

Required:
- ensure Charity has the editorial preview image roles needed to reproduce the original six-item visual density before real uploads exist;
- preserve wedding-scoped real media as the authoritative source once uploaded;
- do not fall into an unnecessarily empty visual state for an established wedding with configured presentation media;
- retain masonry, filters, hover captions, badges, lightbox and keyboard navigation.

### Media Upload

The first recovery changed the pre-wedding presentation from the complete classic uploader plus an opening-date notice to a simplified locked card.

Required:
- restore the complete classic uploader presentation before the wedding;
- enforce the wedding-date/access rule on the actual upload action, not by replacing the whole visual composition;
- unauthorized/public visitors may see a polished locked/read-only uploader state but cannot select/upload files;
- authorized wedding contributors receive the operational uploader when the sharing gate permits it;
- keep uploads scoped to the active wedding.

### Live Wall

Required:
- retain the full classic wall/composer visual composition;
- keep public/unauthorized posting denied server-side;
- show a polished locked/read-only composer state when the viewer cannot post instead of removing the composition entirely;
- invited/authorized contributors retain operational message and applause actions through the wedding-scoped API.

### Memory Capsule

Required:
- retain the restored classic staged recording choreography;
- do not claim binary recording persistence when it does not exist;
- connect the capture to the existing wedding-scoped media pipeline if the current browser/data model can safely support a real `MediaRecorder` video blob upload without weakening authorization;
- if browser recording is unavailable, preserve an honest fallback path and never fabricate persistence.

### The Day / programme separation

The current public renderer correctly uses normalized ProgrammeItem rows, but production contains planner/UAT operational content such as `UAT-TIMELINE-001 Vendor access and setup`.

Required:
- define an explicit public-programme eligibility rule so planner operational/test items cannot appear on the guest-facing wedding page;
- keep legitimate public programme rows wedding-scoped;
- remove or quarantine the known UAT contamination through an additive, auditable migration rather than manual production editing.

### Platform Vision and Keepsakes

Required:
- preserve the classic visual composition;
- restore flagship editorial richness through wedding-scoped content where it was part of the approved Charity presentation and is wedding-specific;
- keep reusable platform copy neutral where the old text represented obsolete platform marketing rather than couple identity;
- keepsake monograms/names/date must always derive from the active wedding.

## Presentation-data completeness

The retrofit must include an additive migration that restores any missing flagship records from the earlier canonical migration and the recovery migration, using `ON CONFLICT DO NOTHING` or equivalent so current couple/planner edits win.

At minimum, Charity & Kudzie must have wedding-scoped records for:

- `hero.imageUrl`
- `story.familyImageUrl`
- `registry.heading`
- `registry.subtitle`
- `registry.culturalNote`
- `registry.card-0..2`
- `guests.party-0..7`
- `guests.guideHeading`
- `guests.guideSubtitle`
- `guests.guide-*`
- `social.telegramUrl`
- `social.telegramHandle`
- gallery/editorial preview image roles
- memory-capsule presentation fields
- vendor showcase rows
- after-wedding presentation fields

## Acceptance criteria

The release is not complete merely because unit tests and build pass.

For Charity & Kudzie, desktop and mobile must visibly show the full classic presentation including hero photography, story portrait, populated wedding party, populated registry, Telegram treatment, rich gallery, upload presentation, live wall, memory capsule, vendors and after-wedding sections with no generic `Partner One`, `Partner Two`, `Add your venue`, example-hotel or cross-wedding leakage.

A secondary wedding must use the same renderer but only its own data. Charity-specific media/content may not leak into it unless explicitly configured as shared platform assets.

Public/guest/couple/planner role behavior must remain isolated and authorized.

Automated qualification must include canonical-template regression contracts and browser coverage. Visual screenshot assertions should be added for the most failure-prone presentation surfaces (at minimum hero and pre-wedding rich interaction states) so future data-plumbing changes cannot silently flatten them again.

## Release sequencing

1. Implement all code and migration repairs on one branch.
2. Run schema validation, clean-database migrations, unit/integration tests, production build and browser desktop/mobile release gates.
3. Create a migration-complete preview/UAT environment.
4. Manually compare Charity desktop/mobile against the golden-master experience and verify a second isolated wedding.
5. Merge only after the integrated acceptance unit is approved.
6. Deploy database migrations through the controlled database workflow; do not patch production ad hoc.
