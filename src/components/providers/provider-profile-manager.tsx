'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { BriefcaseBusiness, CheckCircle2, Eye, EyeOff, Loader2, Lock, LogOut, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { createClient } from '@/lib/supabase/client'
import {
  LANGUAGE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PROVIDER_CATEGORIES,
  SERVICE_AREA_OPTIONS,
  providerCategoryLabel,
  providerServiceFields,
  type ProviderFieldDefinition,
} from '@/lib/provider-catalog'
import {
  AVAILABILITY_MODE_OPTIONS,
  CHARGE_TYPE_OPTIONS,
  DEPOSIT_TYPE_OPTIONS,
  PRICE_COMPONENT_TYPES,
  PRICING_VISIBILITY_OPTIONS,
} from '@/lib/provider-commercial'

type ProfileDraft = {
  slug: string
  displayName: string
  headline: string
  description: string
  country: string
  city: string
  serviceAreas: string[]
  languages: string[]
  publicEmail: string
  phone: string
  website: string
  socialLinks: Record<string, string>
  yearsOperating: string
  teamSize: string
  responseTime: string
  minimumBookingNotice: string
  travelRadiusKm: string
  paymentMethods: string[]
  depositPolicy: string
  cancellationPolicy: string
  refundPolicy: string
  travelPolicy: string
  accessibilitySupport: string
  culturalExperience: string
  coverImageUrl: string
  faq: Array<{ question: string; answer: string }>
  visibility: 'draft' | 'published'
  completionScore: number
}

type VerificationDraft = {
  legalName: string
  registrationNumber: string
  taxNumber: string
  representativeName: string
  physicalAddress: string
  secondaryContact: string
  identityStatus: string
  businessStatus: string
  insuranceStatus: string
  permitStatus: string
}

type CommercialTermsDraft = {
  minimumSpend: string
  includedQuantity: string
  incrementalUnitPrice: string
  minimumBillableQuantity: string
  billingIncrement: string
  setupFee: string
  deliveryFee: string
  includedTravelKm: string
  travelFeePerKm: string
  overtimeRate: string
  overtimeUnit: string
  taxIncluded: boolean | null
  taxPercentage: string
  serviceChargeType: string
  serviceChargeValue: string
  depositType: string
  depositValue: string
  balanceDueRule: string
  availabilityMode: string
}

type PriceComponentDraft = {
  id: string
  label: string
  type: string
  amount: string
  unit: string
  condition: string
  minimumQuantity: string
  maximumQuantity: string
}

type PackageDraft = {
  name: string
  description: string
  price: string
  currency: string
  pricingUnit: string
  inclusions: string[]
  minimumQuantity: string
  maximumQuantity: string
  includedQuantity: string
  additionalUnitPrice: string
  exclusions: string[]
  requiredAddOns: string[]
  optionalAddOns: string[]
  commercialTerms: CommercialTermsDraft
  priceComponents: PriceComponentDraft[]
  priceValidFrom: string
  priceValidUntil: string
  completionScore: number
}

type PortfolioDraft = {
  type: 'image' | 'video' | 'link'
  url: string
  thumbnailUrl: string
  altText: string
  caption: string
}

type OfferingDraft = {
  id?: string | null
  category: string
  displayName: string
  description: string
  status: 'draft' | 'published'
  startingPrice: string
  maximumPrice: string
  currency: string
  pricingModel: string
  pricingVisibility: string
  commercialTerms: CommercialTermsDraft
  priceComponents: PriceComponentDraft[]
  priceValidFrom: string
  priceValidUntil: string
  ownerConfirmedCommercialAt: string
  confirmCommercialPricing: boolean
  aiReadinessScore: number
  aiReadinessStatus: string
  aiReadinessMissing: string[]
  minimumCapacity: string
  maximumCapacity: string
  bookingLeadTime: string
  serviceAreas: string[]
  inclusions: string[]
  details: Record<string, unknown>
  packages: PackageDraft[]
  portfolio: PortfolioDraft[]
  completionScore: number
}

type ProviderPayload = {
  success?: boolean
  error?: string
  business?: { id: string; name: string; slug: string; type: 'venue' | 'vendor' }
  profile?: Record<string, unknown>
  verification?: Record<string, unknown> | null
  offerings?: Array<Record<string, unknown>>
  enquiries?: Array<Record<string, unknown>>
}

type State = 'checking' | 'signed-out' | 'ready' | 'unavailable'

const inputClass = 'h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm text-espresso outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20'
const textareaClass = 'min-h-24 w-full rounded-xl border border-gold/25 bg-ivory px-3 py-2 text-sm text-espresso outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20'
const selectClass = inputClass
const CURRENCIES = ['USD', 'ZAR', 'GBP', 'EUR', 'BWP', 'ZMW', 'MZN'] as const
const PRICING_MODELS = ['Contact for pricing', 'Fixed package', 'Per guest', 'Per hour', 'Per item', 'Per serving', 'Per kilometre', 'Custom proposal'] as const
const RESPONSE_TIMES = ['Within 2 hours', 'Within 4 hours', 'Same business day', 'Within 24 hours', 'Within 48 hours', 'By appointment'] as const
const BOOKING_NOTICE = ['1–2 weeks', '1 month', '2–3 months', '4–6 months', '6–12 months', '12+ months', 'Depends on service'] as const

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean)
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function priceValue(value: unknown): string {
  return typeof value === 'number' ? (value / 100).toFixed(2).replace(/\.00$/, '') : ''
}

function dateInputValue(value: unknown): string {
  if (!value) return ''
  const date = new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}

function commercialTermsDraft(value: unknown): CommercialTermsDraft {
  const row = object(value)
  return {
    minimumSpend: stringValue(row.minimumSpend),
    includedQuantity: stringValue(row.includedQuantity),
    incrementalUnitPrice: stringValue(row.incrementalUnitPrice),
    minimumBillableQuantity: stringValue(row.minimumBillableQuantity),
    billingIncrement: stringValue(row.billingIncrement),
    setupFee: stringValue(row.setupFee),
    deliveryFee: stringValue(row.deliveryFee),
    includedTravelKm: stringValue(row.includedTravelKm),
    travelFeePerKm: stringValue(row.travelFeePerKm),
    overtimeRate: stringValue(row.overtimeRate),
    overtimeUnit: stringValue(row.overtimeUnit),
    taxIncluded: typeof row.taxIncluded === 'boolean' ? row.taxIncluded : null,
    taxPercentage: stringValue(row.taxPercentage),
    serviceChargeType: stringValue(row.serviceChargeType) || 'none',
    serviceChargeValue: stringValue(row.serviceChargeValue),
    depositType: stringValue(row.depositType) || 'none',
    depositValue: stringValue(row.depositValue),
    balanceDueRule: stringValue(row.balanceDueRule),
    availabilityMode: stringValue(row.availabilityMode) || 'request',
  }
}

function priceComponentsDraft(value: unknown): PriceComponentDraft[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const row = object(item)
    return {
      id: stringValue(row.id) || `component-${index + 1}`,
      label: stringValue(row.label),
      type: stringValue(row.type) || 'fixed',
      amount: stringValue(row.amount),
      unit: stringValue(row.unit),
      condition: stringValue(row.condition),
      minimumQuantity: stringValue(row.minimumQuantity),
      maximumQuantity: stringValue(row.maximumQuantity),
    }
  })
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
}

function mapProfile(row: Record<string, unknown>, businessName: string): ProfileDraft {
  return {
    slug: stringValue(row.slug),
    displayName: stringValue(row.displayName) || businessName,
    headline: stringValue(row.headline),
    description: stringValue(row.description),
    country: stringValue(row.country),
    city: stringValue(row.city),
    serviceAreas: list(row.serviceAreas),
    languages: list(row.languages),
    publicEmail: stringValue(row.publicEmail),
    phone: stringValue(row.phone),
    website: stringValue(row.website),
    socialLinks: Object.fromEntries(Object.entries(object(row.socialLinks)).map(([key, value]) => [key, stringValue(value)])),
    yearsOperating: row.yearsOperating == null ? '' : String(row.yearsOperating),
    teamSize: row.teamSize == null ? '' : String(row.teamSize),
    responseTime: stringValue(row.responseTime),
    minimumBookingNotice: stringValue(row.minimumBookingNotice),
    travelRadiusKm: row.travelRadiusKm == null ? '' : String(row.travelRadiusKm),
    paymentMethods: list(row.paymentMethods),
    depositPolicy: stringValue(row.depositPolicy),
    cancellationPolicy: stringValue(row.cancellationPolicy),
    refundPolicy: stringValue(row.refundPolicy),
    travelPolicy: stringValue(row.travelPolicy),
    accessibilitySupport: stringValue(row.accessibilitySupport),
    culturalExperience: stringValue(row.culturalExperience),
    coverImageUrl: stringValue(row.coverImageUrl),
    faq: Array.isArray(row.faq)
      ? row.faq.map((item) => ({ question: stringValue(object(item).question), answer: stringValue(object(item).answer) })).filter((item) => item.question || item.answer)
      : [],
    visibility: row.visibility === 'published' ? 'published' : 'draft',
    completionScore: Number(row.completionScore || 0),
  }
}

function mapVerification(row: Record<string, unknown> | null | undefined): VerificationDraft {
  const value = row ?? {}
  return {
    legalName: stringValue(value.legalName),
    registrationNumber: stringValue(value.registrationNumber),
    taxNumber: stringValue(value.taxNumber),
    representativeName: stringValue(value.representativeName),
    physicalAddress: stringValue(value.physicalAddress),
    secondaryContact: stringValue(value.secondaryContact),
    identityStatus: stringValue(value.identityStatus) || 'not_submitted',
    businessStatus: stringValue(value.businessStatus) || 'not_submitted',
    insuranceStatus: stringValue(value.insuranceStatus) || 'not_submitted',
    permitStatus: stringValue(value.permitStatus) || 'not_applicable',
  }
}

function mapOffering(row: Record<string, unknown>, businessName: string, profileAreas: string[]): OfferingDraft {
  return {
    id: stringValue(row.id) || null,
    category: stringValue(row.category) || 'other',
    displayName: stringValue(row.displayName) || businessName,
    description: stringValue(row.description),
    status: row.status === 'published' ? 'published' : 'draft',
    startingPrice: priceValue(row.startingPriceCents),
    maximumPrice: priceValue(row.maximumPriceCents),
    currency: stringValue(row.currency) || 'USD',
    pricingModel: stringValue(row.pricingModel),
    pricingVisibility: stringValue(row.pricingVisibility) || 'quote_only',
    commercialTerms: commercialTermsDraft(row.commercialTerms),
    priceComponents: priceComponentsDraft(row.priceComponents),
    priceValidFrom: dateInputValue(row.priceValidFrom),
    priceValidUntil: dateInputValue(row.priceValidUntil),
    ownerConfirmedCommercialAt: stringValue(row.ownerConfirmedCommercialAt),
    confirmCommercialPricing: false,
    aiReadinessScore: Number(row.aiReadinessScore || 0),
    aiReadinessStatus: stringValue(row.aiReadinessStatus) || 'not_ready',
    aiReadinessMissing: list(row.aiReadinessMissing),
    minimumCapacity: row.minimumCapacity == null ? '' : String(row.minimumCapacity),
    maximumCapacity: row.maximumCapacity == null ? '' : String(row.maximumCapacity),
    bookingLeadTime: stringValue(row.bookingLeadTime),
    serviceAreas: list(row.serviceAreas).length ? list(row.serviceAreas) : profileAreas,
    inclusions: list(row.inclusions),
    details: object(row.details),
    completionScore: Number(row.completionScore || 0),
    packages: Array.isArray(row.packages) ? row.packages.map((item) => {
      const entry = object(item)
      return {
        name: stringValue(entry.name),
        description: stringValue(entry.description),
        price: priceValue(entry.priceCents),
        currency: stringValue(entry.currency) || 'USD',
        pricingUnit: stringValue(entry.pricingUnit),
        inclusions: list(entry.inclusions),
        minimumQuantity: stringValue(entry.minimumQuantity),
        maximumQuantity: stringValue(entry.maximumQuantity),
        includedQuantity: stringValue(entry.includedQuantity),
        additionalUnitPrice: priceValue(entry.additionalUnitPriceCents),
        exclusions: list(entry.exclusions),
        requiredAddOns: list(entry.requiredAddOns),
        optionalAddOns: list(entry.optionalAddOns),
        commercialTerms: commercialTermsDraft(entry.commercialTerms),
        priceComponents: priceComponentsDraft(entry.priceComponents),
        priceValidFrom: dateInputValue(entry.priceValidFrom),
        priceValidUntil: dateInputValue(entry.priceValidUntil),
        completionScore: Number(entry.completionScore || 0),
      }
    }) : [],
    portfolio: Array.isArray(row.portfolio) ? row.portfolio.map((item) => {
      const entry = object(item)
      const type = stringValue(entry.type)
      return {
        type: type === 'video' || type === 'link' ? type : 'image',
        url: stringValue(entry.url),
        thumbnailUrl: stringValue(entry.thumbnailUrl),
        altText: stringValue(entry.altText),
        caption: stringValue(entry.caption),
      }
    }) : [],
  }
}

function emptyOffering(category: string, businessName: string, areas: string[]): OfferingDraft {
  return {
    id: null,
    category,
    displayName: `${businessName} — ${providerCategoryLabel(category)}`,
    description: '',
    status: 'draft',
    startingPrice: '',
    maximumPrice: '',
    currency: 'USD',
    pricingModel: '',
    pricingVisibility: 'quote_only',
    commercialTerms: commercialTermsDraft({}),
    priceComponents: [],
    priceValidFrom: '',
    priceValidUntil: '',
    ownerConfirmedCommercialAt: '',
    confirmCommercialPricing: false,
    aiReadinessScore: 0,
    aiReadinessStatus: 'not_ready',
    aiReadinessMissing: ['Add calculation-ready pricing and confirm it is current'],
    minimumCapacity: '',
    maximumCapacity: '',
    bookingLeadTime: '',
    serviceAreas: areas,
    inclusions: [],
    details: {},
    packages: [],
    portfolio: [],
    completionScore: 0,
  }
}

export function ProviderProfileManager() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<State>('checking')
  const [payload, setPayload] = useState<ProviderPayload | null>(null)
  const [profile, setProfile] = useState<ProfileDraft | null>(null)
  const [verification, setVerification] = useState<VerificationDraft | null>(null)
  const [offerings, setOfferings] = useState<OfferingDraft[]>([])
  const [activeOffering, setActiveOffering] = useState(0)
  const [newCategory, setNewCategory] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('checking')
    setError(null)
    try {
      const response = await fetch('/api/providers/profile', { cache: 'no-store', credentials: 'same-origin' })
      const next = await response.json() as ProviderPayload
      if (response.status === 401) {
        setPayload(null)
        setState('signed-out')
        return
      }
      if (!response.ok || !next.profile || !next.business) {
        setPayload(next)
        setError(next.error || 'This account does not have an active provider business.')
        setState('unavailable')
        return
      }

      let nextProfile = mapProfile(next.profile, next.business.name)
      const nextVerification = mapVerification(next.verification)
      let nextOfferings = (next.offerings ?? []).map((entry) => mapOffering(entry, next.business!.name, nextProfile.serviceAreas))
      if (!nextOfferings.length) nextOfferings = [emptyOffering(next.business.type === 'venue' ? 'venue' : 'other', next.business.name, nextProfile.serviceAreas)]

      const storageKey = `wewed-provider-onboarding-${next.business.id}`
      const local = window.localStorage.getItem(storageKey)
      if (local) {
        try {
          const restored = JSON.parse(local) as { profile?: ProfileDraft; offerings?: OfferingDraft[]; savedAt?: string }
          if (restored.profile && Array.isArray(restored.offerings) && restored.offerings.length) {
            nextProfile = restored.profile
            nextOfferings = restored.offerings
            setAutosavedAt(restored.savedAt ?? null)
            setNotice('A locally autosaved draft was restored. Review it, then save to sync with Wewed.')
          }
        } catch {
          window.localStorage.removeItem(storageKey)
        }
      }

      setPayload(next)
      setProfile(nextProfile)
      setVerification(nextVerification)
      setOfferings(nextOfferings)
      setActiveOffering(0)
      setState('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the provider profile.')
      setState('unavailable')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (state !== 'ready' || !payload?.business || !profile || offerings.length === 0) return
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      window.localStorage.setItem(
        `wewed-provider-onboarding-${payload.business!.id}`,
        JSON.stringify({ profile, offerings, savedAt }),
      )
      setAutosavedAt(savedAt)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [state, payload?.business, profile, offerings])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setError(signInError.message)
      setBusy(false)
      return
    }
    setPassword('')
    await load()
    setBusy(false)
  }

  async function signOut() {
    setBusy(true)
    await Promise.allSettled([
      supabase.auth.signOut(),
      fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' }),
    ])
    setPayload(null)
    setProfile(null)
    setVerification(null)
    setOfferings([])
    setState('signed-out')
    setBusy(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile || !verification) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/providers/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, verification, offerings }),
      })
      const next = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !next.success) throw new Error(next.error || 'Unable to save the provider profile.')
      if (payload?.business) window.localStorage.removeItem(`wewed-provider-onboarding-${payload.business.id}`)
      setAutosavedAt(null)
      setNotice('Company information, verification details and service offerings were saved.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the provider profile.')
    } finally {
      setBusy(false)
    }
  }

  async function suggestFromWebsite() {
    if (!profile?.website) {
      setError('Enter the public website first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/providers/website-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: profile.website }),
      })
      const next = await response.json() as {
        suggestion?: { displayName?: string | null; description?: string | null; coverImageUrl?: string | null }
        error?: string
      }
      if (!response.ok || !next.suggestion) throw new Error(next.error || 'Website suggestions are unavailable.')
      setProfile((current) => current ? {
        ...current,
        displayName: current.displayName || next.suggestion?.displayName || '',
        description: current.description || next.suggestion?.description || '',
        coverImageUrl: current.coverImageUrl || next.suggestion?.coverImageUrl || '',
      } : current)
      setNotice('Website suggestions were inserted only into empty fields. Confirm every suggestion before saving.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Website suggestions are unavailable.')
    } finally {
      setBusy(false)
    }
  }

  function updateOffering(index: number, patch: Partial<OfferingDraft>) {
    setOfferings((current) => current.map((entry, position) => position === index ? { ...entry, ...patch } : entry))
  }

  function addOffering() {
    if (!newCategory || !payload?.business || offerings.some((entry) => entry.category === newCategory)) return
    const next = emptyOffering(newCategory, payload.business.name, profile?.serviceAreas ?? [])
    setOfferings((current) => [...current, next])
    setActiveOffering(offerings.length)
    setNewCategory('')
  }

  function removeOffering(index: number) {
    if (offerings.length <= 1 || payload?.business?.type === 'venue') return
    setOfferings((current) => current.filter((_, position) => position !== index))
    setActiveOffering(Math.max(0, index - 1))
  }

  return (
    <PublicPlatformShell>
      <section className="bg-espresso px-4 py-14 text-champagne sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Provider business centre</p>
          <h1 className="mt-4 font-serif text-5xl sm:text-6xl">Build a useful, trustworthy company profile.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-champagne/70">Shared business information is collected once. Each wedding service receives its own relevant questions, pricing, packages and portfolio.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {state === 'checking' && <div className="flex min-h-72 items-center justify-center"><Loader2 className="size-8 animate-spin text-gold-muted" /></div>}
        {state === 'signed-out' && <ProviderSignIn email={email} password={password} showPassword={showPassword} busy={busy} error={error} onEmail={setEmail} onPassword={setPassword} onShowPassword={setShowPassword} onSubmit={signIn} />}
        {state === 'unavailable' && (
          <div className="rounded-3xl border border-gold/20 bg-champagne p-8 text-center">
            <BriefcaseBusiness className="mx-auto size-8 text-gold-muted" />
            <h2 className="mt-4 font-serif text-3xl">Provider workspace unavailable</h2>
            <p role="alert" className="mx-auto mt-3 max-w-xl text-sm leading-6 text-espresso/60">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/register?accountType=vendor" className="rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-champagne">Register a provider account</Link>
              <button type="button" onClick={() => void signOut()} className="rounded-full border border-gold/30 px-5 py-2.5 text-sm font-semibold text-gold-muted">Use another account</button>
            </div>
          </div>
        )}

        {state === 'ready' && profile && verification && payload?.business && offerings.length > 0 && (
          <form onSubmit={save} className="space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/20 bg-white p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">{payload.business.type === 'venue' ? 'Venue account' : 'Provider account'}</p>
                <h2 className="mt-1 font-serif text-3xl">{payload.business.name}</h2>
                <p className="mt-1 text-xs text-espresso/50">{autosavedAt ? `Autosaved locally at ${new Date(autosavedAt).toLocaleTimeString()}` : 'Synced with Wewed'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.slug && <Link href={`/vendors/${profile.slug}`} className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-4 py-2 text-xs font-semibold"><Eye className="size-3.5" />Preview public profile</Link>}
                <button type="button" onClick={() => void signOut()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 text-xs font-semibold text-espresso/65"><LogOut className="size-3.5" />Sign out</button>
              </div>
            </div>

            {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}

            <div className="grid gap-7 xl:grid-cols-[1fr_20rem]">
              <div className="space-y-7">
                <Panel title="Shared company profile" description="This information appears across every service offered by the company.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Public company name"><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} required className={inputClass} /></Field>
                    <Field label="Public profile URL"><input value={profile.slug} onChange={(event) => setProfile({ ...profile, slug: event.target.value })} required className={inputClass} /></Field>
                    <Field label="Headline" wide><input value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} className={inputClass} /></Field>
                    <Field label="Business description" wide><textarea value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} className={`${textareaClass} min-h-32`} /></Field>
                    <Field label="Country"><input value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} autoComplete="country-name" className={inputClass} /></Field>
                    <Field label="City / town"><input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} autoComplete="address-level2" className={inputClass} /></Field>
                    <Checks label="Service areas" options={SERVICE_AREA_OPTIONS} values={profile.serviceAreas} onChange={(values) => setProfile({ ...profile, serviceAreas: values })} wide />
                    <Checks label="Languages" options={LANGUAGE_OPTIONS} values={profile.languages} onChange={(values) => setProfile({ ...profile, languages: values })} wide />
                    <Field label="Public email"><input type="email" value={profile.publicEmail} onChange={(event) => setProfile({ ...profile, publicEmail: event.target.value })} className={inputClass} /></Field>
                    <Field label="Phone"><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className={inputClass} /></Field>
                    <Field label="Website">
                      <div className="flex gap-2">
                        <input type="url" value={profile.website} onChange={(event) => setProfile({ ...profile, website: event.target.value })} placeholder="https://" className={`${inputClass} flex-1`} />
                        <button type="button" onClick={() => void suggestFromWebsite()} disabled={busy} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gold/30 px-3 text-xs font-semibold text-gold-muted"><Sparkles className="size-3.5" />Suggest</button>
                      </div>
                    </Field>
                    <Field label="Instagram"><input type="url" value={profile.socialLinks.instagram || ''} onChange={(event) => setProfile({ ...profile, socialLinks: { ...profile.socialLinks, instagram: event.target.value } })} placeholder="https://" className={inputClass} /></Field>
                    <Field label="Years operating"><input type="number" min="0" max="300" value={profile.yearsOperating} onChange={(event) => setProfile({ ...profile, yearsOperating: event.target.value })} className={inputClass} /></Field>
                    <Field label="Team size"><input type="number" min="1" max="10000" value={profile.teamSize} onChange={(event) => setProfile({ ...profile, teamSize: event.target.value })} className={inputClass} /></Field>
                    <SelectField label="Typical response time" value={profile.responseTime} options={RESPONSE_TIMES} onChange={(value) => setProfile({ ...profile, responseTime: value })} />
                    <SelectField label="Minimum booking notice" value={profile.minimumBookingNotice} options={BOOKING_NOTICE} onChange={(value) => setProfile({ ...profile, minimumBookingNotice: value })} />
                    <Field label="Travel radius (km)"><input type="number" min="0" max="50000" value={profile.travelRadiusKm} onChange={(event) => setProfile({ ...profile, travelRadiusKm: event.target.value })} className={inputClass} /></Field>
                    <Field label="Cover image URL"><input type="url" value={profile.coverImageUrl} onChange={(event) => setProfile({ ...profile, coverImageUrl: event.target.value })} placeholder="https://" className={inputClass} /></Field>
                    <Checks label="Accepted payment methods" options={PAYMENT_METHOD_OPTIONS} values={profile.paymentMethods} onChange={(values) => setProfile({ ...profile, paymentMethods: values })} wide />
                    <Field label="Deposit policy" wide><textarea value={profile.depositPolicy} onChange={(event) => setProfile({ ...profile, depositPolicy: event.target.value })} className={textareaClass} /></Field>
                    <Field label="Cancellation policy" wide><textarea value={profile.cancellationPolicy} onChange={(event) => setProfile({ ...profile, cancellationPolicy: event.target.value })} className={textareaClass} /></Field>
                    <Field label="Refund policy" wide><textarea value={profile.refundPolicy} onChange={(event) => setProfile({ ...profile, refundPolicy: event.target.value })} className={textareaClass} /></Field>
                    <Field label="Travel policy" wide><textarea value={profile.travelPolicy} onChange={(event) => setProfile({ ...profile, travelPolicy: event.target.value })} className={textareaClass} /></Field>
                    <Field label="Accessibility support" wide><textarea value={profile.accessibilitySupport} onChange={(event) => setProfile({ ...profile, accessibilitySupport: event.target.value })} className={textareaClass} /></Field>
                    <Field label="Cultural, traditional and religious wedding experience" wide><textarea value={profile.culturalExperience} onChange={(event) => setProfile({ ...profile, culturalExperience: event.target.value })} className={textareaClass} /></Field>
                  </div>
                  <FaqEditor value={profile.faq} onChange={(faq) => setProfile({ ...profile, faq })} />
                </Panel>

                <Panel title="Private business verification" description="These details support Wewed review. Public pages show only approved verification badges, never document numbers or addresses.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Registered legal name"><input value={verification.legalName} onChange={(event) => setVerification({ ...verification, legalName: event.target.value })} className={inputClass} /></Field>
                    <Field label="Registration number"><input value={verification.registrationNumber} onChange={(event) => setVerification({ ...verification, registrationNumber: event.target.value })} className={inputClass} /></Field>
                    <Field label="Tax number"><input value={verification.taxNumber} onChange={(event) => setVerification({ ...verification, taxNumber: event.target.value })} className={inputClass} /></Field>
                    <Field label="Authorised representative"><input value={verification.representativeName} onChange={(event) => setVerification({ ...verification, representativeName: event.target.value })} className={inputClass} /></Field>
                    <Field label="Physical address" wide><textarea value={verification.physicalAddress} onChange={(event) => setVerification({ ...verification, physicalAddress: event.target.value })} className={textareaClass} /></Field>
                    <Field label="Secondary contact" wide><input value={verification.secondaryContact} onChange={(event) => setVerification({ ...verification, secondaryContact: event.target.value })} className={inputClass} /></Field>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['Identity', verification.identityStatus],
                      ['Business', verification.businessStatus],
                      ['Insurance', verification.insuranceStatus],
                      ['Permit', verification.permitStatus],
                    ].map(([label, value]) => <div key={label} className="rounded-xl border border-gold/15 bg-champagne p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-gold-muted">{label}</p><p className="mt-1 text-sm font-semibold capitalize">{value.replaceAll('_', ' ')}</p></div>)}
                  </div>
                </Panel>

                <Panel title="Service offerings" description="Each category receives a separate form, so cakes, venues, photographers and other businesses are not forced into the same questions.">
                  <div className="flex flex-wrap gap-2">
                    {offerings.map((offering, index) => <button key={`${offering.category}-${index}`} type="button" onClick={() => setActiveOffering(index)} className={`rounded-full px-4 py-2 text-xs font-semibold ${activeOffering === index ? 'bg-espresso text-champagne' : 'border border-gold/25 text-gold-muted'}`}>{providerCategoryLabel(offering.category)} · {offering.completionScore}%</button>)}
                  </div>
                  {payload.business.type !== 'venue' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className={`${selectClass} min-w-64 flex-1`}>
                        <option value="">Add another service…</option>
                        {PROVIDER_CATEGORIES.filter((category) => !offerings.some((offering) => offering.category === category.value)).map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                      </select>
                      <button type="button" onClick={addOffering} disabled={!newCategory} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-espresso disabled:opacity-40"><Plus className="size-4" />Add service</button>
                    </div>
                  )}
                  <OfferingEditor offering={offerings[activeOffering]} index={activeOffering} onUpdate={updateOffering} onRemove={() => removeOffering(activeOffering)} removable={offerings.length > 1 && payload.business.type !== 'venue'} />
                </Panel>
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
                <div className="rounded-3xl border border-gold/20 bg-champagne p-6">
                  <CheckCircle2 className="size-6 text-sage" />
                  <h3 className="mt-4 font-serif text-2xl">Profile readiness</h3>
                  <p className="mt-2 text-4xl font-semibold">{profile.completionScore}%</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-espresso/10"><div className="h-full rounded-full bg-gold" style={{ width: `${profile.completionScore}%` }} /></div>
                  <p className="mt-3 text-xs leading-5 text-espresso/55">Wewed recalculates readiness after saving. Publication requires at least 60% company and service completion.</p>
                </div>
                <div className="rounded-3xl border border-gold/20 bg-white p-6">
                  <h3 className="font-serif text-2xl">Directory visibility</h3>
                  <select value={profile.visibility} onChange={(event) => setProfile({ ...profile, visibility: event.target.value as 'draft' | 'published' })} className={`${selectClass} mt-4`}><option value="draft">Private draft</option><option value="published">Publish when ready</option></select>
                  <p className="mt-3 text-xs leading-5 text-espresso/55">At least one service offering must also be published. Verification-private details are never included.</p>
                </div>
                <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso px-5 py-4 text-sm font-semibold text-champagne disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save and sync profile</button>
                <Link href="/vendors" className="block rounded-2xl border border-gold/25 bg-white px-5 py-4 text-center text-sm font-semibold text-gold-muted">View provider directory</Link>
              </aside>
            </div>
          </form>
        )}
      </section>
    </PublicPlatformShell>
  )
}

function ProviderSignIn({ email, password, showPassword, busy, error, onEmail, onPassword, onShowPassword, onSubmit }: {
  email: string
  password: string
  showPassword: boolean
  busy: boolean
  error: string | null
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onShowPassword: (value: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-gold/20 bg-white p-7 shadow-xl">
      <div className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-espresso text-gold"><Lock className="size-6" /></span><h2 className="mt-4 font-serif text-3xl">Provider sign in</h2><p className="mt-2 text-sm leading-6 text-espresso/58">Use the identity attached to an approved Wewed venue or vendor account.</p></div>
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <Field label="Email"><input type="email" value={email} onChange={(event) => onEmail(event.target.value)} autoComplete="email" required className={inputClass} /></Field>
        <Field label="Password"><div className="relative"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => onPassword(event.target.value)} autoComplete="current-password" required className={`${inputClass} pr-10`} /><button type="button" onClick={() => onShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>
        {error && <p role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-espresso disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Sign in securely</button>
      </form>
      <p className="mt-5 text-center text-xs text-espresso/50">Not approved yet? <Link href="/register?accountType=vendor" className="font-semibold text-gold-muted">Register your business</Link></p>
    </div>
  )
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-7"><h2 className="font-serif text-3xl">{title}</h2><p className="mt-2 text-sm leading-6 text-espresso/55">{description}</p><div className="mt-6">{children}</div></section>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`block text-xs font-semibold text-espresso/70 ${wide ? 'sm:col-span-2' : ''}`}>{label}<div className="mt-1.5">{children}</div></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}><option value="">Select…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
}

function Checks({ label, options, values, onChange, wide = false }: { label: string; options: readonly string[]; values: string[]; onChange: (values: string[]) => void; wide?: boolean }) {
  return <fieldset className={wide ? 'sm:col-span-2' : ''}><legend className="text-xs font-semibold text-espresso/70">{label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{options.map((option) => <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${values.includes(option) ? 'border-gold bg-gold/10' : 'border-gold/15 bg-ivory'}`}><input type="checkbox" checked={values.includes(option)} onChange={() => onChange(toggle(values, option))} className="accent-[#BF9B5F]" />{option}</label>)}</div></fieldset>
}

function DynamicField({ field, value, onChange }: { field: ProviderFieldDefinition; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'checkboxes' || field.type === 'multiselect') return <Checks label={field.label} options={field.options ?? []} values={list(value)} onChange={(values) => onChange(values)} wide />
  if (field.type === 'select') return <SelectField label={field.label} value={stringValue(value)} options={field.options ?? []} onChange={(next) => onChange(next)} />
  if (field.type === 'textarea') return <Field label={field.label} wide><textarea value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={textareaClass} />{field.help && <span className="mt-1 block font-normal text-espresso/45">{field.help}</span>}</Field>
  if (field.type === 'number') return <Field label={field.label}><div className="relative"><input type="number" min={field.min} max={field.max} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={inputClass} />{field.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-espresso/40">{field.unit}</span>}</div></Field>
  return <Field label={field.label} wide={Boolean(field.help)}><input value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={inputClass} />{field.help && <span className="mt-1 block font-normal text-espresso/45">{field.help}</span>}</Field>
}

function OfferingEditor({ offering, index, onUpdate, onRemove, removable }: {
  offering: OfferingDraft
  index: number
  onUpdate: (index: number, patch: Partial<OfferingDraft>) => void
  onRemove: () => void
  removable: boolean
}) {
  return (
    <div className="mt-6 rounded-2xl border border-gold/20 bg-champagne/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">{providerCategoryLabel(offering.category)}</p><h3 className="mt-1 font-serif text-3xl">Category-specific profile</h3></div>{removable && <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 rounded-full border border-clay/30 px-3 py-2 text-xs text-clay"><Trash2 className="size-3.5" />Remove service</button>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Offering name"><input value={offering.displayName} onChange={(event) => onUpdate(index, { displayName: event.target.value })} className={inputClass} /></Field>
        <SelectField label="Offering status" value={offering.status} options={['draft', 'published']} onChange={(value) => onUpdate(index, { status: value as 'draft' | 'published' })} />
        <Field label="Service description" wide><textarea value={offering.description} onChange={(event) => onUpdate(index, { description: event.target.value })} className={`${textareaClass} min-h-28`} /></Field>
        <Field label="Starting price"><input type="number" min="0" step="0.01" value={offering.startingPrice} onChange={(event) => onUpdate(index, { startingPrice: event.target.value })} className={inputClass} /></Field>
        <Field label="Maximum indicative price"><input type="number" min="0" step="0.01" value={offering.maximumPrice} onChange={(event) => onUpdate(index, { maximumPrice: event.target.value })} className={inputClass} /></Field>
        <SelectField label="Currency" value={offering.currency} options={CURRENCIES} onChange={(value) => onUpdate(index, { currency: value })} />
        <SelectField label="Pricing model" value={offering.pricingModel} options={PRICING_MODELS} onChange={(value) => onUpdate(index, { pricingModel: value })} />
        <SelectField label="AI pricing visibility" value={offering.pricingVisibility} options={PRICING_VISIBILITY_OPTIONS} onChange={(value) => onUpdate(index, { pricingVisibility: value })} />
        <Field label="Price valid from"><input type="date" value={offering.priceValidFrom} onChange={(event) => onUpdate(index, { priceValidFrom: event.target.value })} className={inputClass} /></Field>
        <Field label="Price valid until"><input type="date" value={offering.priceValidUntil} onChange={(event) => onUpdate(index, { priceValidUntil: event.target.value })} className={inputClass} /></Field>
        <Field label="Minimum spend"><input type="number" min="0" step="0.01" value={offering.commercialTerms.minimumSpend} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, minimumSpend: event.target.value } })} className={inputClass} /></Field>
        <Field label="Quantity included in base price"><input type="number" min="0" value={offering.commercialTerms.includedQuantity} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, includedQuantity: event.target.value } })} className={inputClass} /></Field>
        <Field label="Additional unit price"><input type="number" min="0" step="0.01" value={offering.commercialTerms.incrementalUnitPrice} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, incrementalUnitPrice: event.target.value } })} className={inputClass} /></Field>
        <Field label="Minimum billable quantity"><input type="number" min="0" value={offering.commercialTerms.minimumBillableQuantity} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, minimumBillableQuantity: event.target.value } })} className={inputClass} /></Field>
        <Field label="Billing increment"><input type="number" min="1" value={offering.commercialTerms.billingIncrement} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, billingIncrement: event.target.value } })} className={inputClass} /></Field>
        <Field label="Setup fee"><input type="number" min="0" step="0.01" value={offering.commercialTerms.setupFee} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, setupFee: event.target.value } })} className={inputClass} /></Field>
        <Field label="Delivery fee"><input type="number" min="0" step="0.01" value={offering.commercialTerms.deliveryFee} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, deliveryFee: event.target.value } })} className={inputClass} /></Field>
        <Field label="Travel included (km)"><input type="number" min="0" value={offering.commercialTerms.includedTravelKm} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, includedTravelKm: event.target.value } })} className={inputClass} /></Field>
        <Field label="Extra travel / km"><input type="number" min="0" step="0.01" value={offering.commercialTerms.travelFeePerKm} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, travelFeePerKm: event.target.value } })} className={inputClass} /></Field>
        <Field label="Overtime rate"><input type="number" min="0" step="0.01" value={offering.commercialTerms.overtimeRate} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, overtimeRate: event.target.value } })} className={inputClass} /></Field>
        <Field label="Overtime unit"><input value={offering.commercialTerms.overtimeUnit} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, overtimeUnit: event.target.value } })} placeholder="Example: hour" className={inputClass} /></Field>
        <SelectField label="Tax included" value={offering.commercialTerms.taxIncluded == null ? '' : offering.commercialTerms.taxIncluded ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={(value) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, taxIncluded: value === 'Yes' } })} />
        <Field label="Tax % if applicable"><input type="number" min="0" max="100" step="0.01" value={offering.commercialTerms.taxPercentage} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, taxPercentage: event.target.value } })} className={inputClass} /></Field>
        <SelectField label="Service charge type" value={offering.commercialTerms.serviceChargeType} options={CHARGE_TYPE_OPTIONS} onChange={(value) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, serviceChargeType: value } })} />
        <Field label="Service charge value"><input type="number" min="0" step="0.01" value={offering.commercialTerms.serviceChargeValue} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, serviceChargeValue: event.target.value } })} className={inputClass} /></Field>
        <SelectField label="Deposit type" value={offering.commercialTerms.depositType} options={DEPOSIT_TYPE_OPTIONS} onChange={(value) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, depositType: value } })} />
        <Field label="Deposit value"><input type="number" min="0" step="0.01" value={offering.commercialTerms.depositValue} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, depositValue: event.target.value } })} className={inputClass} /></Field>
        <SelectField label="Availability source" value={offering.commercialTerms.availabilityMode} options={AVAILABILITY_MODE_OPTIONS} onChange={(value) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, availabilityMode: value } })} />
        <Field label="Balance due rule" wide><input value={offering.commercialTerms.balanceDueRule} onChange={(event) => onUpdate(index, { commercialTerms: { ...offering.commercialTerms, balanceDueRule: event.target.value } })} placeholder="Example: balance due 14 days before the wedding" className={inputClass} /></Field>
        <Field label="Minimum capacity"><input type="number" min="0" value={offering.minimumCapacity} onChange={(event) => onUpdate(index, { minimumCapacity: event.target.value })} className={inputClass} /></Field>
        <Field label="Maximum capacity"><input type="number" min="0" value={offering.maximumCapacity} onChange={(event) => onUpdate(index, { maximumCapacity: event.target.value })} className={inputClass} /></Field>
        <Field label="Booking lead time" wide><input value={offering.bookingLeadTime} onChange={(event) => onUpdate(index, { bookingLeadTime: event.target.value })} placeholder="Example: 3–6 months" className={inputClass} /></Field>
        <Checks label="Offering service areas" options={SERVICE_AREA_OPTIONS} values={offering.serviceAreas} onChange={(values) => onUpdate(index, { serviceAreas: values })} wide />
        <Field label="Inclusions" wide><textarea value={offering.inclusions.join('\n')} onChange={(event) => onUpdate(index, { inclusions: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean) })} placeholder="One inclusion per line" className={textareaClass} /></Field>
      </div>
      <div className="mt-7 border-t border-gold/15 pt-6"><h4 className="font-serif text-2xl">Questions for {providerCategoryLabel(offering.category).toLowerCase()}</h4><p className="mt-1 text-xs text-espresso/50">Only fields relevant to this service are shown. These answers are used with the commercial catalogue so Wewed can calculate fit for each wedding.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{providerServiceFields(offering.category).map((field) => <DynamicField key={field.key} field={field} value={offering.details[field.key]} onChange={(value) => onUpdate(index, { details: { ...offering.details, [field.key]: value } })} />)}</div></div>
      <PriceComponentEditor value={offering.priceComponents} onChange={(priceComponents) => onUpdate(index, { priceComponents })} />
      <div className="mt-6 rounded-2xl border border-gold/25 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-serif text-2xl">AI Planning Readiness</h4><p className="mt-1 text-xs text-espresso/50">Only calculation-ready, current offerings can be selected automatically into an exact-budget Wedding Architect plan.</p></div><span className="rounded-full border border-gold/25 px-3 py-1 text-xs font-semibold">{offering.aiReadinessScore}% · {offering.aiReadinessStatus.replaceAll('_', ' ')}</span></div>
        {offering.aiReadinessMissing.length > 0 && <ul className="mt-3 grid gap-1 text-xs text-espresso/60 sm:grid-cols-2">{offering.aiReadinessMissing.map((item) => <li key={item}>• {item}</li>)}</ul>}
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-gold/20 bg-champagne/35 p-3 text-xs"><input type="checkbox" checked={offering.confirmCommercialPricing} onChange={(event) => onUpdate(index, { confirmCommercialPricing: event.target.checked })} className="mt-0.5 accent-[#BF9B5F]" /><span><strong>Confirm current commercial pricing.</strong> I confirm these prices, fees, inclusions and conditions are current and may be used by Wewed to calculate client-specific wedding plans.</span></label>
        {offering.ownerConfirmedCommercialAt && <p className="mt-2 text-[11px] text-espresso/45">Last confirmed: {new Date(offering.ownerConfirmedCommercialAt).toLocaleString()}</p>}
      </div>
      <PackageEditor value={offering.packages} currency={offering.currency} onChange={(packages) => onUpdate(index, { packages })} />
      <PortfolioEditor value={offering.portfolio} onChange={(portfolio) => onUpdate(index, { portfolio })} />
    </div>
  )
}

function FaqEditor({ value, onChange }: { value: Array<{ question: string; answer: string }>; onChange: (value: Array<{ question: string; answer: string }>) => void }) {
  return <div className="mt-7 border-t border-gold/15 pt-6"><div className="flex items-center justify-between gap-3"><div><h3 className="font-serif text-2xl">Frequently asked questions</h3><p className="mt-1 text-xs text-espresso/50">Help couples understand the booking process before enquiring.</p></div><button type="button" onClick={() => onChange([...value, { question: '', answer: '' }])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add FAQ</button></div><div className="mt-4 space-y-3">{value.map((item, index) => <div key={index} className="grid gap-2 rounded-xl border border-gold/15 bg-ivory p-3 sm:grid-cols-[1fr_1.5fr_auto]"><input value={item.question} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, question: event.target.value } : entry))} placeholder="Question" className={inputClass} /><textarea value={item.answer} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, answer: event.target.value } : entry))} placeholder="Answer" className={`${textareaClass} min-h-20`} /><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} aria-label="Remove FAQ" className="self-start rounded-xl border border-clay/25 p-3 text-clay"><Trash2 className="size-4" /></button></div>)}</div></div>
}

function PriceComponentEditor({ value, onChange }: { value: PriceComponentDraft[]; onChange: (value: PriceComponentDraft[]) => void }) {
  return <div className="mt-7 border-t border-gold/15 pt-6"><div className="flex items-center justify-between gap-3"><div><h4 className="font-serif text-2xl">Structured price components</h4><p className="mt-1 text-xs text-espresso/50">Break down charges that Wewed must calculate instead of asking AI to guess them.</p></div><button type="button" onClick={() => onChange([...value, { id: `component-${Date.now()}`, label: '', type: 'fixed', amount: '', unit: '', condition: '', minimumQuantity: '', maximumQuantity: '' }])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add component</button></div><div className="mt-4 space-y-3">{value.map((item, index) => <div key={item.id || index} className="grid gap-3 rounded-xl border border-gold/15 bg-white p-4 sm:grid-cols-2"><input value={item.label} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} placeholder="Charge name — e.g. Adult guest" className={inputClass} /><select value={item.type} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, type: event.target.value } : entry))} className={selectClass}>{PRICE_COMPONENT_TYPES.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select><input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, amount: event.target.value } : entry))} placeholder="Amount or percentage" className={inputClass} /><input value={item.unit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, unit: event.target.value } : entry))} placeholder="Unit — guest, hour, item…" className={inputClass} /><input type="number" min="0" value={item.minimumQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, minimumQuantity: event.target.value } : entry))} placeholder="Minimum quantity" className={inputClass} /><input type="number" min="0" value={item.maximumQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, maximumQuantity: event.target.value } : entry))} placeholder="Maximum quantity" className={inputClass} /><textarea value={item.condition} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, condition: event.target.value } : entry))} placeholder="When does this component apply?" className={`${textareaClass} min-h-20 sm:col-span-2`} /><div className="sm:col-span-2 flex justify-end"><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} className="inline-flex items-center gap-1 text-xs text-clay"><Trash2 className="size-3.5" />Remove component</button></div></div>)}</div></div>
}

function PackageEditor({ value, currency, onChange }: { value: PackageDraft[]; currency: string; onChange: (value: PackageDraft[]) => void }) {
  const emptyPackage = (): PackageDraft => ({ name: '', description: '', price: '', currency, pricingUnit: '', inclusions: [], minimumQuantity: '', maximumQuantity: '', includedQuantity: '', additionalUnitPrice: '', exclusions: [], requiredAddOns: [], optionalAddOns: [], commercialTerms: commercialTermsDraft({}), priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })
  return <div className="mt-7 border-t border-gold/15 pt-6"><div className="flex items-center justify-between gap-3"><div><h4 className="font-serif text-2xl">Packages</h4><p className="mt-1 text-xs text-espresso/50">Packages are calculation-ready catalogue products: include quantities, overage pricing, exclusions, add-ons and validity.</p></div><button type="button" onClick={() => onChange([...value, emptyPackage()])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add package</button></div><div className="mt-4 space-y-4">{value.map((item, index) => <div key={index} className="rounded-xl border border-gold/15 bg-white p-4"><div className="grid gap-3 sm:grid-cols-2"><input value={item.name} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry))} placeholder="Package name" className={inputClass} /><input type="number" min="0" step="0.01" value={item.price} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, price: event.target.value } : entry))} placeholder="Base price" className={inputClass} /><input value={item.pricingUnit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, pricingUnit: event.target.value } : entry))} placeholder="Pricing unit — package, guest, hour…" className={inputClass} /><input type="date" value={item.priceValidUntil} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, priceValidUntil: event.target.value } : entry))} className={inputClass} /><input type="number" min="0" value={item.minimumQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, minimumQuantity: event.target.value } : entry))} placeholder="Minimum quantity" className={inputClass} /><input type="number" min="0" value={item.maximumQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, maximumQuantity: event.target.value } : entry))} placeholder="Maximum quantity" className={inputClass} /><input type="number" min="0" value={item.includedQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, includedQuantity: event.target.value } : entry))} placeholder="Quantity included" className={inputClass} /><input type="number" min="0" step="0.01" value={item.additionalUnitPrice} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, additionalUnitPrice: event.target.value } : entry))} placeholder="Additional unit price" className={inputClass} /><textarea value={item.description} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, description: event.target.value } : entry))} placeholder="Package description" className={textareaClass} /><textarea value={item.inclusions.join('\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, inclusions: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="One inclusion per line" className={textareaClass} /><textarea value={item.exclusions.join('\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, exclusions: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="One exclusion per line" className={textareaClass} /><textarea value={item.optionalAddOns.join('\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, optionalAddOns: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="Optional add-ons, one per line" className={textareaClass} /></div><PriceComponentEditor value={item.priceComponents} onChange={(priceComponents) => onChange(value.map((entry, position) => position === index ? { ...entry, priceComponents } : entry))} /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-espresso/45">Catalogue completeness: {item.completionScore}%</span><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} className="inline-flex items-center gap-1 text-xs text-clay"><Trash2 className="size-3.5" />Remove package</button></div></div>)}</div></div>
}

function PortfolioEditor({ value, onChange }: { value: PortfolioDraft[]; onChange: (value: PortfolioDraft[]) => void }) {
  return <div className="mt-7 border-t border-gold/15 pt-6"><div className="flex items-center justify-between gap-3"><div><h4 className="font-serif text-2xl">Portfolio</h4><p className="mt-1 text-xs text-espresso/50">Use HTTPS image, video or portfolio links and describe them for accessibility.</p></div><button type="button" onClick={() => onChange([...value, { type: 'image', url: '', thumbnailUrl: '', altText: '', caption: '' }])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add item</button></div><div className="mt-4 space-y-3">{value.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-gold/15 bg-white p-4 sm:grid-cols-2"><select value={item.type} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, type: event.target.value as PortfolioDraft['type'] } : entry))} className={selectClass}><option value="image">Image</option><option value="video">Video</option><option value="link">External portfolio link</option></select><input type="url" value={item.url} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, url: event.target.value } : entry))} placeholder="https://" className={inputClass} /><input value={item.altText} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, altText: event.target.value } : entry))} placeholder="What the image or video shows" className={inputClass} /><input value={item.caption} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, caption: event.target.value } : entry))} placeholder="Public caption" className={inputClass} /><div className="sm:col-span-2 flex justify-end"><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} className="inline-flex items-center gap-1 text-xs text-clay"><Trash2 className="size-3.5" />Remove item</button></div></div>)}</div></div>
}
