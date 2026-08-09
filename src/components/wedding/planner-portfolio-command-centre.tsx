'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Loader2,
  RefreshCw,
  Store,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HealthSummary {
  state: 'on_track' | 'attention' | 'at_risk'
  daysUntilWedding: number
  reasons: string[]
}

interface PortfolioWedding {
  weddingId: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  coupleName: string
  membershipRole: string
  membershipStatus: string
  tasks: { total: number; done: number; overdue: number; blocked: number }
  budget: { estimated: number; actual: number; paid: number; outstanding: number; overduePayments: number; currency: string }
  guests: { total: number; confirmed: number; declined: number; pending: number }
  vendors: { total: number; signed: number; pendingContracts: number; paymentAttention: number }
  timeline: { items: number }
  health: HealthSummary
}

interface PriorityItem {
  weddingId: string
  weddingTitle: string
  coupleName: string
  weddingDate: string
  daysUntilWedding: number
  module: 'overview' | 'tasks' | 'budget' | 'vendors' | 'guests' | 'timeline'
  severity: 'normal' | 'high' | 'critical'
  message: string
}

interface PortfolioPayload {
  success: boolean
  activeWeddingId: string | null
  generatedAt: string
  portfolio: {
    activeWeddings: number
    next30Days: number
    next90Days: number
    needsAttention: number
    atRisk: number
    overdueTasks: number
    blockedTasks: number
    pendingRsvps: number
    pendingVendorContracts: number
    overdueBudgetPayments: number
  }
  weddings: PortfolioWedding[]
  priorities: PriorityItem[]
  error?: string
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function healthLabel(health: HealthSummary) {
  if (health.state === 'at_risk') return 'At risk'
  if (health.state === 'attention') return 'Needs attention'
  return 'On track'
}

function healthClasses(health: HealthSummary) {
  if (health.state === 'at_risk') return 'border-clay/40 bg-clay/10 text-clay-light'
  if (health.state === 'attention') return 'border-gold/35 bg-gold/10 text-gold'
  return 'border-sage/35 bg-sage/10 text-sage-light'
}

function severityClasses(severity: PriorityItem['severity']) {
  if (severity === 'critical') return 'border-clay/30 bg-clay/10 text-clay-light'
  if (severity === 'high') return 'border-gold/30 bg-gold/10 text-gold'
  return 'border-champagne/10 bg-champagne/[0.04] text-champagne/70'
}

function weddingLocation(wedding: PortfolioWedding) {
  return [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(' · ')
}

export function PlannerPortfolioCommandCentre() {
  const router = useRouter()
  const [payload, setPayload] = useState<PortfolioPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingWedding, setOpeningWedding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/planner/portfolio', { cache: 'no-store' })
      const next = (await response.json()) as PortfolioPayload
      if (!response.ok || !next.success) throw new Error(next.error || 'Unable to load planner portfolio.')
      setPayload(next)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load planner portfolio.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openWedding(weddingId: string, module: PriorityItem['module'] = 'overview') {
    setOpeningWedding(weddingId)
    setError(null)
    try {
      const response = await fetch('/api/auth/wedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId }),
        cache: 'no-store',
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to open this wedding.')
      window.dispatchEvent(new CustomEvent('wewed:wedding-switched', { detail: { weddingId } }))
      router.push(`/planner/${module}#planner-workspace`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this wedding.')
      setOpeningWedding(null)
    }
  }

  if (loading && !payload) {
    return <div className="flex h-full min-h-[50vh] items-center justify-center bg-espresso text-champagne"><Loader2 className="size-7 animate-spin text-gold" /></div>
  }

  const portfolio = payload?.portfolio
  const weddings = payload?.weddings ?? []
  const priorities = payload?.priorities ?? []

  return <div data-planner-portfolio className="h-full min-h-0 overflow-y-auto bg-espresso px-3 py-5 text-champagne sm:px-6 sm:py-7">
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/75">Planner portfolio</p>
          <h2 className="mt-1 font-serif text-3xl text-champagne">Your wedding command centre</h2>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-champagne/55">See workload and attention signals across every wedding you actively manage, then move directly into the relevant worksheet to act.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="border-gold/25 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 font-sans text-sm text-clay-light">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortfolioMetric icon={<Users className="size-4" />} label="Active weddings" value={portfolio?.activeWeddings ?? 0} detail={`${portfolio?.next90Days ?? 0} in the next 90 days`} />
        <PortfolioMetric icon={<CalendarDays className="size-4" />} label="Next 30 days" value={portfolio?.next30Days ?? 0} detail="Upcoming delivery pressure" />
        <PortfolioMetric icon={<AlertTriangle className="size-4" />} label="Need attention" value={portfolio?.needsAttention ?? 0} detail={`${portfolio?.atRisk ?? 0} currently at risk`} />
        <PortfolioMetric icon={<Clock3 className="size-4" />} label="Overdue tasks" value={portfolio?.overdueTasks ?? 0} detail={`${portfolio?.blockedTasks ?? 0} blocked across clients`} />
      </div>

      <section className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Action queue</p>
            <h3 className="mt-1 font-serif text-2xl">What needs attention next</h3>
          </div>
          <p className="font-sans text-xs text-champagne/40">{priorities.length} prioritised signal{priorities.length === 1 ? '' : 's'}</p>
        </div>
        {priorities.length === 0 ? <div className="mt-4 flex items-center gap-3 rounded-xl border border-sage/20 bg-sage/10 p-4"><CheckCircle2 className="size-5 text-sage-light" /><div><p className="font-sans text-sm font-medium">No immediate portfolio alerts</p><p className="mt-0.5 font-sans text-xs text-champagne/50">Open a wedding below to continue normal planning work.</p></div></div> : <div className="mt-4 grid gap-2">{priorities.slice(0, 12).map((item, index) => <button key={`${item.weddingId}-${item.module}-${item.message}-${index}`} type="button" onClick={() => void openWedding(item.weddingId, item.module)} disabled={openingWedding !== null} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-gold/45 ${severityClasses(item.severity)}`}>
          <div className="min-w-0">
            <p className="truncate font-sans text-xs font-semibold">{item.coupleName} · {item.weddingTitle}</p>
            <p className="mt-1 font-sans text-sm text-champagne">{item.message}</p>
            <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.1em] text-champagne/40">Open {item.module} · {item.daysUntilWedding >= 0 ? `${item.daysUntilWedding} days to wedding` : 'post-wedding'}</p>
          </div>
          {openingWedding === item.weddingId ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ChevronRight className="size-4 shrink-0" />}
        </button>)}</div>}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Managed weddings</p>
            <h3 className="mt-1 font-serif text-2xl">Client portfolio</h3>
          </div>
          <p className="font-sans text-xs text-champagne/40">Only active planner/coordinator relationships count here.</p>
        </div>

        {weddings.length === 0 ? <div className="rounded-2xl border border-dashed border-gold/25 p-10 text-center"><Users className="mx-auto size-6 text-gold/60" /><p className="mt-3 font-serif text-xl">No active client weddings yet</p><p className="mx-auto mt-2 max-w-lg font-sans text-sm leading-6 text-champagne/50">Once a wedding relationship becomes active, it will appear here automatically. Marketplace profile status and client wedding access remain separate.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{weddings.map((wedding) => <article key={wedding.weddingId} className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/70">{wedding.coupleName}</p>
              <h4 className="mt-1 truncate font-serif text-xl">{wedding.title}</h4>
              <p className="mt-1 font-sans text-xs text-champagne/45">{dateLabel(wedding.date)} · {weddingLocation(wedding)}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] ${healthClasses(wedding.health)}`}>{healthLabel(wedding.health)}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric icon={<Clock3 className="size-3.5" />} value={wedding.tasks.overdue} label="Overdue" />
            <MiniMetric icon={<Users className="size-3.5" />} value={wedding.guests.pending} label="RSVP pending" />
            <MiniMetric icon={<Store className="size-3.5" />} value={wedding.vendors.pendingContracts} label="Contracts" />
            <MiniMetric icon={<CircleDollarSign className="size-3.5" />} value={wedding.budget.overduePayments} label="Late payments" />
          </div>

          {wedding.health.reasons.length > 0 ? <div className="mt-4 rounded-xl border border-champagne/10 bg-espresso/35 px-3 py-2.5"><p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-champagne/40">Why this status</p><p className="mt-1 font-sans text-xs leading-5 text-champagne/65">{wedding.health.reasons.slice(0, 3).join(' · ')}</p></div> : <p className="mt-4 flex items-center gap-2 font-sans text-xs text-sage-light"><CheckCircle2 className="size-3.5" /> No current attention rule is triggered.</p>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-champagne/10 pt-4">
            <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-champagne/35">{wedding.membershipRole} · {wedding.health.daysUntilWedding >= 0 ? `${wedding.health.daysUntilWedding} days to go` : 'post-wedding'}</p>
            <Button type="button" size="sm" onClick={() => void openWedding(wedding.weddingId)} disabled={openingWedding !== null} className="bg-gold text-espresso hover:bg-gold-light">
              {openingWedding === wedding.weddingId ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronRight className="size-3.5" />} Open wedding
            </Button>
          </div>
        </article>)}</div>}
      </section>
    </div>
  </div>
}

function PortfolioMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return <div className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4"><div className="flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/70">{icon}{label}</div><p className="mt-2 font-serif text-3xl">{value}</p><p className="mt-1 font-sans text-xs text-champagne/40">{detail}</p></div>
}

function MiniMetric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="rounded-xl border border-champagne/10 bg-espresso/25 p-2.5"><p className="flex items-center gap-1.5 font-sans text-base font-semibold">{icon}{value}</p><p className="mt-0.5 font-sans text-[10px] text-champagne/40">{label}</p></div>
}
