'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Plus, RefreshCw, Send, Trash2, UserRoundCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { list, record, marketplaceFetch, type PlannerEngagement, type PlannerEnquiry, type PlannerFaq, type PlannerPackage } from '@/components/marketplace/marketplace-types'

const SERVICE_AREAS = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Victoria Falls', 'Zimbabwe nationwide', 'Southern Africa', 'Regional / destination']
const SERVICES = ['Full planning', 'Partial planning', 'Month-of coordination', 'Wedding-day coordination', 'Vendor sourcing', 'Budget management', 'Guest management', 'Styling & design', 'Destination planning', 'Consultation']
const WEDDING_STYLES = ['Modern', 'Classic', 'Romantic', 'Luxury', 'Garden', 'Traditional', 'Minimalist', 'Destination', 'Cultural', 'Rustic', 'Editorial', 'Bohemian']
const LANGUAGES = ['English', 'Shona', 'Ndebele', 'French', 'Portuguese', 'Afrikaans', 'Other']
const GUEST_COUNTS = ['', '25', '50', '75', '100', '150', '200', '250', '300', '400', '500', '750', '1000', '1500', '2000']
const SUPPORTED_BUDGETS = ['Under USD 5,000', 'USD 5,000–15,000', 'USD 15,000–30,000', 'USD 30,000–75,000', 'USD 75,000+', 'By consultation']
const RESPONSE_TIMES = ['', 'Within 2 hours', 'Within 4 hours', 'Same business day', 'Within 24 hours', 'Within 48 hours', 'By appointment']
const BOOKING_NOTICE = ['', '1–2 weeks', '1 month', '2–3 months', '4–6 months', '6–12 months', '12+ months', 'Depends on service']
const FEE_MODELS = ['', 'Fixed package', 'Percentage of wedding budget', 'Hourly / consultation', 'Custom proposal']
const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm text-espresso placeholder:text-espresso/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20'
const textareaClass = 'mt-1.5 min-h-24 w-full rounded-xl border border-gold/25 bg-white px-3 py-2 text-sm text-espresso placeholder:text-espresso/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20'

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

function plannerPackages(value: unknown): PlannerPackage[] {
  return parseArray(value).map((item) => {
    const row = record(item)
    return {
      name: typeof row.name === 'string' ? row.name : '',
      description: typeof row.description === 'string' ? row.description : null,
      startingPrice: typeof row.startingPrice === 'number' ? row.startingPrice : null,
      currency: typeof row.currency === 'string' ? row.currency : 'USD',
      pricingUnit: typeof row.pricingUnit === 'string' ? row.pricingUnit : null,
      inclusions: list(row.inclusions),
    }
  }).filter((item) => item.name)
}

function plannerFaq(value: unknown): PlannerFaq[] {
  return parseArray(value).map((item) => {
    const row = record(item)
    return { question: typeof row.question === 'string' ? row.question : '', answer: typeof row.answer === 'string' ? row.answer : '' }
  }).filter((item) => item.question || item.answer)
}

export function PlannerMarketplaceCentre() {
  return (
    <DashboardAuthGate
      allowedRoles={['planner']}
      wrongRoleMessage="Sign in with an active planner account."
      title="Planner marketplace"
      description="Manage your public profile, enquiries and secure appointment requests."
      onClose={() => { window.location.href = '/planner' }}
    >
      <PlannerContent />
    </DashboardAuthGate>
  )
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
  const [packages, setPackages] = useState<PlannerPackage[]>([])
  const [faq, setFaq] = useState<PlannerFaq[]>([])
  const [details, setDetails] = useState<Record<string, unknown>>({})

  const selectedServiceAreas = useMemo(() => list(profile?.serviceAreas), [profile])
  const selectedServices = useMemo(() => list(profile?.services), [profile])
  const selectedStyles = useMemo(() => list(profile?.weddingStyles), [profile])
  const selectedLanguages = useMemo(() => list(profile?.languages), [profile])
  const selectedBudgets = useMemo(() => list(details.supportedBudgets), [details])

  const load = useCallback(async () => {
    try {
      const [profilePayload, enquiryPayload, engagementPayload] = await Promise.all([
        marketplaceFetch<{ profile: Record<string, unknown> | null; business: { businessName: string } }>('/api/marketplace/profile'),
        marketplaceFetch<{ enquiries: PlannerEnquiry[] }>('/api/marketplace/enquiries'),
        marketplaceFetch<{ engagements: PlannerEngagement[] }>('/api/marketplace/engagements'),
      ])
      setProfile(profilePayload.profile)
      setBusinessName(profilePayload.business.businessName)
      setEnquiries(enquiryPayload.enquiries)
      setEngagements(engagementPayload.engagements)
      setPackages(plannerPackages(profilePayload.profile?.packages))
      setFaq(plannerFaq(profilePayload.profile?.faq))
      setDetails(record(profilePayload.profile?.profileDetails))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load planner marketplace.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function run(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await operation()
      setNotice(success)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Operation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload = {
      ...Object.fromEntries(data.entries()),
      serviceAreas: data.getAll('serviceAreas'),
      services: data.getAll('services'),
      weddingStyles: data.getAll('weddingStyles'),
      languages: data.getAll('languages'),
      portfolio: String(data.get('portfolio') || '').split(',').map((entry) => entry.trim()).filter(Boolean),
      profileDetails: details,
      packages,
      faq,
    }
    await run('profile', () => marketplaceFetch('/api/marketplace/profile', { method: 'PUT', body: JSON.stringify(payload) }), 'Profile saved as a draft. Submit it when ready.')
  }

  return (
    <MarketplaceFrame
      title="Planner marketplace centre"
      description="Build a useful public profile, then manage secure enquiries and appointment requests. Private client lists and operational wedding data remain separate."
      backHref="/planner"
      actions={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}
    >
      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-lg border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}
      <div className="grid gap-7 xl:grid-cols-[1fr_1fr]">
        <Card className="border-gold/20 bg-champagne">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><UserRoundCog className="size-5 text-gold-muted" /> Professional profile</h2><p className="mt-1 text-xs text-espresso/55">Business: {businessName}</p></div>{profile?.status && <StatusPill value={String(profile.status)} />}</div>

            <form key={String(profile?.id ?? 'new-profile')} className="mt-5 space-y-6" onSubmit={saveProfile}>
              <FormSection title="Public identity" description="Only populated and approved information is shown publicly.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Public planner name"><Input name="displayName" defaultValue={String(profile?.displayName ?? businessName)} placeholder="Public planner name" required className={inputClass} /></Field>
                  <Field label="Public profile URL"><Input name="slug" defaultValue={String(profile?.slug ?? '')} placeholder="public-profile-slug" className={inputClass} /></Field>
                  <Field label="Professional headline" wide><Input name="headline" defaultValue={String(profile?.headline ?? '')} placeholder="A concise description of your planning service" className={inputClass} /></Field>
                  <Field label="Biography" wide><Textarea name="bio" defaultValue={String(profile?.bio ?? '')} placeholder="Experience, approach and what makes your service distinct" className={`${textareaClass} min-h-32`} /></Field>
                  <Field label="Years of experience"><Input name="yearsExperience" type="number" min="0" max="80" defaultValue={profile?.yearsExperience == null ? '' : String(profile.yearsExperience)} className={inputClass} /></Field>
                  <Field label="Weddings completed"><Input name="completedWeddings" type="number" min="0" max="100000" defaultValue={profile?.completedWeddings == null ? '' : String(profile.completedWeddings)} className={inputClass} /></Field>
                  <Field label="Team size"><Input name="teamSize" type="number" min="1" max="10000" defaultValue={profile?.teamSize == null ? '' : String(profile.teamSize)} className={inputClass} /></Field>
                  <Field label="Portfolio links" wide><Input name="portfolio" defaultValue={list(profile?.portfolio).join(', ')} placeholder="HTTPS portfolio URLs, comma separated" className={inputClass} /></Field>
                </div>
              </FormSection>

              <FormSection title="Services and fit" description="Structured choices improve marketplace matching and prevent inconsistent free-text values.">
                <CheckboxGroup name="serviceAreas" label="Service areas" options={SERVICE_AREAS} selected={selectedServiceAreas} />
                <CheckboxGroup name="services" label="Services offered" options={SERVICES} selected={selectedServices} required />
                <CheckboxGroup name="weddingStyles" label="Wedding styles" options={WEDDING_STYLES} selected={selectedStyles} />
                <CheckboxGroup name="languages" label="Languages" options={LANGUAGES} selected={selectedLanguages} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select name="minimumGuestCount" label="Minimum guest count" value={profile?.minimumGuestCount == null ? '' : String(profile.minimumGuestCount)} options={GUEST_COUNTS.map((entry) => ({ value: entry, label: entry || 'No minimum' }))} />
                  <Select name="maximumGuestCount" label="Maximum guest count" value={profile?.maximumGuestCount == null ? '' : String(profile.maximumGuestCount)} options={GUEST_COUNTS.map((entry) => ({ value: entry, label: entry || 'No maximum' }))} />
                  <Select name="priceBand" label="Price band" value={String(profile?.priceBand ?? 'contact')} options={[{ value: 'contact', label: 'Contact for pricing' }, { value: 'budget', label: 'Budget' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'luxury', label: 'Luxury' }]} />
                  <Select name="availabilityStatus" label="Availability" value={String(profile?.availabilityStatus ?? 'accepting')} options={[{ value: 'accepting', label: 'Accepting enquiries' }, { value: 'limited', label: 'Limited availability' }, { value: 'unavailable', label: 'Unavailable' }]} />
                </div>
              </FormSection>

              <FormSection title="How you work" description="These details help couples understand fit before sending an enquiry.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ControlledSelect label="Typical response time" value={String(details.responseTime ?? '')} options={RESPONSE_TIMES} onChange={(value) => setDetails({ ...details, responseTime: value })} />
                  <ControlledSelect label="Recommended booking notice" value={String(details.bookingNotice ?? '')} options={BOOKING_NOTICE} onChange={(value) => setDetails({ ...details, bookingNotice: value })} />
                  <ControlledSelect label="Fee model" value={String(details.feeModel ?? '')} options={FEE_MODELS} onChange={(value) => setDetails({ ...details, feeModel: value })} />
                  <label className="flex items-center gap-2 self-end rounded-xl border border-gold/20 bg-white px-3 py-3 text-xs"><input type="checkbox" checked={details.referencesAvailable === true} onChange={(event) => setDetails({ ...details, referencesAvailable: event.target.checked })} className="accent-[#BF9B5F]" />Client references available</label>
                  <Field label="Consultation process" wide><Textarea value={String(details.consultationProcess ?? '')} onChange={(event) => setDetails({ ...details, consultationProcess: event.target.value })} className={textareaClass} /></Field>
                  <Field label="Team structure" wide><Textarea value={String(details.teamStructure ?? '')} onChange={(event) => setDetails({ ...details, teamStructure: event.target.value })} className={textareaClass} /></Field>
                  <ControlledChecks label="Supported wedding budgets" options={SUPPORTED_BUDGETS} selected={selectedBudgets} onChange={(values) => setDetails({ ...details, supportedBudgets: values })} />
                  <Field label="Accessibility support" wide><Textarea value={String(details.accessibilitySupport ?? '')} onChange={(event) => setDetails({ ...details, accessibilitySupport: event.target.value })} className={textareaClass} /></Field>
                  <Field label="Cultural, traditional and religious wedding experience" wide><Textarea value={String(details.culturalExperience ?? '')} onChange={(event) => setDetails({ ...details, culturalExperience: event.target.value })} className={textareaClass} /></Field>
                </div>
              </FormSection>

              <FormSection title="Booking policies" description="Clear policies reduce unsuitable enquiries and repeated questions.">
                <div className="grid gap-4">
                  <Field label="Deposit policy"><Textarea value={String(details.depositPolicy ?? '')} onChange={(event) => setDetails({ ...details, depositPolicy: event.target.value })} className={textareaClass} /></Field>
                  <Field label="Cancellation policy"><Textarea value={String(details.cancellationPolicy ?? '')} onChange={(event) => setDetails({ ...details, cancellationPolicy: event.target.value })} className={textareaClass} /></Field>
                  <Field label="Travel policy"><Textarea value={String(details.travelPolicy ?? '')} onChange={(event) => setDetails({ ...details, travelPolicy: event.target.value })} className={textareaClass} /></Field>
                </div>
              </FormSection>

              <PackageEditor value={packages} onChange={setPackages} />
              <FaqEditor value={faq} onChange={setFaq} />
              <Button disabled={busy !== null} className="w-full bg-espresso text-champagne">Save profile draft</Button>
            </form>

            {profile && !['submitted', 'published', 'suspended'].includes(String(profile.status)) && <Button variant="outline" disabled={busy !== null} className="mt-3 w-full" onClick={() => void run('submit-profile', () => marketplaceFetch('/api/marketplace/profile/submit', { method: 'POST' }), 'Profile submitted for Wewed review.')}><Send className="size-4" /> Submit for review</Button>}
          </CardContent>
        </Card>

        <div className="space-y-7">
          <Card className="border-gold/20 bg-white"><CardContent className="p-6"><h2 className="font-semibold text-espresso">Enquiry inbox</h2><div className="mt-4 space-y-4">{enquiries.length === 0 && <p className="text-sm text-espresso/60">No enquiries yet.</p>}{enquiries.map((enquiry) => <article key={enquiry.id} className="rounded-xl border border-gold/15 bg-ivory p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-espresso">{enquiry.weddingTitle}</h3><p className="mt-1 text-xs text-espresso/60">{enquiry.location} · {new Date(enquiry.weddingDate).toLocaleDateString()}</p></div><StatusPill value={enquiry.status} /></div><p className="mt-3 text-sm text-espresso">Services: {list(enquiry.services).join(', ')}</p>{enquiry.message && <p className="mt-3 rounded-lg bg-white p-3 text-sm text-espresso">{enquiry.message}</p>}{!['declined', 'appointed', 'withdrawn', 'closed'].includes(enquiry.status) && <div className="mt-4 space-y-3"><Textarea value={responseById[enquiry.id] ?? enquiry.plannerResponse ?? ''} onChange={(event) => setResponseById((current) => ({ ...current, [enquiry.id]: event.target.value }))} placeholder="Reply to the couple" className="bg-white text-espresso placeholder:text-espresso/40" /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy !== null} onClick={() => void run(`accept-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted_interest', response: responseById[enquiry.id] }) }), 'Interest accepted. The couple may now request an appointment.')}><CheckCircle2 className="size-4" /> Accept interest</Button><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`respond-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'responded', response: responseById[enquiry.id] }) }), 'Response sent.')}>Respond</Button><Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`decline-${enquiry.id}`, () => marketplaceFetch(`/api/marketplace/enquiries/${enquiry.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'declined', response: responseById[enquiry.id] }) }), 'Enquiry declined.')}>Decline</Button></div></div>}</article>)}</div></CardContent></Card>

          <Card className="border-gold/20 bg-espresso text-champagne"><CardContent className="p-6"><h2 className="font-semibold text-gold">Appointment requests</h2><div className="mt-4 space-y-4">{engagements.length === 0 && <p className="text-sm text-champagne/70">No appointment requests.</p>}{engagements.map((engagement) => <article key={engagement.id} className="rounded-xl border border-gold/20 bg-white/[0.04] p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-champagne">{engagement.weddingTitle}</h3><p className="mt-1 text-xs text-champagne/65">Appointment and authority are separate.</p></div><StatusPill value={engagement.status} /></div>{engagement.status === 'requested' && <div className="mt-4 flex flex-wrap gap-2"><Button className="bg-gold text-espresso" disabled={busy !== null} onClick={() => void run(`appointment-${engagement.id}`, () => marketplaceFetch(`/api/marketplace/engagements/${engagement.id}/accept`, { method: 'POST', body: JSON.stringify({ decision: 'accept' }) }), 'Appointment accepted. Waiting for the couple to grant authority.')}>Accept appointment</Button><Button variant="outline" className="border-gold/40 bg-transparent text-champagne hover:bg-gold/10 hover:text-gold" disabled={busy !== null} onClick={() => void run(`decline-appointment-${engagement.id}`, () => marketplaceFetch(`/api/marketplace/engagements/${engagement.id}/accept`, { method: 'POST', body: JSON.stringify({ decision: 'decline' }) }), 'Appointment request declined.')}>Decline appointment</Button></div>}</article>)}</div></CardContent></Card>
        </div>
      </div>
    </MarketplaceFrame>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`block text-xs font-semibold text-espresso/75 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label> }
function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-gold/15 bg-white/45 p-4"><h3 className="font-serif text-2xl text-espresso">{title}</h3><p className="mt-1 text-xs leading-5 text-espresso/55">{description}</p><div className="mt-4">{children}</div></section> }

function CheckboxGroup({ name, label, options, selected, required = false }: { name: string; label: string; options: string[]; selected: string[]; required?: boolean }) {
  return <fieldset className="mb-5"><legend className="text-xs font-semibold text-espresso/75">{label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option} className="flex items-center gap-2 rounded-xl border border-gold/15 bg-white p-2.5 text-xs text-espresso"><input type="checkbox" name={name} value={option} defaultChecked={selected.includes(option)} className="accent-[#BF9B5F]" />{option}</label>)}</div>{required && <p className="mt-1 text-[10px] text-espresso/50">Select at least one before submitting for review.</p>}</fieldset>
}

function ControlledChecks({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-espresso/75">{label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option} className="flex items-center gap-2 rounded-xl border border-gold/15 bg-white p-2.5 text-xs"><input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((entry) => entry !== option) : [...selected, option])} className="accent-[#BF9B5F]" />{option}</label>)}</div></fieldset>
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) { return <label className="block text-xs font-semibold text-espresso/75">{label}<select name={name} defaultValue={value} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> }
function ControlledSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="block text-xs font-semibold text-espresso/75">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map((option) => <option key={option || 'empty'} value={option}>{option || 'Select…'}</option>)}</select></label> }

function PackageEditor({ value, onChange }: { value: PlannerPackage[]; onChange: (value: PlannerPackage[]) => void }) {
  return <FormSection title="Planning packages" description="Give couples structured, comparable packages rather than making them guess what is included."><div className="flex justify-end"><button type="button" onClick={() => onChange([...value, { name: '', description: null, startingPrice: null, currency: 'USD', pricingUnit: null, inclusions: [] }])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add package</button></div><div className="mt-3 space-y-3">{value.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-gold/15 bg-white p-4 sm:grid-cols-2"><Input value={item.name} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry))} placeholder="Package name" className={inputClass} /><Input type="number" min="0" step="0.01" value={item.startingPrice ?? ''} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, startingPrice: event.target.value ? Number(event.target.value) : null } : entry))} placeholder="Starting price" className={inputClass} /><Textarea value={item.description ?? ''} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, description: event.target.value } : entry))} placeholder="Package description" className={textareaClass} /><Textarea value={item.inclusions.join('\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, inclusions: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="One inclusion per line" className={textareaClass} /><div className="sm:col-span-2 flex justify-end"><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} className="inline-flex items-center gap-1 text-xs text-clay"><Trash2 className="size-3.5" />Remove package</button></div></div>)}</div></FormSection>
}

function FaqEditor({ value, onChange }: { value: PlannerFaq[]; onChange: (value: PlannerFaq[]) => void }) {
  return <FormSection title="Frequently asked questions" description="Answer common questions before a couple sends an enquiry."><div className="flex justify-end"><button type="button" onClick={() => onChange([...value, { question: '', answer: '' }])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add FAQ</button></div><div className="mt-3 space-y-3">{value.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-gold/15 bg-white p-4 sm:grid-cols-[1fr_1.5fr_auto]"><Input value={item.question} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, question: event.target.value } : entry))} placeholder="Question" className={inputClass} /><Textarea value={item.answer} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, answer: event.target.value } : entry))} placeholder="Answer" className={textareaClass} /><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} aria-label="Remove FAQ" className="self-start rounded-xl border border-clay/25 p-3 text-clay"><Trash2 className="size-4" /></button></div>)}</div></FormSection>
}
