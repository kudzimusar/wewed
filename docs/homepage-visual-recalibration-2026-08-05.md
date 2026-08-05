# Wewed homepage visual recalibration

Date: 2026-08-05
Branch: `feat/africa-ready-product-experience`
PR: #68

## Decision

Restore the public homepage art direction and composition from the first approved visual iteration while retaining the current live-data, authentication, marketplace and provider functionality.

This is a visual recalibration, not a new redesign and not permission to modify unrelated product workflows.

## Visual source of truth

The first iteration represented by the approved review screenshots and commit `1d7e1031c446ade0f248482e95a1b2a2beed3c8f` is the presentation baseline.

Restore its:

- cinematic full-bleed hero composition and editorial overlay;
- typography scale, spacing, responsive hierarchy and control placement;
- three-audience strip for couples, planners and guests;
- planner discovery carousel treatment;
- dark wedding-inspiration gallery;
- six-card vendor and venue category layout;
- privacy section, social proof, closing CTA and footer rhythm;
- photographic wedding-editorial media treatment.

## Media rule

- Keep the latest Wewed-created Higgsfield film of one Black bride and one Black groom dancing at an elegant outdoor wedding reception as the hero video.
- Do not restore the previous Pexels hero footage.
- Remove flat SVG/cartoon illustrations from public homepage media slots.
- Use Wewed-generated photorealistic wedding imagery created with internal generation tools. Images must match the specific scenario shown by each card.
- The hero poster must be photorealistic and visually compatible with the film.
- No third-party stock image URLs may be introduced in this recalibration.

## Functional behaviour retained

The visual rollback must preserve all approved functional work:

1. `/api/auth/me` remains the source of truth for homepage account and active-wedding state.
2. Signed-out visitors see a clearly labelled example journey without fake names or private wedding data.
3. Signed-in users see their authorized account identity and active wedding.
4. Public account actions continue to provide working workspace navigation and sign-out.
5. Planner cards continue to use real published marketplace records.
6. Vendor cards continue to open filtered `/vendors?category=...` discovery routes.
7. Provider registration and company-profile management remain available.
8. Marketplace profile dropdowns and all existing API/storage contracts remain unchanged.
9. Privacy, wedding isolation, planner authority and invitation controls remain unchanged.

## Copy rule

Retain wedding-first language. Do not restore repetitive campaign slogans such as:

- `Zimbabwe first · designed for Africa`
- `Built for African couples`
- `Real African love`
- `Zimbabwe launch market`
- `Built in Zimbabwe. Designed for Africa.`

Real user-entered locations remain visible when they are genuine operational data.

## Explicitly out of scope

- No redesign of planner, couple, vendor or admin workspaces.
- No changes to Tasks, Budget, Guests, Timeline, Seating, Invitations, Daily Operations, billing, RSVP or Canon.
- No schema or migration changes.
- No production data mutation.
- No reorganization of public navigation, routes or business logic except what is necessary to reconnect the restored visual presentation to the existing functionality.

## Acceptance criteria

1. Homepage composition visually matches the first approved iteration at desktop and mobile widths.
2. Hero uses the latest Higgsfield bride-and-groom film.
3. All homepage card media is photorealistic and scenario-appropriate; no SVG illustrations or third-party stock URLs remain.
4. Signed-out journey is explicitly a preview and contains no named sample couple.
5. Signed-in journey uses authorized live data.
6. Account actions and sign-out remain functional.
7. Planner carousel remains data-backed and honest about loading, empty and error states.
8. Vendor categories remain clickable and open the correct filtered provider directory.
9. Removed Zimbabwe/Africa campaign slogans do not reappear.
10. Existing source, database, privacy, marketplace and browser release gates remain green.
11. Exact-head Vercel preview is reviewed before merge.
12. No unrelated file or workflow is changed.
