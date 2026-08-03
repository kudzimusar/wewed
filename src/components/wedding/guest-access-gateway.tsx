'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GuestAccessGateway({
  slug,
  privacy,
  invitationToken,
}: {
  slug: string
  privacy: 'public' | 'link_only' | 'private'
  invitationToken?: string | null
}) {
  const [token, setToken] = useState(invitationToken ?? '')
  const [busy, setBusy] = useState(Boolean(invitationToken))
  const [error, setError] = useState<string | null>(null)
  const exchanged = useRef(false)

  async function exchange(value: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to open this invitation.')
      }
      window.location.replace(`/w/${encodeURIComponent(slug)}?invitation=1`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this invitation.')
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!invitationToken || exchanged.current) return
    exchanged.current = true
    void exchange(invitationToken)
  }, [invitationToken])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = token.trim()
    if (!value) {
      setError('Enter the invitation code or open the QR link sent to you.')
      return
    }
    void exchange(value)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-espresso px-4 py-12 text-champagne">
      <section className="w-full max-w-lg rounded-3xl border border-gold/25 bg-gradient-to-b from-[#241d18] to-espresso p-7 shadow-2xl sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          {privacy === 'private' ? <LockKeyhole className="size-7 text-gold" /> : <ShieldCheck className="size-7 text-gold" />}
        </div>
        <p className="wewed-monogram mt-6 text-center text-xs tracking-[0.28em]">WEWED · PRIVATE CELEBRATION</p>
        <h1 className="wewed-heading mt-3 text-center text-4xl">
          {privacy === 'private' ? 'This wedding is private' : 'Open your invitation'}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-champagne/65">
          {privacy === 'private'
            ? 'Only the couple can currently view this wedding site. Sign in with the couple account or contact the couple for access.'
            : 'This wedding is shared only with invited guests. Scan the QR code on your invitation or enter its private invitation code.'}
        </p>

        {privacy !== 'private' && (
          <form onSubmit={submit} className="mt-8 space-y-3">
            <label htmlFor="guest-invitation-token" className="text-xs font-semibold uppercase tracking-[0.16em] text-gold/80">
              Invitation code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/55" />
              <Input
                id="guest-invitation-token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                disabled={busy}
                autoComplete="one-time-code"
                className="border-gold/30 bg-black/10 pl-10 text-champagne placeholder:text-champagne/30"
                placeholder="Paste the code from your invitation"
              />
            </div>
            {error && <p role="alert" className="rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay-light">{error}</p>}
            <Button type="submit" disabled={busy || !token.trim()} className="w-full bg-gold text-espresso hover:bg-gold-light">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Open wedding invitation
            </Button>
          </form>
        )}

        {invitationToken && busy && !error && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-champagne/60">
            <Loader2 className="size-4 animate-spin text-gold" /> Verifying your private invitation…
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 border-t border-gold/15 pt-6 text-xs text-champagne/60">
          <Link href="/" className="hover:text-gold">Wewed home</Link>
          <Link href="/guest-access-help" className="hover:text-gold">Guest access help</Link>
          <Link href="/sign-in" className="hover:text-gold">Couple sign in</Link>
          <Link href="/planners" className="hover:text-gold">Find a planner</Link>
        </div>
      </section>
    </main>
  )
}
