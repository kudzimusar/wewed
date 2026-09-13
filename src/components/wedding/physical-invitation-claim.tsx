'use client'

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import { InvitationCountdown } from '@/components/wedding/invitation-countdown'
import { PremiumInvitationExperience } from '@/components/wedding/invitation-experience/premium-invitation-experience'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

export function PhysicalInvitationClaim({
  slug,
  invitation,
  style,
  allowNameOnlyClaim = false,
}: {
  slug: string
  invitation: DigitalInvitationCardData
  style: InvitationCardStyle
  allowNameOnlyClaim?: boolean
}) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const claimSectionRef = useRef<HTMLElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const openClaim = () => {
      claimSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => nameInputRef.current?.focus(), 250)
    }

    window.addEventListener('wewed:open-premium-rsvp', openClaim)
    return () => window.removeEventListener('wewed:open-premium-rsvp', openClaim)
  }, [])

  function handleInvitationClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element) || !target.closest('.ivory-site')) return

    // A physical invitation can grant read-only Couple Site access before the guest
    // identifies their RSVP. Keep the signed shared invitation session intact, but
    // explicitly request the Couple Site presentation instead of letting the clean
    // wedding URL be interpreted as another invitation entry.
    event.preventDefault()
    event.stopPropagation()
    window.location.assign(`/w/${encodeURIComponent(slug)}?site=1`)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || (!allowNameOnlyClaim && !contact.trim())) return

    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/weddings/${encodeURIComponent(slug)}/physical-invitation/claim`,
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            contact: contact.trim(),
            card: style,
          }),
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; redirect?: string; error?: string }
        | null

      if (!response.ok || !payload?.success || !payload.redirect) {
        setError(
          payload?.error ||
            'We could not match those details to this invitation. Check the details or ask the couple or planner for help.',
        )
        return
      }

      window.location.assign(payload.redirect)
    } catch {
      setError('We could not verify this invitation right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      data-testid="physical-invitation-claim"
      className="min-h-screen bg-ivory px-4 py-8 sm:py-12"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,.92fr)] lg:items-center">
        <div className="min-w-0 space-y-4">
          <InvitationCountdown date={invitation.date} />
          <div
            className="overflow-hidden rounded-[2rem] border border-gold/15 shadow-2xl"
            onClickCapture={handleInvitationClickCapture}
          >
            <PremiumInvitationExperience data={invitation} style={style} />
          </div>
        </div>

        <section
          ref={claimSectionRef}
          data-testid="physical-invitation-rsvp-claim"
          className="rounded-3xl border border-gold/25 bg-champagne p-6 shadow-xl sm:p-8"
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <ShieldCheck className="size-5 text-gold" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">
            Printed invitation · secure RSVP
          </p>
          <h1 className="wewed-heading mt-2 text-4xl text-espresso">
            Find my RSVP
          </h1>
          <p className="mt-4 text-sm leading-6 text-espresso/65">
            Your printed invitation opens the same digital invitation experience. Before an RSVP can be changed, Wewed must attach it to the correct invited guest. Enter the details the couple or planner used for your guest record.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="physical-invitation-name"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-espresso/70"
              >
                Full name
              </label>
              <Input
                ref={nameInputRef}
                id="physical-invitation-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
                className="mt-2 border-gold/30 bg-white/70"
                placeholder="Name on the guest list"
                required
              />
            </div>

            <div>
              <label
                htmlFor="physical-invitation-contact"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-espresso/70"
              >
                Email or phone{allowNameOnlyClaim ? ' (optional for this UAT fixture)' : ''}
              </label>
              <Input
                id="physical-invitation-contact"
                name="contact"
                autoComplete="email"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                disabled={busy}
                className="mt-2 border-gold/30 bg-white/70"
                placeholder="Email address or phone number"
                required={!allowNameOnlyClaim}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm leading-5 text-clay-dark"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={
                busy || !name.trim() || (!allowNameOnlyClaim && !contact.trim())
              }
              className="w-full bg-espresso text-champagne hover:bg-plum"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Continue to my digital invitation
            </Button>
          </form>

          <p className="mt-5 text-xs leading-5 text-espresso/50">
            Wewed does not reveal the guest list from this form. If the details do not match exactly, the response remains generic and no RSVP identity is created.
          </p>
        </section>
      </div>
    </main>
  )
}
