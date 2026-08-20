'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarDays, CheckCircle2, ChevronRight, Clock3, Loader2, Siren } from 'lucide-react'

interface AttentionItem {
  id: string
  kind: 'notification' | 'calendar'
  title: string
  description: string | null
  weddingId: string | null
  weddingTitle: string | null
  category: string
  priority: 'urgent' | 'action_required' | 'important' | 'normal' | 'info'
  when: string
  requiresAction: boolean
  deepLink: string | null
  sourceType: string
  sourceId: string | null
}

interface TodayModel {
  role: 'admin' | 'planner' | 'couple' | 'vendor'
  generatedAt: string
  needsAction: AttentionItem[]
  today: AttentionItem[]
  upcoming: AttentionItem[]
  unreadCount: number
  summary: { needsAction: number; today: number; upcoming: number; urgent: number }
}

const ROLE_COPY: Record<TodayModel['role'], { eyebrow: string; title: string; description: string }> = {
  admin: {
    eyebrow: 'Wewed operations',
    title: 'Admin Today',
    description: 'Operational actions, delivery exceptions and system attention assigned to you.',
  },
  planner: {
    eyebrow: 'Portfolio attention',
    title: 'Planner Today',
    description: 'The highest-priority actions and dates across the weddings you are authorized to manage.',
  },
  couple: {
    eyebrow: 'Wedding attention',
    title: 'Your Today',
    description: 'Wedding actions, deadlines and upcoming dates that need your attention.',
  },
  vendor: {
    eyebrow: 'Service attention',
    title: 'Vendor Today',
    description: 'Your own Wewed engagements, service dates, contracts and action-required events.',
  },
}

function dateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function ItemCard({ item }: { item: AttentionItem }) {
  return (
    <Link
      href={item.deepLink || (item.kind === 'notification' ? '/notifications' : '/calendar')}
      className="group block rounded-2xl border border-[#2a211b]/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9a7440]/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${item.priority === 'urgent' || item.priority === 'action_required' ? 'bg-amber-100 text-amber-700' : 'bg-[#9a7440]/10 text-[#8a672f]'}`}>
          {item.kind === 'notification' ? <Bell className="size-4" /> : <CalendarDays className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7440]">
            <span>{item.category}</span>
            {item.weddingTitle && <span className="text-[#2a211b]/35">• {item.weddingTitle}</span>}
          </div>
          <h3 className="mt-1 font-serif text-xl leading-tight">{item.title}</h3>
          {item.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#2a211b]/50">{item.description}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#2a211b]/40">
            <Clock3 className="size-3.5" /> {dateTime(item.when)}
          </p>
        </div>
        <ChevronRight className="mt-2 size-4 shrink-0 text-[#9a7440]/55 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function Section({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: AttentionItem[]; empty: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-serif text-2xl">{title}</h2>
        <span className="rounded-full bg-[#2a211b]/5 px-2 py-0.5 text-xs font-bold text-[#2a211b]/45">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a211b]/15 bg-white/60 px-4 py-7 text-center text-sm text-[#2a211b]/40">{empty}</div>
      ) : (
        <div className="grid gap-2">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div>
      )}
    </section>
  )
}

export default function TodayPage() {
  const [model, setModel] = useState<TodayModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/today', { credentials: 'same-origin', cache: 'no-store' })
      if (response.status === 401) {
        window.location.href = '/sign-in'
        return
      }
      const payload = (await response.json()) as { success?: boolean; error?: string; data?: TodayModel }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || 'Unable to load Today.')
      setModel(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Today.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#f8f3e9] text-[#2a211b]/45"><Loader2 className="mr-2 size-5 animate-spin" /> Loading Today…</main>
  }

  if (!model) {
    return <main className="min-h-dvh bg-[#f8f3e9] p-8 text-[#2a211b]"><div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error || 'Today is unavailable.'}</div></main>
  }

  const copy = ROLE_COPY[model.role]

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-4 pb-24 pt-7 text-[#2a211b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a7440]">{copy.eyebrow}</p>
          <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-serif text-4xl sm:text-6xl">{copy.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#2a211b]/55">{copy.description}</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-amber-50 px-3 py-2"><strong className="block text-xl text-amber-700">{model.summary.urgent}</strong><span className="text-[9px] uppercase tracking-wide text-amber-700/70">Urgent</span></div>
              <div className="rounded-xl bg-[#f4ecde] px-3 py-2"><strong className="block text-xl">{model.summary.needsAction}</strong><span className="text-[9px] uppercase tracking-wide text-[#2a211b]/45">Action</span></div>
              <div className="rounded-xl bg-[#f4ecde] px-3 py-2"><strong className="block text-xl">{model.summary.today}</strong><span className="text-[9px] uppercase tracking-wide text-[#2a211b]/45">Today</span></div>
              <div className="rounded-xl bg-[#f4ecde] px-3 py-2"><strong className="block text-xl">{model.summary.upcoming}</strong><span className="text-[9px] uppercase tracking-wide text-[#2a211b]/45">Next 7d</span></div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[#2a211b]/10 pt-5">
            <Link href="/notifications" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#2a211b] px-4 text-xs font-bold text-[#f8f3e9]"><Bell className="size-4" /> Notifications ({model.unreadCount})</Link>
            <Link href="/calendar" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#2a211b]/15 bg-white px-4 text-xs font-bold"><CalendarDays className="size-4" /> Calendar</Link>
          </div>
        </header>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="mt-7 grid gap-8 lg:grid-cols-3">
          <Section title="Needs action" icon={<Siren className="size-5 text-amber-700" />} items={model.needsAction} empty="No action-required items right now." />
          <Section title="Today" icon={<CheckCircle2 className="size-5 text-[#8a672f]" />} items={model.today} empty="Nothing else is scheduled for today." />
          <Section title="Upcoming" icon={<CalendarDays className="size-5 text-[#8a672f]" />} items={model.upcoming} empty="No upcoming items in the next seven days." />
        </div>
      </div>
    </main>
  )
}
