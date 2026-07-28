# Task 4-a — Bridal Party Profile Modals

> Agent: Z.ai (bridal party introductions)
> Task ID: 4-a
> Scope: Enrich the wedding-party grid so guests can tap any face to read a rich profile (bio, likes, memory, dance-floor anthem, toast) — with prev/next browsing and keyboard nav. Kids (flower girl + ring bearer) get a special "Fun Fact" panel.

## Files Delivered

### NEW — `src/lib/bridal-party-data.ts`
- Exports `BridalPartyMember` interface + `BRIDAL_PARTY` array (8 members) + `BridalSide = 'bride' | 'groom' | 'family'` type
- Each member: `id`, `name`, `role`, `side`, `initials`, `avatarColor` (tailwind gradient classes), `bio` (2–3 sentences), `relationshipToCouple`, `likes[]`, `favoriteMemory`, `favoriteSong`, `quote`, `socialHandle?`, `isKid?`, `kidFunFact?`
- Bios are authentic Zimbabwean context: Gweru/UZ/Bulawayo roots, sadza & braais, Oliver Mtukudzi + Mokoomba + Brenda Fassie + Johnny Clegg + Wizkid + Shakira + Moana, Parirenyatwa, Harare Sports Club, Nyanga, Kariba, Victoria Falls, Hwange, roora/lobola traditions, madora, isitshwala
- 8 members in order: Tendai M. (MOH, bride), Takudzwa M. (Best Man, groom), Rumbidzai C. (Bridesmaid, bride), Chiedza K. (Bridesmaid, bride), Munashe M. (Groomsman, groom), Kudakwashe N. (Groomsman, groom), Narasora M. (Flower Girl, family/kid), Norioshona M. (Ring Bearer, family/kid)
- Helper exports: `getBridalMemberById(id)`, `getNextBridalIndex(i)`, `getPrevBridalIndex(i)` (both wrap around)

### NEW — `src/components/wedding/bridal-profile-modal.tsx`
- 'use client' Dialog-based modal. Props: `{ member, isOpen, onClose, onPrev, onNext }`
- Layout: `grid-cols-1 md:grid-cols-[200px_1fr]` — avatar panel left/top, content right/bottom
- Avatar panel: large 28–32 (size-28 md:size-32) circle with `bg-gradient-to-br` using member's `avatarColor`, serif initials (wewed-heading text-4xl/5xl) in espresso, decorative radial gold wash behind, gold ring-1 ring-gold/30. Kids get a Star icon overlay badge bottom-right (fill-gold) on a champagne circle ring-2 ring-gold/40
- Below avatar: side badge (`Charity's Side` clay / `Kudzie's Side` sage / `Our Family` gold) + role badge (gradient gold-muted→gold→gold-light pill, espresso text)
- Content panel sections (in order):
  1. Name (wewed-heading text-3xl/4xl espresso) + role eyebrow (uppercase tracking gold-muted)
  2. Bio paragraph (font-sans text-sm leading-relaxed espresso/80)
  3. Relationship card: clay/20 border + clay/5 bg, Heart icon (fill-clay/30 text-clay), "Relationship:" label in clay
  4. Loves: gold-muted eyebrow + flex-wrap chips with `border-gold/40 bg-gold/5` rounded-full, hover darkens to gold/70/gold/10
  5. Separator (bg-gold/20)
  6. Favorite Memory: `border-l-2 border-gold/60 pl-4`, italic serif text-base/relaxed, gold-muted eyebrow
  7. Dance Floor Anthem: plum/20 border + plum/5 bg, plum/15 circle with Music icon, plum/80 eyebrow, italic serif song
  8. A Word for the Couple: gradient bg from-plum/8 via-champagne to-gold/5, Quote icon absolute top-right (plum/20), plum/80 eyebrow, italic serif text-lg/xl plum
  9. Social handle (if present) OR Fun Fact (if kid): kids get a gold gradient box border-gold/40 from-gold/10 to-clay/5 with Sparkles icon in gold/20 circle + gold-muted eyebrow + fun fact text
- Custom close button (top-right z-30): size-9 rounded-full border-gold/30 bg-champagne/80 backdrop-blur, X icon, hover bg-gold/15 text-clay, focus-visible ring-2 ring-gold/60
- Prev/Next: on desktop, side buttons (left-2 / right-2 top-1/2 -translate-y-1/2, hidden md:flex) using ChevronLeft/Right; on mobile, footer bar (md:hidden) with Prev/Next ghost buttons + a "Tap arrows to browse" hint with Users icon
- Body scrollable: `max-h-[92vh] overflow-y-auto wewed-scroll` on inner div
- framer-motion: AnimatePresence mode="wait" keyed on member.id; initial opacity-0 scale-0.96 y-8 → animate opacity-1 scale-1 y-0 → exit opacity-0 scale-0.98 y--8; duration 0.32 ease [0.22, 1, 0.36, 1]. This re-animates on prev/next navigation.
- Keyboard: useEffect window keydown listener for ArrowLeft → onPrev, ArrowRight → onNext (preventDefault). Escape handled by Radix Dialog automatically. Listener cleaned up on unmount and when isOpen changes.
- Accessibility: DialogTitle + DialogDescription (sr-only) set from member when present; aria-labels on close/prev/next buttons; focus-visible rings throughout
- Exports both `BridalProfileModal` (named) and `default BridalProfileModal`

### NEW — `src/components/wedding/introductions-banner.tsx`
- 'use client' slim CTA banner for the lead agent to place above `<Guests />`
- motion.section with fade-up (opacity 0→1, y 12→0, duration 0.7, ease [0.22, 1, 0.36, 1], once: true)
- Visual: `border-y border-gold/25 bg-gradient-to-r from-champagne via-ivory to-champagne` + radial gold wash overlay at 60% opacity
- Content (centered, max-w-5xl, py-5 md:py-6): Sparkles + wewed-heading "Meet the people who make our day possible" + Sparkles, vertical divider on md+, then "Tap any face to learn their story" with an animated bouncing ChevronDown (y 0→3→0, 1.6s infinite, clay color)
- Stacks on mobile (flex-col), inline on desktop (md:flex-row)
- Exports both `IntroductionsBanner` (named) and `default IntroductionsBanner`

### MODIFIED — `src/components/wedding/guests.tsx`
- Replaced the local `partyMembers` array + `PartyMember` interface with `BRIDAL_PARTY` import from `@/lib/bridal-party-data`
- Added imports: `useEffect`/`useCallback` via `* as React`, `type Variants` from framer-motion, `ChevronRight` from lucide, `Tooltip`/`TooltipTrigger`/`TooltipContent` from shadcn, `BridalProfileModal` component, `BRIDAL_PARTY` + `getNextBridalIndex` + `getPrevBridalIndex` + `BridalPartyMember` type from data module
- Added `sideBadgeLabel(side)` helper that maps the new `'bride' | 'groom' | 'family'` values to "Charity's Side" / "Kudzie's Side" / "Our Family"
- Converted `Guests` to a stateful component with:
  - `selectedIndex: number | null` and `modalOpen: boolean` via useState
  - `handleOpen(i)`, `handleClose()`, `handlePrev()` (useCallback, wraps with getPrevBridalIndex), `handleNext()` (useCallback, wraps with getNextBridalIndex)
  - `selectedMember` derived: `BRIDAL_PARTY[selectedIndex] ?? null`
- Each bridal party Card now:
  - `role="button" tabIndex={0}` + `aria-label="View {name}'s profile"`
  - `onClick={() => handleOpen(i)}` + onKeyDown Enter/Space handler (preventDefault + open)
  - `cursor-pointer` + `hover:ring-2 hover:ring-gold/40` (kids get `hover:border-gold` too)
  - `focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-champagne` for keyboard a11y
  - Wrapped in shadcn `<Tooltip>` showing "Click to learn more about {name}" on hover (espresso bg, champagne text, gold/30 border)
  - Added a "Learn more" hint inside the card: `mt-1 inline-flex items-center gap-1 font-sans text-[0.65rem] uppercase tracking-[0.15em] text-gold-muted opacity-0 group-hover:opacity-100 transition-opacity` with ChevronRight icon — reveals on hover
- Updated the avatar fallback and side badge conditionals to handle the new `'bride' | 'groom' | 'family'` side values (previously only `'Bride' | 'Groom'`). Kids (side === 'family' OR isKid) still get the gold "Our Little Stars" badge.
- Added a second header subtitle line under the main "The cherished people standing beside us" subtitle: "Tap any face to learn their story" in gold-muted uppercase tracking
- Preserved ALL existing functionality:
  - Cultural Guide accordion (4 entries: traditions, dress, cuisine, phrases) — untouched
  - Footer monogram "C&K · 23.12.26" with wewed-divider — untouched
  - Section id="guests" — preserved
  - cardVariants animation — preserved (and now properly typed as `Variants` to fix a pre-existing TS error)
  - motion stagger reveal — preserved
- Added `<BridalProfileModal />` at the very end of the section (inside the `<section>`, after the footer monogram div), wired to selectedMember/modalOpen/handlers

## Verification
- ✅ `bun run lint` — 0 errors, 0 warnings on my 4 files (the only project-wide warning is a pre-existing `vault-lock-screen.tsx` unused eslint-disable from another agent)
- ✅ `npx tsc --noEmit -p tsconfig.json` — 0 errors on my 4 files (also fixed a pre-existing TS error in the original guests.tsx `cardVariants` by annotating it `: Variants`)
- ✅ Dev server compiles cleanly (`✓ Compiled in 289ms`); the only dev.log warning is the pre-existing `VenueSection` key warning from another agent's work

## Integration Notes for Lead Agent
- **Drop-in enhancement**: No page.tsx changes required for the bridal party feature itself — clicking any card in the existing `<Guests />` section now opens the modal. The cards are already clickable.
- **Optional banner**: To add the CTA banner above the Guests section, render `<IntroductionsBanner />` immediately before `<Guests />` in page.tsx. It's a self-contained slim strip with no props.
- **No new dependencies** — uses existing framer-motion, lucide-react, shadcn/ui (Dialog, Tooltip, Badge, Button, Avatar, Separator, Accordion, Card).
- **Data is the single source of truth**: any future edits to bridal party bios/likes/memories should happen in `/src/lib/bridal-party-data.ts` — both the grid and the modal consume the same `BRIDAL_PARTY` array.
- **Kid handling**: Narasora and Norioshona have `side: 'family'` (not 'bride'/'groom') and `isKid: true`. The card grid renders them with the gold "Our Little Stars" badge + gold avatar ring (unchanged from original design). The modal swaps the social-handle row for a "Fun Fact" panel with a Sparkles icon.
- **Keyboard navigation**: ArrowLeft/ArrowRight cycle through party members while the modal is open; Escape closes (Radix default). The prev/next buttons cycle with wraparound.

## What Was NOT Done (per task rules)
- Did NOT modify page.tsx — lead agent wires the optional `<IntroductionsBanner />`
- Did NOT create API routes
- Did NOT create new page routes
- Did NOT touch other agents' files (admin-*, media-upload, photo-gallery, venue-section, vault-lock-screen, songbook, parallax-hero, decorative-elements)
- Did NOT modify prisma schema or store.ts
- Did NOT change the section id="guests" or break any existing anchor link
