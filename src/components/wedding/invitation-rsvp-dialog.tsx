'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DigitalInvitationCard } from '@/components/wedding/digital-invitation-card'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

interface InvitationData {
  wedding: {
    slug: string
    title: string
    monogram: string | null
    tagline: string | null
    date: string
    venue: string
    venueCity: string
    venueCountry: string
    primaryColor: string
    accentColor: string
    backgroundColor: string
    invitationCardStyle: InvitationCardStyle
    invitationCardMessage: string | null
    rsvpDeadline: string | null
  }
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

export function InvitationRsvpDialog() {
  const { slug } = useWeddingContext()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'card' | 'rsvp'>('card')
  const [requestedStyle, setRequestedStyle] = useState<InvitationCardStyle>('botanical')
  const [data, setData] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.get('invitation') !== '1') return
    setRequestedStyle(normalizeInvitationCardStyle(query.get('card')))
    setView('card')
    setSaved(false)
    setOpen(true)
    setLoading(true)
    void fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Invitation access is not active.')
        setData({
          wedding: {
            ...payload.wedding,
            invitationCardStyle: normalizeInvitationCardStyle(payload.wedding.invitationCardStyle),
          },
          guest: payload.guest,
          rsvp: payload.rsvp,
        })
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Invitation access is not active.'))
      .finally(() => setLoading(false))
  }, [slug])

  const cardStyle = data
    ? normalizeInvitationCardStyle(requestedStyle || data.wedding.invitationCardStyle)
    : requestedStyle

  const cardData = useMemo(() => data ? {
    title: data.wedding.title,
    monogram: data.wedding.monogram,
    tagline: data.wedding.tagline,
    date: data.wedding.date,
    venue: data.wedding.venue,
    venueCity: data.wedding.venueCity,
    venueCountry: data.wedding.venueCountry,
    guestName: data.guest.name,
    message: data.wedding.invitationCardMessage,
    rsvpDeadline: data.wedding.rsvpDeadline,
    primaryColor: data.wedding.primaryColor,
    accentColor: data.wedding.accentColor,
    backgroundColor: data.wedding.backgroundColor,
  } : null, [data])

  function close() {
    const url = new URL(window.location.href)
    url.searchParams.delete('invitation')
    url.searchParams.delete('card')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setOpen(false)
  }

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
    <Dialog open={open} onOpenChange={(value) => { if (!value) close() }}>
      <DialogContent className="max-h-[96vh] overflow-y-auto border-gold/30 bg-champagne text-espresso sm:max-w-5xl">
        <DialogTitle className="wewed-heading text-3xl">Your private invitation</DialogTitle>
        <DialogDescription>The card and RSVP are linked to your guest-scoped session. The raw invitation credential has been removed from the address bar.</DialogDescription>
        {loading && <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div>}
        {error && <div className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div>}
        {data && cardData && view === 'card' && (
          <DigitalInvitationCard
            data={cardData}
            style={cardStyle}
            footer={(
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={close} className="border-current/30 bg-transparent">Explore wedding site</Button>
                <Button type="button" onClick={() => setView('rsvp')} className="bg-gold text-espresso hover:bg-gold-light">RSVP now</Button>
              </div>
            )}
          />
        )}
        {data && view === 'rsvp' && (
          <form onSubmit={submit} className="mx-auto w-full max-w-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Private RSVP</p><h3 className="mt-1 font-serif text-3xl">Reply for {data.guest.name}</h3></div><Button type="button" variant="ghost" onClick={() => setView('card')}><ArrowLeft className="size-4" />View card</Button></div>
            {saved && <div className="flex items-center gap-2 rounded-md border border-sage/30 bg-sage/10 px-3 py-2 text-sm text-sage"><CheckCircle2 className="size-4" />Your RSVP has been saved.</div>}
            <div className="rounded-md border border-gold/20 bg-white/60 p-3"><p className="font-medium">{data.guest.name}</p>{data.guest.email && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" />{data.guest.email}</p>}{data.guest.tableNumber && <p className="mt-1 text-xs text-muted-foreground">Table {data.guest.tableNumber}</p>}</div>
            <div className="space-y-2"><Label>Will you attend?</Label><RadioGroup name="attendance" defaultValue={data.rsvp.attending === false ? 'decline' : 'accept'} required><div className="flex items-center gap-2"><RadioGroupItem value="accept" id="invite-accept" /><Label htmlFor="invite-accept">Joyfully accept</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="decline" id="invite-decline" /><Label htmlFor="invite-decline">Regretfully decline</Label></div></RadioGroup></div>
            <div className="space-y-2"><Label htmlFor="invite-meal">Meal preference</Label><Select name="mealChoice" defaultValue={data.rsvp.mealChoice || undefined}><SelectTrigger id="invite-meal"><SelectValue placeholder="Choose a meal" /></SelectTrigger><SelectContent><SelectItem value="beef">Beef</SelectItem><SelectItem value="chicken">Chicken</SelectItem><SelectItem value="vegetarian">Vegetarian</SelectItem><SelectItem value="vegan">Vegan</SelectItem><SelectItem value="traditional">Traditional</SelectItem></SelectContent></Select></div>
            <div className="space-y-3 rounded-md border border-gold/20 p-3"><div className="flex items-center gap-2"><Checkbox name="plusOne" id="invite-plus-one" defaultChecked={data.rsvp.plusOne} /><Label htmlFor="invite-plus-one">I am bringing a plus-one</Label></div><Input name="plusOneName" defaultValue={data.rsvp.plusOneName || ''} placeholder="Plus-one name" /><Input name="plusOneMeal" defaultValue={data.rsvp.plusOneMeal || ''} placeholder="Plus-one meal preference" /></div>
            <div className="space-y-3 rounded-md border border-gold/20 p-3"><div className="flex items-center gap-2"><Checkbox name="kidsAttending" id="invite-kids" defaultChecked={data.rsvp.kidsAttending} /><Label htmlFor="invite-kids">Children are attending</Label></div><Input name="kidsCount" type="number" min={0} max={20} defaultValue={data.rsvp.kidsCount} placeholder="Number of children" /></div>
            <div className="space-y-2"><Label htmlFor="invite-dietary">Dietary notes</Label><Textarea id="invite-dietary" name="dietaryNotes" defaultValue={data.rsvp.dietaryNotes || ''} /></div>
            <div className="space-y-2"><Label htmlFor="invite-message">Message to the couple</Label><Textarea id="invite-message" name="message" defaultValue={data.rsvp.message || ''} /></div>
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Close</Button><Button disabled={saving} className="bg-gold text-espresso hover:bg-gold-light">{saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Save RSVP</Button></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
