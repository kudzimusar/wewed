'use client'

import Link from 'next/link'
import { Bell, CalendarDays, ChevronRight, Clock3, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface TodayItem {
  id: string
  title: string
  weddingTitle: string | null
  category: string
  priority: string
  when: string
  deepLink: string | null
}

interface TodayPayload {
  role: 'admin' | 'planner' | 'couple' | 'vendor'
  unreadCount: number
  needsAction: TodayItem[]
  today: TodayItem[]
  upcoming: TodayItem[]
  summary: {
    needsAction: number
    today: number
    upcoming: number
    urgent: number
  }
}

const ROLE_LABEL: Record<TodayPayload['role'], string> = {
  admin: 'Admin attention',
  planner: 'Planner today',
  couple: 'Wedding today',
  vendor: 'Vendor today',
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function AttentionSummaryWidget({ className = '' }: { className?: string }) {
  const [data, setData] = useState<TodayPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/today', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as { success?: boolean; data?: TodayPayload }
      if (payload.success && payload.data) setData(payload.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  if (loading) {
    return (
      <section className={`rounded-2xl border border-gold/20 bg-white/95 p-4 text-espresso shadow-sm ${className}`} aria-label="Today attention loading">
        <div className="flex items-center gap-2 text-sm text-espresso/50"><Loader2 className="size-4 animate-spin" /> Loading Today…</div>
      </section>
    )
  }

  if (!data) return null
  const spotlight = [...data.needsAction, ...data.today].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
  ).slice(0, 3)

  return (
    <section className={`rounded-2xl border border-gold/20 bg-white/95 p-4 text-espresso shadow-sm ${className}`} data-testid="attention-summary-widget">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-muted">{ROLE_LABEL[data.role]}</p>
          <h2 className="mt-1 font-serif text-2xl">Your attention</h2>
        </div>
        <Link href="/today" className="inline-flex size-9 items-center justify-center rounded-full bg-espresso text-champagne" aria-label="Open Today">
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Link href="/notifications" className="rounded-xl bg-champagne/50 p-2.5">
          <Bell className="mx-auto size-4 text-gold-muted" />
          <strong className="mt-1 block text-lg">{data.summary.needsAction}</strong>
          <span className="text-[10px] uppercase tracking-wide text-espresso/50">Action</span>
        </Link>
        <Link href="/today" className="rounded-xl bg-champagne/50 p-2.5">
          <Clock3 className="mx-auto size-4 text-gold-muted" />
          <strong className="mt-1 block text-lg">{data.summary.today}</strong>
          <span className="text-[10px] uppercase tracking-wide text-espresso/50">Today</span>
        </Link>
        <Link href="/calendar" className="rounded-xl bg-champagne/50 p-2.5">
          <CalendarDays className="mx-auto size-4 text-gold-muted" />
          <strong className="mt-1 block text-lg">{data.summary.upcoming}</strong>
          <span className="text-[10px] uppercase tracking-wide text-espresso/50">Upcoming</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-2">
        {spotlight.length === 0 ? (
          <p className="rounded-xl border border-dashed border-espresso/10 px-3 py-4 text-center text-xs text-espresso/45">No immediate actions.</p>
        ) : (
          spotlight.map((item) => (
            <Link key={item.id} href={item.deepLink || '/today'} className="flex items-center gap-3 rounded-xl border border-espresso/10 px-3 py-2.5 hover:border-gold/40 hover:bg-champagne/30">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-espresso/45">{item.weddingTitle || item.category} · {timeLabel(item.when)}</p>
              </div>
              <ChevronRight className="size-3.5 shrink-0 text-gold-muted" />
            </Link>
          ))
        )}
      </div>
    </section>
  )
}
