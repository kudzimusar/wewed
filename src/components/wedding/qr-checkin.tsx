'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, QrCode, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'

interface GuestSessionPayload {
  success?: boolean
  authorized?: boolean
  guest?: { name: string; tableNumber: number | null }
  rsvp?: { checkedIn: boolean; checkedInAt: string | null }
}

export function QrCheckin() {
  const { slug } = useWeddingContext()
  const [payload, setPayload] = useState<GuestSessionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!cancelled) setPayload(response.ok ? data : { authorized: false })
      })
      .catch(() => { if (!cancelled) setPayload({ authorized: false }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  async function checkIn() {
    setCheckingIn(true)
    setError(null)
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        method: 'PATCH',
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to check in.')
      setPayload((current) => current ? { ...current, rsvp: data.rsvp } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to check in.')
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <section id="checkin" className="wewed-section py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center"><p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-muted"><QrCode className="size-4" />Secure guest check-in</p><h2 className="wewed-heading mt-3 text-4xl text-espresso md:text-5xl">Your invitation confirms your arrival</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Check-in is authorized by the same private guest session created from your invitation QR. A typed name or demonstration code is never accepted as identity.</p></div>
        <Card className="mt-9 border-gold/30 bg-champagne shadow-md"><CardContent className="p-7 sm:p-9">
          {loading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div> : payload?.authorized && payload.guest ? (
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold/10"><ShieldCheck className="size-6 text-gold-muted" /></div>
              <h3 className="mt-4 font-serif text-3xl">Welcome, {payload.guest.name.split(' ')[0]}</h3>
              {payload.guest.tableNumber && <p className="mt-2 text-sm text-espresso/60">Your table: <strong>{payload.guest.tableNumber}</strong></p>}
              {payload.rsvp?.checkedIn ? <p className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-sage/30 bg-sage/10 px-4 py-2 text-sm text-sage"><CheckCircle2 className="size-4" />Checked in securely</p> : <Button type="button" onClick={() => void checkIn()} disabled={checkingIn} className="mt-6 bg-espresso text-champagne">{checkingIn ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Confirm my arrival</Button>}
              {error && <p role="alert" className="mt-4 text-sm text-clay">{error}</p>}
            </div>
          ) : (
            <div className="text-center"><QrCode className="mx-auto size-10 text-gold/50" /><h3 className="mt-4 font-serif text-2xl">Open your personal invitation first</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-espresso/60">Scan the QR code sent specifically to you. Wewed will verify it, remove the raw credential from the address bar and then enable your RSVP and check-in controls.</p></div>
          )}
        </CardContent></Card>
      </div>
    </section>
  )
}
