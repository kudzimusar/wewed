'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { marketplaceFetch } from '@/components/marketplace/marketplace-types'

const SERVICE_AREAS = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Victoria Falls', 'Zimbabwe nationwide', 'Southern Africa', 'Regional / destination']
const SERVICES = ['Full planning', 'Partial planning', 'Month-of coordination', 'Wedding-day coordination', 'Vendor sourcing', 'Budget management', 'Guest management', 'Styling & design', 'Destination planning', 'Consultation']

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function PlannerProfileQuickStart() {
  return <DashboardAuthGate
    allowedRoles={['planner']}
    wrongRoleMessage="Sign in with an active planner account."
    title="Get listed on Wewed"
    description="Create the essentials first. You can enrich your professional profile later."
    onClose={() => { window.location.href = '/planner' }}
  >
    <QuickStartContent />
  </DashboardAuthGate>
}

function QuickStartContent() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await marketplaceFetch<{ profile: Record<string, unknown> | null; business: { businessName: string } }>('/api/marketplace/profile')
      setProfile(payload.profile)
      setBusinessName(payload.business.businessName)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your planner profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save(event: FormEvent<HTMLFormElement>, submitForReview: boolean) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const serviceAreas = form.getAll('serviceAreas').map(String)
    const services = form.getAll('services').map(String)
    const bio = String(form.get('bio') || '').trim()

    if (!bio || serviceAreas.length === 0 || services.length === 0) {
      setError('Add a short biography, at least one service area, and at least one service before submitting.')
      return
    }

    setBusy(submitForReview ? 'submit' : 'save')
    setError(null)
    setNotice(null)
    try {
      const current = profile ?? {}
      const payload = {
        ...current,
        displayName: String(form.get('displayName') || businessName).trim(),
        headline: String(form.get('headline') || '').trim(),
        bio,
        serviceAreas,
        services,
        weddingStyles: arrayValue(current.weddingStyles),
        languages: arrayValue(current.languages),
        portfolio: arrayValue(current.portfolio),
        profileDetails: objectValue(current.profileDetails),
        packages: Array.isArray(current.packages) ? current.packages : [],
        faq: Array.isArray(current.faq) ? current.faq : [],
        priceBand: typeof current.priceBand === 'string' ? current.priceBand : 'contact',
        availabilityStatus: typeof current.availabilityStatus === 'string' ? current.availabilityStatus : 'accepting',
      }

      await marketplaceFetch('/api/marketplace/profile', { method: 'PUT', body: JSON.stringify(payload) })
      if (submitForReview) {
        await marketplaceFetch('/api/marketplace/profile/submit', { method: 'POST' })
        setNotice('Profile submitted. Wewed will review it before it becomes public.')
      } else {
        setNotice('Draft saved. You can return whenever you are ready.')
      }
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your planner profile.')
    } finally {
      setBusy(null)
    }
  }

  const status = String(profile?.status ?? 'draft')
  const lockedForReview = status === 'submitted'
  const published = status === 'published'
  const suspended = status === 'suspended'
  const selectedAreas = arrayValue(profile?.serviceAreas)
  const selectedServices = arrayValue(profile?.services)

  return <MarketplaceFrame
    title="Get listed"
    description="Start with the four details couples need to understand who you are. Everything else—packages, policies, portfolio depth and FAQs—can be added later."
    backHref="/planner"
    actions={<Button asChild size="sm" variant="outline"><a href="/planner/marketplace">Full profile editor <ArrowRight className="size-4" /></a></Button>}
  >
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div> : <>
      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-5 rounded-xl border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {['Public name', 'Short biography', 'Service area', 'Services offered'].map((label, index) => <div key={label} className="rounded-xl border border-gold/20 bg-champagne px-4 py-3"><div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-espresso text-xs text-champagne">{index + 1}</span><span className="text-xs font-medium text-espresso">{label}</span></div></div>)}
      </div>

      {(lockedForReview || published || suspended) && <Card className="mb-5 border-gold/20 bg-champagne"><CardContent className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-espresso">{published ? 'Your profile is live' : lockedForReview ? 'Your profile is with Wewed for review' : 'Your profile is suspended'}</p><p className="mt-1 text-sm text-espresso/60">{published ? 'Use the full editor whenever you want to enrich or update your listing.' : lockedForReview ? 'No more work is required unless Wewed requests changes.' : 'Open the full profile editor to review the current status and next steps.'}</p></div><StatusPill value={status} /></div></CardContent></Card>}

      {!lockedForReview && !suspended && <form key={String(profile?.id ?? 'quick-start')} onSubmit={(event) => void save(event, false)} className="space-y-5">
        <Card className="border-gold/20 bg-champagne"><CardContent className="space-y-5 p-6">
          <div><label className="text-sm font-medium text-espresso">Public planner name</label><Input name="displayName" required defaultValue={String(profile?.displayName ?? businessName)} className="mt-2 bg-white" /><p className="mt-1 text-xs text-espresso/50">Prefilled from your approved planning business. Change only if clients know you by a different trading name.</p></div>
          <div><label className="text-sm font-medium text-espresso">One-line headline <span className="font-normal text-espresso/45">optional</span></label><Input name="headline" defaultValue={String(profile?.headline ?? '')} placeholder="e.g. Calm, detail-led wedding planning across Zimbabwe" className="mt-2 bg-white" /></div>
          <div><label className="text-sm font-medium text-espresso">Short biography</label><Textarea name="bio" required defaultValue={String(profile?.bio ?? '')} placeholder="Tell couples what you plan, where you work and what they can expect from you. Two or three sentences is enough to start." className="mt-2 min-h-28 bg-white" /></div>
        </CardContent></Card>

        <Card className="border-gold/20 bg-champagne"><CardContent className="p-6"><fieldset><legend className="text-sm font-medium text-espresso">Where do you work?</legend><p className="mt-1 text-xs text-espresso/50">Choose at least one. You can add more later.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{SERVICE_AREAS.map((area) => <label key={area} className="flex items-center gap-2 rounded-lg border border-gold/15 bg-white/70 px-3 py-2 text-xs text-espresso"><input name="serviceAreas" type="checkbox" value={area} defaultChecked={selectedAreas.includes(area)} className="accent-[#BF9B5F]" />{area}</label>)}</div></fieldset></CardContent></Card>

        <Card className="border-gold/20 bg-champagne"><CardContent className="p-6"><fieldset><legend className="text-sm font-medium text-espresso">What do you help couples with?</legend><p className="mt-1 text-xs text-espresso/50">Choose the services you actively want enquiries for.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{SERVICES.map((service) => <label key={service} className="flex items-center gap-2 rounded-lg border border-gold/15 bg-white/70 px-3 py-2 text-xs text-espresso"><input name="services" type="checkbox" value={service} defaultChecked={selectedServices.includes(service)} className="accent-[#BF9B5F]" />{service}</label>)}</div></fieldset></CardContent></Card>

        <div className="flex flex-col gap-3 rounded-2xl border border-gold/20 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-espresso">That is enough to start.</p><p className="mt-1 text-xs text-espresso/50">Save and return later, or send these essentials to Wewed for review now.</p></div><div className="flex flex-wrap gap-2"><Button type="submit" variant="outline" disabled={busy !== null}><Save className="size-4" />{busy === 'save' ? 'Saving…' : 'Save draft'}</Button><Button type="button" disabled={busy !== null} className="bg-espresso text-champagne" onClick={(event) => { const form = event.currentTarget.closest('form'); if (form) void save({ currentTarget: form, preventDefault: () => undefined } as unknown as FormEvent<HTMLFormElement>, true) }}><CheckCircle2 className="size-4" />{busy === 'submit' ? 'Submitting…' : 'Save & submit for review'}</Button></div></div>
      </form>}
    </>}
  </MarketplaceFrame>
}
