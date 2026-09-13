'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
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

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Invitation access is not active.')
      setData({ guest: payload.guest, rsvp: payload.rsvp })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invitation access is not active.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = () => {
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
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originGuestId: data.guest.id,
          attending: form.get('attendance') === 'accept',
          mealChoice: form.get('mealChoice') || null,
          plusOne: form.get('plusOne') === 'on',
          plusOneName: form.get('plusOneName') || null,
          plusOneMeal: form.get('plusOneMeal') || null,
          kidsAttending: form.get('kidsAttending') === 'on',
          kidsCount: Number(form.get('kidsCount') || 0),
          dietaryNotes: form.get('dietaryNotes') || null,
          message: form.get('message') || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save RSVP.')
      setData((current) => current ? { ...current, rsvp: { ...current.rsvp, ...payload.rsvp } } : current)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save RSVP.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="premium-invitation-rsvp-dialog"
        className="max-h-[96vh] overflow-y-auto sm:max-w-2xl"
        style={{ background: theme.palette.paper, color: theme.palette.ink, borderColor: `${theme.palette.primary}88` }}
      >
        <DialogTitle className="font-serif text-3xl">Your private RSVP</DialogTitle>
        <DialogDescription style={{ color: theme.palette.muted }}>
          Your response is connected to the secure guest session created from your personal invitation. No invitation credential is shown here.
        </DialogDescription>

        {loading && <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-7 animate-spin" style={{ color: theme.palette.primary }} /></div>}
        {error && <div role="alert" className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${theme.palette.primary}55` }}>{error}</div>}

        {data && !loading && (
          <form onSubmit={submit} className="space-y-5">
            {saved && (
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${theme.palette.primary}66`, background: `${theme.palette.primary}12` }}>
                <CheckCircle2 className="size-4" /> Your RSVP has been saved.
              </div>
            )}

            <div className="rounded-xl border p-4" style={{ borderColor: `${theme.palette.primary}44`, background: `${theme.palette.primary}0d` }}>
              <p className="font-serif text-2xl">{data.guest.name}</p>
              {data.guest.email && <p className="mt-1 flex items-center gap-1.5 text-xs opacity-60"><Mail className="size-3.5" />{data.guest.email}</p>}
              {data.guest.tableNumber && <p className="mt-1 text-xs opacity-60">Table {data.guest.tableNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label>Will you attend?</Label>
              <RadioGroup name="attendance" defaultValue={data.rsvp.attending === false ? 'decline' : 'accept'} required>
                <div className="flex min-h-10 items-center gap-2"><RadioGroupItem value="accept" id="premium-invite-accept" /><Label htmlFor="premium-invite-accept">Joyfully accept</Label></div>
                <div className="flex min-h-10 items-center gap-2"><RadioGroupItem value="decline" id="premium-invite-decline" /><Label htmlFor="premium-invite-decline">Regretfully decline</Label></div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="premium-invite-meal">Meal preference</Label>
              <Select name="mealChoice" defaultValue={data.rsvp.mealChoice || undefined}>
                <SelectTrigger id="premium-invite-meal"><SelectValue placeholder="Choose a meal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beef">Beef</SelectItem>
                  <SelectItem value="chicken">Chicken</SelectItem>
                  <SelectItem value="vegetarian">Vegetarian</SelectItem>
                  <SelectItem value="vegan">Vegan</SelectItem>
                  <SelectItem value="traditional">Traditional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: `${theme.palette.primary}44` }}>
              <div className="flex min-h-10 items-center gap-2"><Checkbox name="plusOne" id="premium-invite-plus-one" defaultChecked={data.rsvp.plusOne} /><Label htmlFor="premium-invite-plus-one">I am bringing a plus-one</Label></div>
              <Input name="plusOneName" defaultValue={data.rsvp.plusOneName || ''} placeholder="Plus-one name" />
              <Input name="plusOneMeal" defaultValue={data.rsvp.plusOneMeal || ''} placeholder="Plus-one meal preference" />
            </div>

            <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: `${theme.palette.primary}44` }}>
              <div className="flex min-h-10 items-center gap-2"><Checkbox name="kidsAttending" id="premium-invite-kids" defaultChecked={data.rsvp.kidsAttending} /><Label htmlFor="premium-invite-kids">Children are attending</Label></div>
              <Input name="kidsCount" type="number" min={0} max={20} defaultValue={data.rsvp.kidsCount} placeholder="Number of children" />
            </div>

            <div className="space-y-2"><Label htmlFor="premium-invite-dietary">Dietary notes</Label><Textarea id="premium-invite-dietary" name="dietaryNotes" defaultValue={data.rsvp.dietaryNotes || ''} /></div>
            <div className="space-y-2"><Label htmlFor="premium-invite-message">Message to the couple</Label><Textarea id="premium-invite-message" name="message" defaultValue={data.rsvp.message || ''} /></div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close RSVP</Button>
              <Button disabled={saving} style={{ background: theme.palette.primary, color: theme.palette.paper }}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save RSVP
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
