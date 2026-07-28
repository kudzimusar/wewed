# Task 3-c & 3-e — Songbook Live Voting + Styling Polish

**Agent**: Z.ai (songbook live-voting + styling polish)
**Task IDs**: 3-c (Songbook live voting) + 3-e (Styling polish) — combined
**Date**: Completed in this session

## What I Delivered

### Part 1 — Songbook Live Voting (3-c)

**`src/components/wedding/songbook.tsx` (MODIFIED — additive)**
- Added `useWewedLive` import + `Radio` icon
- Added `mockStreamingUrls(song)` helper + new `StreamingLinks` sub-component (hover-revealed Spotify + Apple Music SVG icon buttons, sage/plum hovers)
- Modified `SongCard`:
  - Pulls `isConnected`, `songVotes`, `voteSong` from `useWewedLive`
  - `handleVote` calls BOTH `toggleVote(songId)` (zustand) AND `voteSong(...)` over the socket — but only on the up-vote transition and only when `isConnected`
  - `totalVotes` = local (1 if voted) + live socket votes
  - Subtle "live" indicator on songs with socket votes: gold border, faint gold bg, gradient gold→clay left rail, pulsing clay dot on disc icon, "live" + Radio icon label on md+
  - Vote count badge shows combined total
  - Existing styling preserved; `aria-pressed` added for a11y
- `SongList`, `GuestRequestTab`, main `Songbook` section UNCHANGED — section id="songbook" preserved
- Removed unused `ExternalLink` import (was dead code)

**`src/components/wedding/songbook-enhanced.tsx` (NEW)**
- Wraps existing `<Songbook />` + embeds `<SongbookLive />` as `#songbook-live`
- Live voting status banner: "Live voting is OPEN" (pulse dot, connected) OR "Voting opens on the day" (Radio icon, offline)
- Aggregated vote counter: `liveTotalVotes + localVoteCount` with animated count-up pulse
- "View Live Rankings" button smooth-scrolls to `#songbook-live`
- Lead agent can swap `<Songbook />` → `<SongbookEnhanced />` in page.tsx

### Part 2 — Styling Polish (3-e)

**`src/components/wedding/parallax-hero.tsx` (NEW)** — Optional upgrade of `HeroSection`
- Mouse-move parallax: rAF-throttled, `useSpring`-smoothed, ±6px background / ±3px foreground
- Scroll parallax: `useScroll` on container, `bgY` 0→120px, `bgScale` 1→1.12, `overlayOpacity` 1→0.7 over 800px
- 18 gold dust particles drifting upward (random size/delay/duration/sway/opacity)
- Gradient overlay shifts gold↔clay on 18s loop
- All original hero content preserved (names, monogram, venue, tagline, countdown, scroll hint)
- Performance: `will-change-*` everywhere, passive listeners, cleanup on unmount

**`src/components/wedding/decorative-elements.tsx` (NEW)** — 5 reusable ornaments
- `GoldOrnament` — SVG divider with curl flourishes + central diamond
- `MonogramSeal` — circular wax-seal "C&K 23.12.26"
- `FloralCorner` — SVG floral corner with `flip` prop ('none'|'x'|'y'|'xy')
- `GoldSparkle` — animated 4-point star burst (hover-activated)
- `SectionTransition` — SVG gradient strip between sections (named or hex colors)
- All use framer-motion + gold/champagne palette, all responsive

**`src/app/globals.css` (MODIFIED — purely additive)**
- `scroll-padding-top: 5rem` on `html`
- New classes:
  - `.wewed-card-hover` — lift + gold glow (with `.dark` variant)
  - `.wewed-text-shimmer` — gold shimmer text animation (background-clip)
  - `.wewed-bg-pattern` — damask dot pattern (with `.dark` variant)
  - `.wewed-gold-gradient` — 4-stop gold linear gradient
  - `.wewed-scroll-indicator` — animated scroll chevron
  - `.wewed-image-zoom` — image zoom on hover (works with next/image)
  - `.wewed-float` — gentle floating animation
  - `.wewed-gold-dust` — particle drift (consumed by parallax-hero)
- Global custom scrollbar (Firefox + WebKit/Chromium) — gold-muted thumb, transparent track, floating-thumb look

## Verification
- ✅ `bun run lint` on my 4 files: zero errors, zero warnings
- ✅ `npx tsc --noEmit -p tsconfig.json` on my 4 files: zero errors
- ✅ Dev server compiles clean
- ⚠️ Pre-existing lint errors in OTHER agents' files (admin-trigger.tsx, admin-dashboard.tsx, media-upload.tsx, photo-gallery.tsx, venue-section.tsx) — out of scope per task rules

## Integration Notes for Lead Agent

### Drop-in replacements in page.tsx
1. **Enhanced songbook**: swap `<Songbook />` → `<SongbookEnhanced />`. If currently also rendering `<SongbookLive />` standalone, REMOVE the standalone one — `SongbookEnhanced` already embeds it as `#songbook-live` and a duplicate id will collide.
2. **Parallax hero** (optional): swap `<HeroSection />` → `<ParallaxHero />`. Same `id="home"` so navbar anchor still works.

### Decorative elements available for immediate use
```tsx
import { GoldOrnament, MonogramSeal, FloralCorner, GoldSparkle, SectionTransition } from '@/components/wedding/decorative-elements'

<GoldOrnament className="w-64 mx-auto" />                       // section divider
<MonogramSeal size={120} />                                      // footer / hero
<FloralCorner size={64} className="absolute top-4 left-4" />    // RSVP card corners
<GoldSparkle active={hovered} size={20} />                       // hover accent
<SectionTransition from="champagne" to="espresso" height={48} /> // BEFORE→AFTER mode seam
```

### CSS classes ready to use
- `.wewed-card-hover` — add to any `<Card>` for elegant lift + glow
- `.wewed-text-shimmer` — add to a heading for gold shimmer
- `.wewed-bg-pattern` — add to a `<section>` for damask background
- `.wewed-gold-gradient` — base bg utility
- `.wewed-scroll-indicator` — add to a chevron SVG
- `.wewed-image-zoom` — wrap an image container
- `.wewed-float` — add to badges/monograms
- Global scrollbar now gold-themed across the whole app

## What I Did NOT Do (per task rules)
- Did NOT modify `page.tsx` — lead wires everything
- Did NOT create API routes
- Did NOT modify the socket.io mini-service
- Did NOT touch other agents' files
- Did NOT change existing song data (26 songs, 4 tabs preserved)
- Did NOT remove or modify any existing globals.css rules — all additions are appended after `.wewed-vote-pop`

## Dependencies
- None added — all effects use existing framer-motion v12, lucide-react, and CSS
