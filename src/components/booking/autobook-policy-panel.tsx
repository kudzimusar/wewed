'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2, Save, ShieldCheck } from 'lucide-react'

type Policy = {
  maxAction?: string
  maxPerBookingCents?: number | null
  maxTotalOpenCents?: number | null
  maxDepositCents?: number | null
  allowedCategories?: unknown
  allowedBookingModes?: unknown
  allowedProviderSlugs?: unknown
  allowedRiskClasses?: unknown
  excludedCatalogItemIds?: unknown
  allowNonRefundable?: boolean
  allowHold?: boolean
  allowRequestSubmission?: boolean
  allowInstantConfirmation?: boolean
  allowContractAcceptance?: boolean
  allowPayment?: boolean
  expiresAt?: string | null
  approvedAt?: string | null
  revokedAt?: string | null
  isActive?: boolean
}

const bookingModes = [
  ['instant','Instant Book'],
  ['request','Request to book'],
  ['quote','Request quote'],
  ['appointment','Appointment'],
] as const

function centsToInput(value: number | null | undefined) {
  return value == null ? '' : (value / 100).toFixed(2)
}

function inputToCents(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Money limits must use a non-negative amount with at most two decimal places.')
  const [whole, fraction = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function commaList(value: unknown) {
  return stringList(value).join(', ')
}

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function AutoBookPolicyPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [maxAction, setMaxAction] = useState('prepare')
  const [perBooking, setPerBooking] = useState('')
  const [openTotal, setOpenTotal] = useState('')
  const [depositLimit, setDepositLimit] = useState('')
  const [allowedCategories, setAllowedCategories] = useState('')
  const [allowedModes, setAllowedModes] = useState<string[]>([])
  const [allowedProviderSlugs, setAllowedProviderSlugs] = useState('')
  const [allowedRiskClasses, setAllowedRiskClasses] = useState('')
  const [excludedItems, setExcludedItems] = useState('')
  const [allowNonRefundable, setAllowNonRefundable] = useState(false)
  const [allowHold, setAllowHold] = useState(false)
  const [allowRequestSubmission, setAllowRequestSubmission] = useState(false)
  const [allowInstantConfirmation, setAllowInstantConfirmation] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await fetch('/api/bookings/auto-policy', { credentials: 'include', cache: 'no-store' })
        const payload = await response.json() as { success?: boolean; data?: Policy | null; error?: string }
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load AutoBook policy.')
        if (!active) return
        const policy = payload.data
        if (policy) {
          setEnabled(policy.isActive !== false && !policy.revokedAt)
          setMaxAction(policy.maxAction || 'prepare')
          setPerBooking(centsToInput(policy.maxPerBookingCents))
          setOpenTotal(centsToInput(policy.maxTotalOpenCents))
          setDepositLimit(centsToInput(policy.maxDepositCents))
          setAllowedCategories(commaList(policy.allowedCategories))
          setAllowedModes(stringList(policy.allowedBookingModes))
          setAllowedProviderSlugs(commaList(policy.allowedProviderSlugs))
          setAllowedRiskClasses(commaList(policy.allowedRiskClasses))
          setExcludedItems(commaList(policy.excludedCatalogItemIds))
          setAllowNonRefundable(policy.allowNonRefundable === true)
          setAllowHold(policy.allowHold === true)
          setAllowRequestSubmission(policy.allowRequestSubmission === true)
          setAllowInstantConfirmation(policy.allowInstantConfirmation === true)
          setExpiresAt(toLocalDateTime(policy.expiresAt))
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load AutoBook policy.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  function toggleMode(mode: string) {
    setAllowedModes((current) => current.includes(mode) ? current.filter((entry) => entry !== mode) : [...current, mode])
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/bookings/auto-policy', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          maxAction,
          maxPerBookingCents: inputToCents(perBooking),
          maxTotalOpenCents: inputToCents(openTotal),
          maxDepositCents: inputToCents(depositLimit),
          allowedCategories: allowedCategories.split(',').map((value) => value.trim()).filter(Boolean),
          allowedBookingModes: allowedModes,
          allowedProviderSlugs: allowedProviderSlugs.split(',').map((value) => value.trim()).filter(Boolean),
          allowedRiskClasses: allowedRiskClasses.split(',').map((value) => value.trim()).filter(Boolean),
          excludedCatalogItemIds: excludedItems.split(',').map((value) => value.trim()).filter(Boolean),
          allowNonRefundable,
          allowHold,
          allowRequestSubmission,
          allowInstantConfirmation,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          isActive: enabled,
        }),
      })
      const payload = await response.json() as { success?: boolean; data?: Policy; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save AutoBook policy.')
      setMessage(enabled ? 'AutoBook authorization saved. Contract acceptance and payments remain prohibited.' : 'AutoBook authorization revoked for this wedding.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save AutoBook policy.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="mt-5 rounded-3xl border border-gold/20 bg-champagne/5 p-5 sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-gold"><Bot className="size-4" /> Wedding Architect AutoBook</div>
        <h2 className="mt-2 font-serif text-3xl">Set the boundary before AI can act</h2>
        <p className="mt-2 text-sm leading-6 text-champagne/60">AutoBook is deterministic automation, not open-ended purchasing authority. The action ceiling and each execution permission are enforced separately, so “request” permission cannot silently become an Instant Book confirmation.</p>
      </div>
      <label className="inline-flex items-center gap-3 rounded-full border border-gold/25 px-4 py-2 text-sm font-semibold">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4" /> Enabled
      </label>
    </div>

    {loading ? <div className="mt-4 inline-flex items-center gap-2 text-sm text-champagne/55"><Loader2 className="size-4 animate-spin" /> Loading policy…</div> : <>
      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-semibold text-champagne/70">Highest AI action
          <select value={maxAction} onChange={(event) => setMaxAction(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne">
            <option value="suggest">Suggest only</option>
            <option value="prepare">Prepare booking draft</option>
            <option value="hold">Create temporary inventory hold</option>
            <option value="request">Send booking / quote request</option>
            <option value="confirm">Confirm only when deterministic gates allow</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-champagne/70">Maximum per booking (optional)
          <input value={perBooking} onChange={(event) => setPerBooking(event.target.value)} inputMode="decimal" placeholder="500.00" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
        <label className="text-xs font-semibold text-champagne/70">Maximum deposit (optional)
          <input value={depositLimit} onChange={(event) => setDepositLimit(event.target.value)} inputMode="decimal" placeholder="150.00" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
        <label className="text-xs font-semibold text-champagne/70">Maximum total open commitments (optional)
          <input value={openTotal} onChange={(event) => setOpenTotal(event.target.value)} inputMode="decimal" placeholder="2500.00" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
        <label className="text-xs font-semibold text-champagne/70">Allowed service categories (optional)
          <input value={allowedCategories} onChange={(event) => setAllowedCategories(event.target.value)} placeholder="attire, decor-rentals, photographer" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
        <label className="text-xs font-semibold text-champagne/70">Authorization expires (optional)
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
      </div>

      <fieldset className="mt-5 rounded-2xl border border-gold/15 p-4">
        <legend className="px-2 text-xs font-bold uppercase tracking-[0.12em] text-gold">Allowed booking modes</legend>
        <p className="mb-3 text-xs text-champagne/50">Leave all unchecked to allow any mode that still passes the other policy gates.</p>
        <div className="flex flex-wrap gap-3">{bookingModes.map(([value,label]) => <label key={value} className="inline-flex items-center gap-2 rounded-full border border-gold/20 px-3 py-2 text-xs text-champagne/75"><input type="checkbox" checked={allowedModes.includes(value)} onChange={() => toggleMode(value)} /> {label}</label>)}</div>
      </fieldset>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="text-xs font-semibold text-champagne/70">Allowed provider slugs (optional)
          <input value={allowedProviderSlugs} onChange={(event) => setAllowedProviderSlugs(event.target.value)} placeholder="shandy-events, studio-example" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
          <span className="mt-1 block font-normal text-champagne/40">Leave blank for any provider that passes marketplace and policy checks.</span>
        </label>
        <label className="text-xs font-semibold text-champagne/70">Allowed risk classes (optional)
          <input value={allowedRiskClasses} onChange={(event) => setAllowedRiskClasses(event.target.value)} placeholder="standard, low" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
        <label className="text-xs font-semibold text-champagne/70">Excluded catalogue item IDs (advanced)
          <input value={excludedItems} onChange={(event) => setExcludedItems(event.target.value)} placeholder="Leave blank unless explicitly excluding an item" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-start gap-2 rounded-2xl border border-gold/15 p-3 text-xs text-champagne/70"><input className="mt-0.5" type="checkbox" checked={allowHold} onChange={(event) => setAllowHold(event.target.checked)} /><span><strong className="block text-champagne">Allow inventory holds</strong>May temporarily reserve deterministic inventory.</span></label>
        <label className="flex items-start gap-2 rounded-2xl border border-gold/15 p-3 text-xs text-champagne/70"><input className="mt-0.5" type="checkbox" checked={allowRequestSubmission} onChange={(event) => setAllowRequestSubmission(event.target.checked)} /><span><strong className="block text-champagne">Allow request submission</strong>May submit request/quote workflows to a vendor.</span></label>
        <label className="flex items-start gap-2 rounded-2xl border border-gold/15 p-3 text-xs text-champagne/70"><input className="mt-0.5" type="checkbox" checked={allowInstantConfirmation} onChange={(event) => setAllowInstantConfirmation(event.target.checked)} /><span><strong className="block text-champagne">Allow Instant Book confirmation</strong>May confirm only when price, inventory and all other gates pass.</span></label>
        <label className="flex items-start gap-2 rounded-2xl border border-gold/15 p-3 text-xs text-champagne/70"><input className="mt-0.5" type="checkbox" checked={allowNonRefundable} onChange={(event) => setAllowNonRefundable(event.target.checked)} /><span><strong className="block text-champagne">Allow non-refundable risk</strong>Only applies to items explicitly marked non-refundable.</span></label>
      </div>
    </>}

    <div className="mt-5 flex justify-end">
      <button disabled={loading || saving} onClick={() => void save()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-champagne px-5 text-sm font-bold text-espresso disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save AutoBook policy</button>
    </div>

    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-3 text-xs leading-5 text-emerald-100"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span><strong>Hard safety boundary:</strong> AI cannot accept a Wewed contract and cannot make or record a payment. Those fields are forced false by the API and protected again by database constraints. Disabling this policy records revocation rather than deleting history.</span></div>
    {message ? <div className="mt-3 text-xs text-champagne/65">{message}</div> : null}
  </section>
}
