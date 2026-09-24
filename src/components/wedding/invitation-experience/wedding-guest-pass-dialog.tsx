'use client'

import { useEffect, useState } from 'react'
import qrcode from 'qrcode'
import { Loader2, QrCode, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface WeddingPassData {
  weddingId: string
  weddingSlug: string
  weddingTitle: string
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

interface WeddingPassResponse {
  success?: boolean
  data?: WeddingPassData
  code?: string
  error?: string
}

function friendlyPassError(payload: WeddingPassResponse): string {
  switch (payload.code) {
    case 'ATTENDANCE_REQUIRED':
      return 'Confirm your attendance to unlock your Wedding Pass.'
    case 'PASS_ISSUANCE_CLOSED':
      return 'Your Wedding Pass is not available in the current issuance window.'
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
  const [pass, setPass] = useState<WeddingPassData | null>(null)
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

  useEffect(() => {
    const handler = () => {
      setOpen(true)
      setLoading(true)
      setError(null)
      setPass(null)
      setQrDataUrl(null)

      void fetch('/api/wedding-day/pass', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
        .then(async (response) => {
          const payload = (await response.json()) as WeddingPassResponse
          const data = payload.data
          if (
            !response.ok ||
            !payload.success ||
            !data ||
            !data.token.startsWith('WW2.') ||
            !data.publicKeyDerBase64
          ) {
            throw new Error(friendlyPassError(payload))
          }
          setPass(data)
        })
        .catch((caught) => {
          setPass(null)
          setError(caught instanceof Error ? caught.message : 'Your Wedding Pass is not available.')
        })
        .finally(() => setLoading(false))
    }

    window.addEventListener('wewed:open-guest-pass', handler)
    return () => window.removeEventListener('wewed:open-guest-pass', handler)
  }, [slug])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="wedding-guest-pass-dialog"
        data-pass-authority="ww2"
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
            This is your signed WW2 admission credential. Keep it private and present it at the wedding gate.
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
