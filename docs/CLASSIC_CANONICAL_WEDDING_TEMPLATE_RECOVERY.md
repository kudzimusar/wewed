# Classic Canonical Wedding Template Recovery Contract

## Release goal

Restore the complete client-approved wedding social-site presentation from commit `71963e5ba89d5dc95c8e2d7ccac58c6fb8b40100` as the single canonical Wewed wedding template, while retaining the current database, authorization, persistence, privacy, multi-role and multi-wedding isolation architecture from `main`.

This is a presentation-preserving database retrofit. It is not a redesign.

## Golden masters

- **Presentation golden master:** `71963e5ba89d5dc95c8e2d7ccac58c6fb8b40100`
- **Data/security golden master:** branch base `ad07e6b391c11acad1a94a0b86915c081cd9f524` and all later commits on this recovery branch.

Where these differ, presentation structure and styling come from the presentation golden master while identity, content, permissions and persistence come from wedding-scoped server data.

## Non-negotiable invariants

1. Every wedding slug renders the same premium component architecture. There is no reduced non-flagship renderer.
2. Restore the classic markup hierarchy, spacing, typography, decorative treatments, cards, gradients, masonry, overlays, animations, transitions, lightboxes, staged interactions and responsive behaviour unless a security or accessibility constraint requires a narrowly documented change.
3. Never restore Charity & Kudzie identity as a reusable hardcoded default. Couple names, monogram, date, venue, story, programme, media, party, travel, registry, songs, social channels and wedding-specific copy must come from the active wedding or neutral starter data.
4. Charity & Kudzie must visually reproduce the classic experience because their wedding-scoped data contains the flagship content.
5. A second wedding must receive the same classic presentation with its own data and must never receive Charity/Kudzie/Imba/Musarurwa/23.12.26 data unless that is genuinely saved on that wedding.
6. Server-resolved wedding data must seed the first render. Established weddings must not first render `Partner One`, `Partner Two`, `Add your venue` or other neutral placeholders and then correct themselves after hydration.
7. Existing server authorization remains authoritative. Guest/public users must not gain couple/planner/admin/edit/private-workspace controls as a side effect of visual restoration.
8. Existing wedding-scoped write restrictions remain intact for messages, media, songs and invitation/member actions.
9. Normalized operational data (`ProgrammeItem`, `Song`, media, messages, memberships, invitations and related records) remains authoritative where already established.
10. Existing real database edits must never be overwritten by seed/migration content.

## Restoration scope

The release covers the whole public wedding experience in one qualification unit, including:

- navigation and hero;
- countdown and wedding-day programme;
- story and venue;
- wedding party / village;
- gallery, upload and live wall;
- songbook and requests;
- travel and stay;
- registry / gratitude;
- memory capsule;
- vendor and wedding-support presentation;
- merchandise/keepsakes, platform/legacy and after-wedding sections;
- social/channel widgets that are configured for the active wedding;
- footer/share presentation;
- owner-only wedding controls without exposing them to ordinary guests.

## Data architecture

The public page must be server-seeded with a complete wedding snapshot. The client provider may refetch after hydration for freshness, but the first rendered tree must already have the active wedding's identity and persisted content.

Reusable components may use `useWeddingContextSafe()` and wedding-scoped APIs, but their visual composition must track the presentation golden master. Neutral fallbacks exist only for genuinely incomplete weddings.

## Migration/deployment rule

Presentation data formerly embedded only in source code must be represented as wedding-scoped data when it is wedding-specific. Additive seed migrations must use conflict-safe semantics and may not overwrite user edits.

The production migration workflow must reject failed/divergent migration history while still allowing legitimate pending repository migrations to be deployed by `prisma migrate deploy`.

## Release gates

This recovery is one release, not a series of independently accepted partial redesigns.

Automated qualification must cover:

- build/type/lint/contract suites;
- wedding data isolation;
- guest/private-workspace boundary;
- server-first identity rendering;
- canonical renderer parity across at least two weddings;
- source-level prohibition of flagship identity literals in reusable template defaults;
- browser checks for classic high-value interactions (gallery lightbox, memory capsule staged flow, responsive navigation, programme, registry and contribution surfaces).

Manual UAT must then cover Charity & Kudzie and a secondary wedding on desktop and mobile before merge.

## Merge rule

Do not merge this recovery merely because CI is green. Keep the PR as draft until the complete classic template is restored as one unit and the full manual UAT matrix is accepted.