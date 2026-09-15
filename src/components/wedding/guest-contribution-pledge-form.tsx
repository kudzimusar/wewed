'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CONTRIBUTION_TYPE_LABELS, type ContributionType } from '@/lib/contributions'

const CASH_TYPES = new Set<ContributionType>(['CASH_TO_COUPLE', 'DIRECT_VENDOR_PAYMENT', 'HONEYMOON_GIFT'])
const QUANTITY_TYPES = new Set<ContributionType>(['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR'])

export interface GuestContributionCampaign {
  id: string
  title: string
  currency: string
  acceptedTypes: ContributionType[]
}

export function GuestContributionPledgeForm({
  slug,
  campaign,
}: {
  slug: string
  campaign: GuestContributionCampaign
}) {
  const firstType = campaign.acceptedTypes[0] ?? 'OTHER'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string; message: string } | null>(null)
  const [type, setType] = useState<ContributionType>(firstType)
  const [amount, setAmount] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [recognition, setRecognition] = useState<'private' | 'public' | 'anonymous'>('private')

  const isCash = CASH_TYPES.has(type)
  const supportsQuantity = QUANTITY_TYPES.has(type)
  const options = useMemo(
    () => campaign.acceptedTypes.filter((value) => Boolean(CONTRIBUTION_TYPE_LABELS[value])),
    [campaign.acceptedTypes],
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/contribution-campaigns/${encodeURIComponent(campaign.id)}/pledge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          weddingSlug: slug,
          type,
          amount: isCash ? amount : null,
          estimatedValue: isCash ? null : estimatedValue || null,
          quantity: supportsQuantity ? quantity || null : null,
          unit: supportsQuantity ? unit || null : null,
          displayName,
          email,
          phone,
          note,
          recognition,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || body?.success === false || !body?.data?.id) {
        throw new Error(body?.error || 'We could not record your contribution right now.')
      }
      setSuccess({
        id: String(body.data.id),
        message: String(body.data.message || 'Thank you. Your contribution has been shared with the couple and their planner.'),
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not record your contribution right now.')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div data-testid={`contribution-pledge-success-${campaign.id}`} className="mt-6 rounded-xl border border-sage/30 bg-sage/10 p-4 text-left">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sage" />
          <div>
            <p className="font-sans text-sm font-semibold text-espresso">Contribution recorded</p>
            <p className="mt-1 font-sans text-xs leading-5 text-espresso/65">{success.message}</p>
            <p className="mt-2 font-sans text-[10px] text-espresso/40">Reference: {success.id}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <Button
        type="button"
        data-testid={`contribution-pledge-open-${campaign.id}`}
        onClick={() => setOpen((current) => !current)}
        className="w-full bg-gold text-espresso hover:bg-gold-light"
      >
        Contribute through Wewed
        <ChevronDown className={`ml-2 size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <form
          data-testid={`contribution-pledge-form-${campaign.id}`}
          onSubmit={submit}
          className="mt-3 space-y-4 rounded-xl border border-gold/25 bg-ivory/75 p-4 text-left"
        >
          <div>
            <Label htmlFor={`contribution-type-${campaign.id}`}>How would you like to contribute?</Label>
            <select
              id={`contribution-type-${campaign.id}`}
              value={type}
              onChange={(event) => setType(event.target.value as ContributionType)}
              className="mt-1 h-10 w-full rounded-md border border-gold/25 bg-white/70 px-3 font-sans text-sm text-espresso"
            >
              {options.map((value) => <option key={value} value={value}>{CONTRIBUTION_TYPE_LABELS[value]}</option>)}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {isCash ? (
              <div>
                <Label htmlFor={`contribution-amount-${campaign.id}`}>Amount ({campaign.currency})</Label>
                <Input
                  id={`contribution-amount-${campaign.id}`}
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="mt-1 bg-white/70 text-espresso"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor={`contribution-value-${campaign.id}`}>Estimated value ({campaign.currency})</Label>
                <Input
                  id={`contribution-value-${campaign.id}`}
                  inputMode="decimal"
                  value={estimatedValue}
                  onChange={(event) => setEstimatedValue(event.target.value)}
                  placeholder="Optional"
                  className="mt-1 bg-white/70 text-espresso"
                />
              </div>
            )}
            {supportsQuantity && (
              <>
                <div>
                  <Label htmlFor={`contribution-quantity-${campaign.id}`}>Quantity</Label>
                  <Input id={`contribution-quantity-${campaign.id}`} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Optional" className="mt-1 bg-white/70 text-espresso" />
                </div>
                <div>
                  <Label htmlFor={`contribution-unit-${campaign.id}`}>Unit</Label>
                  <Input id={`contribution-unit-${campaign.id}`} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. hours, crates" className="mt-1 bg-white/70 text-espresso" />
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`contributor-name-${campaign.id}`}>Your name</Label>
              <Input id={`contributor-name-${campaign.id}`} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" className="mt-1 bg-white/70 text-espresso" />
            </div>
            <div>
              <Label htmlFor={`contributor-email-${campaign.id}`}>Email</Label>
              <Input id={`contributor-email-${campaign.id}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Optional" className="mt-1 bg-white/70 text-espresso" />
            </div>
            <div>
              <Label htmlFor={`contributor-phone-${campaign.id}`}>Phone</Label>
              <Input id={`contributor-phone-${campaign.id}`} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="Optional" className="mt-1 bg-white/70 text-espresso" />
            </div>
          </div>

          <fieldset>
            <legend className="font-sans text-sm font-medium text-espresso">Recognition preference</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {([
                ['private', 'Private', 'Visible only to the couple/planner.'],
                ['public', 'Public thanks', 'Your name may be acknowledged if the couple enables recognition.'],
                ['anonymous', 'Anonymous', 'Do not show your name publicly.'],
              ] as const).map(([value, label, description]) => (
                <label key={value} className="flex cursor-pointer gap-2 rounded-lg border border-gold/20 bg-white/45 p-3">
                  <input type="radio" name={`recognition-${campaign.id}`} value={value} checked={recognition === value} onChange={() => setRecognition(value)} className="mt-1" />
                  <span><strong className="block font-sans text-xs text-espresso">{label}</strong><span className="mt-0.5 block font-sans text-[10px] leading-4 text-espresso/55">{description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor={`contribution-note-${campaign.id}`}>Note to the couple or planner</Label>
            <Textarea id={`contribution-note-${campaign.id}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional details about your contribution" className="mt-1 min-h-20 bg-white/70 text-espresso" />
          </div>

          {error && <p role="alert" className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 font-sans text-xs text-clay">{error}</p>}
          <Button type="submit" disabled={busy || options.length === 0} className="w-full bg-espresso text-champagne hover:bg-espresso/90">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Record my contribution
          </Button>
          <p className="text-center font-sans text-[10px] leading-4 text-espresso/45">Submitting records a pledge in the wedding Planner. It does not charge a card or mark any wedding payment as paid.</p>
        </form>
      )}
    </div>
  )
}
