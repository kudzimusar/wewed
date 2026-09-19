'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, QrCode, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface GuestPassPayload {
  success?: boolean
  guest?: {
    name: string
    email: string | null
    tableNumber: number | null
  }
  rsvp?: {
    attending: boolean | null
    checkedIn: boolean
    checkedInAt: string | null
  }
  wedding?: {
    title: string
    date: string
    venue: string
  }
}

export function WeddingGuestPassDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<GuestPassPayload | null>(null)

  useEffect(() => {
    const handler = () => {
      setOpen(true)
      setLoading(true)
      setError(null)
      void fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
        .then(async (response) => {
          const data = (await response.json()) as GuestPassPayload & { error?: string }
          if (!response.ok || !data.success || !data.guest) {
            throw new Error(data.error || 'Your wedding pass is not available.')
          }
          setPayload(data)
        })
        .catch((caught) => {
          setPayload(null)
          setError(caught instanceof Error ? caught.message : 'Your wedding pass is not available.')
        })
        .finally(() => setLoading(false))
    }

    window.addEventListener('wewed:open-guest-pass', handler)
    return () => window.removeEventListener('wewed:open-guest-pass', handler)
  }, [slug])

  const attendingLabel =
    payload?.rsvp?.attending === true
      ? 'RSVP accepted'
      : payload?.rsvp?.attending === false
        ? 'RSVP declined'
        : 'RSVP pending'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="wedding-guest-pass-dialog"
        className="overflow-hidden rounded-[2rem] border border-[#c89a55]/45 bg-[#fff9ef] p-0 text-[#3a2b20] shadow-2xl sm:max-w-md"
      >
        <div className="bg-[#17130f] px-6 pb-7 pt-8 text-center text-[#f5dfb8]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#d4a75f]/45 bg-[#d4a75f]/10">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d4a75f]">
            Wewed · Secure wedding pass
          </p>
          <DialogTitle className="mt-3 font-serif text-4xl leading-none text-[#fffaf0]">
            Your wedding pass
          </DialogTitle>
          <DialogDescription className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#d8cbbb]">
            This pass is bound to your private guest session. No RSVP credential is displayed.
          </DialogDescription>
        </div>

        {loading && (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="size-7 animate-spin text-[#a97831]" />
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="m-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {!loading && payload?.guest && (
          <div className="p-6">
            <div className="rounded-[1.5rem] border border-[#c89a55]/35 bg-white/70 p-5 text-center shadow-sm">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-[#c89a55]/35 bg-[#f7ecdc]">
                <QrCode className="size-8 text-[#9b6b2f]" aria-hidden="true" />
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a97831]">
                Guest
              </p>
              <p data-testid="wedding-pass-guest-name" className="mt-1 font-serif text-3xl">
                {payload.guest.name}
              </p>
              {payload.guest.tableNumber && (
                <p className="mt-2 text-sm text-[#6f5b49]">
                  Table <strong>{payload.guest.tableNumber}</strong>
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#f7ecdc] px-3 py-3">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b6b2f]">Reply</span>
                  <strong className="mt-1 block">{attendingLabel}</strong>
                </div>
                <div className="rounded-xl bg-[#f7ecdc] px-3 py-3">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b6b2f]">Arrival</span>
                  <strong className="mt-1 flex items-center justify-center gap-1">
                    {payload.rsvp?.checkedIn && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                    {payload.rsvp?.checkedIn ? 'Checked in' : 'Ready'}
                  </strong>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-[#7d6a58]">
              Keep Wewed on this device for arrival and table details. Your private invitation remains the source of identity.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
