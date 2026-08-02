'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, RefreshCw, Send, UserRoundCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { list, marketplaceFetch, type PlannerEngagement, type PlannerEnquiry } from '@/components/marketplace/marketplace-types'

export function PlannerMarketplaceCentre() {
  return <DashboardAuthGate allowedRoles={['planner']} wrongRoleMessage="Sign in with an active planner account." title="Planner marketplace" description="Manage your public profile, enquiries and secure appointment requests." onClose={() => { window.location.href = '/planner' }}><PlannerContent /></DashboardAuthGate>
}

function PlannerContent() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [enquiries, setEnquiries] = useState<PlannerEnquiry[]>([])
  const [engagements, setEngagements] = useState<PlannerEngagement[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [responseById, setResponseById] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [profilePayload, enquiryPayload, engagementPayload] = await Promise.all([
        marketplaceFetch<{ profile: Record<string, unknown> | null; business: { businessName: string } }>('/api/marketplace/profile'),
        marketplaceFetch<{ enquiries: PlannerEnquiry[] }>('/api/marketplace/enquiries'),
        marketplaceFetch<{ engagements: PlannerEngagement[] }>('/api/marketplace/engagements'),
      ])
      setProfile(profilePayload.profile); setBusinessName(profilePayload.business.businessName); setEnquiries(enquiryPayload.enquiries); setEngagements(engagementPayload.engagements)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load planner marketplace.') }
  }, [])
  useEffect(() => { void load() }, [load])

  async function run(key: string, operation: () => Promise<unknown>, success: string) { setBusy(key); setError(null); setNotice(null); try { await operation(); setNotice(success); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Operation failed.') } finally { setBusy(null) } }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload = Object.fromEntries(data.entries())
    await run('profile', () => marketplaceFetch('/api/marketplace/profile', { method: 'PUT', body: JSON.stringify(payload) }), 'Profile saved as a draft. Submit it when ready.')
  }

  return <MarketplaceFrame title="Planner marketplace centre" description="Your profile is linked to your existing planning business account. Publishing does not expose client lists, operational records or private availability details." backHref="/planner" actions={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-lg border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}
    <div className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-gold/20 bg-champagne"><CardContent className="p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><UserRoundCog className="size-5 text-gold-muted" /> Professional profile</h2><p className="mt-1 text-xs text-espresso/55">Business: {businessName}</p></div>{profile?.status && <StatusPill value={String(profile.status)} />}</div>
        <form className="mt-5 space-y-4" onSubmit={saveProfile}>
          <Input name="displayName" defaultValue={String(profile?.displayName ?? businessName)} placeholder="Public planner name" required />
          <Input name="slug" defaultValue={String(profile?.slug ?? '')} placeholder="Public profile URL slug" />
          <Input name="headline" defaultValue={String(profile?.headline ?? '')} placeholder="Professional headline" />
          <Textarea name="bio" defaultValue={String(profile?.bio ?? '')} placeholder="Experience, approach and what makes your service distinct" className="min-h-32" />
          <Input name="yearsExperience" type="number" min="0" max="80" defaultValue={profile?.yearsExperience == null ? '' : String(profile.yearsExperience)} placeholder="Years of experience" />
          <Input name="serviceAreas" defaultValue={list(profile?.serviceAreas).join(', ')} placeholder="Service areas, comma separated" />
          <Input name="services" defaultValue={list(profile?.services).join(', ')} placeholder="Services, comma separated" required />
          <Input name="weddingStyles" defaultValue={list(profile?.weddingStyles).join(', ')} placeholder="Wedding styles, comma separated" />
          <Input name="languages" defaultValue={list(profile?.languages).join(', ')} placeholder="Languages, comma separated" />
          <div className="grid grid-cols-2 gap-3"><Input name="minimumGuestCount" type="number" min="0" defaultValue={profile?.minimumGuestCount == null ? '' : String(profile.minimumGuestCount)} placeholder="Min guests" /><Input name="maximumGuestCount" type="number" min="0" defaultValue={profile?.maximumGuestCount == null ? '' : String(profile.maximumGuestCount)} placeholder="Max guests" /></div>
          <select name="priceBand" defaultValue={String(profile?.priceBand ?? 'contact')} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="contact">Contact for pricing</option><option value="budget">Budget</option><option value="standard">Standard</option><option value="premium">Premium</option><option value="luxury">Luxury</option></select>
          <select name="availabilityStatus" defaultValue={String(profile?.availabilityStatus ?? 'accepting')} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="accepting">Accepting enquiries</option><option value="limited">Limited availability</option><option value="unavailable">Unavailable</option></select>
          <Input name="portfolio" defaultValue={list(profile?.portfolio).join(', ')} placeholder="Portfolio URLs, comma separated" />
          <Button disabled={busy !== null} className="w-full bg-espresso text-champagne">Save profile draft</Button>
        </form>
        {profile && !['submitted', 'published', 'suspended'].includes(String(profile.status)) && <Button variant="outline" disabled={busy !== null} className="mt-3 w-full" onClick={() => void run('submit-profile', () => marketplaceFetch('/api/marketplace/profile/submit', { method: 'POST' }), 'Profile submitted for Wewed review.')}><Send className="size-4" /> Submit for review</Button>}
      </CardContent></Card>

      <div className="space-y-7">
        <Card className="border-gold/20"><CardContent className="p-6"><h2 className="font-semibold">Enquiry inbox</h2><div className="mt-4 space-y-4">{enquiries.length === 0 && <p className="text-sm text-espresso/55">No enquiries yet.</p>}{enquiries.map((enquiry) => <article key={enquiry.id} className="rounded-xl border border-gold/15 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{enquiry.weddingTitle}</h3><p className="mt-1 text-xs text-espresso/55">{enquiry.location} · {new Date(enquiry.weddingDate).toLocaleDateString()}</p></div><StatusPill value={enquiry.status} /></div><p className="mt-3 text-sm">Services: {list(enquiry.services).join(', ')}</p>{enquiry.message && <p className="mt-3 rounded-lg bg-champagne p-3 text-sm">{enquiry.message}</p>}
          {!['declined', 'appointed', 'withdrawn', 'closed'].includes(enquiry.status) && <div className="mt-4 space-y-3"><Textarea value={responseById[enquiry.id] ?? enquiry.plannerResponse ?? ''} onChange={(event) => setResponseById((current) => ({ ...current, [enquiry.id]: event.target.value }))} placeholder="Reply to the couple" /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy !== null} onClick={() => void run(`accept-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted_interest', response: responseById[enquiry.id] }) }), 'Interest accepted. The couple may now request an appointment.')}><CheckCircle2 className="size-4" /> Accept interest</Button><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`respond-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'responded', response: responseById[enquiry.id] }) }), 'Response sent.')}>Respond</Button><Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`decline-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'declined', response: responseById[enquiry.id] }) }), 'Enquiry declined.')}>Decline</Button></div></div>}
        </article>)}</div></CardContent></Card>

        <Card className="border-gold/20 bg-espresso text-champagne"><CardContent className="p-6"><h2 className="font-semibold text-gold">Appointment requests</h2><div className="mt-4 space-y-4">{engagements.length === 0 && <p className="text-sm text-champagne/55">No appointment requests.</p>}{engagements.map((engagement) => <article key={engagement.id} className="rounded-xl border border-gold/20 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{engagement.weddingTitle}</h3><p className="mt-1 text-xs text-champagne/55">Appointment and authority are separate.</p></div><StatusPill value={engagement.status} /></div>{engagement.status === 'requested' && <Button className="mt-4 bg-gold text-espresso" disabled={busy !== null} onClick={() => void run(`appointment-${engagement.id}`, () => marketplaceFetch(`/api/marketplace/engagements/${engagement.id}/accept`, { method: 'POST' }), 'Appointment accepted. Waiting for the couple to grant authority.')}>Accept appointment</Button>}{engagement.status === 'active' && <p className="mt-3 text-sm text-champagne/70">Authority: {engagement.authorityBundle?.replaceAll('_', ' ')}. Open the existing planner workspace to manage this wedding.</p>}</article>)}</div></CardContent></Card>
      </div>
    </div>
  </MarketplaceFrame>
}
