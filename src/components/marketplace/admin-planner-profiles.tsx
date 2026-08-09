'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
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
}

const EMPTY_METRICS: PlannerProfileMetrics = {
  planningBusinesses: 0,
  activeCompleteBusinesses: 0,
  profilesNotStarted: 0,
  draftProfiles: 0,
  submittedProfiles: 0,
  publishedProfiles: 0,
}

export function AdminPlannerProfiles() {
  return <DashboardAuthGate allowedRoles={['admin']} wrongRoleMessage="This review area is restricted to Wewed platform administrators." title="Planner profile review" description="Review public marketplace profiles without entering any wedding workspace." onClose={() => { window.location.href = '/admin' }}><AdminPlannerProfileContent /></DashboardAuthGate>
}

function AdminPlannerProfileContent() {
  const [profiles, setProfiles] = useState<Array<Record<string, unknown>>>([])
  const [metrics, setMetrics] = useState<PlannerProfileMetrics>(EMPTY_METRICS)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const payload = await marketplaceFetch<{ profiles: Array<Record<string, unknown>>; metrics: PlannerProfileMetrics }>('/api/admin/planner-profiles')
      setProfiles(payload.profiles)
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

  return <MarketplaceFrame title="Planner profile governance" description="One lifecycle view for every planning company. Draft and incomplete profiles stay private; only approved published profiles reach public discovery." backHref="/admin" actions={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-lg border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}

    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Metric label="Planning businesses" value={metrics.planningBusinesses} />
      <Metric label="Active + onboarded" value={metrics.activeCompleteBusinesses} />
      <Metric label="Profile not started" value={metrics.profilesNotStarted} />
      <Metric label="Draft" value={metrics.draftProfiles} />
      <Metric label="Awaiting review" value={metrics.submittedProfiles} />
      <Metric label="Published" value={metrics.publishedProfiles} />
    </div>

    <div className="space-y-5">{profiles.length === 0 && <p className="rounded-2xl border border-dashed border-gold/30 p-12 text-center">No planning businesses are registered yet.</p>}{profiles.map((profile) => {
      const profileId = typeof profile.id === 'string' ? profile.id : ''
      const businessAccountId = String(profile.businessAccountId ?? '')
      const key = profileId || businessAccountId
      const status = String(profile.profileState ?? profile.status ?? 'not_started')
      const businessStatus = String(profile.businessStatus ?? 'unknown')
      const onboardingStatus = String(profile.onboardingStatus ?? 'unknown')
      const isMissing = !profileId
      const isReadyBusiness = businessStatus === 'active' && onboardingStatus === 'complete'
      return <Card key={key} className="border-gold/20 bg-champagne"><CardContent className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-gold-muted">{String(profile.businessName ?? 'Planning business')}</p><h2 className="wewed-heading mt-1 text-2xl">{String(profile.displayName ?? profile.businessName ?? 'Planner')}</h2><p className="mt-1 text-sm text-espresso/60">{String(profile.headline ?? '')}</p><p className="mt-2 text-xs text-espresso/50">Account: {businessStatus.replaceAll('_', ' ')} · Onboarding: {onboardingStatus.replaceAll('_', ' ')}</p></div><StatusPill value={status} /></div>

        {isMissing ? <div className={`mt-5 rounded-xl border p-4 text-sm ${isReadyBusiness ? 'border-clay/25 bg-clay/10 text-espresso' : 'border-gold/20 bg-white/55 text-espresso/70'}`}>
          <p className="font-semibold">{isReadyBusiness ? 'Integrity attention required' : 'Profile will be created after onboarding'}</p>
          <p className="mt-1 leading-6">{isReadyBusiness ? 'This active, fully onboarded planning company has no PlannerProfile. The lifecycle integrity provisioner should create a private draft automatically.' : 'No public profile is expected yet. Complete account onboarding first; Wewed will then create the private draft automatically.'}</p>
          <p className="mt-2 text-xs text-espresso/50">Owner: {String(profile.ownerName ?? profile.ownerEmail ?? 'Not available')} · {String(profile.ownerEmail ?? '')}</p>
        </div> : <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div><p className="whitespace-pre-wrap text-sm leading-6 text-espresso/70">{String(profile.bio ?? 'Profile started; biography not supplied yet.')}</p><div className="mt-4 flex flex-wrap gap-2">{list(profile.services).map((value) => <span key={value} className="rounded-full bg-white/70 px-3 py-1 text-xs">{value}</span>)}</div><p className="mt-4 text-xs text-espresso/55">Areas: {list(profile.serviceAreas).join(', ') || 'Not supplied'} · Plan: {String(profile.subscriptionPlan ?? 'free')}</p></div><div><Textarea value={notes[profileId] ?? String(profile.reviewNotes ?? '')} onChange={(event) => setNotes((current) => ({ ...current, [profileId]: event.target.value }))} placeholder="Review notes shared with the planner" className="min-h-24 bg-white" /><div className="mt-3 flex flex-wrap gap-2">{status === 'submitted' && <><Button disabled={busy !== null} onClick={() => void review(profileId, 'published')} className="bg-espresso text-champagne"><ShieldCheck className="size-4" /> Publish</Button><Button disabled={busy !== null} variant="outline" onClick={() => void review(profileId, 'changes_requested')}>Request changes</Button><Button disabled={busy !== null} variant="ghost" onClick={() => void review(profileId, 'rejected')}>Reject</Button></>}{status === 'published' && <Button disabled={busy !== null} variant="destructive" onClick={() => void review(profileId, 'suspended')}>Suspend profile</Button>}{status === 'suspended' && <><Button disabled={busy !== null} onClick={() => void review(profileId, 'published')} className="bg-espresso text-champagne"><ShieldCheck className="size-4" /> Reinstate profile</Button><Button disabled={busy !== null} variant="outline" onClick={() => void review(profileId, 'changes_requested')}>Return for changes</Button></>}</div></div></div>}
      </CardContent></Card>
    })}</div>
  </MarketplaceFrame>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-gold/20 bg-champagne px-4 py-3"><p className="text-2xl font-semibold text-espresso">{value}</p><p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-espresso/50">{label}</p></div>
}
