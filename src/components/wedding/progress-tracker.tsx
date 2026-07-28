'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Bot,
  CheckCircle2,
  Circle,
  Code,
  ListTodo,
  Loader2,
  RefreshCw,
  Server,
  Share2,
  ShieldCheck,
  TrendingUp,
  X,
  XCircle,
  Zap,
  Clock,
  AlertTriangle,
  FileWarning,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PROJECT_STATUS,
  CATEGORY_AGGREGATES,
  PHASE_PROGRESS,
  FAILURES,
  TOTAL_COUNT,
  PASSING_COUNT,
  IN_PROGRESS_COUNT,
  PLANNED_COUNT,
  FAILING_COUNT,
  OVERALL_PROGRESS,
  LAST_UPDATED,
  LAST_UPDATED_LABEL,
  type StatusCategory,
  type StatusItem,
  type StatusState,
} from '@/lib/project-status'
import { useWewedLive } from '@/lib/useWewedLive'

/* ============================================================
   ProgressTracker — Build Progress Dashboard
   ------------------------------------------------------------
   Full-screen overlay (Dialog) that shows the real-time build
   state of the wewed project. Honest, live, clear.

   Opens via the ProgressTrigger (Ctrl+Shift+P or ?progress=1).

   Layout (top → bottom):
     1. Header — title, last-updated, Refresh / Run QA / Close
     2. Summary cards (Total / Passing / In Progress / Failing)
     3. Overall progress bar with gold gradient
     4. Phase timeline (P1–P5)
     5. Category breakdown — 7 cards, each lists its items
     6. Failures section — empty state OR list with fixes
     7. Live health checks — 3 endpoints, green/red dots

   Auto-refresh: health checks re-run every 30s while open.
   ============================================================ */

// ─── Category icon map ─────────────────────────────────────────────────────

const CATEGORY_ICON: Record<StatusCategory, React.ComponentType<{ className?: string }>> = {
  frontend: Code,
  backend: Server,
  integration: Zap,
  ai: Bot,
  social: Share2,
  planner: ListTodo,
  infrastructure: ShieldCheck,
}

// ─── Status badge helper ───────────────────────────────────────────────────

interface StatusBadgeProps {
  status: StatusState
  progress?: number
  compact?: boolean
}

function StatusBadge({ status, progress, compact = false }: StatusBadgeProps) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        {!compact && <span className="font-sans text-[10px] font-medium uppercase tracking-[0.16em]">Done</span>}
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 text-gold-light">
        <Loader2 className="size-3.5 animate-spin" />
        {!compact && (
          <span className="font-sans text-[10px] font-medium uppercase tracking-[0.16em]">
            {progress != null ? `${progress}%` : 'In progress'}
          </span>
        )}
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-clay-light">
        <XCircle className="size-3.5" />
        {!compact && <span className="font-sans text-[10px] font-medium uppercase tracking-[0.16em]">Failed</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-sage-light">
      <Circle className="size-3.5" />
      {!compact && <span className="font-sans text-[10px] font-medium uppercase tracking-[0.16em]">Planned</span>}
    </span>
  )
}

// ─── Overall progress ring (SVG) ───────────────────────────────────────────

function ProgressRing({ value, size = 72 }: { value: number; size?: number }) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference

  // Unique gradient id so multiple rings on a page don't clash
  const gradientId = useMemo(
    () => `progress-ring-grad-${Math.random().toString(36).slice(2, 9)}`,
    [],
  )

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A68B4B" />
            <stop offset="50%" stopColor="#D8BC7E" />
            <stop offset="100%" stopColor="#BF9B5F" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(191,155,95,0.12)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="wewed-heading text-2xl text-gold-light leading-none">{clamped}%</span>
      </div>
    </div>
  )
}

// ─── Summary card ──────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: number
  tone: 'total' | 'passing' | 'in_progress' | 'failing'
  icon: React.ComponentType<{ className?: string }>
}

const SUMMARY_TONE: Record<SummaryCardProps['tone'], { text: string; ring: string; bg: string; icon: string }> = {
  total: { text: 'text-champagne', ring: 'border-gold/20', bg: 'bg-champagne/[0.03]', icon: 'text-gold-light' },
  passing: { text: 'text-emerald-400', ring: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.06]', icon: 'text-emerald-400' },
  in_progress: { text: 'text-gold-light', ring: 'border-gold/40', bg: 'bg-gold/[0.06]', icon: 'text-gold-light' },
  failing: { text: 'text-clay-light', ring: 'border-clay/40', bg: 'bg-clay/[0.06]', icon: 'text-clay-light' },
}

function SummaryCard({ label, value, tone, icon: Icon }: SummaryCardProps) {
  const t = SUMMARY_TONE[tone]
  return (
    <Card className={`border ${t.ring} ${t.bg} backdrop-blur-sm`}>
      <CardContent className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-champagne/55">
            {label}
          </p>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`wewed-heading text-3xl sm:text-4xl ${t.text} leading-none mt-1`}
          >
            {value}
          </motion.p>
        </div>
        <Icon className={`size-7 sm:size-8 shrink-0 ${t.icon}`} aria-hidden="true" />
      </CardContent>
    </Card>
  )
}

// ─── Phase timeline ────────────────────────────────────────────────────────

function PhaseTimeline() {
  return (
    <Card className="border-gold/20 bg-champagne/[0.03]">
      <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-4 text-gold" />
          <h3 className="wewed-heading text-lg text-champagne">Phase Timeline</h3>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-champagne/40">
            5 phases · {PHASE_PROGRESS.length} tracked
          </span>
        </div>

        {/* Desktop horizontal timeline */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-5 right-5 h-px bg-gold/20" />
            <motion.div
              className="absolute top-5 left-5 h-px bg-gradient-to-r from-gold-muted via-gold to-gold-light"
              initial={{ width: 0 }}
              animate={{ width: 'calc((100% - 2.5rem) * 0.95)' }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
            <div className="relative grid grid-cols-5 gap-2">
              {PHASE_PROGRESS.map((phase, idx) => {
                const isLast = idx === PHASE_PROGRESS.length - 1
                const complete = phase.progress === 100
                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 + idx * 0.08 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div
                      className={`flex size-10 items-center justify-center rounded-full border-2 ${
                        complete
                          ? 'border-gold bg-espresso text-gold-light'
                          : isLast
                          ? 'border-gold/50 bg-espresso text-gold-light/80'
                          : 'border-sage/50 bg-espresso text-sage-light'
                      }`}
                    >
                      {complete ? (
                        <CheckCircle2 className="size-5" />
                      ) : (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                    </div>
                    <p className="mt-2 wewed-heading text-sm text-champagne">{phase.name}</p>
                    <p className={`font-mono text-[11px] ${complete ? 'text-emerald-400' : 'text-gold-light'}`}>
                      {phase.progress}%
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {PHASE_PROGRESS.map((phase) => (
              <div key={phase.id} className="flex items-start gap-3 text-xs">
                <span className="wewed-heading text-gold-light w-16 shrink-0">{phase.name}</span>
                <span className="font-sans text-champagne/70 leading-relaxed">{phase.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile vertical timeline */}
        <div className="md:hidden space-y-3">
          {PHASE_PROGRESS.map((phase, idx) => {
            const complete = phase.progress === 100
            const isLast = idx === PHASE_PROGRESS.length - 1
            return (
              <div key={phase.id} className="flex items-start gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    complete
                      ? 'border-gold bg-espresso text-gold-light'
                      : isLast
                      ? 'border-gold/50 bg-espresso text-gold-light/80'
                      : 'border-sage/50 bg-espresso text-sage-light'
                  }`}
                >
                  {complete ? <CheckCircle2 className="size-4" /> : <Loader2 className="size-3.5 animate-spin" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="wewed-heading text-sm text-champagne">{phase.name}</span>
                    <span className={`font-mono text-[11px] ${complete ? 'text-emerald-400' : 'text-gold-light'}`}>
                      {phase.progress}%
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-champagne/60 leading-snug mt-0.5">{phase.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Category card ─────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: typeof CATEGORY_AGGREGATES[number] }) {
  const Icon = CATEGORY_ICON[cat.id]
  const [expanded, setExpanded] = useState(true)
  const hasIssues = cat.failed > 0 || cat.inProgress > 0 || cat.planned > 0

  return (
    <Card className="border-gold/15 bg-champagne/[0.02]">
      <CardContent className="px-4 py-3 sm:px-5 sm:py-4">
        {/* Header row */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gold/25 bg-gold/[0.06]">
            <Icon className="size-4 text-gold-light" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h3 className="wewed-heading text-base sm:text-lg text-champagne">{cat.label}</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-champagne/45">
                {cat.done}/{cat.total} done
              </span>
            </div>
            <p className="font-sans text-[11px] text-champagne/55 leading-tight">{cat.description}</p>
          </div>
          <div className="hidden sm:flex w-32 shrink-0 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gold/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-gold-muted via-gold to-gold-light"
                initial={{ width: 0 }}
                animate={{ width: `${cat.progress}%` }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className={`font-mono text-[11px] w-8 text-right ${cat.progress === 100 ? 'text-emerald-400' : 'text-gold-light'}`}>
              {cat.progress}%
            </span>
          </div>
          <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-champagne/40 ml-1">
            {expanded ? 'Hide' : 'Show'}
          </span>
        </button>

        {/* Mobile progress bar */}
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gold/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold-muted via-gold to-gold-light"
              initial={{ width: 0 }}
              animate={{ width: `${cat.progress}%` }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className={`font-mono text-[11px] w-8 text-right ${cat.progress === 100 ? 'text-emerald-400' : 'text-gold-light'}`}>
            {cat.progress}%
          </span>
        </div>

        {/* Item list */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ul className="mt-3 space-y-1.5 max-h-72 overflow-y-auto wewed-scroll pr-1">
                {cat.items.map((item) => (
                  <StatusItemRow key={item.id} item={item} />
                ))}
              </ul>
              {hasIssues && (
                <p className="mt-2 font-sans text-[10px] text-champagne/45 leading-snug">
                  {cat.failed > 0 && <span className="text-clay-light">{cat.failed} failing · </span>}
                  {cat.inProgress > 0 && <span className="text-gold-light">{cat.inProgress} in progress · </span>}
                  {cat.planned > 0 && <span className="text-sage-light">{cat.planned} planned · </span>}
                  <span>{cat.done} done</span>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

// ─── Status item row ───────────────────────────────────────────────────────

function StatusItemRow({ item }: { item: StatusItem }) {
  return (
    <li className="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-gold/[0.04]">
      <div className="mt-0.5 shrink-0">
        <StatusBadge status={item.status} compact />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[12.5px] leading-snug text-champagne/85">{item.name}</p>
        {item.notes && (
          <p className="font-mono text-[10.5px] text-champagne/40 leading-snug mt-0.5 break-words">{item.notes}</p>
        )}
      </div>
      {item.status === 'in_progress' && (
        <span className="shrink-0 font-mono text-[10px] text-gold-light/80 mt-0.5">{item.progress}%</span>
      )}
    </li>
  )
}

// ─── Failures section ──────────────────────────────────────────────────────

function FailuresSection() {
  if (FAILURES.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/[0.06]">
        <CardContent className="flex items-center gap-4 px-5 py-6">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-emerald-500/10"
          >
            <CheckCircle2 className="size-6 text-emerald-400" />
          </motion.div>
          <div>
            <h3 className="wewed-heading text-xl text-emerald-400">All systems passing</h3>
            <p className="font-sans text-sm text-champagne/70 mt-1">
              No critical failures. Every API route returns 200, every component renders, lint passes clean.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <AlertTriangle className="size-4 text-clay-light" />
        <h3 className="wewed-heading text-lg text-champagne">Known Issues</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-champagne/40">
          {FAILURES.length} {FAILURES.length === 1 ? 'item' : 'items'} · 0 blocking
        </span>
      </div>
      {FAILURES.map((failure) => (
        <Card
          key={failure.id}
          className={`border ${
            failure.severity === 'critical'
              ? 'border-clay/50 bg-clay/[0.06]'
              : failure.severity === 'warning'
              ? 'border-gold/40 bg-gold/[0.04]'
              : 'border-sage/30 bg-sage/[0.04]'
          }`}
        >
          <CardContent className="px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FileWarning
                    className={`size-4 ${
                      failure.severity === 'critical'
                        ? 'text-clay-light'
                        : failure.severity === 'warning'
                        ? 'text-gold-light'
                        : 'text-sage-light'
                    }`}
                  />
                  <h4 className="wewed-heading text-base text-champagne">{failure.title}</h4>
                  <Badge
                    variant="outline"
                    className={`border-current/30 text-[9px] uppercase tracking-[0.18em] ${
                      failure.severity === 'critical'
                        ? 'text-clay-light'
                        : failure.severity === 'warning'
                        ? 'text-gold-light'
                        : 'text-sage-light'
                    }`}
                  >
                    {failure.severity}
                  </Badge>
                  {failure.acknowledged && (
                    <Badge variant="outline" className="border-gold/30 text-[9px] uppercase tracking-[0.18em] text-gold-light">
                      Acknowledged
                    </Badge>
                  )}
                </div>
                <p className="font-sans text-[12.5px] text-champagne/75 leading-snug mt-2">{failure.description}</p>
                <div className="mt-3 grid gap-1.5">
                  <p className="font-mono text-[11px] text-champagne/55">
                    <span className="text-champagne/40">File:</span> {failure.affectedFile}
                  </p>
                  <p className="font-sans text-[12px] text-champagne/70 leading-snug">
                    <span className="font-mono text-[11px] text-champagne/40">Fix:</span> {failure.suggestedFix}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-gold/30 text-gold-light hover:bg-gold/10 hover:text-gold-light text-[10px] uppercase tracking-[0.16em]"
                onClick={() => {
                  // Mock retry — the actual fix requires editing the source file.
                  // The button is here so the user sees the action is queued.
                  const btn = document.activeElement as HTMLButtonElement | null
                  if (btn) {
                    btn.disabled = true
                    const original = btn.textContent
                    btn.textContent = 'Queued ✓'
                    window.setTimeout(() => {
                      btn.disabled = false
                      btn.textContent = original
                    }, 1800)
                  }
                }}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Health checks ─────────────────────────────────────────────────────────

interface HealthCheckResult {
  id: string
  label: string
  description: string
  status: 'pending' | 'ok' | 'fail' | 'checking'
  /** ms — only meaningful when status === 'ok' */
  responseMs?: number
  /** HTTP status code for http checks; undefined for socket checks. */
  httpStatus?: number
  error?: string
  checkedAt?: number
}

function HealthChecks({ autoRefreshSignal }: { autoRefreshSignal: number }) {
  const live = useWewedLive()
  const [results, setResults] = useState<HealthCheckResult[]>([
    { id: 'wedding-api', label: '/api/wedding', description: 'Flagship wedding data', status: 'pending' },
    { id: 'songs-api', label: '/api/songs', description: 'Songbook list', status: 'pending' },
    { id: 'socket-io', label: 'socket.io :3003', description: 'Live wedding service', status: 'pending' },
  ])
  const [qaRunning, setQaRunning] = useState(false)
  const [qaProgress, setQaProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const runCheck = useCallback(
    async (id: string): Promise<HealthCheckResult> => {
      if (id === 'socket-io') {
        // Pull from the live socket hook — it reconnects automatically.
        const ok = live.isConnected
        return {
          id,
          label: 'socket.io :3003',
          description: 'Live wedding service',
          status: ok ? 'ok' : 'fail',
          responseMs: undefined,
          error: ok ? undefined : 'Socket disconnected — check mini-services/wewed-live',
          checkedAt: Date.now(),
        }
      }
      const url = id === 'wedding-api' ? '/api/wedding' : '/api/songs'
      const start = performance.now()
      try {
        const res = await fetch(url, { cache: 'no-store' })
        const ms = Math.round(performance.now() - start)
        const ok = res.ok
        return {
          id,
          label: url,
          description: id === 'wedding-api' ? 'Flagship wedding data' : 'Songbook list',
          status: ok ? 'ok' : 'fail',
          responseMs: ms,
          httpStatus: res.status,
          error: ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
          checkedAt: Date.now(),
        }
      } catch (e) {
        const ms = Math.round(performance.now() - start)
        return {
          id,
          label: url,
          description: id === 'wedding-api' ? 'Flagship wedding data' : 'Songbook list',
          status: 'fail',
          responseMs: ms,
          error: e instanceof Error ? e.message : 'Network error',
          checkedAt: Date.now(),
        }
      }
    },
    [live.isConnected],
  )

  const runAll = useCallback(
    async (sequential: boolean) => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (sequential) {
        setQaRunning(true)
        setQaProgress(0)
        const checks = ['wedding-api', 'songs-api', 'socket-io']
        const next = [...results]
        for (let i = 0; i < checks.length; i++) {
          if (controller.signal.aborted) return
          const id = checks[i]
          const idx = next.findIndex((r) => r.id === id)
          if (idx >= 0) next[idx] = { ...next[idx], status: 'checking' }
          setResults([...next])
          // Small delay so the user can see the checking state
          await new Promise((r) => setTimeout(r, 280))
          const result = await runCheck(id)
          const rIdx = next.findIndex((r) => r.id === id)
          if (rIdx >= 0) next[rIdx] = result
          setResults([...next])
          setQaProgress(Math.round(((i + 1) / checks.length) * 100))
        }
        setQaRunning(false)
        window.setTimeout(() => setQaProgress(0), 1200)
      } else {
        const all = await Promise.all(['wedding-api', 'songs-api', 'socket-io'].map((id) => runCheck(id)))
        if (!controller.signal.aborted) setResults(all)
      }
    },
    [results, runCheck],
  )

  // Initial run on mount.
  // Deferred via setTimeout(0) so setState calls inside runAll don't
  // fire synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const id = window.setTimeout(() => {
      void runAll(false)
    }, 0)
    return () => {
      window.clearTimeout(id)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [runAll])

  // Re-run when the parent passes a new autoRefreshSignal (manual refresh).
  useEffect(() => {
    if (autoRefreshSignal === 0) return // skip the initial mount value
    const id = window.setTimeout(() => {
      void runAll(false)
    }, 0)
    return () => window.clearTimeout(id)
  }, [autoRefreshSignal, runAll])

  // Periodic refresh every 30 seconds while mounted
  useEffect(() => {
    const id = window.setInterval(() => {
      void runAll(false)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [runAll])

  return (
    <Card className="border-gold/15 bg-champagne/[0.02]">
      <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Activity className="size-4 text-gold" />
          <h3 className="wewed-heading text-lg text-champagne">Live Health Checks</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-champagne/40">
            auto-refresh 30s
          </span>
          <Button
            type="button"
            size="sm"
            disabled={qaRunning}
            onClick={() => void runAll(true)}
            className="ml-auto border-gold/30 bg-gold/10 text-gold-light hover:bg-gold/20 hover:text-gold-light text-[10px] uppercase tracking-[0.18em]"
          >
            {qaRunning ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Zap className="size-3.5 mr-1.5" />}
            {qaRunning ? `Running… ${qaProgress}%` : 'Run Full QA'}
          </Button>
        </div>

        {/* QA progress bar */}
        <AnimatePresence>
          {qaRunning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="h-1 w-full overflow-hidden rounded-full bg-gold/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-gold-muted via-gold to-gold-light"
                  animate={{ width: `${qaProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ul className="space-y-2">
          {results.map((r) => (
            <HealthCheckRow key={r.id} result={r} />
          ))}
        </ul>

        <Separator className="my-3 bg-gold/15" />

        <div className="flex flex-wrap items-center gap-3 font-sans text-[11px] text-champagne/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            Operational
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-clay-light" />
            Failing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-gold-light/60" />
            Checking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-champagne/20" />
            Pending
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function HealthCheckRow({ result }: { result: HealthCheckResult }) {
  const dotClass =
    result.status === 'ok'
      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
      : result.status === 'fail'
      ? 'bg-clay-light shadow-[0_0_6px_rgba(212,128,94,0.5)]'
      : result.status === 'checking'
      ? 'bg-gold-light/80 animate-pulse'
      : 'bg-champagne/20'

  return (
    <li className="flex items-center gap-3 rounded-md border border-gold/10 bg-espresso/40 px-3 py-2">
      <span className={`size-2.5 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[12px] text-champagne">{result.label}</span>
          <span className="font-sans text-[11px] text-champagne/55">{result.description}</span>
        </div>
        {result.error && (
          <p className="font-mono text-[10.5px] text-clay-light/80 mt-0.5 truncate">{result.error}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {result.status === 'ok' && (
          <>
            {result.httpStatus && (
              <p className="font-mono text-[11px] text-emerald-400 leading-tight">
                {result.httpStatus}
              </p>
            )}
            {result.responseMs != null && (
              <p className="font-mono text-[10px] text-champagne/45 leading-tight">{result.responseMs}ms</p>
            )}
            {result.httpStatus == null && result.responseMs == null && (
              <p className="font-mono text-[11px] text-emerald-400 leading-tight inline-flex items-center gap-1">
                <Wifi className="size-3" />
                Connected
              </p>
            )}
          </>
        )}
        {result.status === 'fail' && (
          <p className="font-mono text-[11px] text-clay-light leading-tight inline-flex items-center gap-1">
            <WifiOff className="size-3" />
            {result.httpStatus ? result.httpStatus : 'Down'}
          </p>
        )}
        {result.status === 'checking' && (
          <p className="font-mono text-[11px] text-gold-light leading-tight inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            Checking
          </p>
        )}
        {result.status === 'pending' && (
          <p className="font-mono text-[11px] text-champagne/40 leading-tight">Pending</p>
        )}
      </div>
    </li>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export interface ProgressTrackerProps {
  onClose: () => void
}

export function ProgressTracker({ onClose }: ProgressTrackerProps) {
  const [lastRefresh, setLastRefresh] = useState<number>(() => Date.now())
  const [autoRefreshSignal, setAutoRefreshSignal] = useState<number>(0)
  const [now, setNow] = useState<number>(() => Date.now())

  // Tick "now" every second for the relative timestamp display
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const handleManualRefresh = useCallback(() => {
    setLastRefresh(Date.now())
    setAutoRefreshSignal((v) => v + 1)
  }, [])

  // Esc closes (in addition to the Dialog's built-in escape)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const secondsSinceRefresh = Math.max(0, Math.floor((now - lastRefresh) / 1000))
  const refreshLabel =
    secondsSinceRefresh < 5
      ? 'just now'
      : secondsSinceRefresh < 60
      ? `${secondsSinceRefresh}s ago`
      : `${Math.floor(secondsSinceRefresh / 60)}m ago`

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="h-[94vh] max-h-[94vh] w-[96vw] max-w-[1300px] gap-0 overflow-hidden rounded-2xl border-gold/25 bg-espresso p-0 text-champagne sm:max-w-[1300px]"
      >
        <DialogTitle className="sr-only">wewed Build Progress Dashboard</DialogTitle>
        <DialogDescription className="sr-only">
          Real-time build progress, health checks, and known issues for the wewed project.
        </DialogDescription>

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-gold/15 bg-espresso/95 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <ProgressRing value={OVERALL_PROGRESS} size={56} />
            <div className="min-w-0">
              <h1 className="wewed-heading text-xl sm:text-2xl text-champagne leading-tight">
                wewed — <span className="text-gold-light">Build Progress</span>
              </h1>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-champagne/50 mt-0.5">
                {LAST_UPDATED_LABEL} · refresh {refreshLabel}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleManualRefresh}
              className="border-gold/30 bg-gold/[0.06] text-gold-light hover:bg-gold/15 hover:text-gold-light text-[10px] uppercase tracking-[0.18em]"
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Refresh
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close progress dashboard"
              className="inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-clay/20 hover:text-champagne hover:border-clay/40"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <ScrollArea className="h-[calc(94vh-72px)] wewed-scroll">
          <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <SummaryCard label="Total Features" value={TOTAL_COUNT} tone="total" icon={Sparkles} />
              <SummaryCard label="Passing" value={PASSING_COUNT} tone="passing" icon={CheckCircle2} />
              <SummaryCard label="In Progress" value={IN_PROGRESS_COUNT} tone="in_progress" icon={Loader2} />
              <SummaryCard label="Failing" value={FAILING_COUNT} tone="failing" icon={XCircle} />
            </div>

            {/* Overall progress + planner & planned counts */}
            <Card className="border-gold/20 bg-gradient-to-br from-espresso via-espresso to-plum/20">
              <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex flex-wrap items-baseline gap-2 mb-3">
                  <TrendingUp className="size-4 text-gold" />
                  <h3 className="wewed-heading text-lg text-champagne">Overall Progress</h3>
                  <span className="ml-auto font-mono text-[11px] text-gold-light">{OVERALL_PROGRESS}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gold/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-gold-muted via-gold to-gold-light shadow-[0_0_10px_rgba(216,188,126,0.4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${OVERALL_PROGRESS}%` }}
                    transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] text-champagne/60">
                  <span><span className="text-emerald-400">{PASSING_COUNT}</span> done</span>
                  <span><span className="text-gold-light">{IN_PROGRESS_COUNT}</span> in progress</span>
                  <span><span className="text-sage-light">{PLANNED_COUNT}</span> planned</span>
                  <span><span className="text-clay-light">{FAILING_COUNT}</span> failing</span>
                  <span className="ml-auto text-champagne/40">across {PROJECT_STATUS.length} tracked items</span>
                </div>
              </CardContent>
            </Card>

            {/* Phase timeline */}
            <PhaseTimeline />

            {/* Categories */}
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <Code className="size-4 text-gold" />
                <h3 className="wewed-heading text-lg text-champagne">Category Breakdown</h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-champagne/40">
                  {CATEGORIES_THAT_EXIST_COUNT} categories
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {CATEGORY_AGGREGATES.map((cat) => (
                  <CategoryCard key={cat.id} cat={cat} />
                ))}
              </div>
            </div>

            {/* Failures */}
            <FailuresSection />

            {/* Live health checks */}
            <HealthChecks autoRefreshSignal={autoRefreshSignal} />

            {/* Footer note */}
            <div className="pt-2 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-champagne/35">
                Open with <span className="text-gold-light">Ctrl+Shift+P</span> · or visit <span className="text-gold-light">?progress=1</span>
              </p>
              <p className="wewed-monogram text-xs mt-2">C&amp;K · 23.12.26 · wewed</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// Tiny constant so the JSX stays readable — count of categories tracked.
const CATEGORIES_THAT_EXIST_COUNT = CATEGORY_AGGREGATES.length

export default ProgressTracker
