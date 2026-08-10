'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { list, marketplaceFetch } from '@/components/marketplace/marketplace-types'

interface PlannerProfileMetrics {
  planningBusinesses: number
  activeCompleteBusinesses: number
  profilesNotStarted: number
  draftProfiles: number
  submittedProfiles: number
  publishedProfiles: number
  plannerManagedWeddings: number
  weddingsWithoutActivePlanner: number
  pendingPlannerRelationships: number
  activePlanningProfessionals: number
  weddingsNeedingAttention: number
  weddingsAtRisk: number
}

interface HealthSummary {
  state: 'on_track' | 'attention' | 'at_risk'
  daysUntilWedding: number
  reasons: string[]
}

interface PlanningProfessional {
  membershipId: string
  userId: string
  name: string | null
  email: string
  role: string
  status: string
  businessAccountId?: string | null
  businessName?: string | null
}

interface ManagedWedding {
  weddingId: string
  slug?: string
  title?: string
  date?: string
  venue?: string
  venueCity?: string
  venueCountry?: string
  coupleId?: string
  coupleName?: string
  relationshipStatus: string
  professionals: PlanningProfessional[]
  health?: HealthSummary
  tasks?: { overdue: number; blocked: number }
  guests?: { pending: number }
  vendors?: { pendingContracts: number }
}

interface AdminPlannerProfile extends Record<string, unknown> {
  managedWeddings?: ManagedWedding[]
  relationshipSummary?: {
    activeWeddings: number
    invitedWeddings: number
    historicalWeddings: number
    upcomingWeddings: number
  }
}

interface WeddingRelationship {
  weddingId: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  coupleName: string
  planningTeam: PlanningProfessional[]
  activePlanningTeam: PlanningProfessional[]
  invitedPlanningTeam: PlanningProfessional[]
  hasActivePlanner: boolean
  health?: HealthSummary
}

const EMPTY_METRICS: PlannerProfileMetrics = {
  planningBusinesses: 0,
  activeCompleteBusinesses: 0,
  profilesNotStarted: 0,
  draftProfiles: 0,
  submittedProfiles: 0,
  publishedProfiles: 0,
  plannerManagedWeddings: 0,
  weddingsWithoutActivePlanner: 0,
  pendingPlannerRelationships: 0,
  activePlanningProfessionals: 0,
  weddingsNeedingAttention: 0,
  weddingsAtRisk: 0,
}

function dateLabel(value?: string) {
  if (!value) return 'Wedding date not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function locationLabel(wedding: Pick<ManagedWedding, 'venue' | 'venueCity' | 'venueCountry'>) {
  return [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(' · ')
}

function HealthPill({ health }: { health?: HealthSummary }) {
  if (!health) return null
  const label = health.state === 'at_risk' ? 'At risk' : health.state === 'attention' ? 'Needs attention' : 'On track'
  const classes = health.state === 'at_risk'
    ? 'border-clay/35 bg-clay/10 text-clay'
    : health.state === 'attention'
      ? 'border-gold/35 bg-gold/10 text-espresso'
      : 'border-sage/35 bg-sage/10 text-sage-dark'
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${classes}`}>{label}</span>
}

export function AdminPlannerProfiles() {
  return <DashboardAuthGate allowedRoles={['admin']} wrongRoleMessage="This review area is restricted to Wewed platform administrators." title="Planner profile review" description="Review planner marketplace profiles and their live wedding relationships without entering a wedding workspace." onClose={() => { window.location.href = '/admin' }}><AdminPlannerProfileContent /></DashboardAuthGate>
}

function AdminPlannerProfileContent() {
  const [profiles, setProfiles] = useState<AdminPlannerProfile[]>([])
  const [weddings, setWeddings] = useState<WeddingRelationship[]>([])
  const [metrics, setMetrics] = useState<PlannerProfileMetrics>(EMPTY_METRICS)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const payload = await marketplaceFetch<{
        profiles: AdminPlannerProfile[]
        weddings: WeddingRelationship[]
        metrics: PlannerProfileMetrics
      }>('/api/admin/planner-profiles')
      setProfiles(payload.profiles)
      setWeddings(payload.weddings ?? [])
      setMetrics(payload.metrics ?? EMPTY_METRICS)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load planner profiles.')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  async function review(profileId: string, status: string) {
    setBusy(`${profileId}-${status}`); setError(null); setNotice(null)
    try {
      await marketplaceFetch('/api/admin/planner-profiles', { method: 'PATCH', body: JSON.stringify({ profileId, status, reviewNotes: notes[profileId] }) })
      setNotice(`Profile marked ${status.replaceAll('_', ' ')}.`); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Review failed.') } finally { setBusy(null) }
  }

  return <MarketplaceFrame title="Planner relationship governance" description="Marketplace profile lifecycle and wedding authority are shown separately. The same WeddingMembership graph powers planner-to-couple and couple-to-planner visibility." backHref="/admin" actions={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-lg border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}

    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-gold" />
        <h2 className="wewed-heading text-xl">Marketplace lifecycle</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Planning businesses" value={metrics.planningBusinesses} />
        <Metric label="Active + onboarded" value={metrics.activeCompleteBusinesses} />
        <Metric label="Profile not started" value={metrics.profilesNotStarted} />
        <Metric label="Draft" value={metrics.draftProfiles} />
        <Metric label="Awaiting review" value={metrics.submittedProfiles} />
        <Metric label="Published" value={metrics.publishedProfiles} />
      </div>
    </section>

    <section className="mb-8 rounded-2xl border border-gold/20 bg-espresso p-5 text-champagne">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Relationship operations</p>
          <h2 className="wewed-heading mt-1 text-2xl">Planner ↔ Wedding ↔ Couple</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-champagne/55">Active workload is counted only from active planner/coordinator wedding memberships. Invited relationships stay visible but do not inflate active capacity.</p>
        </div>
        {metrics.weddingsAtRisk > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-clay/40 bg-clay/10 px-3 py-1.5 text-xs text-clay-light"><AlertTriangle className="size-3.5" /> {metrics.weddingsAtRisk} at risk</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <DarkMetric label="Active professionals" value={metrics.activePlanningProfessionals} />
        <DarkMetric label="Managed weddings" value={metrics.plannerManagedWeddings} />
        <DarkMetric label="No active planner" value={metrics.weddingsWithoutActivePlanner} />
        <DarkMetric label="Invites pending" value={metrics.pendingPlannerRelationships} />
        <DarkMetric label="Need attention" value={metrics.weddingsNeedingAttention} />
        <DarkMetric label="At risk" value={metrics.weddingsAtRisk} />
      </div>
    </section>

    <div className="space-y-5">{profiles.length === 0 && <p className="rounded-2xl border border-dashed border-gold/30 p-12 text-center">No planning businesses are registered yet.</p>}{profiles.map((profile) => {
      const profileId = typeof profile.id === 'string' ? profile.id : ''
      const businessAccountId = String(profile.businessAccountId ?? '')
      const key = profileId || businessAccountId
      const status = String(profile.profileState ?? profile.status ?? 'not_started')
      const businessStatus = String(profile.businessStatus ?? 'unknown')
      const onboardingStatus = String(profile.onboardingStatus ?? 'unknown')
      const isMissing = !profileId
      const isReadyBusiness = businessStatus === 'active' && onboardingStatus === 'complete'
      const managedWeddings = profile.managedWeddings ?? []
      const relationshipSummary = profile.relationshipSummary
      return <Card key={key} className="border-gold/20 bg-champagne"><CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gold-muted">{String(profile.businessName ?? 'Planning business')}</p>
            <h2 className="wewed-heading mt-1 text-2xl">{String(profile.displayName ?? profile.businessName ?? 'Planner')}</h2>
            <p className="mt-1 text-sm text-espresso/60">{String(profile.headline ?? '')}</p>
            <p className="mt-2 text-xs text-espresso/50">Account: {businessStatus.replaceAll('_', ' ')} · Onboarding: {onboardingStatus.replaceAll('_', ' ')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {relationshipSummary && <span className="rounded-full border border-espresso/15 bg-white/65 px-3 py-1 text-xs font-medium text-espresso"><Users className="mr-1 inline size-3.5" /> {relationshipSummary.activeWeddings} active wedding{relationshipSummary.activeWeddings === 1 ? '' : 's'}</span>}
            <StatusPill value={status} />
          </div>
        </div>

        {isMissing ? <div className={`mt-5 rounded-xl border p-4 text-sm ${isReadyBusiness ? 'border-clay/25 bg-clay/10 text-espresso' : 'border-gold/20 bg-white/55 text-espresso/70'}`}>
          <p className="font-semibold">{isReadyBusiness ? 'Integrity attention required' : 'Profile will be created after onboarding'}</p>
          <p className="mt-1 leading-6">{isReadyBusiness ? 'This active, fully onboarded planning company has no PlannerProfile. The lifecycle integrity provisioner should create a private draft automatically.' : 'No public profile is expected yet. Complete account onboarding first; Wewed will then create the private draft automatically.'}</p>
          <p className="mt-2 text-xs text-espresso/50">Owner: {String(profile.ownerName ?? profile.ownerEmail ?? 'Not available')} · {String(profile.ownerEmail ?? '')}</p>
        </div> : <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div><p className="whitespace-pre-wrap text-sm leading-6 text-espresso/70">{String(profile.bio ?? 'Profile started; biography not supplied yet.')}</p><div className="mt-4 flex flex-wrap gap-2">{list(profile.services).map((value) => <span key={value} className="rounded-full bg-white/70 px-3 py-1 text-xs">{value}</span>)}</div><p className="mt-4 text-xs text-espresso/55">Areas: {list(profile.serviceAreas).join(', ') || 'Not supplied'} · Plan: {String(profile.subscriptionPlan ?? 'free')}</p></div><div><Textarea value={notes[profileId] ?? String(profile.reviewNotes ?? '')} onChange={(event) => setNotes((current) => ({ ...current, [profileId]: event.target.value }))} placeholder="Review notes shared with the planner" className="min-h-24 bg-white" /><div className="mt-3 flex flex-wrap gap-2">{status === 'submitted' && <><Button disabled={busy !== null} onClick={() => void review(profileId, 'published')} className="bg-espresso text-champagne"><ShieldCheck className="size-4" /> Publish</Button><Button disabled={busy !== null} variant="outline" onClick={() => void review(profileId, 'changes_requested')}>Request changes</Button><Button disabled={busy !== null} variant="ghost" onClick={() => void review(profileId, 'rejected')}>Reject</Button></>}{status === 'published' && <Button disabled={busy !== null} variant="destructive" onClick={() => void review(profileId, 'suspended')}>Suspend profile</Button>}{status === 'suspended' && <><Button disabled={busy !== null} onClick={() => void review(profileId, 'published')} className="bg-espresso text-champagne"><ShieldCheck className="size-4" /> Reinstate profile</Button><Button disabled={busy !== null} variant="outline" onClick={() => void review(profileId, 'changes_requested')}>Return for changes</Button></>}</div></div></div>}

        <div className="mt-6 border-t border-espresso/10 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-muted">Clients & weddings</p>
              <h3 className="wewed-heading mt-1 text-lg">Current planner workload</h3>
            </div>
            {relationshipSummary && <p className="text-xs text-espresso/50">{relationshipSummary.activeWeddings} active · {relationshipSummary.invitedWeddings} invited · {relationshipSummary.historicalWeddings} historical</p>}
          </div>
          {managedWeddings.length === 0 ? <p className="rounded-xl border border-dashed border-espresso/15 bg-white/40 px-4 py-5 text-sm text-espresso/55">No planner/coordinator wedding relationships are recorded for active members of this planning business.</p> : <div className="grid gap-3 lg:grid-cols-2">{managedWeddings.map((wedding) => <div key={wedding.weddingId} className="rounded-xl border border-espresso/10 bg-white/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-espresso">{wedding.coupleName || wedding.title || 'Wedding'}</p>
                <p className="mt-0.5 text-xs text-espresso/55">{wedding.title || 'Wedding'} · {dateLabel(wedding.date)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5"><StatusPill value={wedding.relationshipStatus} /><HealthPill health={wedding.health} /></div>
            </div>
            <p className="mt-2 text-xs text-espresso/45">{locationLabel(wedding) || 'Location not set'}</p>
            <div className="mt-3 space-y-1.5">{wedding.professionals.map((professional) => <div key={professional.membershipId} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-espresso/70">{professional.name || professional.email}</span><span className="rounded-full bg-espresso/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-espresso/55">{professional.role} · {professional.status}</span></div>)}</div>
            {wedding.health?.reasons?.length ? <p className="mt-3 text-xs leading-5 text-espresso/60">{wedding.health.reasons.slice(0, 2).join(' · ')}</p> : null}
          </div>)}</div>}
        </div>
      </CardContent></Card>
    })}</div>

    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-muted">Reverse relationship view</p>
          <h2 className="wewed-heading mt-1 text-2xl">Couples & planning teams</h2>
          <p className="mt-1 max-w-3xl text-sm text-espresso/55">Every wedding shows the planner/coordinator team recorded against it. Empty states are explicit so Admin can distinguish “no planner assigned” from missing UI data.</p>
        </div>
        <span className="text-xs text-espresso/45">{weddings.length} wedding{weddings.length === 1 ? '' : 's'}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{weddings.map((wedding) => <Card key={wedding.weddingId} className={`bg-champagne ${wedding.hasActivePlanner ? 'border-gold/20' : 'border-clay/30'}`}><CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-muted">{wedding.coupleName}</p>
            <h3 className="wewed-heading mt-1 text-xl">{wedding.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-espresso/50"><CalendarDays className="size-3.5" /> {dateLabel(wedding.date)} · {[wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(' · ')}</p>
          </div>
          <HealthPill health={wedding.health} />
        </div>
        {wedding.hasActivePlanner ? <div className="mt-4 space-y-2">{wedding.activePlanningTeam.map((member) => <div key={member.membershipId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-espresso/10 bg-white/60 px-3 py-2"><div><p className="text-sm font-medium text-espresso">{member.name || member.email}</p><p className="text-[11px] text-espresso/45">{member.businessName || 'Independent / business not linked'}</p></div><span className="rounded-full bg-sage/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sage-dark">{member.role} · active</span></div>)}</div> : <div className="mt-4 rounded-xl border border-clay/25 bg-clay/10 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-espresso"><AlertTriangle className="size-4 text-clay" /> No planner currently assigned</p>{wedding.invitedPlanningTeam.length > 0 && <p className="mt-1 text-xs text-espresso/55">{wedding.invitedPlanningTeam.length} planner/coordinator invitation{wedding.invitedPlanningTeam.length === 1 ? ' is' : 's are'} pending.</p>}</div>}
        {wedding.health?.reasons?.length ? <p className="mt-3 text-xs leading-5 text-espresso/55">Operational signal: {wedding.health.reasons.slice(0, 2).join(' · ')}</p> : null}
      </CardContent></Card>)}</div>
    </section>
  </MarketplaceFrame>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-gold/20 bg-champagne px-4 py-3"><p className="text-2xl font-semibold text-espresso">{value}</p><p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-espresso/50">{label}</p></div>
}

function DarkMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-gold/15 bg-champagne/[0.04] px-4 py-3"><p className="text-2xl font-semibold text-champagne">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-champagne/45">{label}</p></div>
}
