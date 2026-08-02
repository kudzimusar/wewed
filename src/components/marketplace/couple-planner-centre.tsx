'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarPlus, Heart, RefreshCw, ShieldCheck, UserRoundSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { list, marketplaceFetch, type PlannerEngagement, type PlannerEnquiry, type PublicPlannerProfile } from '@/components/marketplace/marketplace-types'

const AUTHORITY = [
  ['consultation', 'Consultation', 'Read-only planner overview'],
  ['planning', 'Planning', 'Tasks, vendors, timeline, read-only budget/guests'],
  ['coordination', 'Coordination', 'Operational guest, vendor, timeline and seating edits'],
  ['full_coordination', 'Full coordination', 'Full planner operations except ownership and billing'],
] as const

export function CouplePlannerCentre() {
  return <DashboardAuthGate allowedRoles={['couple']} wrongRoleMessage="Sign in with the couple account that owns this wedding." title="Couple planner centre" description="Find, appoint and control a planner for your active wedding." onClose={() => { window.location.href = '/' }}><CouplePlannerCentreContent /></DashboardAuthGate>
}

function CouplePlannerCentreContent() {
  const [planners, setPlanners] = useState<PublicPlannerProfile[]>([])
  const [shortlist, setShortlist] = useState<PublicPlannerProfile[]>([])
  const [enquiries, setEnquiries] = useState<PlannerEnquiry[]>([])
  const [engagements, setEngagements] = useState<PlannerEngagement[]>([])
  const [selected, setSelected] = useState<string>('')
  const [services, setServices] = useState('Full planning')
  const [styles, setStyles] = useState('')
  const [guestMin, setGuestMin] = useState('')
  const [guestMax, setGuestMax] = useState('')
  const [budgetBand, setBudgetBand] = useState('not_sure')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [plannerPayload, enquiryPayload, engagementPayload, shortlistPayload] = await Promise.all([
        marketplaceFetch<{ planners: PublicPlannerProfile[] }>('/api/marketplace/planners'),
        marketplaceFetch<{ enquiries: PlannerEnquiry[] }>('/api/marketplace/enquiries'),
        marketplaceFetch<{ engagements: PlannerEngagement[] }>('/api/marketplace/engagements'),
        marketplaceFetch<{ planners: PublicPlannerProfile[] }>('/api/marketplace/shortlist'),
      ])
      setPlanners(plannerPayload.planners)
      setEnquiries(enquiryPayload.enquiries)
      setEngagements(engagementPayload.engagements)
      setShortlist(shortlistPayload.planners)
      const requested = new URLSearchParams(window.location.search).get('planner')
      setSelected((current) => current || (requested && plannerPayload.planners.some((planner) => planner.id === requested) ? requested : plannerPayload.planners[0]?.id || ''))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load planner centre.')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const activeEngagement = useMemo(() => engagements.find((item) => ['requested', 'planner_accepted', 'active', 'paused'].includes(item.status)), [engagements])

  async function run(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key); setError(null); setNotice(null)
    try { await operation(); setNotice(success); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Operation failed.') } finally { setBusy(null) }
  }

  async function submitEnquiry(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run('enquiry', () => marketplaceFetch('/api/marketplace/enquiries', { method: 'POST', body: JSON.stringify({ plannerProfileId: selected, services, weddingStyles: styles, guestCountMin: guestMin || null, guestCountMax: guestMax || null, budgetBand, message }) }), 'Your enquiry was sent without granting wedding access.')
    setMessage('')
  }

  function cancelPendingAppointment(engagementId: string) {
    return run('cancel-appointment', () => marketplaceFetch(`/api/marketplace/engagements/${engagementId}/action`, { method: 'POST', body: JSON.stringify({ action: 'revoke', reason: 'Appointment cancelled by couple before authority' }) }), 'Appointment cancelled without granting planner access.')
  }

  return <MarketplaceFrame title="Your planner centre" description="Search, enquire, appoint, authorize, pause or revoke. Your couple account remains the owner of the subscription, public wedding site and all wedding data." actions={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-lg border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}

    {activeEngagement && <Card className="mb-7 border-gold/30 bg-espresso text-champagne"><CardContent className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-gold">Current appointment</p><h2 className="wewed-heading mt-2 text-3xl">{activeEngagement.plannerDisplayName || 'Selected planner'}</h2><p className="mt-2 text-sm text-champagne/65">Authority is separate from the professional appointment and can be paused or revoked.</p></div><StatusPill value={activeEngagement.status} /></div>
      {activeEngagement.status === 'requested' && <Button className="mt-6" variant="outline" disabled={busy !== null} onClick={() => void cancelPendingAppointment(activeEngagement.id)}>Cancel appointment request</Button>}
      {activeEngagement.status === 'planner_accepted' && <><div className="mt-6 grid gap-3 sm:grid-cols-2">{AUTHORITY.map(([id, label, detail]) => <Button key={id} disabled={busy !== null} variant="outline" className="h-auto justify-start border-gold/30 p-4 text-left text-champagne hover:bg-gold/10 hover:text-gold" onClick={() => void run(`authorize-${id}`, () => marketplaceFetch(`/api/marketplace/engagements/${activeEngagement.id}/authorize`, { method: 'POST', body: JSON.stringify({ authorityBundle: id }) }), `${label} authority is active.`)}><span><strong className="block">{label}</strong><small className="mt-1 block whitespace-normal text-champagne/55">{detail}</small></span></Button>)}</div><Button className="mt-4" variant="ghost" disabled={busy !== null} onClick={() => void cancelPendingAppointment(activeEngagement.id)}>Cancel before granting authority</Button></>}
      {activeEngagement.status === 'active' && <div className="mt-6 flex flex-wrap gap-3"><Button variant="outline" disabled={busy !== null} onClick={() => void run('pause', () => marketplaceFetch(`/api/marketplace/engagements/${activeEngagement.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'pause', reason: 'Paused by couple' }) }), 'Planner authority is paused.')}>Pause authority</Button><Button variant="outline" disabled={busy !== null} onClick={() => void run('complete', () => marketplaceFetch(`/api/marketplace/engagements/${activeEngagement.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'complete', reason: 'Planning engagement completed by couple' }) }), 'Planner engagement is complete and operational access is closed.')}>Complete engagement</Button><Button variant="destructive" disabled={busy !== null} onClick={() => void run('revoke', () => marketplaceFetch(`/api/marketplace/engagements/${activeEngagement.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'revoke', reason: 'Revoked by couple' }) }), 'Planner authority is revoked.')}>Revoke authority</Button></div>}
      {activeEngagement.status === 'paused' && <Button className="mt-6 bg-gold text-espresso" disabled={busy !== null} onClick={() => void run('resume', () => marketplaceFetch(`/api/marketplace/engagements/${activeEngagement.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'resume' }) }), 'Planner authority is active again.')}>Resume authority</Button>}
    </CardContent></Card>}

    <div className="grid gap-7 xl:grid-cols-[1.1fr_0.9fr]">
      <section><div className="mb-4 flex items-center justify-between"><h2 className="wewed-heading text-2xl">Published planners</h2><Link href="/planners" className="text-xs font-semibold text-gold-muted underline">Public directory</Link></div>
        <div className="space-y-4">{planners.map((planner) => <Card key={planner.id} className={`border-gold/20 bg-champagne ${selected === planner.id ? 'ring-2 ring-gold/40' : ''}`}><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="wewed-heading text-xl">{planner.displayName}</h3><p className="mt-1 text-sm text-espresso/60">{planner.headline}</p></div><StatusPill value={planner.availabilityStatus} /></div><p className="mt-3 text-xs text-espresso/60">{planner.serviceAreas.join(', ') || 'Service area by consultation'}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => setSelected(planner.id)} className="bg-espresso text-champagne">Enquire</Button><Button size="sm" variant="outline" asChild><Link href={`/planners/${planner.slug}`}>View profile</Link></Button><Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void (shortlist.some((item) => item.id === planner.id) ? run(`unshortlist-${planner.id}`, () => marketplaceFetch(`/api/marketplace/shortlist?plannerProfileId=${encodeURIComponent(planner.id)}`, { method: 'DELETE' }), 'Planner removed from your shortlist.') : run(`shortlist-${planner.id}`, () => marketplaceFetch('/api/marketplace/shortlist', { method: 'POST', body: JSON.stringify({ plannerProfileId: planner.id }) }), 'Planner saved to your shortlist.'))}><Heart className="size-4" /> {shortlist.some((item) => item.id === planner.id) ? 'Remove saved' : 'Save'}</Button></div></CardContent></Card>)}</div>
      </section>

      <section className="space-y-6">
        <Card className="border-gold/20 bg-white"><CardContent className="p-6"><h2 className="flex items-center gap-2 font-semibold"><UserRoundSearch className="size-5 text-gold-muted" /> Structured enquiry</h2><p className="mt-2 text-xs text-espresso/55">Only the summary below is shared. No guest list, budget records, documents or private wedding content is exposed.</p><form className="mt-5 space-y-4" onSubmit={submitEnquiry}>
          <select aria-label="Planner" value={selected} onChange={(event) => setSelected(event.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm">{planners.map((planner) => <option key={planner.id} value={planner.id}>{planner.displayName}</option>)}</select>
          <Input value={services} onChange={(event) => setServices(event.target.value)} placeholder="Services, comma separated" required />
          <Input value={styles} onChange={(event) => setStyles(event.target.value)} placeholder="Wedding styles, comma separated" />
          <div className="grid grid-cols-2 gap-3"><Input type="number" min="0" value={guestMin} onChange={(event) => setGuestMin(event.target.value)} placeholder="Min guests" /><Input type="number" min="0" value={guestMax} onChange={(event) => setGuestMax(event.target.value)} placeholder="Max guests" /></div>
          <select aria-label="Budget band" value={budgetBand} onChange={(event) => setBudgetBand(event.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="not_sure">Budget not decided</option><option value="under_10k">Under $10k</option><option value="10k_25k">$10k–$25k</option><option value="25k_50k">$25k–$50k</option><option value="50k_100k">$50k–$100k</option><option value="over_100k">Over $100k</option></select>
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Requirements and questions" />
          <Button disabled={!selected || busy !== null} className="w-full bg-espresso text-champagne"><CalendarPlus className="size-4" /> Send enquiry</Button>
        </form></CardContent></Card>

        <Card className="border-gold/20 bg-champagne"><CardContent className="p-6"><h2 className="font-semibold">Enquiries and appointment</h2><div className="mt-4 space-y-4">{enquiries.length === 0 && <p className="text-sm text-espresso/55">No enquiries yet.</p>}{enquiries.map((enquiry) => <div key={enquiry.id} className="rounded-xl border border-gold/15 bg-white/60 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{enquiry.plannerDisplayName}</p><p className="mt-1 text-xs text-espresso/55">{list(enquiry.services).join(', ')}</p></div><StatusPill value={enquiry.status} /></div>{enquiry.plannerResponse && <p className="mt-3 rounded-lg bg-sage/10 p-3 text-sm">{enquiry.plannerResponse}</p>}<div className="mt-3 flex flex-wrap gap-2">{enquiry.status === 'accepted_interest' && !engagements.some((item) => ['requested', 'planner_accepted', 'active', 'paused'].includes(item.status)) && <Button size="sm" disabled={busy !== null} onClick={() => void run(`appoint-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}/appoint`, { method: 'POST' }), 'Appointment request sent to the planner.')}>Request appointment</Button>}{!['appointed', 'withdrawn', 'closed'].includes(enquiry.status) && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`withdraw-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) }), 'Enquiry withdrawn.')}>Withdraw</Button>}</div></div>)}</div></CardContent></Card>

        <Card className="border-gold/20"><CardContent className="p-6"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-gold-muted" /> Authority safeguards</h2><ul className="mt-3 space-y-2 text-sm text-espresso/65"><li>• Enquiries never create access.</li><li>• Planner acceptance is required.</li><li>• Only the couple owner selects authority.</li><li>• Billing, ownership and deletion remain unavailable to planners.</li></ul></CardContent></Card>
      </section>
    </div>
  </MarketplaceFrame>
}
