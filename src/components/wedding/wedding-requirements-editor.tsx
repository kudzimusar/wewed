'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import {
  PROVIDER_CATEGORIES,
  providerCategoryLabel,
} from '@/lib/provider-catalog'
import {
  WEDDING_PLAN_STRATEGIES,
  WEDDING_REQUIREMENT_PRIORITIES,
  weddingRequirementFields,
  type WeddingRequirementField,
} from '@/lib/wedding-requirement-catalog'
import { WEDDING_BUDGET_CURRENCIES } from '@/lib/wedding-requirements'

type WeddingSummary = {
  id: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
}

type ProfileDraft = {
  totalBudget: string
  currency: string
  contingencyPercent: string
  budgetFlexibilityPercent: string
  guestCount: string
  adultCount: string
  childCount: string
  dateFlexibilityDays: string
  country: string
  city: string
  locationRadiusKm: string
  ceremonyType: string
  receptionType: string
  strategy: string
  styleTags: string[]
  culturalRequirements: string[]
  paymentConstraints: {
    maxMonthlySpend: string
    maxSingleDeposit: string
    paymentPlanPreferred: boolean
  }
  notes: string
  completionScore: number
  confirmedAt: string | null
}

type CategoryDraft = {
  category: string
  priority: string
  requirements: Record<string, unknown>
  notes: string
}

type RequirementPayload = {
  success?: boolean
  error?: string
  wedding?: WeddingSummary
  profile?: Record<string, unknown> | null
  categories?: Array<Record<string, unknown>>
}

const inputClass = 'h-11 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'
const textareaClass = 'min-h-24 w-full rounded-xl border border-gold/25 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'

function stringValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function emptyProfile(wedding?: WeddingSummary): ProfileDraft {
  return {
    totalBudget: '',
    currency: 'USD',
    contingencyPercent: '',
    budgetFlexibilityPercent: '',
    guestCount: '',
    adultCount: '',
    childCount: '',
    dateFlexibilityDays: '',
    country: wedding?.venueCountry ?? '',
    city: wedding?.venueCity ?? '',
    locationRadiusKm: '',
    ceremonyType: '',
    receptionType: '',
    strategy: 'balanced',
    styleTags: [],
    culturalRequirements: [],
    paymentConstraints: {
      maxMonthlySpend: '',
      maxSingleDeposit: '',
      paymentPlanPreferred: false,
    },
    notes: '',
    completionScore: 0,
    confirmedAt: null,
  }
}

function mapProfile(row: Record<string, unknown> | null | undefined, wedding?: WeddingSummary): ProfileDraft {
  if (!row) return emptyProfile(wedding)
  const payment = object(row.paymentConstraints)
  const centsToAmount = (value: unknown) => typeof value === 'number' ? (value / 100).toFixed(2).replace(/\.00$/, '') : ''
  return {
    totalBudget: stringValue(row.totalBudget),
    currency: stringValue(row.currency) || 'USD',
    contingencyPercent: stringValue(row.contingencyPercent),
    budgetFlexibilityPercent: stringValue(row.budgetFlexibilityPercent),
    guestCount: stringValue(row.guestCount),
    adultCount: stringValue(row.adultCount),
    childCount: stringValue(row.childCount),
    dateFlexibilityDays: stringValue(row.dateFlexibilityDays),
    country: stringValue(row.country) || wedding?.venueCountry || '',
    city: stringValue(row.city) || wedding?.venueCity || '',
    locationRadiusKm: stringValue(row.locationRadiusKm),
    ceremonyType: stringValue(row.ceremonyType),
    receptionType: stringValue(row.receptionType),
    strategy: stringValue(row.strategy) || 'balanced',
    styleTags: list(row.styleTags),
    culturalRequirements: list(row.culturalRequirements),
    paymentConstraints: {
      maxMonthlySpend: centsToAmount(payment.maxMonthlySpendCents),
      maxSingleDeposit: centsToAmount(payment.maxSingleDepositCents),
      paymentPlanPreferred: payment.paymentPlanPreferred === true,
    },
    notes: stringValue(row.notes),
    completionScore: Number(row.completionScore || 0),
    confirmedAt: typeof row.confirmedAt === 'string' ? row.confirmedAt : null,
  }
}

function mapCategories(rows: Array<Record<string, unknown>> | undefined): CategoryDraft[] {
  return (rows ?? []).map((row) => ({
    category: stringValue(row.category),
    priority: stringValue(row.priority) || 'preferred',
    requirements: object(row.requirements),
    notes: stringValue(row.notes),
  })).filter((row) => row.category)
}

function LinesEditor({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string
  values: string[]
  placeholder: string
  onChange: (value: string[]) => void
}) {
  return (
    <Field label={label} wide>
      <textarea
        value={values.join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean))}
        placeholder={placeholder}
        className={textareaClass}
      />
    </Field>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`block text-xs font-semibold text-espresso/70 ${wide ? 'sm:col-span-2' : ''}`}>{label}<div className="mt-1.5">{children}</div></label>
}

function RequirementField({ definition, value, onChange }: {
  definition: WeddingRequirementField
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (definition.type === 'boolean') {
    return (
      <Field label={definition.label}>
        <select
          value={typeof value === 'boolean' ? (value ? 'yes' : 'no') : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value === 'yes')}
          className={inputClass}
        >
          <option value="">Not specified</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        <span className="mt-1 block text-[11px] font-normal leading-4 text-espresso/45">{definition.help}</span>
      </Field>
    )
  }

  if (definition.type === 'select') {
    return (
      <Field label={definition.label}>
        <select value={stringValue(value)} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="">Not specified</option>
          {(definition.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span className="mt-1 block text-[11px] font-normal leading-4 text-espresso/45">{definition.help}</span>
      </Field>
    )
  }

  if (definition.type === 'multiselect') {
    const selected = list(value)
    return (
      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-semibold text-espresso/70">{definition.label}</legend>
        <p className="mt-1 text-[11px] leading-4 text-espresso/45">{definition.help}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(definition.options ?? []).map((option) => {
            const active = selected.includes(option)
            return <label key={option} className={`cursor-pointer rounded-full border px-3 py-2 text-xs ${active ? 'border-gold bg-gold/10' : 'border-gold/15 bg-white'}`}><input className="sr-only" type="checkbox" checked={active} onChange={() => onChange(active ? selected.filter((entry) => entry !== option) : [...selected, option])} />{option}</label>
          })}
        </div>
      </fieldset>
    )
  }

  if (definition.type === 'number') {
    return (
      <Field label={definition.label}>
        <div className="relative">
          <input
            type="number"
            min={definition.min}
            max={definition.max}
            value={stringValue(value)}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          />
          {definition.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-espresso/40">{definition.unit}</span>}
        </div>
        <span className="mt-1 block text-[11px] font-normal leading-4 text-espresso/45">{definition.help}</span>
      </Field>
    )
  }

  return (
    <Field label={definition.label} wide>
      <input value={stringValue(value)} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      <span className="mt-1 block text-[11px] font-normal leading-4 text-espresso/45">{definition.help}</span>
    </Field>
  )
}

export function WeddingRequirementsEditor() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wedding, setWedding] = useState<WeddingSummary | null>(null)
  const [profile, setProfile] = useState<ProfileDraft>(() => emptyProfile())
  const [categories, setCategories] = useState<CategoryDraft[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/wedding-requirements', { cache: 'no-store', credentials: 'same-origin' })
      const result = await response.json() as RequirementPayload
      if (!response.ok || !result.success || !result.wedding) throw new Error(result.error || 'Unable to load the wedding brief.')
      setWedding(result.wedding)
      setProfile(mapProfile(result.profile, result.wedding))
      setCategories(mapCategories(result.categories))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the wedding brief.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const availableCategories = useMemo(
    () => PROVIDER_CATEGORIES.filter((entry) => !categories.some((category) => category.category === entry.value)),
    [categories],
  )

  function addCategory() {
    if (!newCategory || categories.some((entry) => entry.category === newCategory)) return
    setCategories((current) => [...current, { category: newCategory, priority: 'preferred', requirements: {}, notes: '' }])
    setNewCategory('')
    setProfile((current) => ({ ...current, confirmedAt: null }))
  }

  function updateCategory(index: number, patch: Partial<CategoryDraft>) {
    setCategories((current) => current.map((entry, position) => position === index ? { ...entry, ...patch } : entry))
    setProfile((current) => ({ ...current, confirmedAt: null }))
  }

  function updateProfile(patch: Partial<ProfileDraft>) {
    setProfile((current) => ({ ...current, ...patch, confirmedAt: null }))
  }

  async function save(confirmBrief: boolean) {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/wedding-requirements', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { ...profile, confirmBrief },
          categories,
        }),
      })
      const result = await response.json() as RequirementPayload
      if (!response.ok || !result.success || !result.wedding) throw new Error(result.error || 'Unable to save the wedding brief.')
      setWedding(result.wedding)
      setProfile(mapProfile(result.profile, result.wedding))
      setCategories(mapCategories(result.categories))
      setNotice(confirmBrief ? 'Wedding brief confirmed for AI planning and optimisation.' : 'Wedding brief saved as a working draft.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the wedding brief.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div>

  return (
    <div className="space-y-6">
      {wedding && (
        <div className="rounded-3xl border border-gold/20 bg-champagne/[0.05] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Shared wedding brief</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-serif text-3xl text-champagne">{wedding.title}</h2><p className="mt-1 text-xs text-champagne/55">{new Date(wedding.date).toLocaleDateString()} · {[wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')}</p></div>
            <div className="text-right"><p className="text-xs text-champagne/50">Brief completion</p><p className="text-2xl font-semibold text-gold">{profile.completionScore}%</p></div>
          </div>
        </div>
      )}

      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-clay/30 bg-clay/10 text-clay' : 'border-sage/30 bg-sage/10 text-sage'}`}>{error || notice}</p>}

      <section className="rounded-3xl border border-gold/20 bg-champagne p-6 text-espresso">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-serif text-3xl">Budget and wedding shape</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-espresso/55">This is the same operational brief whether completed by the couple or by an authorised planner. Wewed will later calculate against real provider catalogue prices.</p></div>
          {profile.confirmedAt && <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs font-semibold text-sage"><CheckCircle2 className="size-3.5" />Confirmed</span>}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Total wedding budget"><input type="number" min="0" step="0.01" value={profile.totalBudget} onChange={(event) => updateProfile({ totalBudget: event.target.value })} className={inputClass} /></Field>
          <Field label="Currency"><select value={profile.currency} onChange={(event) => updateProfile({ currency: event.target.value })} className={inputClass}>{WEDDING_BUDGET_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Contingency target (%)"><input type="number" min="0" max="100" step="0.1" value={profile.contingencyPercent} onChange={(event) => updateProfile({ contingencyPercent: event.target.value })} className={inputClass} /></Field>
          <Field label="Budget flexibility (%)"><input type="number" min="0" max="100" step="0.1" value={profile.budgetFlexibilityPercent} onChange={(event) => updateProfile({ budgetFlexibilityPercent: event.target.value })} className={inputClass} /></Field>
          <Field label="Total guests"><input type="number" min="0" value={profile.guestCount} onChange={(event) => updateProfile({ guestCount: event.target.value })} className={inputClass} /></Field>
          <Field label="Adults"><input type="number" min="0" value={profile.adultCount} onChange={(event) => updateProfile({ adultCount: event.target.value })} className={inputClass} /></Field>
          <Field label="Children"><input type="number" min="0" value={profile.childCount} onChange={(event) => updateProfile({ childCount: event.target.value })} className={inputClass} /></Field>
          <Field label="Date flexibility (days)"><input type="number" min="0" value={profile.dateFlexibilityDays} onChange={(event) => updateProfile({ dateFlexibilityDays: event.target.value })} className={inputClass} /></Field>
          <Field label="Country"><input value={profile.country} onChange={(event) => updateProfile({ country: event.target.value })} className={inputClass} /></Field>
          <Field label="City / area"><input value={profile.city} onChange={(event) => updateProfile({ city: event.target.value })} className={inputClass} /></Field>
          <Field label="Search radius (km)"><input type="number" min="0" value={profile.locationRadiusKm} onChange={(event) => updateProfile({ locationRadiusKm: event.target.value })} className={inputClass} /></Field>
          <Field label="Planning strategy"><select value={profile.strategy} onChange={(event) => updateProfile({ strategy: event.target.value })} className={inputClass}>{WEDDING_PLAN_STRATEGIES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Field>
          <Field label="Ceremony type"><input value={profile.ceremonyType} onChange={(event) => updateProfile({ ceremonyType: event.target.value })} placeholder="Civil, religious, traditional…" className={inputClass} /></Field>
          <Field label="Reception type"><input value={profile.receptionType} onChange={(event) => updateProfile({ receptionType: event.target.value })} placeholder="Dinner, cocktail, garden…" className={inputClass} /></Field>
          <LinesEditor label="Style priorities" values={profile.styleTags} onChange={(styleTags) => updateProfile({ styleTags })} placeholder="One style per line — e.g. Modern" />
          <LinesEditor label="Cultural / ceremony requirements" values={profile.culturalRequirements} onChange={(culturalRequirements) => updateProfile({ culturalRequirements })} placeholder="One requirement per line" />
        </div>
      </section>

      <section className="rounded-3xl border border-gold/20 bg-champagne p-6 text-espresso">
        <h3 className="font-serif text-3xl">Payment comfort</h3>
        <p className="mt-1 text-sm leading-6 text-espresso/55">These constraints help Wewed avoid a plan that fits the total budget but creates an unrealistic deposit or cash-flow schedule.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Maximum monthly spend"><input type="number" min="0" step="0.01" value={profile.paymentConstraints.maxMonthlySpend} onChange={(event) => updateProfile({ paymentConstraints: { ...profile.paymentConstraints, maxMonthlySpend: event.target.value } })} className={inputClass} /></Field>
          <Field label="Maximum single deposit"><input type="number" min="0" step="0.01" value={profile.paymentConstraints.maxSingleDeposit} onChange={(event) => updateProfile({ paymentConstraints: { ...profile.paymentConstraints, maxSingleDeposit: event.target.value } })} className={inputClass} /></Field>
          <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-gold/20 bg-white p-3 text-sm"><input type="checkbox" checked={profile.paymentConstraints.paymentPlanPreferred} onChange={(event) => updateProfile({ paymentConstraints: { ...profile.paymentConstraints, paymentPlanPreferred: event.target.checked } })} className="accent-[#BF9B5F]" />Prefer providers offering payment plans where practical</label>
        </div>
      </section>

      <section className="rounded-3xl border border-gold/20 bg-champagne p-6 text-espresso">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-serif text-3xl">Wedding categories</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-espresso/55">Choose what the wedding actually needs. Priority tells the optimiser what it may trade off and what it must protect.</p></div>
          <div className="flex gap-2"><select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className={inputClass}><option value="">Add category…</option>{availableCategories.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select><button type="button" onClick={addCategory} disabled={!newCategory} className="inline-flex items-center gap-1 rounded-xl border border-gold/30 px-3 text-xs font-semibold disabled:opacity-40"><Plus className="size-3.5" />Add</button></div>
        </div>

        <div className="mt-5 space-y-4">
          {categories.length === 0 && <p className="rounded-xl border border-dashed border-gold/30 p-5 text-sm text-espresso/50">No service categories selected yet. Add the services this wedding needs.</p>}
          {categories.map((category, index) => (
            <div key={category.category} className="rounded-2xl border border-gold/20 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-muted">Wedding requirement</p><h4 className="mt-1 font-serif text-2xl">{providerCategoryLabel(category.category)}</h4></div>
                <div className="flex items-center gap-2"><select value={category.priority} onChange={(event) => updateCategory(index, { priority: event.target.value })} className={inputClass}>{WEDDING_REQUIREMENT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority.replaceAll('_', ' ')}</option>)}</select><button type="button" aria-label={`Remove ${providerCategoryLabel(category.category)}`} onClick={() => { setCategories((current) => current.filter((_, position) => position !== index)); setProfile((current) => ({ ...current, confirmedAt: null })) }} className="rounded-xl border border-clay/25 p-3 text-clay"><Trash2 className="size-4" /></button></div>
              </div>
              {category.priority !== 'not_required' && <div className="mt-5 grid gap-4 sm:grid-cols-2">{weddingRequirementFields(category.category).map((definition) => <RequirementField key={definition.key} definition={definition} value={category.requirements[definition.key]} onChange={(value) => updateCategory(index, { requirements: { ...category.requirements, [definition.key]: value } })} />)}</div>}
              <Field label="Category notes" wide><textarea value={category.notes} onChange={(event) => updateCategory(index, { notes: event.target.value })} placeholder="Anything Wewed should consider for this category" className={`${textareaClass} mt-4`} /></Field>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gold/20 bg-champagne p-6 text-espresso">
        <Field label="Overall notes"><textarea value={profile.notes} onChange={(event) => updateProfile({ notes: event.target.value })} placeholder="Anything else that should shape the wedding plan" className={textareaClass} /></Field>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => void save(false)} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save draft</button>
          <button type="button" onClick={() => void save(true)} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-espresso disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Confirm for AI planning</button>
        </div>
      </section>
    </div>
  )
}
