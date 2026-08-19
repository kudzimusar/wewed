# Wewed Notebook Responsive Density Refinement

**Stamp:** `WW-NOTEBOOK-DENSITY-2026-08-19-01`  
**Status:** STAMPED — UAT FOLLOW-UP REFINEMENT  
**Baseline:** `90d788a8144603da9a0bd83b5dcd56817f9ebdce`  
**Scope:** Planner Notebook phone/small-screen visual density only. No Notebook data, AI, permission, autosave, checkpoint, sharing, recording, linking or recovery semantics change.  
**Contributions Canon impact:** none.  
**Vault/Contracts Canon impact:** none.

## UAT result carried forward

The post-PR #159 Notebook UX retest passed all four functional checks:

- Read mode renders Markdown correctly.
- Write mode allows normal editing.
- AI panel immediately exposes guidance and suggested actions.
- Meaningful checkpoint history is clearer than technical `vN` revisions.
- No error was reported.

## Follow-up findings

Phone screenshots show that the now-correct Notebook still uses more vertical and horizontal space than necessary:

1. Notebook headings/body copy and primary CTAs are visually larger/looser than nearby Wewed workspace UI.
2. Card and editor padding consumes too much usable width on small screens.
3. The note action group may wrap because the full `Save checkpoint` label competes with icon actions; the Trash action can fall onto a second row.
4. `Files · tags · recovery` is visually heavy for a fixed phone utility.

## Required refinement

At phone widths below 640px:

- reduce Notebook shell/card/editor padding and gaps without reducing tap accessibility;
- reduce header/supporting-copy/CTA typography to the existing compact Planner density;
- reduce rendered note body line-height and heading scale while retaining clear hierarchy;
- keep the note action group on one line;
- render `Save checkpoint` as a compact icon control on narrow screens while preserving its accessible text/title and full desktop label;
- ensure Trash remains on the same action row as the other note controls;
- compact the fixed files/tags/recovery utility without removing access;
- preserve no-horizontal-overflow behavior at 320, 375 and 390 CSS pixels.

## Release gate

Before merge:

1. Browser test at 320px and 390px proves the checkpoint and Trash controls remain on the same row and the document has no horizontal overflow.
2. Browser test proves the mobile checkpoint control remains accessible by name.
3. Existing Notebook writing/AI/checkpoint browser contract remains green.
4. Full applicable Wewed workflow matrix remains green on the exact head.
5. Exact-head Vercel preview is READY.

Manual UAT after release should verify the Notebook feels materially denser while all controls remain readable and tappable.
