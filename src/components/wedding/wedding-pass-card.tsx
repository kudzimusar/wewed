'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Loader2, MapPin, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GuestContextPayload {
  success: boolean
  error?: string
  data?: {
    guest: {
      id: string
      name: string
      attending: boolean | null
      tableNumber: number | null
      household: Array<{ attendeeKey: string; attendeeKind: string; attendeeName: string }>
    }
    wedding: {
      id: string
      slug: string
      title: string
      date: string
      venue: string
    }
    programme: Array<{
      id: string
      time: string
      title: string
      description?: string | null
      location?: string | null
      order: number
    }>
    announcements: Array<{
      id: string
      title?: string | null
      body: string
      publishedAt: string
    }>
  }
}

interface PassPayload {
  success: boolean
  error?: string
  data?: {
    passSerial: string
    tokenVersion: string
    eventBitmask: number
    token: string
    issuedAt: string
    expiresAt: string | null
  }
}

export function WeddingPassCard({ slug }: { slug: string }) {
  const [guest, setGuest] = useState<GuestContextPayload['data'] | null>(null)
  const [pass, setPass] = useState<PassPayload['data'] | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [guestResponse, passResponse] = await Promise.all([
          fetch('/api/wedding-day/guest', { cache: 'no-store' }),
          fetch('/api/wedding-day/pass', { cache: 'no-store' }),
        ])
        const guestPayload = (await guestResponse.json()) as GuestContextPayload
        const passPayload = (await passResponse.json()) as PassPayload
        if (!guestResponse.ok || !guestPayload.success || !guestPayload.data) {
          throw new Error(guestPayload.error || 'Wedding Day guest access is unavailable.')
        }
        if (!passResponse.ok || !passPayload.success || !passPayload.data) {
          throw new Error(passPayload.error || 'Wedding Pass is unavailable.')
        }
        const dataUrl = await QRCode.toDataURL(passPayload.data.token, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (cancelled) return
        setGuest(guestPayload.data)
        setPass(passPayload.data)
        setQrUrl(dataUrl)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load Wedding Pass.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-testid="wedding-pass-loading">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }

  if (error || !guest || !pass) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-background p-6 text-center" role="alert">
        <h1 className="font-serif text-2xl">Wewed Wedding Pass</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error || 'Pass unavailable.'}</p>
        <Button asChild className="mt-5"><a href={`/w/${encodeURIComponent(slug)}`}>Back to wedding</a></Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]" data-testid="wedding-pass">
      <section className="rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Wewed Wedding Pass</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">{guest.guest.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{guest.wedding.title}</p>
          </div>
          <ShieldCheck className="size-9" aria-label="Cryptographically signed WW2 credential" />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="rounded-2xl border bg-white p-3">
            {qrUrl && <img src={qrUrl} alt="Wewed Wedding Pass QR" className="h-64 w-64" data-testid="wedding-pass-qr" />}
          </div>
          <div className="space-y-4 text-sm">
            <div><span className="text-muted-foreground">Pass serial</span><p className="font-mono font-semibold" data-testid="wedding-pass-serial">{pass.passSerial}</p></div>
            <div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /><span>{guest.wedding.venue}</span></div>
            <div className="flex gap-2"><Users className="mt-0.5 size-4 shrink-0" /><span>{guest.guest.household.length} admitted member{guest.guest.household.length === 1 ? '' : 's'} on this household invitation</span></div>
            {guest.guest.tableNumber && <div><span className="text-muted-foreground">Table</span><p className="font-semibold" data-testid="wedding-pass-table">{guest.guest.tableNumber}</p></div>}
            <p className="text-xs text-muted-foreground">WW2 · P-256 ECDSA · event mask {pass.eventBitmask.toString(16).padStart(2, '0')}</p>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-[2rem] border bg-card p-6">
          <h2 className="font-serif text-2xl">Your household</h2>
          <div className="mt-4 space-y-2" data-testid="wedding-pass-household">
            {guest.guest.household.map((member) => (
              <div key={member.attendeeKey} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                <span>{member.attendeeName}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{member.attendeeKind.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border bg-card p-6">
          <h2 className="font-serif text-2xl">Wedding Day programme</h2>
          <div className="mt-4 space-y-3" data-testid="wedding-pass-programme">
            {guest.programme.map((item) => (
              <div key={item.id} className="grid grid-cols-[4.5rem_1fr] gap-3 text-sm">
                <span className="font-semibold">{item.time}</span>
                <div><p className="font-medium">{item.title}</p>{item.location && <p className="text-xs text-muted-foreground">{item.location}</p>}</div>
              </div>
            ))}
          </div>
        </section>

        {guest.announcements.length > 0 && (
          <section className="rounded-[2rem] border bg-card p-6" data-testid="wedding-pass-announcements">
            <h2 className="font-serif text-2xl">Live announcements</h2>
            <div className="mt-4 space-y-3">
              {guest.announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-xl border p-3 text-sm">
                  {announcement.title && <p className="font-semibold">{announcement.title}</p>}
                  <p>{announcement.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
