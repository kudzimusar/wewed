# Task 3-a — Couple Admin Dashboard (auth + dashboard + trigger)

**Agent:** Z.ai (frontend/backend builder — admin dashboard)
**Task ID:** 3-a
**Files created:**
- `/home/z/my-project/src/lib/admin-auth.ts`
- `/home/z/my-project/src/components/wedding/admin-dashboard.tsx`
- `/home/z/my-project/src/components/wedding/admin-trigger.tsx`

## What was built

### 1. `src/lib/admin-auth.ts` — Lightweight client-side auth
- Hardcoded password with `NEXT_PUBLIC_WEWED_ADMIN_PASSWORD` env override (fallback `wewed-admin-2026`).
- `verifyAdmin(password)` — constant-time-ish string compare (XOR diff loop).
- `isAdminLoggedIn()` — checks localStorage session + 8-hour TTL, cleans up if expired.
- `setAdminLoggedIn()` — writes session (timestamp + 16-hex-char nonce) to localStorage + a `wewed_admin_auth` cookie (8h, SameSite=Lax).
- `logoutAdmin()` — clears both stores.
- `adminSessionRemainingMs()` — for surfacing "session expires soon" in the dashboard.
- Session TTL: 8 hours (covers a full wedding day).

### 2. `src/components/wedding/admin-dashboard.tsx` — Couple control center
Full-screen Dialog overlay (94vh, max-w-1400px) with espresso bg + gold accents.

**Auth gate** — `LoginScreen` sub-component with:
- Monogram + "Couple Dashboard" heading
- Password input (gold border, espresso bg, show/hide toggle)
- "Enter Dashboard" gold button
- Default password hint + Ctrl+Shift+A shortcut hint
- Toast feedback on success/failure

**Once authed** — `DashboardShell` with:
- Top bar: monogram, LIVE/OFFLINE badge, "Updated Xm ago", session remaining, Logout, X close
- 5-tab navigation: Overview, RSVPs, Songbook, Messages, Ceremony

**Tab 1 — Overview:**
- 4 hero cards: Days until wedding, Live connection (with online + checked-in counts), Checked in (with progress), Acceptance rate
- 6 stat cards: Total RSVPs, Confirmed (with head count), Declined, Pending, Plus-ones, Kids attending
- Recent Activity feed: merges latest RSVPs + messages, sorted by createdAt, shows top 12 with kind icons (Users/MessageSquare/Music)

**Tab 2 — RSVP Management:**
- Search by name/email + filter by all/accept/decline/pending
- Check-in progress bar (animated gold gradient)
- CSV export (full data: name, email, status, meal, +1, kids, dietary, check-in, message, dates)
- Table: Guest (name+email), Status badge, Meal, +1, Kids, Check-in toggle button (per-row)
- Click row to expand details: dietary notes, plus-one meal, song requests, RSVP token, submitted/updated timestamps, message to couple
- Check-in toggle: optimistic update + PATCH `/api/rsvp/[token]` + toast feedback + revert on failure

**Tab 3 — Songbook Manager:**
- 2-column layout: main playlist + side column
- Playlist sorted by votes (with framer-motion layout animations), each row: rank, title/artist/phase, vote badge (clay heart), played badge (sage with timestamp), up/down move buttons, Mark Played toggle
- Mark-as-played persists to localStorage (`wewed:played-songs`) since no API exists yet
- Add Song form: title, artist, phase dropdown (7 phases) → POST `/api/songs`
- Guest Requests card: filters `phase === 'requested'`, shows count + vote per request
- Move up/down reorders locally (swaps `order` field)

**Tab 4 — Messages & Capsule:**
- Announcement composer (plum gradient card, Megaphone icon): 280-char input → POST `/api/messages` + `live.sendMessage()` to broadcast on the live wall
- Guest Wall: list of all wall/toast messages with approve/hide toggle (persists to localStorage) and Remove button (deletes locally + permanently hides)
- Time Capsule card (plum gradient, Lock icon): shows count (capsule messages + 47 sample baseline), sealed-until-Dec-23 messaging, preview-when-day-arrives note

**Tab 5 — Ceremony Control:**
- "Now Live" hero card: large display of `live.currentCeremonyItem`, "Up next" subtitle, broadcasting/disconnected badge
- 3 primary actions: Start Ceremony (sets first programme item as current), Next Item (advances through programme), Open Dance Floor (free-text trigger)
- Programme timeline: clickable items with active/next badges, time/icon, "LIVE" pulse badge on active
- Quick moment triggers: Cake Cutting, Toasts & Speeches, First Dance, Last Dance
- Side panel: checked-in count (max of socket count + DB count), connection stats (status, online guests, live messages, total song votes), explanation of broadcast behavior

**Polling & real-time:**
- Polls `/api/rsvp`, `/api/songs`, `/api/messages`, `/api/wedding` every 10s when authed (Promise.allSettled so individual failures don't break)
- Uses `useWewedLive` hook for socket connection: reads `isConnected`, `connectedGuests`, `checkedInCount`, `liveMessages`, `songVotes`, `currentCeremonyItem`, `nextCeremonyItem`; emits `identify` (as couple), `updateCeremony`, `sendMessage`
- Auto-identifies as couple on connect

**UX details:**
- Body scroll lock when open
- Escape key closes (in addition to Dialog's built-in)
- All mutations have toast feedback
- Optimistic updates with revert on failure (check-in)
- "Last updated" indicator in top bar
- Loading gate (authChecked state) prevents SSR flash
- framer-motion: fade-up on stat cards, layout animations on song rows, smooth transitions on ceremony current-item

### 3. `src/components/wedding/admin-trigger.tsx` — Invisible gate
- Renders `null` when closed (no visible UI)
- Listens for `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac) — toggles dashboard open/closed
- On mount, checks URL for `?admin=1` → opens dashboard, then strips the param from URL (so refresh/share doesn't auto-open)
- Defers `setOpen(true)` via `setTimeout(0)` to satisfy `react-hooks/set-state-in-effect` rule and avoid SSR hydration mismatch
- Manages open state internally, mounts `<AdminDashboard onClose={...} />` when open
- Body scroll lock when open (defensive — dashboard also does this)

## Design consistency
- All custom color tokens used: espresso, champagne, gold, gold-muted, gold-light, clay, clay-light, plum, plum-light, sage, sage-light
- `wewed-heading` class for all serif headings (Cormorant Garamond)
- `wewed-monogram` class for "C&K · 23.12.26" markers
- `wewed-pulse-dot` for live indicators
- `wewed-scroll` for scrollable areas
- framer-motion with consistent easing `[0.25, 0.46, 0.45, 0.94]` and stagger patterns
- All `'use client'` components
- shadcn/ui: Dialog, Tabs, Card, Button, Input, Badge, ScrollArea, Separator, Table
- Lucide icons: LayoutDashboard, Users, Music, MessageSquare, Play, X, LogOut, Search, Download, Check, Clock, Heart, Disc3, Sparkles, Lock, Unlock, CheckCircle2, XCircle, ChevronUp, ChevronDown, Send, CalendarDays, TrendingUp, UserCheck, Baby, Wifi, WifiOff, SkipForward, PlayCircle, PartyPopper, Megaphone, Inbox, Trash2

## Lint & verification
- ✅ `bun run lint` — passes clean, zero errors, zero warnings
- ✅ Dev server compiles all 3 new files without errors (✓ Compiled in 130-319ms)
- ✅ Home page GET / 200 (no regressions)
- ✅ No modifications to page.tsx or layout.tsx (lead agent will wire `<AdminTrigger />` into layout)
- ✅ No new API routes created (uses existing /api/rsvp, /api/songs, /api/messages, /api/wedding, /api/rsvp/[token])
- ✅ No new page routes created (admin is a Dialog overlay)

## Notes for the lead agent (wiring)
- Import: `import { AdminTrigger } from '@/components/wedding/admin-trigger'`
- Add `<AdminTrigger />` to the body in `src/app/layout.tsx` (alongside PWARegister, InstallPrompt)
- It renders nothing visible until triggered
- Default password: `wewed-admin-2026` (override via `NEXT_PUBLIC_WEWED_ADMIN_PASSWORD` env var)
- Test entry: visit `/?admin=1` or press `Ctrl+Shift+A`

## Followups for future phases
- Replace `admin-auth.ts` with NextAuth.js credentials provider (Phase 5 platform-ization)
- Add `/api/songs/[id]` PATCH route to persist `playedAt` server-side (currently localStorage only)
- Add `/api/messages/[id]` DELETE route for true message moderation (currently local-only)
- Add `/api/rsvp/[token]/checkin` POST route with idempotency for QR scan flow (currently PATCH toggle works fine for manual admin use)
- Consider adding a `/api/admin/announcements` endpoint to broadcast via socket server-side (currently uses client emit which works but couples broadcast to the dashboard being open)
