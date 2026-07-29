'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, MapPin, Settings2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface ClientProfile {
  wedding: {
    id: string
    slug: string
    title: string
    monogram: string
    tagline: string
    date: string
    venue: string
    venueCity: string
    venueCountry: string
    venueMapUrl: string
    lifecycle: string
    privacy: string
  }
  couple: {
    id: string
    partner1: string
    partner2: string
    surname: string | null
  }
  venue: {
    heading: string
    subtitle: string
    description: string
    address: string
    suburb: string
    cityCountry: string
    phone: string
    website: string
    imageUrl: string
    imageAlt: string
    imageCaption: string
    imageTitle: string
    aboutEyebrow: string
    aboutHeading: string
    exploreLabel: string
    directionsLabel: string
    features: string[]
    moments: string[]
  }
  completeness: {
    complete: number
    total: number
    percent: number
    missing: string[]
  }
}

interface ProfileResponse {
  success?: boolean
  data?: ClientProfile
  error?: string
}

function toLocalDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function FormField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-sans text-[10px] uppercase tracking-[0.14em] text-gold/70">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="border-gold/20 bg-espresso/60 text-champagne placeholder:text-champagne/25"
      />
    </div>
  )
}

export function PlannerClientProfile() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ClientProfile | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch('/api/planner/client-profile', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as ProfileResponse
        if (!response.ok || !payload.data) throw new Error(payload.error || 'Unable to load client profile.')
        if (!cancelled) setProfile(payload.data)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load client profile.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const locationLabel = useMemo(() => {
    if (!profile) return ''
    return [profile.venue.address, profile.venue.suburb, profile.wedding.venueCity, profile.wedding.venueCountry]
      .filter(Boolean)
      .join(', ')
  }, [profile])

  function updateWedding(field: keyof ClientProfile['wedding'], value: string) {
    setProfile((current) =>
      current ? { ...current, wedding: { ...current.wedding, [field]: value } } : current,
    )
  }

  function updateCouple(field: keyof ClientProfile['couple'], value: string) {
    setProfile((current) =>
      current ? { ...current, couple: { ...current.couple, [field]: value } } : current,
    )
  }

  function updateVenue(field: keyof ClientProfile['venue'], value: string | string[]) {
    setProfile((current) =>
      current ? { ...current, venue: { ...current.venue, [field]: value } } : current,
    )
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/planner/client-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          wedding: {
            ...profile.wedding,
            date: new Date(profile.wedding.date).toISOString(),
          },
          couple: profile.couple,
          venue: profile.venue,
        }),
      })
      const payload = (await response.json()) as ProfileResponse
      if (!response.ok || !payload.data) throw new Error(payload.error || 'Unable to save client profile.')
      setProfile(payload.data)
      toast({
        title: 'Client profile saved',
        description: 'The planner and public wedding website now use these saved details.',
      })
      window.dispatchEvent(new CustomEvent('wewed:client-profile-updated'))
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save client profile.'
      setError(message)
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden border-gold/25 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold sm:inline-flex"
      >
        <Settings2 className="size-3.5" />
        Client profile
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[96vw] max-w-5xl overflow-y-auto border-gold/25 bg-espresso p-0 text-champagne"
        >
          <DialogTitle className="sr-only">Client profile and venue details</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the active wedding’s real client, date, and venue information.
          </DialogDescription>

          <div className="sticky top-0 z-20 flex items-start justify-between border-b border-gold/15 bg-espresso/95 px-5 py-4 backdrop-blur-md">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold/70">Phase 5 · Real Client Data</p>
              <h2 className="mt-1 font-serif text-2xl">Client Profile & Venue</h2>
              <p className="mt-1 max-w-2xl font-sans text-xs leading-5 text-champagne/50">
                These fields are wedding-scoped. Saving here updates only the selected client and drives their public website.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close client profile"
              className="inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/65 hover:bg-gold/10 hover:text-gold"
            >
              <X className="size-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <Loader2 className="size-7 animate-spin text-gold" />
            </div>
          ) : profile ? (
            <form onSubmit={save} className="space-y-6 p-5 sm:p-6">
              <section className="rounded-2xl border border-gold/15 bg-gold/[0.035] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg">Real-data completeness</p>
                    <p className="mt-1 font-sans text-xs text-champagne/50">
                      {profile.completeness.missing.length
                        ? `Missing: ${profile.completeness.missing.join(', ')}`
                        : 'All essential client and venue fields are present.'}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-gold/25 bg-gold/5 text-gold">
                    {profile.completeness.percent}% complete
                  </Badge>
                </div>
                <Progress value={profile.completeness.percent} className="mt-4 h-2 bg-champagne/10 [&>div]:bg-gold" />
              </section>

              {error && (
                <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 font-sans text-sm text-clay-light">
                  {error}
                </div>
              )}

              <section className="space-y-4 rounded-2xl border border-gold/15 p-4">
                <div>
                  <h3 className="font-serif text-xl">Couple and wedding</h3>
                  <p className="font-sans text-xs text-champagne/45">Identity shown in the planner and public wedding experience.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Partner one" required value={profile.couple.partner1} onChange={(value) => updateCouple('partner1', value)} />
                  <FormField label="Partner two" required value={profile.couple.partner2} onChange={(value) => updateCouple('partner2', value)} />
                  <FormField label="Surname" value={profile.couple.surname ?? ''} onChange={(value) => updateCouple('surname', value)} />
                  <FormField label="Wedding title" required value={profile.wedding.title} onChange={(value) => updateWedding('title', value)} />
                  <FormField label="Monogram" value={profile.wedding.monogram} onChange={(value) => updateWedding('monogram', value)} />
                  <FormField label="Wedding date and time" type="datetime-local" required value={toLocalDateTime(profile.wedding.date)} onChange={(value) => updateWedding('date', value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans text-[10px] uppercase tracking-[0.14em] text-gold/70">Tagline</Label>
                  <Textarea value={profile.wedding.tagline} onChange={(event) => updateWedding('tagline', event.target.value)} className="border-gold/20 bg-espresso/60 text-champagne" />
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-gold/15 p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 size-4 text-gold" />
                  <div>
                    <h3 className="font-serif text-xl">Venue record</h3>
                    <p className="font-sans text-xs text-champagne/45">Operational address, directions, contacts, and public copy.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Venue name" required value={profile.wedding.venue} onChange={(value) => { updateWedding('venue', value); updateVenue('heading', value) }} />
                  <FormField label="Street address" value={profile.venue.address} onChange={(value) => updateVenue('address', value)} />
                  <FormField label="Suburb / area" value={profile.venue.suburb} onChange={(value) => updateVenue('suburb', value)} />
                  <FormField label="City" required value={profile.wedding.venueCity} onChange={(value) => updateWedding('venueCity', value)} />
                  <FormField label="Country" required value={profile.wedding.venueCountry} onChange={(value) => updateWedding('venueCountry', value)} />
                  <FormField label="Venue phone" value={profile.venue.phone} onChange={(value) => updateVenue('phone', value)} />
                  <FormField label="Directions URL" value={profile.wedding.venueMapUrl} onChange={(value) => updateWedding('venueMapUrl', value)} placeholder="Leave blank to generate from the address" />
                  <FormField label="Venue website" value={profile.venue.website} onChange={(value) => updateVenue('website', value)} />
                  <FormField label="Venue image URL" value={profile.venue.imageUrl} onChange={(value) => updateVenue('imageUrl', value)} placeholder="/uploads/venue.jpg or https://…" />
                </div>
                {locationLabel && <p className="rounded-xl border border-gold/10 bg-gold/[0.03] px-3 py-2 font-sans text-xs text-champagne/55">Saved location: {locationLabel}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Venue subtitle" value={profile.venue.subtitle} onChange={(value) => updateVenue('subtitle', value)} />
                  <FormField label="About heading" value={profile.venue.aboutHeading} onChange={(value) => updateVenue('aboutHeading', value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans text-[10px] uppercase tracking-[0.14em] text-gold/70">Venue description</Label>
                  <Textarea rows={6} value={profile.venue.description} onChange={(event) => updateVenue('description', event.target.value)} className="border-gold/20 bg-espresso/60 text-champagne" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="font-sans text-[10px] uppercase tracking-[0.14em] text-gold/70">Venue features · one per line</Label>
                    <Textarea rows={7} value={profile.venue.features.join('\n')} onChange={(event) => updateVenue('features', event.target.value.split('\n'))} className="border-gold/20 bg-espresso/60 text-champagne" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-sans text-[10px] uppercase tracking-[0.14em] text-gold/70">Wedding-day moments · one per line</Label>
                    <Textarea rows={7} value={profile.venue.moments.join('\n')} onChange={(event) => updateVenue('moments', event.target.value.split('\n'))} className="border-gold/20 bg-espresso/60 text-champagne" />
                  </div>
                </div>
              </section>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gold/15 bg-espresso/95 py-4 backdrop-blur-md">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-champagne/60 hover:text-champagne">Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-gold text-espresso hover:bg-gold-light">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Save real client data
                </Button>
              </div>
            </form>
          ) : (
            <div className="p-8 font-sans text-sm text-clay-light">{error || 'Client profile unavailable.'}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
