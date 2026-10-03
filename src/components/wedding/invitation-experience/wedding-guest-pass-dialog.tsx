'use client'

import { useCallback, useEffect, useState } from 'react'
import qrcode from 'qrcode'
import { CalendarDays, CheckCircle2, Loader2, LockKeyhole, MapPin, QrCode, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  GUEST_PASS_AVAILABILITY_COPY,
  isWeddingPassAvailabilityState,
  type WeddingPassAvailability,
  type WeddingPassAvailabilityState,
} from '@/lib/wedding-pass-availability'

interface WeddingPassData {
  weddingId: string
  weddingSlug: string
  weddingTitle: string
  weddingDate: string
  venue: string
  venueCity: string
  venueCountry: string
  guestId: string
  guestName: string
  passSerial: string
  tokenVersion: string
  eventBitmask: number
  token: string
  issuedAt: string
  expiresAt: string | null
  revokedAt: string | null
  publicKeyDerBase64: string
}

interface LockedPassContext {
  weddingId: string
  weddingSlug: string
  weddingTitle: string
  weddingDate: string
  venue: string
  venueCity: string
  venueCountry: string
  guestId: string
  guestName: string
  attending: boolean | null
}

interface WeddingPassResponse {
  success?: boolean
  data?: WeddingPassData
  code?: string
  error?: string
  availability?: WeddingPassAvailability
  context?: LockedPassContext
}

function availabilityState(payload: WeddingPassResponse): WeddingPassAvailabilityState | null {
  const state = payload.availability?.state
  return isWeddingPassAvailabilityState(state) ? state : null
}

/**
 * UAT 2026-09-29: a bare `toLocaleDateString()` rendered "12/9/2026", which a guest reading
 * day-first reads as 12 September. Spell the month out, like every other invitation date.
 */
export function formatPassOpensAt(opensAt: Date): string {
  return opensAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function friendlyPassError(payload: WeddingPassResponse): string {
  // The server's shared availability state wins; web, iOS and Android present the same sentence.
  const state = availabilityState(payload)
  if (state && state !== 'active') {
    const copy = GUEST_PASS_AVAILABILITY_COPY[state]
    const opensAt = payload.availability?.opensAt ? new Date(payload.availability.opensAt) : null
    return state === 'not_yet_issuable' && opensAt && !Number.isNaN(opensAt.getTime())
      ? `${copy} Available from ${formatPassOpensAt(opensAt)}.`
      : copy
  }
  switch (payload.code) {
    case 'WEDDING_DAY_DISABLED':
      return 'Wedding Pass is not active for this wedding yet.'
    case 'WEDDING_DAY_KEY_CONFIGURATION_INVALID':
      return 'Wedding Pass verification is temporarily unavailable.'
    case 'SESSION_INVALID':
      return 'Your private guest session has expired. Reopen your invitation link.'
    default:
      return payload.error || 'Your Wedding Pass is not available.'
  }
}

export function WeddingGuestPassDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passState, setPassState] = useState<WeddingPassAvailabilityState | 'error' | null>(null)
  const [pass, setPass] = useState<WeddingPassData | null>(null)
  const [availability, setAvailability] = useState<WeddingPassAvailability | null>(null)
  const [lockedContext, setLockedContext] = useState<LockedPassContext | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!pass?.token) {
      setQrDataUrl(null)
      return
    }

    void qrcode
      .toDataURL(pass.token, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
      .then((value) => {
        if (!cancelled) setQrDataUrl(value)
      })
      .catch(() => {
        if (!cancelled) setError('Wedding Pass QR could not be prepared. Please try again.')
      })

    return () => {
      cancelled = true
    }
  }, [pass?.token])

  const loadPass = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPass(null)
    setQrDataUrl(null)
    try {
      const response = await fetch('/api/wedding-day/pass', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const payload = (await response.json()) as WeddingPassResponse
      const state = availabilityState(payload)
      if (!response.ok || !payload.success || !payload.data) {
        if (state && state !== 'active' && payload.context) {
          setAvailability(payload.availability ?? null)
          setLockedContext(payload.context)
          setPassState(state)
          return
        }
        setPassState(state && state !== 'active' ? state : 'error')
        throw new Error(friendlyPassError(payload))
      }
      const data = payload.data
      if (!data.token.startsWith('WW2.') || !data.publicKeyDerBase64) {
        setPassState('error')
        throw new Error('Wedding Pass credential is invalid.')
      }
      setAvailability(payload.availability ?? null)
      setLockedContext(null)
      setPass(data)
      setPassState('active')
    } catch (caught) {
      setPass(null)
      setError(caught instanceof Error ? caught.message : 'Your Wedding Pass is not available.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const handler = () => {
      setOpen(true)
      setPassState(null)
      setAvailability(null)
      setLockedContext(null)
      void loadPass()
    }
    window.addEventListener('wewed:open-guest-pass', handler)
    return () => window.removeEventListener('wewed:open-guest-pass', handler)
  }, [loadPass])

  // A locked Pass must transition without the Guest closing/reopening it. Re-check on resume/focus
  // and once when the server-provided issuance window opens.
  useEffect(() => {
    if (!open) return
    const refreshOnResume = () => {
      if (document.visibilityState === 'visible') void loadPass()
    }
    window.addEventListener('focus', refreshOnResume)
    document.addEventListener('visibilitychange', refreshOnResume)
    const opensAt = availability?.opensAt ? new Date(availability.opensAt).getTime() : Number.NaN
    const delay = Number.isFinite(opensAt) ? Math.max(0, opensAt - Date.now() + 250) : null
    const timer = delay !== null && delay <= 2_147_000_000
      ? window.setTimeout(() => void loadPass(), delay)
      : null
    return () => {
      window.removeEventListener('focus', refreshOnResume)
      document.removeEventListener('visibilitychange', refreshOnResume)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [availability?.opensAt, loadPass, open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="wedding-guest-pass-dialog"
        data-pass-authority="ww2"
        data-pass-state={passState ?? undefined}
        className="overflow-hidden rounded-[2rem] border border-[#c89a55]/45 bg-[#fff9ef] p-0 text-[#3a2b20] shadow-2xl sm:max-w-md"
      >
        <div className="bg-[#17130f] px-6 pb-7 pt-8 text-center text-[#f5dfb8]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#d4a75f]/45 bg-[#d4a75f]/10">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d4a75f]">
            Wewed · Secure Wedding Pass
          </p>
          <DialogTitle className="mt-3 font-serif text-4xl leading-none text-[#fffaf0]">
            Your Wedding Pass
          </DialogTitle>
          <DialogDescription className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#d8cbbb]">
            {passState && passState !== 'active' && passState !== 'error'
              ? GUEST_PASS_AVAILABILITY_COPY[passState]
              : 'This is your signed WW2 admission credential. Keep it private and present it at the wedding gate.'}
          </DialogDescription>
        </div>

        {loading && (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="size-7 animate-spin text-[#a97831]" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            data-testid="wedding-pass-unavailable"
            className="m-6 rounded-2xl border border-[#d7b98e] bg-[#fff5e5] px-4 py-4 text-sm leading-6 text-[#6b4a25]"
          >
            {error}
          </div>
        )}

        {!loading && !error && !pass && lockedContext && passState && passState !== 'active' && passState !== 'error' && (
          <div data-testid="wedding-pass-locked-card" className="p-6">
            <div className="rounded-[1.5rem] border border-[#c89a55]/35 bg-white/80 p-5 shadow-sm">
              <div className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f7ecdc] text-[#9b6b2f]">
                  <LockKeyhole className="size-6" aria-hidden="true" />
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a97831]">{lockedContext.weddingTitle}</p>
                <p data-testid="wedding-pass-locked-guest-name" className="mt-2 font-serif text-3xl">{lockedContext.guestName}</p>
                <p className="mt-2 text-sm leading-6 text-[#6f5d4c]">{friendlyPassError({ availability: availability ?? undefined })}</p>
              </div>

              <div className="mt-5 grid gap-2 text-sm">
                <div className="flex items-center gap-3 rounded-xl bg-[#f7ecdc] px-3 py-3">
                  <CheckCircle2 className="size-4 text-[#49765b]" />
                  <span>Invitation verified</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-[#f7ecdc] px-3 py-3">
                  {lockedContext.attending === true ? <CheckCircle2 className="size-4 text-[#49765b]" /> : <LockKeyhole className="size-4 text-[#9b6b2f]" />}
                  <span>{lockedContext.attending === true ? 'RSVP confirmed' : lockedContext.attending === false ? 'RSVP declined' : 'RSVP required'}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-[#f7ecdc] px-3 py-3">
                  <LockKeyhole className="size-4 text-[#9b6b2f]" />
                  <span>
                    Secure admission QR {availability?.opensAt ? `unlocks on ${formatPassOpensAt(new Date(availability.opensAt))}` : 'is not issued yet'}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 border-t border-[#c89a55]/20 pt-4 text-sm text-[#6f5d4c]">
                <p className="flex items-center gap-2"><CalendarDays className="size-4 text-[#9b6b2f]" />{formatPassOpensAt(new Date(lockedContext.weddingDate))}</p>
                <p className="flex items-center gap-2"><MapPin className="size-4 text-[#9b6b2f]" />{[lockedContext.venue, lockedContext.venueCity, lockedContext.venueCountry].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-[#7d6a58]">Your secure WW2 admission QR will appear here only when the canonical Wedding Pass authority makes it available.</p>
          </div>
        )}

        {!loading && pass && (
          <div className="p-6">
            <div className="rounded-[1.5rem] border border-[#c89a55]/35 bg-white/75 p-5 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a97831]">
                {pass.weddingTitle}
              </p>
              <p data-testid="wedding-pass-guest-name" className="mt-2 font-serif text-3xl">
                {pass.guestName}
              </p>

              <div
                data-testid="wedding-pass-ww2-qr"
                className="mx-auto mt-5 flex min-h-64 w-full max-w-72 items-center justify-center rounded-2xl border border-[#c89a55]/35 bg-white p-3"
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Wedding Pass QR code"
                    className="h-auto w-full"
                  />
                ) : (
                  <QrCode className="size-16 text-[#9b6b2f]" aria-hidden="true" />
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#f7ecdc] px-3 py-3">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b6b2f]">
                    Pass
                  </span>
                  <strong data-testid="wedding-pass-serial" className="mt-1 block">
                    {pass.passSerial}
                  </strong>
                </div>
                <div className="rounded-xl bg-[#f7ecdc] px-3 py-3">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b6b2f]">
                    Credential
                  </span>
                  <strong data-testid="wedding-pass-version" className="mt-1 block">
                    {pass.tokenVersion}
                  </strong>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-[#7d6a58]">
              The QR contains your signed admission credential. Your RSVP token is never displayed here.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
