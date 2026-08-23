'use client'

import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { NotificationRoleDescription } from '@/components/notifications/notification-role-description'
import { NotificationSectionNavigation } from '@/components/notifications/notification-section-navigation'

type NotificationState =
  | 'scheduled'
  | 'queued'
  | 'active'
  | 'read'
  | 'acknowledged'
  | 'resolved'
  | 'dismissed'
  | 'cancelled'
  | 'expired'
  | 'failed'

type NotificationSeverity = 'info' | 'normal' | 'important' | 'action_required' | 'urgent'

interface NotificationItem {
  id: string
  weddingId: string | null
  sourceType: string
  sourceId: string | null
  eventType: string
  category: string
  severity: NotificationSeverity
  title: string
  body: string
  deepLink: string | null
  actionType: string | null
  requiresAction: boolean
  state: NotificationState
  readAt: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
  scheduledFor: string | null
  snoozedUntil: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

type AttentionFilter = 'all' | 'needs_action' | 'upcoming' | 'updates' | 'resolved'

const FILTERS: Array<{ key: AttentionFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs_action', label: 'Needs action' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'updates', label: 'Updates' },
  { key: 'resolved', label: 'Resolved' },
]

function isResolved(item: NotificationItem) {
  return ['resolved', 'cancelled', 'expired'].includes(item.state)
}

function isDeferred(item: NotificationItem) {
  return item.state === 'scheduled' || item.state === 'queued'
}

function isAcknowledged(item: NotificationItem) {
  return item.state === 'acknowledged' || Boolean(item.acknowledgedAt)
}

function matchesAttentionFilter(item: NotificationItem, filter: AttentionFilter) {
  if (filter === 'all') return true
  if (filter === 'resolved') return isResolved(item)
  if (isResolved(item)) return false
  if (filter === 'needs_action') {
    if (isDeferred(item) || isAcknowledged(item)) return false
    return item.requiresAction || item.severity === 'action_required' || item.severity === 'urgent'
  }
  if (filter === 'upcoming') {
    return isDeferred(item) || Boolean(item.snoozedUntil || item.scheduledFor)
  }
  if (isAcknowledged(item)) return true
  return !isDeferred(item) && !item.requiresAction
}

function formatTimestamp(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function severityLabel(severity: NotificationSeverity) {
  if (severity === 'action_required') return 'Action required'
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

function StatePill({ children, tone = 'gold', testId }: { children: ReactNode; tone?: 'gold' | 'green' | 'muted'; testId?: string }) {
  const classes = tone === 'green'
    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    : tone === 'muted'
      ? 'border-white/10 bg-white/[0.04] text-[#f5ead7]/45'
      : 'border-[#bf9b5f]/25 bg-[#bf9b5f]/10 text-[#d8b978]'
  return <span data-testid={testId} className={`inline-flex min-h-5 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>{children}</span>
}

export default function NotificationCenterPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<AttentionFilter>('all')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/notifications?limit=100', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (response.status === 401) {
        window.location.href = '/sign-in'
        return
      }
      const payload = (await response.json()) as {
        success?: boolean
        error?: string
        unreadCount?: number
        data?: NotificationItem[]
      }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load notifications.')
      setItems(payload.data ?? [])
      setUnreadCount(payload.unreadCount ?? 0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const onFocus = () => refreshWhenVisible()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const intervalId = window.setInterval(refreshWhenVisible, 10_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(intervalId)
    }
  }, [load])

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items],
  )

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesAttentionFilter(item, filter) &&
          (category === 'all' || item.category === category),
      ),
    [items, filter, category],
  )

  async function act(item: NotificationItem, action: string, extra?: Record<string, unknown>) {
    setWorkingId(item.id)
    setError(null)
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, action, ...extra }),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update notification.')
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update notification.')
    } finally {
      setWorkingId(null)
    }
  }

  function snoozeTomorrow(item: NotificationItem) {
    const triggerAt = new Date()
    triggerAt.setDate(triggerAt.getDate() + 1)
    triggerAt.setHours(9, 0, 0, 0)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    void act(item, 'snooze', { triggerAt: triggerAt.toISOString(), timezone })
  }

  return (
    <main className="min-h-dvh bg-[#17120f] px-3 pb-12 pt-16 text-[#f5ead7] sm:px-6 sm:pt-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <NotificationSectionNavigation surface="center" />

        <header className="flex items-end justify-between gap-4 border-b border-[#bf9b5f]/20 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#bf9b5f]">
              <Bell className="size-3.5" />
              Wewed attention
            </div>
            <h1 className="mt-1 font-serif text-3xl font-normal leading-none sm:text-4xl">Notifications</h1>
            <div className="mt-1.5 max-w-2xl text-xs leading-5 text-[#f5ead7]/50 sm:text-sm">
              <NotificationRoleDescription />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-semibold text-[#d8b978]">{unreadCount}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#f5ead7]/35">unread</p>
          </div>
        </header>

        <section className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" aria-label="Notification filters">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`min-h-8 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold transition ${
                  filter === item.key
                    ? 'border-[#bf9b5f] bg-[#bf9b5f] text-[#17120f]'
                    : 'border-[#bf9b5f]/20 text-[#f5ead7]/55 hover:border-[#bf9b5f]/45 hover:text-[#d8b978]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-[11px] text-[#f5ead7]/45 sm:justify-start">
            <span className="sm:hidden">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-8 rounded-lg border border-[#bf9b5f]/20 bg-[#211915] px-2.5 text-xs text-[#f5ead7] outline-none focus:border-[#bf9b5f]"
              aria-label="Filter notifications by category"
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </section>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-[#f5ead7]/45">
            <Loader2 className="mr-2 size-5 animate-spin" /> Loading attention…
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#bf9b5f]/20 px-4 py-10 text-center">
            <Inbox className="mx-auto size-7 text-[#bf9b5f]/50" />
            <h2 className="mt-2 font-serif text-xl">Nothing here right now</h2>
            <p className="mt-1 text-xs text-[#f5ead7]/40">This view will fill as Wewed events require your attention.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#bf9b5f]/15 bg-white/[0.015]">
            {visibleItems.map((item) => {
              const busy = workingId === item.id
              const deferred = isDeferred(item)
              const acknowledged = isAcknowledged(item)
              const unread = item.state === 'active' && !item.readAt
              const when = item.snoozedUntil || item.scheduledFor || item.createdAt

              return (
                <article
                  key={item.id}
                  className={`border-b border-[#bf9b5f]/10 px-3 py-3 last:border-b-0 sm:px-4 ${unread ? 'bg-[#bf9b5f]/[0.055]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 size-2 shrink-0 rounded-full ${unread ? 'bg-[#bf9b5f]' : 'bg-[#f5ead7]/15'}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
                        <span className="text-[#bf9b5f]">{item.category}</span>
                        <span className="text-[#f5ead7]/20">•</span>
                        <span className={item.severity === 'urgent' || item.severity === 'action_required' ? 'text-amber-300' : 'text-[#f5ead7]/40'}>
                          {severityLabel(item.severity)}
                        </span>
                        {acknowledged ? (
                          <StatePill tone="green" testId="notification-acknowledged-state"><CheckCheck className="size-2.5" /> Acknowledged</StatePill>
                        ) : null}
                        {deferred ? (
                          <StatePill><Clock3 className="size-2.5" /> {item.snoozedUntil ? 'Snoozed' : 'Scheduled'}</StatePill>
                        ) : null}
                        {isResolved(item) ? <StatePill tone="muted">Resolved</StatePill> : null}
                      </div>

                      <div className="mt-1 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className={`text-[15px] leading-5 sm:text-base ${unread ? 'font-semibold text-[#f8edda]' : 'font-medium text-[#f5ead7]/85'}`}>{item.title}</h2>
                          <p className="mt-1 max-h-10 overflow-hidden whitespace-pre-wrap text-xs leading-5 text-[#f5ead7]/48 sm:text-sm">{item.body}</p>
                        </div>
                        {item.deepLink ? (
                          <Link
                            href={`/notifications/open/${encodeURIComponent(item.id)}`}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[#bf9b5f]/20 text-[#d8b978] transition hover:bg-[#bf9b5f]/10"
                            data-testid="notification-open-source"
                            aria-label={`Open ${item.title}`}
                            title="Open"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1 text-[10px] text-[#f5ead7]/30">
                          <CalendarClock className="size-3" /> {formatTimestamp(when)}
                        </p>

                        {!isResolved(item) ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {!deferred && !acknowledged ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void act(item, unread ? 'read' : 'unread')}
                                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#bf9b5f]/15 px-2 text-[10px] text-[#f5ead7]/55 hover:bg-[#bf9b5f]/10 hover:text-[#d8b978] disabled:opacity-50"
                              >
                                {unread ? <Check className="size-3" /> : <RotateCcw className="size-3" />}
                                {unread ? 'Read' : 'Unread'}
                              </button>
                            ) : null}
                            {!deferred && item.requiresAction && !acknowledged ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void act(item, 'acknowledge')}
                                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#bf9b5f]/15 px-2 text-[10px] text-[#f5ead7]/55 hover:bg-[#bf9b5f]/10 hover:text-[#d8b978] disabled:opacity-50"
                              >
                                <CheckCheck className="size-3" /> Acknowledge
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => snoozeTomorrow(item)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#bf9b5f]/15 px-2 text-[10px] text-[#f5ead7]/55 hover:bg-[#bf9b5f]/10 hover:text-[#d8b978] disabled:opacity-50"
                            >
                              <Clock3 className="size-3" /> Tomorrow
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void act(item, 'resolve')}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#bf9b5f]/15 px-2 text-[10px] text-[#f5ead7]/55 hover:bg-[#bf9b5f]/10 hover:text-[#d8b978] disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3" />}
                              Resolve
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
