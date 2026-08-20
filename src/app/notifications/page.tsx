'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

function matchesAttentionFilter(item: NotificationItem, filter: AttentionFilter) {
  if (filter === 'all') return true
  if (filter === 'resolved') return isResolved(item)
  if (isResolved(item)) return false
  if (filter === 'needs_action') return item.requiresAction || item.severity === 'action_required' || item.severity === 'urgent'
  if (filter === 'upcoming') return item.state === 'scheduled' || Boolean(item.snoozedUntil || item.scheduledFor)
  return !item.requiresAction && item.state !== 'scheduled'
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
    <main className="min-h-dvh bg-[#17120f] px-4 pb-20 pt-8 text-[#f5ead7] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-[#bf9b5f]/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#bf9b5f]">
              <Bell className="size-4" />
              Wewed attention
            </div>
            <h1 className="mt-2 font-serif text-4xl font-normal sm:text-5xl">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#f5ead7]/55">
              One secure attention center for Admin, Planner, Couple and Vendor activity. Source records remain authoritative.
            </p>
          </div>
          <div className="rounded-2xl border border-[#bf9b5f]/20 bg-[#bf9b5f]/5 px-4 py-3 text-sm">
            <span className="font-semibold text-[#bf9b5f]">{unreadCount}</span>{' '}
            <span className="text-[#f5ead7]/60">unread</span>
          </div>
        </header>

        <section className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" aria-label="Notification filters">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  filter === item.key
                    ? 'border-[#bf9b5f] bg-[#bf9b5f] text-[#17120f]'
                    : 'border-[#bf9b5f]/20 text-[#f5ead7]/65 hover:border-[#bf9b5f]/50 hover:text-[#bf9b5f]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#f5ead7]/55">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-lg border border-[#bf9b5f]/20 bg-[#211915] px-3 py-2 text-[#f5ead7] outline-none focus:border-[#bf9b5f]"
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </section>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-[#f5ead7]/45">
            <Loader2 className="mr-2 size-5 animate-spin" /> Loading attention…
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[#bf9b5f]/20 p-10 text-center">
            <Inbox className="mx-auto size-8 text-[#bf9b5f]/55" />
            <h2 className="mt-3 font-serif text-2xl">Nothing here right now</h2>
            <p className="mt-2 text-sm text-[#f5ead7]/45">This view will fill as Wewed events require your attention.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {visibleItems.map((item) => {
              const busy = workingId === item.id
              const unread = !item.readAt && !isResolved(item)
              const when = item.snoozedUntil || item.scheduledFor || item.createdAt
              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-4 transition sm:p-5 ${
                    unread ? 'border-[#bf9b5f]/40 bg-[#bf9b5f]/[0.07]' : 'border-[#bf9b5f]/15 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em]">
                        <span className="text-[#bf9b5f]">{item.category}</span>
                        <span className="text-[#f5ead7]/25">•</span>
                        <span className={item.severity === 'urgent' || item.severity === 'action_required' ? 'text-amber-300' : 'text-[#f5ead7]/45'}>
                          {severityLabel(item.severity)}
                        </span>
                        {item.state === 'scheduled' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#bf9b5f]/10 px-2 py-1 text-[#bf9b5f]">
                            <Clock3 className="size-3" /> Snoozed
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 font-serif text-2xl leading-tight">{item.title}</h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#f5ead7]/60">{item.body}</p>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-[#f5ead7]/35">
                        <CalendarClock className="size-3.5" /> {formatTimestamp(when)}
                      </p>
                    </div>

                    {item.deepLink && (
                      <Link
                        href={item.deepLink}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#bf9b5f] px-3 py-2 text-xs font-bold text-[#17120f] hover:bg-[#d2b578]"
                      >
                        Open <ChevronRight className="size-3.5" />
                      </Link>
                    )}
                  </div>

                  {!isResolved(item) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#bf9b5f]/10 pt-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(item, unread ? 'read' : 'unread')}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#bf9b5f]/20 px-3 text-xs text-[#f5ead7]/65 hover:bg-[#bf9b5f]/10 hover:text-[#bf9b5f] disabled:opacity-50"
                      >
                        {unread ? <Check className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                        {unread ? 'Mark read' : 'Mark unread'}
                      </button>
                      {item.requiresAction && item.state !== 'acknowledged' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(item, 'acknowledge')}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#bf9b5f]/20 px-3 text-xs text-[#f5ead7]/65 hover:bg-[#bf9b5f]/10 hover:text-[#bf9b5f] disabled:opacity-50"
                        >
                          <CheckCheck className="size-3.5" /> Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => snoozeTomorrow(item)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#bf9b5f]/20 px-3 text-xs text-[#f5ead7]/65 hover:bg-[#bf9b5f]/10 hover:text-[#bf9b5f] disabled:opacity-50"
                      >
                        <Clock3 className="size-3.5" /> Tomorrow 9:00
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(item, 'resolve')}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#bf9b5f]/20 px-3 text-xs text-[#f5ead7]/65 hover:bg-[#bf9b5f]/10 hover:text-[#bf9b5f] disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                        Resolve
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
