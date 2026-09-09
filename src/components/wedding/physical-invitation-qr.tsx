'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download, Loader2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PhysicalInvitationData {
  success: boolean
  configured: boolean
  wedding?: { slug: string; title: string }
  code: string | null
  rawCode: string | null
  accessUrl: string | null
  scanCount: number
  invitedCount: number
  createdAt: string | null
  error?: string
}

export function PhysicalInvitationQr() {
  const [data, setData] = useState<PhysicalInvitationData | null>(null)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [busy, setBusy] = useState<'load' | 'create' | null>('load')
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('load')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations/physical', {
        cache: 'no-store',
      })
      const payload = (await response.json()) as PhysicalInvitationData
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load bulk invitation QR.')
      }
      setData(payload)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load bulk invitation QR.',
      )
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    if (!data?.accessUrl) {
      setQrSrc(null)
      return
    }

    void QRCode.toDataURL(data.accessUrl, {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: 480,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then((value) => {
      if (!cancelled) setQrSrc(value)
    })

    return () => {
      cancelled = true
    }
  }, [data?.accessUrl])

  async function createPhysicalQr() {
    setBusy('create')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations/physical', {
        method: 'POST',
      })
      const payload = (await response.json()) as PhysicalInvitationData
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to create bulk invitation QR.')
      }
      setData(payload)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to create bulk invitation QR.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function copy(value: string, key: 'link' | 'code') {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(
      () => setCopied((current) => (current === key ? null : current)),
      1800,
    )
  }

  async function downloadVectorQr() {
    if (!data?.accessUrl || !data.rawCode) return
    const svg = await QRCode.toString(data.accessUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `wewed-physical-invitation-${data.rawCode}.svg`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(href)
  }

  return (
    <section className="mb-6 rounded-2xl border border-gold/25 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">
            Bulk physical cards
          </p>
          <h3 className="mt-1 font-serif text-2xl text-espresso">
            One clean QR for every printed invitation
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">
            This shared QR opens the wedding directly for anyone holding the
            physical card. It grants read-only invitation access and never
            reuses or impersonates a guest RSVP identity.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-espresso/65">
          <span className="rounded-full border border-gold/20 bg-champagne px-3 py-1.5">
            Guests listed: {data?.invitedCount ?? '—'}
          </span>
          <span className="rounded-full border border-gold/20 bg-champagne px-3 py-1.5">
            Opens: {data?.scanCount ?? '—'}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm text-clay">
          {error}
        </p>
      )}

      {busy === 'load' && !data ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-gold-muted" />
        </div>
      ) : data?.configured && data.accessUrl && data.code ? (
        <div className="mt-5 grid items-center gap-5 md:grid-cols-[15rem_1fr]">
          <div className="flex min-h-60 items-center justify-center rounded-2xl border border-gold/15 bg-white p-4">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="Shared QR code for the bulk printed wedding invitation"
                className="size-52 max-w-full object-contain [image-rendering:auto]"
              />
            ) : (
              <Loader2 className="size-6 animate-spin text-gold-muted" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-espresso/50">
              Shared fallback code
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tracking-[0.12em] text-espresso">
              {data.code}
            </p>
            <p className="mt-3 break-all text-sm text-espresso/60">
              {data.accessUrl}
            </p>
            <p className="mt-3 text-xs leading-5 text-espresso/50">
              Print the QR on every copy. The code can be placed discreetly on
              the rear panel later as a fallback; normal guests should only
              need to scan once.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copy(data.accessUrl!, 'link')}
              >
                {copied === 'link' ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === 'link' ? 'Link copied' : 'Copy link'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copy(data.code!, 'code')}
              >
                {copied === 'code' ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === 'code' ? 'Code copied' : 'Copy code'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void downloadVectorQr()}
                className="bg-gold text-espresso hover:bg-gold-light"
              >
                <Download className="size-4" />
                Download print SVG
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-gold/30 bg-champagne/35 px-5 py-8 text-center">
          <QrCode className="size-10 text-gold/60" />
          <p className="mt-3 font-medium text-espresso">No bulk-print QR exists yet.</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-espresso/55">
            Create one stable shared code before finalising the printed card.
            It will be separate from all personalised digital RSVP links.
          </p>
          <Button
            type="button"
            className="mt-4 bg-gold text-espresso hover:bg-gold-light"
            disabled={busy !== null}
            onClick={() => void createPhysicalQr()}
          >
            {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
            Create bulk-card QR
          </Button>
        </div>
      )}
    </section>
  )
}
