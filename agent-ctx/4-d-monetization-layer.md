# Task 4-d — Monetization Layer (Pricing + Platform Vision + Merch Teaser)

**Agent:** Z.ai (frontend component builder — monetization)
**Task ID:** 4-d
**Date:** wewed build, Phase 4 monetization layer

## Summary
Created 3 elegant, production-quality 'use client' components that introduce wewed's monetization layer on the flagship Charity & Kudzie wedding site — without breaking the brand's editorial elegance. All sections are designed as gentle upsells, not aggressive sales.

## Files Created
1. `src/components/wedding/pricing-section.tsx` — Subscription pricing (Free / Canon / Forever)
2. `src/components/wedding/platform-vision.tsx` — Mission, 3 pillars, stats, CTA
3. `src/components/wedding/merch-teaser.tsx` — 4-product keepsake preview

## Component Details

### 1. PricingSection (`#pricing`)
- **Heading**: "Your Forever, Preserved" (wewed-heading) + tagline
- **3 tier cards** in responsive grid (1 col mobile, 3 col desktop)
  - **Free** ($0/forever): champagne bg, gold border, outline "Start Free" button
  - **Canon** ($9/mo): FEATURED — espresso bg, gold border, "Most Popular" ribbon, scale-105 + shadow elevation, prominent gold "Choose Canon" button with shadow-gold glow
  - **Forever** ($29/mo): plum bg, gold border, plum-bg/gold-text "Choose Forever" button
- Each card: icon (Gift/Crown/Sparkles), tier name (serif), price (large serif), italic tagline, hairline divider, ✓/✗ feature list (excluded features line-through + faded), full-width rounded CTA button
- **Notes block**: BEFORE | AFTER mention, cancel anytime, ZIMBABWE2026 discount code in mono pill styling
- **"Compare Features" accordion** (shadcn Accordion): full feature matrix with 6 categories × ~3-5 features each, 4-column table (Feature/Free/Canon/Forever) with ✓/✗ icons, horizontally scrollable on mobile
- **Enterprise CTA**: "Planning something bigger?" card with Crown icon → "Talk to us" outline button → `#contact`
- framer-motion staggered reveals via useInView + index delays
- Canon card visually elevated via `lg:-translate-y-4` and `lg:scale-[1.03]`
- Reuses `GoldOrnament` from decorative-elements

### 2. PlatformVision (`#vision`)
- Espresso dark background with atmospheric radial gradients (plum/sage/gold glows) + dotted texture overlay
- **Heading**: "More Than a Wedding Website" + "wewed is building the forever layer for love — in Zimbabwe, and across the world."
- **3 pillars** in responsive grid (Celebrate / Plan / Preserve) with heart/clipboard/shield icons
  - Each card: oversized faded "01/02/03" number watermark, top hairline accent, icon ring, serif title, body copy
  - Accent colors: Celebrate=clay, Plan=sage, Preserve=plum (matches brand "memory" palette)
- **Mission block**: large rounded card with plum gradient, gold "Our Mission" label, large serif statement with highlighted phrases ("infrastructure for memory" in gold-light, "Charity & Kudzie" in clay-light italic), decorative corner radial glows
- **Stats row**: 5 stats in champagne/5 backdrop-blur card — "1 flagship wedding", "8 bridal party profiles", "26 songs", "47 messages in the capsule", "∞ forever preserved" with serif numbers in plum
- **CTA**: "Hundreds of couples will follow. Yours could be next." + "Join the wewed family" gold button with Globe2 icon → `#contact`
- framer-motion reveals with mission block + stats + CTA staggered after pillars

### 3. MerchTeaser (`#merch`)
- Ivory background with subtle gold/clay dotted texture
- **Heading**: "wewed Keepsakes" + "Take a piece of forever with you"
- **4 product cards** in responsive grid (1 col mobile / 2 col tablet / 4 col desktop)
  1. Mr & Mrs Musarurwa Candle — $24 — clay→gold gradient, Flame icon, available
  2. Monogram Mug — $18 — sage→gold gradient, Coffee icon, available
  3. Forever Print — $45 — plum→gold gradient, ImageIcon, "Coming Soon" badge
  4. Memory Album — $65 — gold→champagne gradient, BookOpen icon, "Coming Soon" badge
- Each card: 4/5 aspect image placeholder (gradient + dotted texture + circular icon medallion with backdrop blur + monogram watermark in corner), hover shimmer + scale-110 on icon, "Coming Soon" badge if not available
- Card body: serif product name (with price in gold serif aligned right), description, full-width rounded "Add to Cart" (or "Notify Me" if unavailable, disabled)
- **Note pill**: "All keepsakes are made-to-order and ship globally from Harare." with Sparkles icon
- **CTA**: "Browse Full Store" espresso button with hover-to-plum + ArrowRight → `#`
- framer-motion staggered reveals

## Design Decisions
- **Brand consistency**: All 3 sections reuse the established color tokens (espresso/champagne/gold/clay/plum/sage), Cormorant Garamond serif (font-serif via wewed-heading) + Inter sans, and the existing `GoldOrnament` decorative component for section headers
- **Pricing — not salesy**: Italic taglines, "Your Forever, Preserved" heading (not "Pricing Plans"), elegant tier names (Free/Canon/Forever), generous whitespace, gentle ZIMBABWE2026 discount. The Canon featured card is visually distinct but not garish.
- **Vision — mission-driven**: Espresso dark background creates the "memory" mood (per the AFTER/plum side of brand). Mission statement uses editorial serif type with highlighted phrases rather than corporate bullet points.
- **Merch — elegant commerce**: 4/5 aspect cards with gradient placeholders (no real photos yet), tasteful "Coming Soon" badges on pre-order items, made-to-order note in pill format.
- **Accessibility**: ARIA-hidden decorative elements, disabled buttons for unavailable products, semantic section IDs, sufficient color contrast on all tiers
- **Responsive**: All grids collapse cleanly to 1 column on mobile; pricing Canon card scales only at lg breakpoint (avoids cramped layout on tablet)
- **Animations**: All reveals use framer-motion `useInView` with `once: true` and consistent `[0.22, 1, 0.36, 1]` easing, staggered delays per index

## Compliance Checklist
- ✅ All 3 files use 'use client'
- ✅ All imports from '@/components/ui/...' (Card, Button, Badge, Accordion)
- ✅ Reuses GoldOrnament from existing decorative-elements (no duplication)
- ✅ Tailwind custom color tokens (text-gold, bg-champagne, text-espresso, bg-plum, text-clay, text-sage, bg-espresso)
- ✅ font-serif for headings (via wewed-heading class), font-sans body (default)
- ✅ framer-motion staggered reveals throughout
- ✅ Mobile-first responsive (1/2/3/4 col grids per spec)
- ✅ Generous py-20 md:py-32 section padding
- ✅ Proper TypeScript types (TierId, Pillar, Product, etc.)
- ✅ Lucide icons only (Heart, ClipboardList, Shield, Check, X, Sparkles, Crown, Gift, Flame, Coffee, Image, BookOpen, ShoppingBag, ArrowRight, ChevronDown, Globe2)
- ✅ No page.tsx modification
- ✅ No API routes created
- ✅ No new page routes
- ✅ Lint passes clean (zero errors)

## Handover Notes for Lead Agent
- All 3 components export both named + default (PricingSection, PlatformVision, MerchTeaser)
- All have proper `id` attributes (`pricing`, `vision`, `merch`) for nav anchor scrolling
- The vision section uses dark espresso bg — recommended to pair with adjacent ivory sections (pricing above, merch below) for contrast rhythm
- Compare Features accordion is collapsed by default; users opt-in to see the full matrix
- "Notify Me" buttons on Coming Soon merch are disabled — wire to a real notify endpoint when backend exists
- All CTA links point to `#contact` placeholder (except merch "Browse Full Store" → `#`) — lead agent can wire to real routes later

## Status: ✅ COMPLETE
Lint passes. All 3 files production-ready. Awaiting lead agent wiring into page.tsx.
