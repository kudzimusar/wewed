'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2, Save, ShieldCheck } from 'lucide-react'

type Policy = {
  maxAction?: string
  maxPerBookingCents?: number | null
  maxTotalOpenCents?: number | null
  allowedCategories?: unknown
  allowNonRefundable?: boolean
  allowContractAcceptance?: boolean
  allowPayment?: boolean
  isActive?: boolean
}

function centsToInput(value: number | null | undefined) {
  return value == null ? '' : (value / 100).toFixed(2)
}

function inputToCents(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Money limits must use a positive amount with at most two decimal places.')
  const [whole, fraction = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

function categories(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').join(', ') : ''
}

export function AutoBookPolicyPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [maxAction, setMaxAction] = useState('prepare')
  const [perBooking, setPerBooking] = useState('')
  const [openTotal, setOpenTotal] = useState('')
  const [allowedCategories, setAllowedCategories] = useState('')
  const [allowNonRefundable, setAllowNonRefundable] = useState(false)

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
          setEnabled(policy.isActive !== false)
          setMaxAction(policy.maxAction || 'prepare')
          setPerBooking(centsToInput(policy.maxPerBookingCents))
          setOpenTotal(centsToInput(policy.maxTotalOpenCents))
          setAllowedCategories(categories(policy.allowedCategories))
          setAllowNonRefundable(policy.allowNonRefundable === true)
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load AutoBook policy.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

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
          allowedCategories: allowedCategories.split(',').map((value) => value.trim()).filter(Boolean),
          allowNonRefundable,
          isActive: enabled,
        }),
      })
      const payload = await response.json() as { success?: boolean; data?: Policy; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save AutoBook policy.')
      setMessage('AutoBook policy saved. Contract acceptance and payments remain prohibited.')
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
        <p className="mt-2 text-sm leading-6 text-champagne/60">AutoBook is deterministic automation, not open-ended purchasing authority. It uses the same catalogue, availability, hold, quote and contract gates as a person. You can restrict the highest action, category and money exposure.</p>
      </div>
      <label className="inline-flex items-center gap-3 rounded-full border border-gold/25 px-4 py-2 text-sm font-semibold">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4" /> Enabled
      </label>
    </div>

    {loading ? <div className="mt-4 inline-flex items-center gap-2 text-sm text-champagne/55"><Loader2 className="size-4 animate-spin" /> Loading policy…</div> : <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <label className="text-xs font-semibold text-champagne/70">Highest AI action
        <select value={maxAction} onChange={(event) => setMaxAction(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne">
          <option value="suggest">Suggest only</option>
          <option value="prepare">Prepare booking draft</option>
          <option value="hold">Create temporary inventory hold</option>
          <option value="request">Send booking / quote request</option>
          <option value="confirm">Confirm only when deterministic gates allow</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-champagne/70">Allowed service categories (optional)
        <input value={allowedCategories} onChange={(event) => setAllowedCategories(event.target.value)} placeholder="attire, decor-rentals, photographer" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
      </label>
      <label className="text-xs font-semibold text-champagne/70">Maximum per booking (optional)
        <input value={perBooking} onChange={(event) => setPerBooking(event.target.value)} inputMode="decimal" placeholder="500.00" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
      </label>
      <label className="text-xs font-semibold text-champagne/70">Maximum total open commitments (optional)
        <input value={openTotal} onChange={(event) => setOpenTotal(event.target.value)} inputMode="decimal" placeholder="2500.00" className="mt-1 min-h-11 w-full rounded-xl border border-gold/25 bg-espresso px-3 text-sm text-champagne" />
      </label>
    </div>}

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex items-center gap-2 text-xs text-champagne/65"><input type="checkbox" checked={allowNonRefundable} onChange={(event) => setAllowNonRefundable(event.target.checked)} /> Allow items explicitly marked non-refundable</label>
      <button disabled={loading || saving} onClick={() => void save()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-champagne px-5 text-sm font-bold text-espresso disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save AutoBook policy</button>
    </div>

    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-3 text-xs leading-5 text-emerald-100"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span><strong>Hard safety boundary:</strong> AI cannot accept a Wewed contract and cannot make or record a payment. Those fields are forced false by the API and protected again by database constraints.</span></div>
    {message ? <div className="mt-3 text-xs text-champagne/65">{message}</div> : null}
  </section>
}
