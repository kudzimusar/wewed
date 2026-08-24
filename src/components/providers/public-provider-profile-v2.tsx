'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown,
  Clock3, ExternalLink, Globe2, Heart, Loader2, Mail, MapPin, MessageCircle, Phone,
  Send, ShieldCheck, ShoppingBag, Sparkles, Users, X,
} from 'lucide-react'
import { ProviderClaimPanel } from '@/components/providers/provider-claim-panel'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { usePublicAccountSession } from '@/components/public/public-account-actions'
import { providerCategoryLabel, providerServiceFields, type ProviderFieldDefinition } from '@/lib/provider-catalog'

type Package = { id: string; name: string; description: string | null; priceCents: number | null; currency: string; pricingUnit: string | null; inclusions: string[]; minimumQuantity: number | null; maximumQuantity: number | null; includedQuantity: number | null; additionalUnitPriceCents: number | null; priceValidUntil: string | null; completionScore: number }
type Portfolio = { id: string; type: string; url: string; thumbnailUrl: string | null; altText: string; caption: string | null }
type Offering = {
  id: string
  category: string
  displayName: string
  description: string | null
  startingPriceCents: number | null
  maximumPriceCents: number | null
  currency: string
  pricingModel: string | null
  pricingVisibility: string
  priceValidUntil: string | null
  aiReadinessScore: number
  aiReadinessStatus: string
  minimumCapacity: number | null
  maximumCapacity: number | null
  bookingLeadTime: string | null
  serviceAreas: string[]
  inclusions: string[]
  details: Record<string, unknown>
  sourceConfidence: number | null
  packages: Package[]
  portfolio: Portfolio[]
}
type Provider = {
  id: string
  slug: string
  displayName: string
  headline: string | null
  description: string | null
  country: string | null
  city: string | null
  serviceAreas: string[]
  languages: string[]
  publicEmail: string | null
  phone: string | null
  website: string | null
  socialLinks: Record<string, unknown>
  yearsOperating: number | null
  teamSize: number | null
  responseTime: string | null
  minimumBookingNotice: string | null
  travelRadiusKm: number | null
  paymentMethods: string[]
  depositPolicy: string | null
  cancellationPolicy: string | null
  refundPolicy: string | null
  travelPolicy: string | null
  accessibilitySupport: string | null
  culturalExperience: string | null
  coverImageUrl: string | null
  faq: Array<{ question?: string; answer?: string }>
  verificationBadges: string[]
  listingStatus: string
  isClaimable: boolean
  acceptingEnquiries: boolean
  sourceSummary: string | null
  lastSourceCheckAt: string | null
  ownerConfirmedAt: string | null
  provisionalPublishedAt: string | null
  claimNotice: string | null
  lastProfileUpdate: string | null
  offerings: Offering[]
}

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-[#dacdbb] bg-white px-3 text-sm text-[#211a15] outline-none transition placeholder:text-[#8f8376] focus:border-[#a57d31] focus:ring-2 focus:ring-[#a57d31]/15'
const textareaClass = `${inputClass} min-h-24 py-3`

function valueList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function money(cents: number | null, currency: string): string | null {
  if (cents == null) return null
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100) }
  catch { return `${currency} ${Math.round(cents / 100)}` }
}

function isProvisional(provider: Provider): boolean {
  return provider.listingStatus === 'unclaimed' || provider.listingStatus === 'claim_pending'
}

function detailLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (character) => character.toUpperCase())
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function PublicProviderProfileV2({ slug }: { slug: string }) {
  const router = useRouter()
  const accountSession = usePublicAccountSession()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetch(`/api/providers/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { provider?: Provider; error?: string }
        if (!response.ok || !payload.provider) throw new Error(payload.error || 'Provider profile unavailable.')
        if (!cancelled) setProvider(payload.provider)
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Provider profile unavailable.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  const offering = provider?.offerings[active] ?? null
  const fields = useMemo(() => offering ? providerServiceFields(offering.category) : [], [offering])
  const coupleOwner = Boolean(accountSession?.authorized && accountSession.user?.role === 'couple' && accountSession.activeWedding?.membershipRole === 'owner')
  const sessionChecking = accountSession === null

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!offering || !provider || !provider.acceptingEnquiries || isProvisional(provider)) return
    if (!coupleOwner) {
      setError('Sign in with the Couple owner account for the active wedding before sending this enquiry.')
      return
    }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setBusy(true); setError(null); setNotice(null); setConversationId(null)
    try {
      const response = await fetch('/api/providers/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringId: offering.id,
          eventDate: form.get('eventDate'),
          location: form.get('location'),
          guestCount: form.get('guestCount'),
          budgetBand: form.get('budgetBand'),
          contactPreference: form.get('contactPreference'),
          message: form.get('message'),
          structuredAnswers: answers,
          sharedSummary: {
            weddingTitle: form.get('shareWeddingTitle') === 'on',
            weddingDate: form.get('shareWeddingDate') === 'on',
            location: form.get('shareLocation') === 'on',
            guestCount: form.get('shareGuestCount') === 'on',
            budgetBand: form.get('shareBudget') === 'on',
          },
        }),
      })
      const payload = await response.json() as { success?: boolean; conversationId?: string; providerName?: string; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to send the enquiry.')
      setConversationId(payload.conversationId ?? null)
      setNotice(`Enquiry sent${payload.providerName ? ` to ${payload.providerName}` : ''}. Continue the conversation privately in Wewed Messages.`)
      setAnswers({})
      formElement.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send the enquiry.')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <PublicPlatformShell><div className="flex min-h-[65vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-gold-muted" /></div></PublicPlatformShell>
  }

  if (!provider || !offering) {
    return <PublicPlatformShell><div className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="font-serif text-5xl">Provider profile unavailable</h1><p className="mt-4 text-espresso/60">{error}</p><Link href="/vendors" className="mt-8 inline-flex rounded-xl bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Return to marketplace</Link></div></PublicPlatformShell>
  }

  const locationLabel = [provider.city, provider.country].filter(Boolean).join(', ')
  const description = provider.description || provider.headline || 'Explore this provider’s published services and booking options on Wewed.'
  const hasPolicies = Boolean(provider.depositPolicy || provider.cancellationPolicy || provider.refundPolicy || provider.travelPolicy)

  return (
    <PublicPlatformShell>
      <section className="relative isolate overflow-hidden bg-[#1a1410] text-[#fbf6ee]">
        {provider.coverImageUrl ? <img src={provider.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-45" /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(18,13,10,.97)_8%,rgba(18,13,10,.84)_48%,rgba(18,13,10,.42)_100%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pb-20 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => router.back()} className="inline-flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/85 hover:bg-white/10" aria-label="Go back"><ArrowLeft className="size-4" /></button>
              <button type="button" onClick={() => window.history.forward()} className="hidden size-10 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/85 hover:bg-white/10 sm:inline-flex" aria-label="Go forward"><ArrowRight className="size-4" /></button>
              <Link href="/vendors" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 text-xs font-semibold text-white/85 hover:bg-white/10">Marketplace</Link>
            </div>
            <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 text-xs font-semibold text-white/85 hover:bg-white/10"><Heart className="size-4" /> Save</button>
          </div>

          <div className="mt-14 max-w-4xl sm:mt-20">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d7b36c]">
              <span>{providerCategoryLabel(offering.category)}</span>
              {isProvisional(provider) ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-200/10 px-2.5 py-1 text-amber-100"><AlertTriangle className="size-3" /> {provider.listingStatus === 'claim_pending' ? 'Claim pending' : 'Unclaimed listing'}</span> : provider.verificationBadges.slice(0, 3).map((badge) => <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-[#d7b36c]/30 bg-black/20 px-2.5 py-1"><BadgeCheck className="size-3" />{badge}</span>)}
            </div>
            <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[.94] sm:text-7xl lg:text-8xl">{provider.displayName}</h1>
            {provider.headline ? <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">{provider.headline}</p> : null}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/65">
              {locationLabel ? <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-[#d7b36c]" />{locationLabel}</span> : null}
              {provider.responseTime && !isProvisional(provider) ? <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-[#d7b36c]" />Responds {provider.responseTime.toLowerCase()}</span> : null}
              {provider.minimumBookingNotice ? <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#d7b36c]" />{provider.minimumBookingNotice}</span> : null}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => scrollTo('provider-booking-slot')} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#c9a25d] px-5 text-sm font-bold text-[#1a1410] shadow-lg shadow-black/20 hover:bg-[#d6b36e]"><ShoppingBag className="size-4" /> Explore services & book</button>
              {provider.acceptingEnquiries && !isProvisional(provider) ? <button type="button" onClick={() => setEnquiryOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/8 px-5 text-sm font-semibold text-white hover:bg-white/12"><MessageCircle className="size-4" /> Ask a question</button> : null}
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-16 z-40 border-b border-[#e5dacb] bg-[#fbf7f1]/96 shadow-sm backdrop-blur" aria-label="Provider profile sections">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
          {[['Book', 'provider-booking-slot'], ['Overview', 'overview'], ['Services', 'services'], ['Policies', 'policies'], ['FAQ', 'faq']].map(([label, id]) => <button key={id} type="button" onClick={() => scrollTo(id)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-[#5f554b] hover:bg-white hover:text-[#1f1813]">{label}</button>)}
          {provider.acceptingEnquiries && !isProvisional(provider) ? <button type="button" onClick={() => setEnquiryOpen(true)} className="ml-auto shrink-0 rounded-lg bg-[#211a15] px-3 py-2 text-xs font-semibold text-white">Enquire</button> : null}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div id="provider-booking-slot" className="scroll-mt-28" />

        {isProvisional(provider) ? <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><h2 className="font-semibold text-amber-950">Public information not yet owner-verified</h2><p className="mt-1 text-sm leading-6 text-amber-900/75">This profile is assembled from public business information. Missing prices, policies and vendor-specific media remain unpublished until the owner confirms them.</p></div></div></section> : null}

        <section id="overview" className="scroll-mt-28 border-t border-[#e9dfd2] py-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7938]">At a glance</p>
              <h2 className="mt-2 font-serif text-4xl text-[#211a15]">About {provider.displayName}</h2>
              <p className={`mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#665b50] ${aboutExpanded ? '' : 'line-clamp-4'}`}>{description}</p>
              {description.length > 280 ? <button type="button" onClick={() => setAboutExpanded((value) => !value)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#8f6b2c]">{aboutExpanded ? 'Show less' : 'Read more'} <ChevronDown className={`size-4 transition ${aboutExpanded ? 'rotate-180' : ''}`} /></button> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {provider.yearsOperating != null ? <CompactFact label="Years operating" value={String(provider.yearsOperating)} /> : null}
              {provider.teamSize != null ? <CompactFact label="Team size" value={String(provider.teamSize)} /> : null}
              {provider.languages.length ? <CompactFact label="Languages" value={provider.languages.slice(0, 2).join(', ')} /> : null}
              {provider.serviceAreas.length ? <CompactFact label="Service areas" value={provider.serviceAreas.slice(0, 2).join(', ')} /> : null}
            </div>
          </div>
        </section>

        <section id="services" className="scroll-mt-28 border-t border-[#e9dfd2] py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7938]">Service explorer</p><h2 className="mt-2 font-serif text-4xl text-[#211a15]">What they can help with</h2></div><p className="max-w-xl text-sm leading-6 text-[#71665b]">Choose a service to reveal only the details relevant to it. Booking happens from the catalogue above.</p></div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{provider.offerings.map((entry, index) => <button key={entry.id} type="button" onClick={() => { setActive(index); setAnswers({}) }} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${active === index ? 'bg-[#211a15] text-white' : 'border border-[#ddcfbd] bg-white text-[#6c5f53] hover:border-[#bda47c]'}`}>{providerCategoryLabel(entry.category)}</button>)}</div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
            <article className="rounded-2xl border border-[#e5d8c8] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a7938]">{providerCategoryLabel(offering.category)}</p><h3 className="mt-1 font-serif text-3xl text-[#211a15]">{offering.displayName}</h3></div><div className="text-right">{money(offering.startingPriceCents, offering.currency) ? <><p className="text-[11px] text-[#82766a]">Starting from</p><p className="mt-1 text-lg font-bold text-[#211a15]">{money(offering.startingPriceCents, offering.currency)}</p></> : <span className="rounded-lg bg-[#f4eee5] px-3 py-2 text-xs font-semibold text-[#66584b]">Quote based</span>}</div></div>
              {offering.description ? <p className="mt-3 text-sm leading-6 text-[#706459]">{offering.description}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">{offering.bookingLeadTime ? <MiniChip icon={<CalendarDays className="size-3.5" />} text={offering.bookingLeadTime} /> : null}{(offering.minimumCapacity != null || offering.maximumCapacity != null) ? <MiniChip icon={<Users className="size-3.5" />} text={`${offering.minimumCapacity ?? 'Any'}–${offering.maximumCapacity ?? 'Any'} capacity`} /> : null}{offering.aiReadinessStatus === 'ready' ? <MiniChip icon={<Sparkles className="size-3.5" />} text="AI-ready details" /> : null}</div>
              {offering.inclusions.length ? <details className="mt-5 rounded-xl border border-[#eadfce] bg-[#fbf8f3] p-4"><summary className="cursor-pointer text-sm font-semibold text-[#352b24]">What is included</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{offering.inclusions.map((item) => <span key={item} className="flex items-start gap-2 text-sm text-[#6d6257]"><Check className="mt-0.5 size-4 shrink-0 text-[#788166]" />{item}</span>)}</div></details> : null}
            </article>
            <div className="space-y-3">
              {Object.keys(offering.details).length ? <details className="rounded-2xl border border-[#e5d8c8] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#2d241e]">Service specifics</summary><div className="mt-4 space-y-3">{Object.entries(offering.details).filter(([, value]) => value != null && value !== '' && (!Array.isArray(value) || value.length > 0)).map(([key, value]) => <div key={key}><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#9a7938]">{detailLabel(key)}</div><div className="mt-1 text-sm text-[#665b50]">{Array.isArray(value) ? value.join(', ') : String(value)}</div></div>)}</div></details> : null}
              {offering.packages.length ? <details className="rounded-2xl border border-[#e5d8c8] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#2d241e]">Packages ({offering.packages.length})</summary><div className="mt-4 space-y-3">{offering.packages.map((item) => <div key={item.id} className="rounded-xl bg-[#faf6f0] p-3"><div className="flex justify-between gap-2"><strong className="text-sm">{item.name}</strong>{money(item.priceCents, item.currency) ? <span className="text-xs font-semibold text-[#7b6032]">{money(item.priceCents, item.currency)}</span> : null}</div>{item.description ? <p className="mt-1 text-xs leading-5 text-[#71665b]">{item.description}</p> : null}</div>)}</div></details> : null}
              {provider.acceptingEnquiries && !isProvisional(provider) ? <button type="button" onClick={() => setEnquiryOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-[#211a15] p-5 text-left text-white"><span><span className="block text-xs text-white/55">Need something custom?</span><span className="mt-1 block font-semibold">Ask {provider.displayName}</span></span><ArrowRight className="size-5 text-[#d1aa61]" /></button> : null}
            </div>
          </div>
        </section>

        <section id="policies" className="scroll-mt-28 border-t border-[#e9dfd2] py-10">
          <div className="grid gap-5 lg:grid-cols-2">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7938]">Trust before commitment</p><h2 className="mt-2 font-serif text-4xl text-[#211a15]">Policies & contact</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#71665b]">Keep the first visit light. Open only the information you need before you book or ask a question.</p></div>
            <div className="space-y-2">
              {hasPolicies ? <>{provider.depositPolicy ? <InfoDisclosure title="Deposit" value={provider.depositPolicy} /> : null}{provider.cancellationPolicy ? <InfoDisclosure title="Cancellation" value={provider.cancellationPolicy} /> : null}{provider.refundPolicy ? <InfoDisclosure title="Refunds" value={provider.refundPolicy} /> : null}{provider.travelPolicy ? <InfoDisclosure title="Travel" value={provider.travelPolicy} /> : null}</> : <div className="rounded-xl border border-[#e5d8c8] bg-white p-4 text-sm text-[#74685d]">No public policy text has been published for this provider yet.</div>}
              <details className="rounded-xl border border-[#e5d8c8] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-[#30261f]">Contact & service area</summary><div className="mt-3 space-y-2 text-sm text-[#665b50]">{provider.serviceAreas.length ? <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-[#9a7938]" />{provider.serviceAreas.join(', ')}</p> : null}{provider.website ? <a href={provider.website} target="_blank" rel="noreferrer" className="flex gap-2 text-[#876629]"><Globe2 className="mt-0.5 size-4 shrink-0" />Website <ExternalLink className="size-3" /></a> : null}{provider.phone ? <a href={`tel:${provider.phone}`} className="flex gap-2 text-[#876629]"><Phone className="mt-0.5 size-4 shrink-0" />{provider.phone}</a> : null}{provider.publicEmail ? <a href={`mailto:${provider.publicEmail}`} className="flex gap-2 break-all text-[#876629]"><Mail className="mt-0.5 size-4 shrink-0" />{provider.publicEmail}</a> : null}</div></details>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 border-t border-[#e9dfd2] py-10">
          <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7938]">Questions</p><h2 className="mt-2 font-serif text-4xl text-[#211a15]">What people ask</h2></div><div className="space-y-2">{provider.faq.length ? provider.faq.map((item, index) => item.question && item.answer ? <InfoDisclosure key={`${item.question}-${index}`} title={item.question} value={item.answer} /> : null) : <div className="rounded-xl border border-[#e5d8c8] bg-white p-4 text-sm text-[#74685d]">No public FAQs have been published yet. Use “Ask a question” for anything specific.</div>}</div></div>
        </section>

        {isProvisional(provider) ? <div id="claim-business" className="pb-10"><ProviderClaimPanel slug={provider.slug} businessName={provider.displayName} listingStatus={provider.listingStatus} sourceSummary={provider.sourceSummary} lastSourceCheckAt={provider.lastSourceCheckAt} /></div> : null}
        {provider.lastProfileUpdate ? <p className="pb-8 text-center text-xs text-[#8b7f73]">Profile information updated {new Date(provider.lastProfileUpdate).toLocaleDateString()}</p> : null}
      </main>

      {provider.acceptingEnquiries && !isProvisional(provider) ? <div className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-2xl border border-[#dfd1bf] bg-white/96 p-2 shadow-2xl backdrop-blur sm:hidden"><button type="button" onClick={() => scrollTo('provider-booking-slot')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#211a15] px-3 text-sm font-bold text-white"><ShoppingBag className="size-4" /> Services</button><button type="button" onClick={() => setEnquiryOpen(true)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#d9cbb7] px-3 text-sm font-semibold text-[#332921]"><MessageCircle className="size-4" /> Ask</button></div> : null}

      {enquiryOpen ? <div className="fixed inset-0 z-[80] bg-black/45" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEnquiryOpen(false) }}><section role="dialog" aria-modal="true" aria-label={`Ask ${provider.displayName}`} className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-[#fbf7f1] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-none">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#e4d8c7] bg-[#fbf7f1]/96 px-5 py-4 backdrop-blur"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9a7938]">Private Wewed enquiry</p><h2 className="mt-1 font-serif text-3xl text-[#211a15]">Ask {provider.displayName}</h2><p className="mt-1 text-xs leading-5 text-[#74685d]">Start simple. Add detailed wedding information only when it helps the vendor answer.</p></div><button type="button" onClick={() => setEnquiryOpen(false)} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#dfd1bf] bg-white" aria-label="Close enquiry"><X className="size-4" /></button></div>
        <form onSubmit={submitEnquiry} className="space-y-4 p-5">
          <label className="block text-sm font-semibold text-[#3b3028]">Service<select value={active} onChange={(event) => { setActive(Number(event.target.value)); setAnswers({}) }} className={inputClass}>{provider.offerings.map((entry, index) => <option key={entry.id} value={index}>{providerCategoryLabel(entry.category)} — {entry.displayName}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-[#3b3028]">Wedding date<input name="eventDate" type="date" className={inputClass} /></label><label className="block text-sm font-semibold text-[#3b3028]">Location<input name="location" placeholder="City or venue" className={inputClass} /></label></div>
          <label className="block text-sm font-semibold text-[#3b3028]">What would you like to know?<textarea name="message" placeholder="A short question is enough to start…" className={textareaClass} /></label>

          <details className="rounded-xl border border-[#e2d5c4] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-[#30261f]">Add wedding details <span className="ml-1 font-normal text-[#83766a]">(optional)</span></summary><div className="mt-4 space-y-4"><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium text-[#4a3e34]">Guests<input name="guestCount" type="number" min="0" max="100000" className={inputClass} /></label><label className="block text-sm font-medium text-[#4a3e34]">Budget<select name="budgetBand" className={inputClass}><option value="">Not stated</option><option>Under USD 5,000</option><option>USD 5,000–15,000</option><option>USD 15,000–30,000</option><option>USD 30,000–75,000</option><option>USD 75,000+</option><option>By consultation</option></select></label></div>{fields.map((field) => <EnquiryFieldLight key={field.key} field={field} value={answers[field.key]} onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))} />)}<label className="block text-sm font-medium text-[#4a3e34]">Preferred reply<select name="contactPreference" className={inputClass}><option value="wewed">Wewed message</option><option value="email">Email</option><option value="phone">Phone</option></select></label></div></details>

          <details className="rounded-xl border border-[#e2d5c4] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-[#30261f]">What Wewed may share</summary><div className="mt-3 grid grid-cols-2 gap-2">{[['shareWeddingTitle','Wedding title'],['shareWeddingDate','Wedding date'],['shareLocation','Location'],['shareGuestCount','Guest count'],['shareBudget','Budget']].map(([name, label]) => <label key={name} className="flex items-center gap-2 text-xs text-[#665b50]"><input name={name} type="checkbox" className="size-4 accent-[#a57d31]" />{label}</label>)}</div></details>

          {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><p>{notice}</p>{conversationId ? <Link href={`/messages?conversation=${encodeURIComponent(conversationId)}`} className="mt-2 inline-flex items-center gap-1 font-semibold underline"><MessageCircle className="size-4" />Open conversation</Link> : null}</div> : null}

          {coupleOwner ? <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#211a15] px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send enquiry</button> : sessionChecking ? <button type="button" disabled className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d8cbb8] px-4 text-sm font-semibold text-[#5e5145]"><Loader2 className="size-4 animate-spin" />Checking account…</button> : <Link href="/sign-in" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#211a15] px-4 text-sm font-bold text-white"><Send className="size-4" /> Sign in to send</Link>}
          <p className="text-center text-[11px] leading-5 text-[#817467]"><ShieldCheck className="mr-1 inline size-3.5" />An enquiry starts a private conversation. It never grants wedding access or vendor authority.</p>
        </form>
      </section></div> : null}
    </PublicPlatformShell>
  )
}

function CompactFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e5d8c8] bg-white p-3"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#9a7938]">{label}</div><div className="mt-1 line-clamp-2 text-sm font-semibold text-[#352b24]">{value}</div></div>
}

function MiniChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4eee5] px-2.5 py-1.5 text-xs font-medium text-[#66584b]">{icon}{text}</span>
}

function InfoDisclosure({ title, value }: { title: string; value: string }) {
  return <details className="rounded-xl border border-[#e5d8c8] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-[#30261f]">{title}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#6d6257]">{value}</p></details>
}

function EnquiryFieldLight({ field, value, onChange }: { field: ProviderFieldDefinition; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'checkboxes' || field.type === 'multiselect') {
    const selected = valueList(value)
    return <fieldset className="rounded-xl border border-[#e0d2c0] p-3"><legend className="px-1 text-xs font-semibold text-[#6d5b43]">{field.label}</legend>{(field.options ?? []).map((option) => <label key={option} className="mt-2 flex items-center gap-2 text-sm text-[#62564b]"><input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((entry) => entry !== option) : [...selected, option])} className="size-4 accent-[#a57d31]" />{option}</label>)}</fieldset>
  }
  if (field.type === 'select') return <label className="block text-sm font-medium text-[#4a3e34]">{field.label}<select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  if (field.type === 'textarea') return <label className="block text-sm font-medium text-[#4a3e34]">{field.label}<textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={textareaClass} /></label>
  if (field.type === 'number') return <label className="block text-sm font-medium text-[#4a3e34]">{field.label}<input type="number" min={field.min} max={field.max} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>
  return <label className="block text-sm font-medium text-[#4a3e34]">{field.label}<input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>
}
