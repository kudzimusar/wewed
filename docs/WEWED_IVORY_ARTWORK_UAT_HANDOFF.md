# Ivory Floral Gold artwork UAT candidate

Branch: `feature/ivory-floral-artwork-fidelity-20260911`. Do not merge before visual approval.

## Implementation

Recovered all four approved compositions, stored binary reference assets with
hashes, normalized to 1080 × 2340, extracted image doors and paper surfaces,
and retained the closed → opening → open → details flow. Variable text remains
live. UAT has reference/live comparison and a deterministic 1080ms midpoint.

Configured map URLs now pass through the existing guest-session data response.
Registry actions require configured content. Existing RSVP persistence remains
in the secure guest flow. Install/offline notices no longer obscure invitations.
A server/browser punctuation mismatch in the website's default date label was
fixed after the secure browser test exposed a hydration error.

The mobile finishing pass keeps 9:19.5 as the canonical artwork coordinate
system but no longer shrinks the whole invitation to fit browser height. The
stage is width-driven on phones, allowing the long interactive stationery to
scroll vertically while preserving aspect ratio and percentage-based CTA
coordinates. The approved artwork assets and 1800ms opening keyframes are
unchanged. `A Note from Us` is now presented as a centred stationery dialog and
the details surface uses a deliberate `Back to invitation` control.

## Validation

- 34 unit/contract tests passed across five files on the Work candidate.
- 10 production-build Playwright tests passed on the Work candidate (premium digital invitation plus artwork suite).
- Existing mobile sizes: 320×568, 390×844, 412×915, 430×932.
- Responsive finishing gate additionally covers 375×667 and 393×852 and asserts width fill, canonical aspect ratio, no horizontal overflow, details width, and note containment.
- Secure tests verify token-free URL, guest identity, RSVP save/readback and physical/shared isolation.
- `bun run build` passed using the repository CI environment with an isolated local PostgreSQL database and all migrations.
- `node scripts/check-ivory-types.mjs` passed; full repository TypeScript still reports 208 diagnostics outside this scope.
- Full cross-product browser release suite is a separate CI gate and must pass on the current responsive-finishing head before merge approval.

## Visual approval still required

This is an artwork-derived UAT candidate, not a claim of pixel-identical live
typography or midpoint geometry. Names use a licensed live script font, and
textless surfaces use neighbouring source-paper pixels. The OPENING reference
was recovered from the approved PDF's embedded raster rather than its native
PNG. Inspect all four live states against the reference controls on a real
phone. No main-branch merge is authorized.

## Exact files changed

- `.github/workflows/ci.yml`
- `.gitignore`
- `docs/WEWED_IVORY_ARTWORK_UAT_HANDOFF.md`
- `docs/WEWED_IVORY_FLORAL_GOLD_VISUAL_BENCHMARK.md`
- `next.config.ts`
- `playwright.ivory.config.ts`
- `public/fonts/GreatVibes-OFL.txt`
- `public/fonts/GreatVibes-Regular.ttf`
- `public/invitation-art/ivory/.gitkeep`
- `public/invitation-art/ivory/closed-master.webp`
- `public/invitation-art/ivory/closed-surface.webp`
- `public/invitation-art/ivory/details-master.webp`
- `public/invitation-art/ivory/details-surface.webp`
- `public/invitation-art/ivory/left-door.webp`
- `public/invitation-art/ivory/manifest.json`
- `public/invitation-art/ivory/open-master.webp`
- `public/invitation-art/ivory/open-surface.webp`
- `public/invitation-art/ivory/opening-master.webp`
- `public/invitation-art/ivory/paper.webp`
- `public/invitation-art/ivory/reference/closed.png`
- `public/invitation-art/ivory/reference/details.png`
- `public/invitation-art/ivory/reference/open.png`
- `public/invitation-art/ivory/reference/opening.png`
- `public/invitation-art/ivory/right-door.webp`
- `scripts/check-ivory-types.mjs`
- `scripts/normalize-ivory-artwork.mjs`
- `src/app/api/weddings/[slug]/guest-session/route.ts`
- `src/app/preview/invitation/ivory-floral-gold/page.tsx`
- `src/app/preview/invitation/ivory-floral-gold/preview.tsx`
- `src/app/uat/invitation/ivory-floral-gold/preview.tsx`
- `src/components/wedding/digital-invitation-card.tsx`
- `src/components/wedding/gift-registry-campaign-bridge.tsx`
- `src/components/wedding/gift-registry.tsx`
- `src/components/wedding/install-prompt.tsx`
- `src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx`
- `src/components/wedding/invitation-experience/ivory-floral-gold.css`
- `src/components/wedding/invitation-experience/premium-invitation-experience.tsx`
- `src/components/wedding/pwa-register.tsx`
- `src/lib/digital-invitation-experience.test.ts`
- `src/lib/wedding-date-hydration.test.ts`
- `src/lib/wedding-public-access.ts`
- `src/lib/wedding-template-defaults.ts`
- `tests/e2e/ivory-artwork.spec.ts`
- `tests/e2e/ivory-invitation-responsive.spec.ts`
- `tests/e2e/premium-digital-invitation.spec.ts`
