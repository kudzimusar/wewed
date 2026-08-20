'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
} from 'lucide-react'

interface CalendarItem {
  id: string
  sourceType: string
  sourceId: string
  weddingId: string | null
  weddingTitle: string | null
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  category: string
  status: string | null
  priority: string | null
  deepLink: string | null
}

type ViewMode = 'month' | 'agenda'

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addMonths(value: Date, delta: number) {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1)
}

function dateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthGrid(value: Date) {
  const first = startOfMonth(value)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function formatTime(item: CalendarItem) {
  if (item.allDay) return 'All day'
  const date = new Date(item.startAt)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatAgendaDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [items, setItems] = useState<CalendarItem[]>([])
  const [mode, setMode] = useState<ViewMode>('month')
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => {
    const from = addMonths(cursor, -1)
    const to = endOfMonth(addMonths(cursor, 1))
    return { from, to }
  }, [cursor])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        limit: '1000',
      })
      const response = await fetch(`/api/calendar?${params.toString()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (response.status === 401) {
        window.location.href = '/sign-in'
        return
      }
      const payload = (await response.json()) as { success?: boolean; error?: string; data?: CalendarItem[] }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load calendar.')
      setItems(payload.data ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load calendar.')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items],
  )

  const visibleItems = useMemo(
    () =>
      activeCategories.size === 0
        ? items
        : items.filter((item) => activeCategories.has(item.category)),
    [items, activeCategories],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of visibleItems) {
      const key = dateKey(item.startAt)
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [visibleItems])

  const grid = useMemo(() => monthGrid(cursor), [cursor])
  const agendaGroups = useMemo(
    () =>
      Array.from(byDay.entries())
        .map(([key, dayItems]) => ({ key, date: new Date(`${key}T12:00:00`), items: dayItems }))
        .filter((group) => group.date >= startOfMonth(cursor) && group.date <= endOfMonth(cursor))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [byDay, cursor],
  )

  function toggleCategory(category: string) {
    setActiveCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(cursor)

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-3 pb-24 pt-6 text-[#2a211b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-[#2a211b]/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#9a7440]">
              <CalendarDays className="size-4" /> Wewed unified calendar
            </div>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{monthLabel}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#2a211b]/55">
              Dates are projected from Wewed source records. Editing a task, payment, service date or RSVP deadline remains the responsibility of its original module.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor(addMonths(cursor, -1))}
              aria-label="Previous month"
              className="flex size-10 items-center justify-center rounded-full border border-[#2a211b]/15 bg-white hover:border-[#9a7440]"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="min-h-10 rounded-full border border-[#2a211b]/15 bg-white px-4 text-sm font-semibold hover:border-[#9a7440]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCursor(addMonths(cursor, 1))}
              aria-label="Next month"
              className="flex size-10 items-center justify-center rounded-full border border-[#2a211b]/15 bg-white hover:border-[#9a7440]"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="ml-1 flex rounded-full border border-[#2a211b]/15 bg-white p-1">
              {(['month', 'agenda'] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  onClick={() => setMode(view)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${mode === view ? 'bg-[#2a211b] text-[#f8f3e9]' : 'text-[#2a211b]/55'}`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </header>

        {categories.length > 0 && (
          <section className="mt-4 flex flex-wrap gap-2" aria-label="Calendar categories">
            {categories.map((category) => {
              const active = activeCategories.size === 0 || activeCategories.has(category)
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${active ? 'border-[#9a7440]/40 bg-[#9a7440]/10 text-[#725329]' : 'border-[#2a211b]/10 text-[#2a211b]/35'}`}
                >
                  {category}
                </button>
              )
            })}
            {activeCategories.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategories(new Set())}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#2a211b]/45 underline"
              >
                Show all
              </button>
            )}
          </section>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-[#2a211b]/40">
            <Loader2 className="mr-2 size-5 animate-spin" /> Loading calendar…
          </div>
        ) : mode === 'month' ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-[#2a211b]/10 bg-white shadow-sm" aria-label={`${monthLabel} calendar`}>
            <div className="grid grid-cols-7 border-b border-[#2a211b]/10 bg-[#f2eadb] text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#2a211b]/45">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-1 py-2.5">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((day) => {
                const key = dateKey(day)
                const dayItems = byDay.get(key) ?? []
                const currentMonth = day.getMonth() === cursor.getMonth()
                const today = key === dateKey(new Date())
                return (
                  <div
                    key={key}
                    className={`min-h-28 border-b border-r border-[#2a211b]/[0.08] p-1.5 sm:min-h-36 sm:p-2 ${currentMonth ? 'bg-white' : 'bg-[#faf7f1] text-[#2a211b]/30'}`}
                  >
                    <div className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold ${today ? 'bg-[#9a7440] text-white' : ''}`}>
                      {day.getDate()}
                    </div>
                    <div className="grid gap-1">
                      {dayItems.slice(0, 4).map((item) => (
                        <Link
                          key={item.id}
                          href={item.deepLink || '/calendar'}
                          title={`${item.title}${item.weddingTitle ? ` — ${item.weddingTitle}` : ''}`}
                          className="block truncate rounded-md border border-[#9a7440]/15 bg-[#9a7440]/[0.07] px-1.5 py-1 text-[10px] font-semibold text-[#725329] hover:bg-[#9a7440]/15 sm:text-xs"
                        >
                          {!item.allDay && <span className="mr-1 opacity-60">{formatTime(item)}</span>}
                          {item.title}
                        </Link>
                      ))}
                      {dayItems.length > 4 && (
                        <button type="button" onClick={() => setMode('agenda')} className="text-left text-[10px] font-semibold text-[#2a211b]/40">
                          +{dayItems.length - 4} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : agendaGroups.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#2a211b]/15 bg-white p-12 text-center text-sm text-[#2a211b]/45">
            No calendar items match this month and filter.
          </div>
        ) : (
          <section className="mt-6 grid gap-6" aria-label="Calendar agenda">
            {agendaGroups.map((group) => (
              <div key={group.key} className="grid gap-3 md:grid-cols-[12rem_1fr]">
                <div>
                  <h2 className="sticky top-4 font-serif text-xl text-[#725329]">{formatAgendaDate(group.date)}</h2>
                </div>
                <div className="grid gap-2">
                  {group.items.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-[#2a211b]/10 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7440]">
                            <span>{item.category}</span>
                            {item.weddingTitle && <span className="text-[#2a211b]/35">• {item.weddingTitle}</span>}
                          </div>
                          <h3 className="mt-1 font-serif text-2xl">{item.title}</h3>
                          {item.description && <p className="mt-1 text-sm text-[#2a211b]/50">{item.description}</p>}
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#2a211b]/40">
                            <Clock3 className="size-3.5" /> {formatTime(item)}
                            {item.status && <> · {item.status.replaceAll('_', ' ')}</>}
                          </p>
                        </div>
                        {item.deepLink && (
                          <Link href={item.deepLink} className="inline-flex items-center gap-1 text-xs font-bold text-[#725329] hover:underline">
                            Open source <ExternalLink className="size-3.5" />
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
