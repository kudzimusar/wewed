'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, Loader2, Mail, Minus, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  getInvitationCardStyleDefinition,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

interface InvitationData {
  guest: { id: string; name: string; email: string | null; tableNumber: number | null }
  rsvp: {
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    plusOneName: string | null
    plusOneMeal: string | null
    kidsAttending: boolean
    kidsCount: number
    dietaryNotes: string | null
    message: string | null
    checkedIn: boolean
  }
}

type AttendanceChoice = 'accept' | 'decline'

export function PremiumInvitationRsvpDialog({
  slug,
  style,
}: {
  slug: string
  style: InvitationCardStyle
}) {
  const theme = getInvitationCardStyleDefinition(style)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [attendance, setAttendance] = useState<AttendanceChoice>('accept')
  const [plusOne, setPlusOne] = useState(false)
  const [kidsAttending, setKidsAttending] = useState(false)
  const [kidsCount, setKidsCount] = useState(0)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Invitation access is not active.')
      }
      const nextData = { guest: payload.guest, rsvp: payload.rsvp } as InvitationData
      setData(nextData)
      setAttendance(nextData.rsvp.attending === false ? 'decline' : 'accept')
      setPlusOne(Boolean(nextData.rsvp.plusOne))
      setKidsAttending(Boolean(nextData.rsvp.kidsAttending))
      setKidsCount(Math.max(0, Number(nextData.rsvp.kidsCount) || 0))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invitation access is not active.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setSaved(false)
      setOpen(true)
      void load()
    }
    window.addEventListener('wewed:open-premium-rsvp', handler)
    return () => window.removeEventListener('wewed:open-premium-rsvp', handler)
  }, [slug])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    setSaving(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const accepting = attendance === 'accept'
    const rsvpUpdate: Record<string, unknown> = {
      originGuestId: data.guest.id,
      attending: accepting,
      plusOne: accepting ? plusOne : false,
      kidsAttending: accepting ? kidsAttending : false,
      message: form.get('message') || null,
    }

    // Progressive disclosure must never become destructive persistence. Fields
    // hidden because the guest declines, removes a plus-one, or removes children
    // are omitted so the server's partial-update contract preserves prior details.
    if (accepting) {
      rsvpUpdate.mealChoice = form.get('mealChoice') || null
      rsvpUpdate.dietaryNotes = form.get('dietaryNotes') || null
      if (plusOne) {
        rsvpUpdate.plusOneName = form.get('plusOneName') || null
        rsvpUpdate.plusOneMeal = form.get('plusOneMeal') || null
      }
      if (kidsAttending) {
        rsvpUpdate.kidsCount = kidsCount
      }
    }

    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rsvpUpdate),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save RSVP.')
      setData((current) =>
        current ? { ...current, rsvp: { ...current.rsvp, ...payload.rsvp } } : current,
      )
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save RSVP.')
    } finally {
      setSaving(false)
    }
  }

  const cardBorder = `${theme.palette.primary}55`
  const softSurface = `${theme.palette.primary}0d`
  const selectedSurface = `${theme.palette.primary}16`
  const controlStyle = {
    borderColor: cardBorder,
    background: `${theme.palette.paper}e8`,
    color: theme.palette.ink,
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="premium-invitation-rsvp-dialog"
        className="max-h-[94dvh] overflow-y-auto rounded-[2rem] border p-0 shadow-2xl sm:max-w-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:size-11 [&>button]:rounded-full [&>button]:border [&>button]:bg-white/70 [&>button]:shadow-sm [&>button]:backdrop-blur-sm"
        style={{
          background: theme.palette.paper,
          color: theme.palette.ink,
          borderColor: `${theme.palette.primary}72`,
        }}
      >
        <div className="px-6 pb-4 pt-7 sm:px-8 sm:pt-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: theme.palette.primary }}>
            <Sparkles className="size-4" aria-hidden="true" />
            Private wedding reply
          </div>
          <DialogTitle className="max-w-[80%] font-serif text-4xl leading-none sm:text-5xl">
            Your private RSVP
          </DialogTitle>
          <DialogDescription className="mt-3 max-w-xl text-base leading-6" style={{ color: theme.palette.muted }}>
            Your response is private and securely connected to this invitation.
          </DialogDescription>
        </div>

        {loading && (
          <div className="flex min-h-48 items-center justify-center px-6 pb-8">
            <Loader2 className="size-7 animate-spin" style={{ color: theme.palette.primary }} />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-6 mb-5 rounded-2xl border px-4 py-3 text-sm sm:mx-8"
            style={{ borderColor: cardBorder, background: softSurface }}
          >
            {error}
          </div>
        )}

        {data && !loading && (
          <form onSubmit={submit} className="space-y-6 px-6 pb-0 sm:px-8">
            {saved && (
              <div
                className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
                style={{ borderColor: `${theme.palette.primary}66`, background: selectedSurface }}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Your RSVP has been saved.
              </div>
            )}

            <div
              className="rounded-2xl border px-5 py-4"
              style={{ borderColor: cardBorder, background: softSurface }}
            >
              <p className="font-serif text-3xl leading-tight">{data.guest.name}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: theme.palette.muted }}>
                {data.guest.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" aria-hidden="true" />
                    {data.guest.email}
                  </span>
                )}
                {data.guest.tableNumber && <span>Table {data.guest.tableNumber}</span>}
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-base font-semibold">Will you attend?</legend>
              <RadioGroup
                name="attendance"
                value={attendance}
                onValueChange={(value) => setAttendance(value as AttendanceChoice)}
                required
                className="grid gap-3 sm:grid-cols-2"
              >
                {([
                  ['accept', 'Joyfully accept', 'We’ll be there'],
                  ['decline', 'Regretfully decline', 'We’ll celebrate from afar'],
                ] as const).map(([value, title, subtitle]) => {
                  const selected = attendance === value
                  return (
                    <Label
                      key={value}
                      htmlFor={`premium-invite-${value}`}
                      className="flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 transition-[border-color,background,box-shadow,transform] hover:-translate-y-0.5"
                      style={{
                        borderColor: selected ? theme.palette.primary : cardBorder,
                        background: selected ? selectedSurface : `${theme.palette.paper}b8`,
                        boxShadow: selected ? `0 10px 28px ${theme.palette.primary}18` : 'none',
                      }}
                    >
                      <RadioGroupItem
                        value={value}
                        id={`premium-invite-${value}`}
                        aria-label={title}
                        className="!size-5 shrink-0 border-2 shadow-none"
                        style={{ borderColor: theme.palette.primary, color: theme.palette.primary }}
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">{title}</span>
                        <span className="mt-1 block text-xs font-normal" style={{ color: theme.palette.muted }}>
                          {subtitle}
                        </span>
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
            </fieldset>

            {attendance === 'accept' && (
              <div data-testid="premium-rsvp-attending-fields" className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="premium-invite-meal" className="text-sm font-semibold">
                    Meal preference
                  </Label>
                  <Select name="mealChoice" defaultValue={data.rsvp.mealChoice || undefined}>
                    <SelectTrigger
                      id="premium-invite-meal"
                      aria-label="Meal preference"
                      className="h-12 rounded-xl border px-4 shadow-none focus:ring-2"
                      style={controlStyle}
                    >
                      <SelectValue placeholder="Choose a meal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beef">Beef</SelectItem>
                      <SelectItem value="chicken">Chicken</SelectItem>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="traditional">Traditional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <section
                  className="rounded-2xl border p-4"
                  style={{ borderColor: cardBorder, background: plusOne ? selectedSurface : `${theme.palette.paper}a8` }}
                >
                  <div className="flex min-h-10 items-center gap-3">
                    <Checkbox
                      name="plusOne"
                      id="premium-invite-plus-one"
                      aria-label="I am bringing a plus-one"
                      checked={plusOne}
                      onCheckedChange={(value) => setPlusOne(value === true)}
                      className="!size-6 rounded-md border-2 shadow-none"
                      style={{
                        borderColor: theme.palette.primary,
                        background: plusOne ? theme.palette.primary : theme.palette.paper,
                        color: theme.palette.paper,
                      }}
                    />
                    <Label htmlFor="premium-invite-plus-one" className="cursor-pointer text-base font-semibold">
                      I am bringing a plus-one
                    </Label>
                  </div>

                  {plusOne && (
                    <div data-testid="premium-rsvp-plus-one-details" className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="premium-invite-plus-one-name" className="text-xs font-semibold uppercase tracking-[0.12em]">
                          Plus-one name
                        </Label>
                        <Input
                          id="premium-invite-plus-one-name"
                          name="plusOneName"
                          defaultValue={data.rsvp.plusOneName || ''}
                          placeholder="Guest name"
                          className="h-12 rounded-xl border px-4 shadow-none"
                          style={controlStyle}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="premium-invite-plus-one-meal" className="text-xs font-semibold uppercase tracking-[0.12em]">
                          Meal preference
                        </Label>
                        <Input
                          id="premium-invite-plus-one-meal"
                          name="plusOneMeal"
                          defaultValue={data.rsvp.plusOneMeal || ''}
                          placeholder="Meal preference"
                          className="h-12 rounded-xl border px-4 shadow-none"
                          style={controlStyle}
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section
                  className="rounded-2xl border p-4"
                  style={{ borderColor: cardBorder, background: kidsAttending ? selectedSurface : `${theme.palette.paper}a8` }}
                >
                  <div className="flex min-h-10 items-center gap-3">
                    <Checkbox
                      name="kidsAttending"
                      id="premium-invite-kids"
                      aria-label="Children are attending"
                      checked={kidsAttending}
                      onCheckedChange={(value) => {
                        const checked = value === true
                        setKidsAttending(checked)
                        setKidsCount((current) => (checked ? Math.max(1, current) : 0))
                      }}
                      className="!size-6 rounded-md border-2 shadow-none"
                      style={{
                        borderColor: theme.palette.primary,
                        background: kidsAttending ? theme.palette.primary : theme.palette.paper,
                        color: theme.palette.paper,
                      }}
                    />
                    <Label htmlFor="premium-invite-kids" className="cursor-pointer text-base font-semibold">
                      Children are attending
                    </Label>
                  </div>

                  {kidsAttending && (
                    <div data-testid="premium-rsvp-kids-stepper" className="mt-4 flex items-center justify-between rounded-xl border px-3 py-2" style={controlStyle}>
                      <span className="text-sm font-medium">Number of children</span>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Remove one child"
                          className="size-9 rounded-full"
                          onClick={() => setKidsCount((current) => Math.max(1, current - 1))}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <output className="min-w-6 text-center font-serif text-xl" aria-live="polite">
                          {kidsCount}
                        </output>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Add one child"
                          className="size-9 rounded-full"
                          onClick={() => setKidsCount((current) => Math.min(20, current + 1))}
                        >
                          <Plus className="size-4" />
                        </Button>
                        <input type="hidden" name="kidsCount" value={kidsCount} />
                      </div>
                    </div>
                  )}
                </section>

                <div className="space-y-2">
                  <Label htmlFor="premium-invite-dietary" className="text-sm font-semibold">
                    Dietary notes <span className="font-normal opacity-60">(optional)</span>
                  </Label>
                  <Textarea
                    id="premium-invite-dietary"
                    name="dietaryNotes"
                    aria-label="Dietary notes"
                    defaultValue={data.rsvp.dietaryNotes || ''}
                    placeholder="Allergies or dietary needs"
                    className="min-h-24 rounded-xl border p-3 shadow-none"
                    style={controlStyle}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="premium-invite-message" className="text-sm font-semibold">
                Message to the couple <span className="font-normal opacity-60">(optional)</span>
              </Label>
              <Textarea
                id="premium-invite-message"
                name="message"
                aria-label="Message to the couple"
                defaultValue={data.rsvp.message || ''}
                placeholder="Share a note with the couple"
                className="min-h-28 rounded-xl border p-3 shadow-none"
                style={controlStyle}
              />
            </div>

            <div
              className="sticky bottom-0 z-10 -mx-6 mt-7 flex flex-col-reverse gap-2 border-t px-6 py-4 backdrop-blur-md sm:-mx-8 sm:flex-row sm:justify-end sm:px-8"
              style={{
                borderColor: cardBorder,
                background: `${theme.palette.paper}f2`,
                boxShadow: '0 -12px 28px rgba(69, 47, 23, 0.08)',
              }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-11 rounded-full px-6"
                style={{ borderColor: cardBorder, background: `${theme.palette.paper}cc` }}
              >
                Close RSVP
              </Button>
              <Button
                disabled={saving}
                className="h-11 rounded-full px-7 font-semibold shadow-lg"
                style={{ background: theme.palette.primary, color: theme.palette.paper }}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save RSVP
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
