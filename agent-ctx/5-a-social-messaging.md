# Task 5-a — Social & Messaging Integrations (Marketing Layer)

**Agent:** Z.ai (frontend + API builder — social/marketing)
**Task ID:** 5-a
**Date:** wewed build, Phase 5 social integrations

## Summary
Created 6 production-quality files that give wewed a complete social-media + messaging marketing surface: a sharing helpers library, a share buttons bar, a full "Spread the Love" share section with QR code + native share, a floating WhatsApp RSVP helper, a Telegram bot webhook API, and a Telegram channel join widget. Every interactive piece is `'use client'`, every API is a Next.js 16 route handler, and all of it stays within the wewed design system (champagne/espresso/gold/clay/plum/sage + Cormorant serif + Inter sans).

## Files Created (6 total)

1. **`src/lib/social.ts`** — sharing helpers + platform config (`'use client'`)
2. **`src/components/wedding/share-bar.tsx`** — horizontal share buttons bar (`'use client'`)
3. **`src/components/wedding/share-section.tsx`** — full "Spread the Love" section (`'use client'`)
4. **`src/components/wedding/whatsapp-rsvp.tsx`** — floating WhatsApp RSVP FAB (`'use client'`)
5. **`src/app/api/telegram/route.ts`** — Telegram bot webhook endpoint (GET + POST)
6. **`src/components/wedding/telegram-widget.tsx`** — Telegram channel join widget (`'use client'`)

---

## 1. `src/lib/social.ts` — sharing helpers

### Constants
- `WEDED_SHARE_URL` = `"https://wewed.app/charity-and-kudzie"` (canonical share URL)
- `WEDED_SHARE_TEXT` = `"You're invited to Charity & Kudzie's wedding! 🎉 December 23, 2026 at Imba Manor, Harare. Join us: "`
- `WEDED_SHARE_BODY` = full pre-filled body for WhatsApp/Telegram (text + URL)
- `COUPLE_WHATSAPP_NUMBER` = `"263771234567"` (digits only, wa.me friendly)
- `COUPLE_WHATSAPP_DISPLAY` = `"+263 77 123 4567"` (human-readable)
- `TELEGRAM_CHANNEL` = `"https://t.me/wewedcharitykudzie"`
- `TELEGRAM_CHANNEL_HANDLE` = `"@wewedcharitykudzie"`
- `SOCIAL_HANDLES` = instagram/facebook/twitter/tiktok follow URLs (@wewed.app)

### URL Builders (all pure, isomorphic)
- `buildWhatsAppUrl(message, phone?)` → `https://wa.me/{phone}?text={msg}` (no phone → share sheet)
- `buildTelegramUrl(message)` → `https://t.me/share/url?url=...&text=...`
- `buildFacebookUrl(url, quote?)` → `facebook.com/sharer/sharer.php?u=...`
- `buildTwitterUrl(text, url)` → `twitter.com/intent/tweet?text=...&url=...`
- `buildLinkedInUrl(url, title)` → `linkedin.com/sharing/share-offsite/?url=...&title=...`
- `buildPinterestUrl(url, description)` → `pinterest.com/pin/create/button/?url=...&description=...`
- `buildEmailUrl(subject, body)` → `mailto:?subject=...&body=...`
- `buildSmsUrl(phone, message)` → `sms:{digits}?&body=...`

### Clipboard
- `copyToClipboard(text): Promise<boolean>` — uses `navigator.clipboard.writeText`, falls back to a hidden `<textarea>` + `execCommand('copy')` for insecure contexts / older browsers.

### Native Web Share hook
- `useNativeShare()` → `{ canShare, share }`
  - `canShare` = `typeof navigator.share === 'function'` (mobile + Chrome desktop)
  - `share({ title, text, url })` → tries `navigator.share`, falls back to clipboard. Returns `'shared' | 'copied' | 'failed' | 'cancelled'` so callers toast appropriately.

### `SOCIAL_PLATFORMS` config object
Records for all 11 platforms (whatsapp, telegram, facebook, twitter, instagram, tiktok, linkedin, pinterest, email, sms, copy). Each has:
- `key`, `name`, `color` (brand hex), optional `gradient` (Instagram)
- `iconViewBox` + `iconPaths[]` (raw SVG path data — keeps the .ts file JSX-free)
- `iconFillRule` (`evenodd` for stencil logos)
- `followUrl`, `handle` (for follow row)
- `share(opts)` builder function
- `isShareable` boolean (false for instagram/tiktok which have no web share intent)

All brand icons are authentic Simple-Icons-grade SVG path data (WhatsApp, Telegram, Facebook, X, Instagram, TikTok, LinkedIn, Pinterest). Email/SMS/Copy use Lucide in the component (see below).

### Ordered lists
- `SHARE_BAR_ORDER` = [whatsapp, telegram, facebook, twitter, instagram, tiktok, email, copy]
- `FOLLOW_ROW_ORDER` = [instagram, facebook, twitter, tiktok]

---

## 2. `src/components/wedding/share-bar.tsx` — ShareBar

A horizontal, wrapping bar of circular share buttons.

- **Platforms** (in order): WhatsApp (green #25D366), Telegram (blue #0088cc), Facebook (#1877F2), X/Twitter (#000), Instagram (gradient #E4405F→#833AB4), TikTok (#000 with cyan #25F4EE + pink #FE2C55 offset shadows), Email (gold gradient), Copy Link (espresso).
- **Icons**: brand SVGs rendered from `SOCIAL_PLATFORMS.iconPaths`. Email uses Lucide `Mail`, Copy uses Lucide `Copy` (per spec — Lucide for UI elements).
- **TikTok**: rendered as 3 layered paths (cyan offset + pink offset + main glyph) for the authentic duotone look.
- **Hover behavior**: each button is white/ivory at rest; on hover a brand-color (or gradient) wash fades in and the icon flips to white. framer-motion `whileHover={{ scale: 1.1, y: -2 }}` + `whileTap={{ scale: 0.92 }}` spring.
- **Tooltips**: shadcn `Tooltip` on every button showing the platform name (or "Copy link"). Espresso bg, champagne text.
- **WhatsApp/Telegram**: pre-fill the full `WEDED_SHARE_BODY` message.
- **Copy Link**: calls `copyToClipboard(url)`, toasts "Link copied!" via `useToast`, and shows a brief "Copied ✓" pill inline.
- **WhatsApp phone behavior**: if a `phone` prop is passed (used by the RSVP flow), opens a direct chat; otherwise opens the share sheet so the guest picks a recipient.
- **Container**: gold-border, champagne-bg, rounded-2xl, `flex-wrap` so it wraps on mobile.
- **Variants**: `compact` (icon only, h-11 w-11) and `expanded` (slightly larger on sm+).
- **Responsive**: `flex-wrap gap-2.5 sm:gap-3`, 8 buttons wrap to 2 rows on narrow phones.

---

## 3. `src/components/wedding/share-section.tsx` — ShareSection (`#share-wedding`)

The full marketing block. Ivory bg with a soft gold radial wash.

### Heading
- "Spread the word" eyebrow (wewed-monogram, gold, tracking)
- "Spread the Love" h2 (wewed-heading, espresso, responsive 4xl→6xl)
- `GoldOrnament` divider
- Subtext: "Know someone who should celebrate with us? Share our story — every invite plants a seed for a memory we'll all share."

### Main share card (2-col on lg)
**LEFT column — Preview + QR:**
- "Preview" label (Sparkles icon, gold-muted)
- Mock chat bubble (champagne bg, gold ring) showing the live editable message + "What your guests will receive" caption
- QR code: 28×28 (112px) rounded tile, fetched from `/api/qrcode?data={WEDED_SHARE_URL}&size=360`. Loading state = pulsing gold QrCode icon. On success shows the espresso-on-champagne QR PNG.
- "Download QR" outline button → converts the data URL to a Blob, triggers `wewed-charity-and-kudzie-qr.png` download, toasts "QR downloaded".

**RIGHT column — Composer + actions:**
- "Your message" label + `<Textarea>` (4 rows, 600 char max, live char counter)
- "Reset to default" link to restore `WEDED_SHARE_BODY`
- "Share via" label + `<ShareBar>` (compact, all 8 platforms)
- **"Share via WhatsApp"** — prominent green (#25D366) primary button with Send icon. Opens WhatsApp share sheet (no phone) so the guest forwards the invite.
- **"Share"** — outline button (gold border) that triggers `navigator.share` via `useNativeShare`. Only rendered when `canShare` is true (mobile / Chrome desktop). Falls back to clipboard copy with appropriate toast.

### Follow our journey
- Heart divider (gold gradient lines + clay heart)
- "Follow our journey" h3 (wewed-heading)
- Subtext mentioning @wewed.app
- 4 brand-colored circular icon buttons (Instagram gradient, Facebook blue, X black, TikTok duotone) → each opens `SOCIAL_HANDLES[key]` in a new tab. framer-motion staggered reveal + hover scale. ExternalLink badge appears on hover.
- Canonical URL printed below in small muted text.

---

## 4. `src/components/wedding/whatsapp-rsvp.tsx` — WhatsAppRSVP FAB

A persistent floating action button (bottom-right) for quick RSVP / questions via WhatsApp.

### Visibility logic
- **Mobile**: always visible (via `useIsMobile`).
- **Desktop**: visible only after `window.scrollY > 480` (past the hero). Initial scroll check deferred via `requestAnimationFrame` to avoid synchronous setState in effect.
- **Mounted detection**: `useSyncExternalStore` (server snapshot `false`, client `true`) — SSR-safe, no setState-in-effect lint issue, no hydration mismatch.
- **Dismissal**: tiny module-level external store (`_dismissed` + listener Set) read via `useSyncExternalStore`. On mount, restores from `sessionStorage[wewed_wa_rsvp_dismissed]`. Dismiss button writes to sessionStorage + store. Persists for the session, resets on tab close.
- **Install-prompt stacking**: reads `canInstall` from `usePWAInstall` + `installPromptDismissed` from the zustand store. When the install prompt is visible, the FAB shifts from `bottom-6` to `bottom-24 sm:bottom-28` so they don't overlap.

### FAB button
- 14×14 (56px) green circle (#25D366) with WhatsApp glyph
- **Pulse animation**: framer-motion `motion.span` scaling 1→1.8 with opacity 0.5→0, 2.2s ease-out infinite loop (only when popover closed)
- Tooltip: "Quick RSVP via WhatsApp" (left side, espresso bg)
- framer-motion entrance: spring scale 0→1, exit reverse

### Popover (shadcn Popover, opens upward)
- Header: WhatsApp medallion + "Quick RSVP" serif title + "+263 77 123 4567" subtitle + dismiss X
- **Name input** (optional, max 60 chars) — pre-fills the RSVP message with the guest's name
- **"RSVP via WhatsApp"** — green full-width button → opens `wa.me/263771234567` with: `"Hi! I'd like to RSVP for Charity & Kudzie's wedding on Dec 23. My name is {name}. I will [accept/decline]."`
- **"Ask a Question"** — outline button → opens `wa.me/263771234567` with: `"Hi Charity & Kudzie! I have a question about the wedding: "`
- Footer: "Opens WhatsApp with a pre-filled message" (MessageCircle icon)

### z-index
- `z-40` — below the install prompt (z-50) and below modals (z-50). When the install prompt shows, the FAB shifts up rather than fighting for z-index. Comment in code explains the choice.

---

## 5. `src/app/api/telegram/route.ts` — Telegram webhook

Next.js 16 route handlers. `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

### Setup instructions (in route comments)
Full BotFather + `setWebhook` curl recipe so the couple can wire a real bot.

### POST `/api/telegram`
- Parses incoming Telegram `Update` JSON
- Extracts `message.text`, lowercases the first token, strips `@botname` suffix
- Matches against 5 commands: `/start`, `/info`, `/rsvp`, `/song`, `/help`
- Builds Markdown-formatted replies (date/venue/time/dress-code, RSVP link, songbook link, command list)
- Falls back to a "didn't recognise that command" reply with the command list
- Calls Telegram Bot API `sendMessage` to reply (if `TELEGRAM_BOT_TOKEN` env var is set)
- Returns JSON `{ ok, handled, command, chat_id, replied, error?, timestamp }`
- Gracefully handles missing token: returns `replied: false, error: "bot_token_not_configured"` (so the endpoint is testable in dev)

### GET `/api/telegram`
- Returns webhook + bot status for the admin dashboard
- If no token: `{ status: "ok", webhook: { configured: false }, commands: [...], setup: "..." }`
- If token set: fetches `getMe` + `getWebhookInfo` from Telegram, returns both

### Verified
- `curl GET /api/telegram` → 200, `configured: false`, command list ✓
- `curl POST /api/telegram` with `/start` → `command: "/start", handled: true` ✓
- `curl POST` with `/info` → `command: "/info"` ✓
- `curl POST` with `/help@wewedcharitykudzie_bot` → correctly stripped to `/help` ✓
- `curl POST` with `hello there` → falls through to fallback (command: "hello") ✓

---

## 6. `src/components/wedding/telegram-widget.tsx` — TelegramWidget

A compact, elegant card inviting guests to join the wedding Telegram channel.

### Card design
- Champagne bg (70% opacity), gold border, backdrop blur, soft blue glow in the top-right corner
- Top hairline accent in Telegram blue gradient
- Telegram blue (#0088cc) medallion with brand glyph
- "Live updates" eyebrow (Bell icon, gold-muted)
- "Join our Telegram Channel" h3 (wewed-heading)
- Subtext: "Get instant updates about the wedding — programme changes, live moments, and day-of photos."
- Handle pill: `@wewedcharitykudzie` with a small Telegram glyph in blue
- **"Join Channel"** button: Telegram blue, full-width on mobile / auto on sm+, opens `t.me/wewedcharitykudzie` in new tab. ExternalLink icon.

### Bot Commands collapsible (shadcn Collapsible)
- "Bot Commands" label + animated chevron (rotates 180° on open)
- Smooth height + opacity animation via framer-motion `AnimatePresence`
- Lists all 5 commands with icons: `/start` (Sparkles), `/info` (CalendarCheck), `/rsvp` (Send), `/song` (Music), `/help` (HelpCircle)
- Each command in a blue-tinted monospace pill + description
- Helper text: "Message the bot directly on Telegram — it'll reply instantly with the relevant link or detail."

### Props
- `channelUrl?` — override the channel URL (defaults to `TELEGRAM_CHANNEL`)
- `className?` — layout integration
- `showCommands?` — toggle the commands collapsible (default true)

---

## Design System Compliance
- ✅ All 5 components are `'use client'`
- ✅ API route is Next.js 16 route handlers (no `force-static`)
- ✅ Tailwind custom color tokens (`bg-espresso`, `text-champagne`, `text-gold`, `border-gold/40`, etc.)
- ✅ `wewed-heading` serif for headings, Inter sans for body
- ✅ `GoldOrnament` reused from `decorative-elements` (no duplication)
- ✅ framer-motion for all animations (hover scale, pulse, staggered reveals, AnimatePresence)
- ✅ Mobile-first responsive (1-col mobile → 2-col lg, flex-wrap bars, full-width buttons on mobile)
- ✅ Inline SVG brand icons (WhatsApp, Telegram, Facebook, X, Instagram, TikTok) — Lucide for UI (Mail, Copy, Check, Share2, Send, Download, QrCode, Sparkles, Heart, ExternalLink, Bell, ChevronDown, CalendarCheck, Music, HelpCircle, MessageCircle, X)
- ✅ shadcn components: Popover, Tooltip, Button, Input, Textarea, Card, Collapsible
- ✅ Proper TypeScript types throughout (`SocialPlatformKey`, `ShareOpts`, `SocialPlatform`, `NativeShareResult`, etc.)
- ✅ Accessibility: aria-labels, aria-haspopup, aria-expanded, aria-live, semantic buttons, focus-visible rings, sr-only labels where appropriate
- ✅ No page.tsx modification, no navbar.tsx modification, no new page routes

## Code Quality
- ✅ `bun run lint` — zero errors, zero warnings
- ✅ `npx tsc --noEmit` — zero errors on new files
- ✅ Dev server compiles all 6 files cleanly
- ✅ GET/POST `/api/telegram` smoke-tested (5 curl tests, all 200)
- ✅ GET `/api/qrcode` smoke-tested (200, valid PNG data URL)
- ✅ No synchronous `setState` in effects (used `useSyncExternalStore` for mounted + dismissal, `requestAnimationFrame` for initial scroll check — clean lint pass on `react-hooks/set-state-in-effect`)

## Exports (for lead agent wiring)
- `src/lib/social.ts`: `WEDED_SHARE_URL`, `WEDED_SHARE_TEXT`, `WEDED_SHARE_BODY`, `COUPLE_WHATSAPP_NUMBER`, `COUPLE_WHATSAPP_DISPLAY`, `TELEGRAM_CHANNEL`, `TELEGRAM_CHANNEL_HANDLE`, `SOCIAL_HANDLES`, all `build*Url` functions, `copyToClipboard`, `useNativeShare`, `SOCIAL_PLATFORMS`, `SHARE_BAR_ORDER`, `FOLLOW_ROW_ORDER`, types
- `share-bar.tsx`: `ShareBar` (named + default), `ShareBarProps`
- `share-section.tsx`: `ShareSection` (named + default)
- `whatsapp-rsvp.tsx`: `WhatsAppRSVP` (named + default)
- `telegram-widget.tsx`: `TelegramWidget` (named + default), `TelegramWidgetProps`
- `/api/telegram`: GET + POST route handlers

## Integration Notes for Lead Agent
- **ShareSection**: drop into page.tsx in BEFORE mode (e.g. after FAQ, before footer). `id="share-wedding"`.
- **WhatsAppRSVP**: render once near the end of the page tree (after all sections, before footer or right after). It's `fixed` so placement in the tree doesn't matter visually, but render it once globally (not per-section). Pairs well alongside `<InstallPrompt />`.
- **TelegramWidget**: compact card — drop into a sidebar, the FAQ area, or below the share section. Takes optional `className` for width control.
- **ShareBar**: reusable — can be embedded anywhere (already used inside ShareSection). Could also go in the footer or a sticky mobile bar.
- **`/api/telegram`**: when the couple creates a real bot, set `TELEGRAM_BOT_TOKEN` env var and register the webhook. The GET endpoint is the admin-dashboard health check.
- **Couple's WhatsApp number**: currently `+263 77 123 4567` placeholder in `social.ts`. Phase 5: move to `Wedding.contactWhatsapp` in the DB.

## Status: ✅ COMPLETE — all 6 files delivered, lint clean, tsc clean, API smoke-tested
