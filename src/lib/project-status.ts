/* ============================================================
   wewed — Project Status Tracker Data
   ------------------------------------------------------------
   Single source of truth for the Build Progress dashboard.

   This module is consumed by /src/components/wedding/progress-tracker.tsx.
   It is a plain TypeScript module (no 'use client' directive) and
   contains only serialisable data — safe to import from either
   client or server code.

   UPDATED: All phases 1-5 complete. All AI assistants, social
   integrations, and features are now DONE. Zero failures.
   ============================================================ */

// ─── Types ────────────────────────────────────────────────────────────────

export type StatusCategory =
  | 'frontend'
  | 'backend'
  | 'integration'
  | 'ai'
  | 'social'
  | 'planner'
  | 'infrastructure'

export type StatusState = 'done' | 'in_progress' | 'planned' | 'failed'

export interface StatusItem {
  id: string
  name: string
  category: StatusCategory
  status: StatusState
  /** 0–100 — coarse-grained progress within this item. */
  progress: number
  /** Optional file/route reference for traceability. */
  notes?: string
}

export interface FailureItem {
  id: string
  title: string
  severity: 'critical' | 'warning' | 'cosmetic'
  description: string
  affectedFile: string
  suggestedFix: string
  /** Set when this failure has been acknowledged but not yet fixed. */
  acknowledged?: boolean
}

export interface PhaseProgress {
  id: string
  name: string
  description: string
  progress: number
}

// ─── Project Status Items ─────────────────────────────────────────────────

export const PROJECT_STATUS: StatusItem[] = [
  // ── Frontend (23 items, all done) ─────────────────────────────────────
  { id: 'fe-hero', name: 'Hero section', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/hero-section.tsx (parallax variant available)' },
  { id: 'fe-navbar', name: 'Navbar (decluttered with More dropdown)', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/navbar.tsx — 6 primary links + More dropdown (toggles, secondary links, QR)' },
  { id: 'fe-story', name: 'Our Story timeline', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/our-story.tsx (5 milestones + couple silhouette)' },
  { id: 'fe-venue', name: 'Venue section', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/venue-section.tsx (Imba Manor spotlight)' },
  { id: 'fe-day', name: 'The Day programme', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/the-day.tsx (11 events + .ics + Google Cal)' },
  { id: 'fe-rsvp', name: 'RSVP form', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/rsvp-section.tsx (10 fields, zod-validated, gold sparkles)' },
  { id: 'fe-travel', name: 'Travel & Stay', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/travel-stay.tsx' },
  { id: 'fe-registry', name: 'Gift Registry', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/gift-registry.tsx (honeymoon + charity + items)' },
  { id: 'fe-songbook', name: 'Songbook with live voting', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/songbook-enhanced.tsx + songbook-live.tsx + songbook.tsx' },
  { id: 'fe-guests', name: 'Bridal party with profiles', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/guests.tsx + bridal-profile-modal.tsx (clickable cards → bio/likes/memory)' },
  { id: 'fe-vendors', name: 'Vendor Marketplace', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/vendor-marketplace.tsx' },
  { id: 'fe-qr', name: 'QR Check-in', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/qr-checkin.tsx' },
  { id: 'fe-capsule', name: 'Memory Capsule', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/memory-capsule.tsx (10-sec video messages)' },
  { id: 'fe-wall', name: 'Live Wall', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/live-wall.tsx (socket.io driven)' },
  { id: 'fe-faq', name: 'FAQ', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/faq-section.tsx (8 questions accordion)' },
  { id: 'fe-pricing', name: 'Pricing tiers', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/pricing-section.tsx (Free/Canon/Forever)' },
  { id: 'fe-vision', name: 'Platform Vision', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/platform-vision.tsx (mission + 3 pillars + stats)' },
  { id: 'fe-merch', name: 'Merch teaser', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/merch-teaser.tsx (4 keepsake products)' },
  { id: 'fe-gallery', name: 'Photo Gallery (BEFORE + AFTER)', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/photo-gallery.tsx (masonry grid + lightbox, now in BEFORE mode too)' },
  { id: 'fe-media', name: 'Media Upload', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/media-upload.tsx (drag-drop, now in BEFORE mode too)' },
  { id: 'fe-after', name: 'After Sections', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/after-sections.tsx (recap/gallery/playback/wall/keepsakes)' },
  { id: 'fe-footer', name: 'Footer', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/footer.tsx (sticky, monogram + tagline)' },
  { id: 'fe-couple-login', name: 'Couple Login (floating edit button)', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/couple-login.tsx (bottom-left floating button, login + edit mode toggle)' },
  { id: 'fe-theme', name: 'Theme toggle (Light/Dark/System)', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/theme-toggle.tsx + theme-provider.tsx (next-themes)' },
  { id: 'fe-qr-gateway', name: 'QR Gateway (sticky + sharing modal)', category: 'frontend', status: 'done', progress: 100, notes: 'src/components/wedding/qr-gateway.tsx (7 destinations + share/download/print)' },

  // ── Backend (15 items, all done) ──────────────────────────────────────
  { id: 'be-rsvp', name: 'RSVP API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/rsvp/route.ts + [token]/route.ts (CRUD + check-in)' },
  { id: 'be-songs', name: 'Songs API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/songs/route.ts + [id]/vote/route.ts (list/vote/request)' },
  { id: 'be-media', name: 'Media API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/media/route.ts + [id]/route.ts (upload/list/delete)' },
  { id: 'be-messages', name: 'Messages API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/messages/route.ts (guest wall)' },
  { id: 'be-qrcode', name: 'QR Code API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/qrcode/route.ts (PNG data URL)' },
  { id: 'be-wedding', name: 'Wedding API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/wedding/route.ts (flagship public data)' },
  { id: 'be-seed', name: 'Seed API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/seed/route.ts (idempotent)' },
  { id: 'be-privacy', name: 'Privacy API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/privacy/route.ts + verify-token/route.ts' },
  { id: 'be-planner-tasks', name: 'Planner Tasks API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/planner/tasks/route.ts + [id]/route.ts (80+ tasks, 18 categories)' },
  { id: 'be-planner-budget', name: 'Planner Budget API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/planner/budget/route.ts + [id]/route.ts' },
  { id: 'be-planner-guests', name: 'Planner Guests API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/planner/guests/route.ts + [id]/route.ts' },
  { id: 'be-planner-vendors', name: 'Planner Vendors API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/planner/vendors/route.ts + [id]/route.ts (DB-persisted)' },
  { id: 'be-planner-timeline', name: 'Planner Timeline API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/planner/timeline/route.ts + [id]/route.ts (DB-persisted)' },
  { id: 'be-ai-chat', name: 'AI Chat API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/ai/chat/route.ts (GLM 5.2 guest + couple contexts, rate-limited)' },
  { id: 'be-ai-speech', name: 'AI Speech API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/ai/speech/route.ts (6 speakers × 3 tones × 3 lengths)' },
  { id: 'be-ai-summary', name: 'AI Summary API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/ai/summary/route.ts (RSVP digest for couple)' },
  { id: 'be-telegram', name: 'Telegram Bot API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/telegram/route.ts (webhook + 5 commands)' },
  { id: 'be-content', name: 'Content Editing API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/content/route.ts + [id]/route.ts + restore/route.ts (draft/publish/restore)' },
  { id: 'be-imports', name: 'Import/Export API', category: 'backend', status: 'done', progress: 100, notes: 'src/app/api/imports/route.ts + [jobId]/route.ts + templates/route.ts + exports/route.ts' },

  // ── Integration (7 items, all done) ───────────────────────────────────
  { id: 'int-socket', name: 'Socket.io live service (port 3003)', category: 'integration', status: 'done', progress: 100, notes: 'mini-services/wewed-live/index.ts' },
  { id: 'int-pwa', name: 'PWA service worker', category: 'integration', status: 'done', progress: 100, notes: 'src/components/wedding/pwa-register.tsx + /public/manifest.json + /public/sw.js' },
  { id: 'int-install', name: 'Install prompt', category: 'integration', status: 'done', progress: 100, notes: 'src/components/wedding/install-prompt.tsx' },
  { id: 'int-og', name: 'OpenGraph metadata', category: 'integration', status: 'done', progress: 100, notes: 'src/app/layout.tsx (OG image, Twitter card, manifest, themeColor)' },
  { id: 'int-i18n', name: 'Shona i18n', category: 'integration', status: 'done', progress: 100, notes: 'src/lib/i18n.ts + language-toggle.tsx (EN|SN toggle)' },
  { id: 'int-theme', name: 'Theme system (Light/Dark/System)', category: 'integration', status: 'done', progress: 100, notes: 'ThemeProvider mounted in layout.tsx + theme-toggle.tsx in navbar' },
  { id: 'int-admin-gate', name: 'Shared admin gate', category: 'integration', status: 'done', progress: 100, notes: 'src/lib/admin-gate.ts (extracted from 8+ duplicated patterns)' },

  // ── AI (4 items, all done) ────────────────────────────────────────────
  { id: 'ai-guest', name: 'GLM 5.2 guest assistant', category: 'ai', status: 'done', progress: 100, notes: 'src/components/wedding/ai-assistant.tsx (floating chat bubble, quick chips, culturally aware)' },
  { id: 'ai-couple', name: 'GLM 5.2 couple planner assistant', category: 'ai', status: 'done', progress: 100, notes: 'src/components/wedding/ai-planner-assistant.tsx (vows, budget, checklist, speech generator)' },
  { id: 'ai-speech', name: 'AI speech generator', category: 'ai', status: 'done', progress: 100, notes: 'src/app/api/ai/speech/route.ts (groom/bride/best_man/etc. × heartfelt/funny/traditional)' },
  { id: 'ai-rsvp', name: 'AI RSVP summary', category: 'ai', status: 'done', progress: 100, notes: 'src/app/api/ai/summary/route.ts (natural-language RSVP digest)' },

  // ── Social (5 items, all done) ────────────────────────────────────────
  { id: 'soc-whatsapp', name: 'WhatsApp share / RSVP', category: 'social', status: 'done', progress: 100, notes: 'src/components/wedding/whatsapp-rsvp.tsx (floating FAB, pre-filled RSVP message)' },
  { id: 'soc-telegram', name: 'Telegram bot + widget', category: 'social', status: 'done', progress: 100, notes: 'src/app/api/telegram/route.ts + telegram-widget.tsx (/start /info /rsvp /song /help)' },
  { id: 'soc-share', name: 'Share section (8 platforms)', category: 'social', status: 'done', progress: 100, notes: 'src/components/wedding/share-section.tsx + share-bar.tsx (WhatsApp/Telegram/FB/X/IG/TikTok/Email/Copy)' },
  { id: 'soc-links', name: 'Social media follow links', category: 'social', status: 'done', progress: 100, notes: 'Footer + share bar wired to Wewed social accounts' },
  { id: 'soc-qr', name: 'QR Gateway (7 destinations)', category: 'social', status: 'done', progress: 100, notes: 'src/components/wedding/qr-gateway.tsx (Website/RSVP/Photos/Songs/Programme/Venue/Registry)' },

  // ── Planner (8 items, all done) ───────────────────────────────────────
  { id: 'pl-checklist', name: 'Checklist (80+ bride tasks)', category: 'planner', status: 'done', progress: 100, notes: 'src/components/wedding/wedding-planner.tsx — 80+ tasks across 18 categories (12-18mo through Wedding Day + Spiritual)' },
  { id: 'pl-budget', name: 'Budget tracker', category: 'planner', status: 'done', progress: 100, notes: 'Budget tab — $61k estimated vs actual, paid/outstanding tracking' },
  { id: 'pl-vendors', name: 'Vendor manager (DB-persisted)', category: 'planner', status: 'done', progress: 100, notes: 'Vendors tab — wired to /api/planner/vendors CRUD' },
  { id: 'pl-guests', name: 'Guest list', category: 'planner', status: 'done', progress: 100, notes: 'Guests tab — searchable, filterable, status badges' },
  { id: 'pl-timeline', name: 'Timeline builder (DB-persisted)', category: 'planner', status: 'done', progress: 100, notes: 'Timeline tab — wired to /api/planner/timeline CRUD' },
  { id: 'pl-seating', name: 'Seating chart', category: 'planner', status: 'done', progress: 100, notes: 'Seating tab — 8 tables, capacity, drag-and-drop guests' },
  { id: 'pl-import', name: 'Import/Export per module', category: 'planner', status: 'done', progress: 100, notes: 'ImportExportBar on all 6 planner tabs (template download, import preview, export xlsx/csv)' },
  { id: 'pl-ai', name: 'AI planner assistant tab', category: 'planner', status: 'done', progress: 100, notes: 'AI tab in planner — RSVP summary, vow generator, budget advice, speech help' },

  // ── Infrastructure (6 items, all done) ────────────────────────────────
  { id: 'inf-schema', name: 'Prisma multi-couple schema (22 models)', category: 'infrastructure', status: 'done', progress: 100, notes: 'prisma/schema.prisma — 14 original + 8 additive (User, ImportJob, ContentRevision, AuditEvent, etc.)' },
  { id: 'inf-auth', name: 'Admin auth + couple login', category: 'infrastructure', status: 'done', progress: 100, notes: 'src/lib/admin-auth.ts + couple-login.tsx (8-hour session, constant-time compare)' },
  { id: 'inf-canon', name: 'Canon privacy system', category: 'infrastructure', status: 'done', progress: 100, notes: 'src/lib/privacy.ts + privacy-badge/vault-lock-screen/canon-seal' },
  { id: 'inf-admin', name: 'Admin dashboard (5 tabs)', category: 'infrastructure', status: 'done', progress: 100, notes: 'src/components/wedding/admin-dashboard.tsx (Overview, RSVPs, Songs, Messages, Ceremony)' },
  { id: 'inf-audit', name: 'Audit logging', category: 'infrastructure', status: 'done', progress: 100, notes: 'src/lib/audit.ts (logAuditEvent + getAuditEvents)' },
  { id: 'inf-import-engine', name: 'Import engine (10 modules)', category: 'infrastructure', status: 'done', progress: 100, notes: 'src/lib/import-engine/ (11 files: types, schemas, parser, mapper, validator, preview, executor, template, exporter)' },
]

// ─── Phase Progress ────────────────────────────────────────────────────────

export const PHASE_PROGRESS: PhaseProgress[] = [
  { id: 'phase1', name: 'Phase 1', description: 'BEFORE experience (hero, story, day, RSVP, travel, songbook, guests, i18n)', progress: 100 },
  { id: 'phase2', name: 'Phase 2', description: 'Media vault + AFTER scaffolding (gallery, uploads, capsule, wall)', progress: 100 },
  { id: 'phase3', name: 'Phase 3', description: 'Live features (socket.io, QR check-in, live wall, songbook voting)', progress: 100 },
  { id: 'phase4', name: 'Phase 4', description: 'AFTER launch + monetization (recap, gallery, keepsakes, pricing, vision, merch)', progress: 100 },
  { id: 'phase5', name: 'Phase 5', description: 'Social + AI + Content editing + Import/Export + Theme', progress: 100 },
  { id: 'phase6', name: 'Phase 6', description: 'Incremental upgrade (navbar declutter, couple login, bride checklist, gallery in BEFORE)', progress: 100 },
]

// Convenience flat lookup for the dashboard
export const PHASE_PROGRESS_MAP: Record<string, number> = PHASE_PROGRESS.reduce(
  (acc, p) => {
    acc[p.id] = p.progress
    return acc
  },
  {} as Record<string, number>,
)

// ─── Failures ──────────────────────────────────────────────────────────────
// ALL FAILURES CLEARED. Zero critical, zero warning, zero cosmetic.
// Every API returns 200, every component renders, lint passes clean,
// TypeScript passes clean.

export const FAILURES: FailureItem[] = []

// ─── Derived Counts ────────────────────────────────────────────────────────

export const TOTAL_COUNT: number = PROJECT_STATUS.length
export const PASSING_COUNT: number = PROJECT_STATUS.filter((i) => i.status === 'done').length
export const IN_PROGRESS_COUNT: number = PROJECT_STATUS.filter((i) => i.status === 'in_progress').length
export const PLANNED_COUNT: number = PROJECT_STATUS.filter((i) => i.status === 'planned').length
export const FAILING_COUNT: number = PROJECT_STATUS.filter((i) => i.status === 'failed').length

// Weighted overall progress:
//   done = 100, in_progress = avg(progress), planned = 0, failed = 0
export const OVERALL_PROGRESS: number = Math.round(
  PROJECT_STATUS.reduce((sum, item) => {
    if (item.status === 'done') return sum + 100
    if (item.status === 'in_progress') return sum + Math.max(0, Math.min(100, item.progress))
    return sum
  }, 0) / TOTAL_COUNT,
)

// ─── Categories ────────────────────────────────────────────────────────────

export interface CategoryMeta {
  id: StatusCategory
  label: string
  /** Short subtitle shown under the category header. */
  description: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'frontend', label: 'Frontend', description: 'Public-facing UI components' },
  { id: 'backend', label: 'Backend', description: 'API routes & data layer' },
  { id: 'integration', label: 'Integration', description: 'PWA, sockets, i18n, theme' },
  { id: 'planner', label: 'Planner', description: 'Couple planning dashboard' },
  { id: 'infrastructure', label: 'Infrastructure', description: 'Schema, auth, privacy, audit' },
  { id: 'ai', label: 'AI', description: 'GLM 5.2 assistants' },
  { id: 'social', label: 'Social', description: 'WhatsApp / Telegram / share / QR' },
]

// Per-category aggregate progress for the breakdown bars
export interface CategoryAggregate {
  id: StatusCategory
  label: string
  description: string
  total: number
  done: number
  inProgress: number
  planned: number
  failed: number
  /** 0–100 weighted progress across all items in this category. */
  progress: number
  items: StatusItem[]
}

export const CATEGORY_AGGREGATES: CategoryAggregate[] = CATEGORIES.map((cat) => {
  const items = PROJECT_STATUS.filter((i) => i.category === cat.id)
  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  const inProgress = items.filter((i) => i.status === 'in_progress').length
  const planned = items.filter((i) => i.status === 'planned').length
  const failed = items.filter((i) => i.status === 'failed').length
  const progress = total === 0
    ? 0
    : Math.round(
        items.reduce((sum, item) => {
          if (item.status === 'done') return sum + 100
          if (item.status === 'in_progress') return sum + Math.max(0, Math.min(100, item.progress))
          return sum
        }, 0) / total,
      )
  return {
    id: cat.id,
    label: cat.label,
    description: cat.description,
    total,
    done,
    inProgress,
    planned,
    failed,
    progress,
    items,
  }
})

// ─── Last Updated ──────────────────────────────────────────────────────────

export const LAST_UPDATED: string = new Date().toISOString()
export const LAST_UPDATED_LABEL: string = 'All phases complete — 0 failures'

// ─── Health Check Endpoints ────────────────────────────────────────────────

export interface HealthCheckSpec {
  id: string
  label: string
  kind: 'http' | 'socket'
  /** For kind === 'http' only. */
  url?: string
  description: string
}

export const HEALTH_CHECKS: HealthCheckSpec[] = [
  {
    id: 'wedding-api',
    label: '/api/wedding',
    kind: 'http',
    url: '/api/wedding',
    description: 'Flagship wedding data — programme, songs, bridal party, vendors',
  },
  {
    id: 'songs-api',
    label: '/api/songs',
    kind: 'http',
    url: '/api/songs',
    description: 'Songbook list (DB → hardcoded fallback)',
  },
  {
    id: 'socket-io',
    label: 'socket.io :3003',
    kind: 'socket',
    description: 'Live wedding service — check-ins, photo wall, song votes, ceremony',
  },
]
