'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, Mail, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'

interface GuestInvitation {
  authorized?: boolean
  guest?: {
    name: string
    email: string | null
    tableNumber: number | null
  }
  rsvp?: {
    attending: boolean | null
    checkedIn: boolean
  }
}

export function RsvpSection() {
  const { slug } = useWeddingContext()
  const [invitation, setInvitation] = useState<GuestInvitation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!cancelled) setInvitation(response.ok ? payload : { authorized: false })
      })
      .catch(() => {
        if (!cancelled) setInvitation({ authorized: false })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  function openInvitation() {
    const url = new URL(window.location.href)
    url.searchParams.set('invitation', '1')
    url.hash = 'rsvp'
    window.location.href = url.toString()
  }

  return (
    <section id="rsvp" className="wewed-section py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <SectionEyebrow>Your invitation response</SectionEyebrow>
        <h2 className="wewed-heading wewed-heading-accent mt-3 text-4xl text-espresso md:text-5xl">
          RSVP securely
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
          RSVP changes are connected to the individual guest credential issued by the couple. Names and email addresses alone cannot create or modify a guest record.
        </p>

        <Card className="mt-8 border-gold/25 bg-champagne shadow-md">
          <CardContent className="p-7 sm:p-9">
            {loading ? (
              <div className="flex min-h-28 items-center justify-center">
                <Loader2 className="size-7 animate-spin text-gold" />
              </div>
            ) : invitation?.authorized && invitation.guest ? (
              <div>
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold/10">
                  <CheckCircle2 className="size-6 text-gold-muted" />
                </div>
                <h3 className="mt-4 font-serif text-3xl">{invitation.guest.name}</h3>
                {invitation.guest.email && (
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-espresso/55">
                    <Mail className="size-3.5" />
                    {invitation.guest.email}
                  </p>
                )}
                <p className="mt-4 text-sm text-espresso/60">
                  Response:{' '}
                  <strong>
                    {invitation.rsvp?.attending === true
                      ? 'Attending'
                      : invitation.rsvp?.attending === false
                        ? 'Not attending'
                        : 'Not submitted'}
                  </strong>
                  {invitation.guest.tableNumber
                    ? ` · Table ${invitation.guest.tableNumber}`
                    : ''}
                </p>
                <Button
                  type="button"
                  onClick={openInvitation}
                  className="mt-6 bg-espresso text-champagne"
                >
                  <KeyRound className="size-4" />
                  Review my RSVP
                </Button>
              </div>
            ) : (
              <div>
                <QrCode className="mx-auto size-10 text-gold/50" />
                <h3 className="mt-4 font-serif text-2xl">Use your personal invitation</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-espresso/60">
                  Scan the QR code or open the private invitation link sent specifically to you. Contact the couple when your credential is missing or no longer works.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
