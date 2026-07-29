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

interface InvitationData {
  token: string
  attending: boolean | null
  mealChoice: string | null
  plusOne: boolean
  plusOneName: string | null
  plusOneMeal: string | null
  kidsAttending: boolean
  kidsCount: number
  dietaryNotes: string | null
  message: string | null
  guest: { name: string; email: string | null }
}

export function InvitationRsvpDialog() {
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('rsvp')?.trim()
    if (!value) return
    setToken(value)
    setLoading(true)
    void fetch(`/api/rsvp/${encodeURIComponent(value)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Invitation not found.')
        setData(payload.data)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Invitation not found.'))
      .finally(() => setLoading(false))
  }, [])

  function close() {
    const url = new URL(window.location.href)
    url.searchParams.delete('rsvp')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setToken(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !data) return
    setSaving(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const attendance = form.get('attendance')
    try {
      const response = await fetch(`/api/rsvp/${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attending: attendance === 'accept',
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
      setData(payload.data)
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save RSVP.')
    } finally {
      setSaving(false)
    }
  }

  if (!token) return null

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto border-gold/30 bg-champagne text-espresso sm:max-w-xl">
        <DialogTitle className="wewed-heading text-3xl">Your RSVP</DialogTitle>
        <DialogDescription>
          This invitation is linked directly to your guest record. You may return to the same link to update your response.
        </DialogDescription>

        {loading && <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div>}
        {error && <div className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div>}
        {saved && <div className="flex items-center gap-2 rounded-md border border-sage/30 bg-sage/10 px-3 py-2 text-sm text-sage"><CheckCircle2 className="size-4" />Your RSVP has been saved.</div>}

        {data && (
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-md border border-gold/20 bg-white/60 p-3">
              <p className="font-medium">{data.guest.name}</p>
              {data.guest.email && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" />{data.guest.email}</p>}
            </div>

            <div className="space-y-2">
              <Label>Will you attend?</Label>
              <RadioGroup name="attendance" defaultValue={data.attending === false ? 'decline' : 'accept'} required>
                <div className="flex items-center gap-2"><RadioGroupItem value="accept" id="invite-accept" /><Label htmlFor="invite-accept">Joyfully accept</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="decline" id="invite-decline" /><Label htmlFor="invite-decline">Regretfully decline</Label></div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-meal">Meal preference</Label>
              <Select name="mealChoice" defaultValue={data.mealChoice || undefined}>
                <SelectTrigger id="invite-meal"><SelectValue placeholder="Choose a meal" /></SelectTrigger>
                <SelectContent><SelectItem value="beef">Beef</SelectItem><SelectItem value="chicken">Chicken</SelectItem><SelectItem value="vegetarian">Vegetarian</SelectItem><SelectItem value="vegan">Vegan</SelectItem><SelectItem value="traditional">Traditional</SelectItem></SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-md border border-gold/20 p-3">
              <div className="flex items-center gap-2"><Checkbox name="plusOne" id="invite-plus-one" defaultChecked={data.plusOne} /><Label htmlFor="invite-plus-one">I am bringing a plus-one</Label></div>
              <Input name="plusOneName" defaultValue={data.plusOneName || ''} placeholder="Plus-one name" />
              <Input name="plusOneMeal" defaultValue={data.plusOneMeal || ''} placeholder="Plus-one meal preference" />
            </div>

            <div className="space-y-3 rounded-md border border-gold/20 p-3">
              <div className="flex items-center gap-2"><Checkbox name="kidsAttending" id="invite-kids" defaultChecked={data.kidsAttending} /><Label htmlFor="invite-kids">Children are attending</Label></div>
              <Input name="kidsCount" type="number" min={0} max={20} defaultValue={data.kidsCount} placeholder="Number of children" />
            </div>

            <div className="space-y-2"><Label htmlFor="invite-dietary">Dietary notes</Label><Textarea id="invite-dietary" name="dietaryNotes" defaultValue={data.dietaryNotes || ''} /></div>
            <div className="space-y-2"><Label htmlFor="invite-message">Message to the couple</Label><Textarea id="invite-message" name="message" defaultValue={data.message || ''} /></div>

            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Close</Button><Button disabled={saving} className="bg-gold text-espresso hover:bg-gold-light">{saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Save RSVP</Button></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
