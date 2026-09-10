# Wewed Ivory Floral Gold — Visual Benchmark Lock

**Benchmark ID:** `WW-IVORY-FLORAL-PHYSICAL-DIGITAL-2026-09-11-01`  
**Status:** Binding visual/interaction acceptance reference  
**Applies to:** `ivory-floral-gold` digital invitation  
**Parent system:** `WW-DIGITAL-INVITE-EXPERIENCE-2026-09-10-01`

## Rule

The Ivory Floral Gold digital invitation is not a generic web-card theme and must not be reinterpreted as one.

> **Redesign the digital invitation system so each invitation feels like a premium physical wedding stationery piece that happens to be interactive on a screen.**

For this first benchmark, the approved reference is the sculpted ivory floral tri-fold supplied during review on 11 September 2026. The visual language is frozen: if implementation work removes or materially changes the qualities below, that work is a regression rather than a redesign.

## Locked visual characteristics

The guest must receive an invitation object with the same essential visual composition as the approved reference:

- tall, deliberate printed-card proportion rather than a dashboard/presentation rectangle;
- warm ivory handmade-paper appearance with visible but restrained grain;
- sculpted flowing ivory layers rather than flat rectangular panels;
- fine champagne/gold edge lines and metallic accents;
- detailed fine-line botanical/floral illustration integrated into the folds;
- elegant restrained serif/script hierarchy and controlled whitespace;
- centred monogram on the closed invitation;
- the closed cover message **A SPECIAL INVITATION AWAITS**;
- a small, quiet **Tap to open** affordance at the bottom of the physical object;
- no generic Wewed banner or oversized application chrome competing with the stationery;
- realistic depth, contact shadows, edge highlights and paper thickness cues.

The artwork must read first as premium wedding stationery and only second as software.

## Locked interaction

The opening must behave as handling a real card, not as a slideshow transition.

1. The guest first sees the closed invitation object.
2. The guest activates **Tap to open**.
3. The two sculpted floral cover halves physically separate/unfold around their inner hinges.
4. Perspective, changing shadows and edge highlights communicate paper depth while the panels move.
5. The centre invitation is revealed behind the folds.
6. The invitation settles into an open physical-card state; it must not merely fade between two flat layouts.
7. The guest may then continue to wedding details / RSVP.

`prefers-reduced-motion` must bypass the 3D delay without changing the final visual design.

## Content/data rule

The visual benchmark is fixed, but invitation facts remain data-driven. The renderer must use actual wedding/guest data and must not retain the sample names, venue, date, time, branding or social handles shown in inspiration imagery.

For the Charity Manyewu / Shadreck Kudzanai Musarurwa reference wedding, the authoritative facts remain those already documented in the parent invitation plan. Missing facts must not be invented.

Personal guest identity may be introduced quietly inside the revealed invitation after the secure guest session is established. It must not distort the locked cover composition.

## Prohibited regressions

Do not replace this benchmark with:

- a flat rounded web card;
- a PowerPoint/presentation-style tile;
- generic centered text on a gradient;
- a recolour of another theme;
- a fade/slide-only reveal;
- decorative particles standing in for physical opening motion;
- extra copy on the floral wings that is not present in the approved composition;
- oversized buttons layered over the stationery;
- invented wedding facts.

## Acceptance checks

The release gate for this benchmark must verify:

- closed cover exists and presents the monogram + **A special invitation awaits**;
- card exposes `data-card-object="physical-stationery"`;
- paper-grain treatment exists;
- left, centre and right physical panels exist;
- open action changes the motion state from `closed` to `opening` to `open` under normal motion;
- reduced motion reaches `open` without the 3D delay;
- revealed centre contains **Together with our families** and real wedding data;
- old side-copy treatments such as **Our journey** / **A brighter tomorrow** are not rendered on this visual benchmark;
- personal guest-session and RSVP privacy rules remain unchanged;
- no horizontal overflow occurs on the mobile release viewport.
