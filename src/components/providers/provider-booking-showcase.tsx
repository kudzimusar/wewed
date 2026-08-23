'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Copy, Facebook, Loader2, QrCode, Share2, ShoppingBag } from 'lucide-react'

type Media = { id: string; type: 'image' | 'video'; url: string; thumbnailUrl?: string | null; altText?: string; caption?: string | null }
type Variant = { id: string; name: string; sku: string; optionValues: Record<string, unknown>; priceOverrideCents: number | null; inventoryMode: string }
type CatalogItem = {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  bookingArchetype: string
  bookingMode: string
  basePriceCents: number | null
  currency: string
  pricingUnit: string | null
  requiresFitting: boolean
  requiresContract: boolean
  variants: Variant[]
  media: Media[]
  resourceCount: number
}

type CatalogPayload = { provider: { slug: string; displayName: string; coverImageUrl?: string | null }; items: CatalogItem[] }

type SharePayload = { shareUrl: string; qrEndpoint: string }

const modeLabel: Record<string, string> = {
  instant: 'Book now',
  request: 'Request booking',
  quote: 'Request quote',
  appointment: 'Schedule',
  plan_only: 'Add to plan',
}

function formatMoney(cents: number | null, currency: string) {
  if (cents == null) return 'Price confirmed by vendor'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`
  }
}

function safeImage(item: CatalogItem, fallback?: string | null) {
  return item.media.find((entry) => entry.type === 'image')?.url || fallback || null
}

export function ProviderBookingShowcase({ slug, fallbackCover }: { slug: string; fallbackCover?: string | null }) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [share, setShare] = useState<SharePayload | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/providers/${encodeURIComponent(slug)}/catalog`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load booking catalogue.')
        if (alive) setCatalog(payload.data)
      })
      .catch((reason: unknown) => alive && setError(reason instanceof Error ? reason.message : 'Unable to load booking catalogue.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [slug])

  const itemCount = catalog?.items.length ?? 0
  const providerName = catalog?.provider.displayName ?? 'Provider'
  const canonicalShare = useMemo(() => `https://wewed.pro/vendors/${encodeURIComponent(slug)}`, [slug])

  async function openShare() {
    setShareOpen(true)
    setQrCode(null)
    if (share) return
    try {
      const response = await fetch(`/api/providers/${encodeURIComponent(slug)}/share`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to prepare sharing.')
      setShare(payload.data)
    } catch {
      setShare({ shareUrl: canonicalShare, qrEndpoint: `/api/qrcode?data=${encodeURIComponent(canonicalShare)}` })
    }
  }

  async function loadQr() {
    const endpoint = share?.qrEndpoint || `/api/qrcode?data=${encodeURIComponent(canonicalShare)}`
    const response = await fetch(endpoint)
    const payload = await response.json()
    if (response.ok && payload.qrCode) setQrCode(payload.qrCode)
  }

  async function shareNative() {
    const url = share?.shareUrl || canonicalShare
    if (navigator.share) {
      await navigator.share({ title: providerName, text: `View ${providerName} on Wewed`, url }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(share?.shareUrl || canonicalShare)
  }

  if (loading) {
    return <section className="mx-auto max-w-6xl px-4 py-8"><div className="flex items-center gap-2 rounded-2xl border bg-white p-5 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading booking options…</div></section>
  }

  if (error || !catalog) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby="book-provider-services">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700"><ShoppingBag className="h-4 w-4" /> Online booking</div>
          <h2 id="book-provider-services" className="text-2xl font-semibold text-slate-950">Browse and book {providerName}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Choose a service, date and options online. Wewed keeps requests, bookings and wedding planning connected.</p>
        </div>
        <button type="button" onClick={openShare} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
          <QrCode className="h-4 w-4" /> Share / QR
        </button>
      </div>

      {itemCount === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600">This provider accepts enquiries, but has not published bookable catalogue items yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.items.map((item) => {
            const image = safeImage(item, fallbackCover || catalog.provider.coverImageUrl)
            return (
              <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                {image ? (
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <Image src={image} alt={item.media.find((entry) => entry.type === 'image')?.altText || item.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm text-slate-500">Media coming soon</div>
                )}
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.category.replaceAll('-', ' ')}</span>
                    {item.variants.length > 0 && <span>{item.variants.length} option{item.variants.length === 1 ? '' : 's'}</span>}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">{item.name}</h3>
                  {item.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>}
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{formatMoney(item.basePriceCents, item.currency)}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.bookingMode === 'instant' ? 'Live availability' : 'Vendor confirms availability'}</div>
                    </div>
                    <Link href={`/vendors/${encodeURIComponent(slug)}/book/${encodeURIComponent(item.slug)}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3.5 text-sm font-semibold text-white hover:bg-slate-800">
                      <CalendarDays className="h-4 w-4" /> {modeLabel[item.bookingMode] || 'View'}
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {shareOpen && (
        <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-950">Share {providerName}</h3>
              <p className="mt-1 text-sm text-slate-600">Use the permanent Wewed link on WhatsApp, Facebook, status posts, printed material or in person.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={shareNative} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm"><Share2 className="h-4 w-4" /> Share</button>
                <button type="button" onClick={copyUrl} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm"><Copy className="h-4 w-4" /> Copy link</button>
                <a className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`View ${providerName} on Wewed: ${share?.shareUrl || canonicalShare}`)}`}>WhatsApp</a>
                <a className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share?.shareUrl || canonicalShare)}`}><Facebook className="h-4 w-4" /> Facebook</a>
                <button type="button" onClick={loadQr} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm"><QrCode className="h-4 w-4" /> Show QR</button>
              </div>
            </div>
            {qrCode && (
              <div className="rounded-2xl border bg-white p-3 text-center">
                {/* QR is generated by Wewed's existing QR endpoint and is intentionally rendered as a data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt={`QR code for ${providerName}`} className="mx-auto h-44 w-44" />
                <div className="mt-2 text-xs font-medium text-slate-600">Scan to view {providerName}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
