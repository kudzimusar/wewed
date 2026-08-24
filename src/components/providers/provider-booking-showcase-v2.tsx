'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Facebook, Images, QrCode, Share2, ShoppingBag } from 'lucide-react'

type Media = {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnailUrl?: string | null
  altText?: string
  caption?: string | null
}

type Variant = {
  id: string
  name: string
  sku: string
  optionValues: Record<string, unknown>
  priceOverrideCents: number | null
  inventoryMode: string
}

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

type CatalogPayload = {
  provider: {
    slug: string
    displayName: string
    coverImageUrl?: string | null
  }
  items: CatalogItem[]
}

type ProviderPortfolio = {
  id: string
  type: string
  url: string
  thumbnailUrl: string | null
  altText: string
  caption: string | null
}

type ProfilePayload = {
  provider?: {
    coverImageUrl?: string | null
    offerings?: Array<{ portfolio?: ProviderPortfolio[] }>
  }
}

type GalleryImage = {
  id: string
  url: string
  altText: string
  caption: string
}

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

function CatalogImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <div className="flex h-full w-full items-center justify-center bg-[#eee8de] px-3 text-center text-[11px] font-medium text-[#75695c]">Verified item imagery not published yet</div>
  }
  return <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
}

export function ProviderBookingShowcaseV2({ slug, fallbackCover }: { slug: string; fallbackCover?: string | null }) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null)
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [activeGallery, setActiveGallery] = useState(0)
  const [share, setShare] = useState<SharePayload | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    const locate = () => {
      const target = document.querySelector<HTMLElement>('#main-content > main')
      if (target) setPortalTarget(target)
      return Boolean(target)
    }

    if (locate()) return
    const observer = new MutationObserver(() => {
      if (locate()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    void Promise.all([
      fetch(`/api/providers/${encodeURIComponent(slug)}/catalog`, { cache: 'no-store' }),
      fetch(`/api/providers/${encodeURIComponent(slug)}`, { cache: 'no-store' }),
    ]).then(async ([catalogResponse, profileResponse]) => {
      const catalogJson = await catalogResponse.json() as { success?: boolean; data?: CatalogPayload; error?: string }
      const profileJson = await profileResponse.json().catch(() => ({})) as ProfilePayload
      if (!catalogResponse.ok || !catalogJson.success || !catalogJson.data) {
        throw new Error(catalogJson.error || 'Unable to load booking catalogue.')
      }
      if (!alive) return
      setCatalog(catalogJson.data)
      setProfile(profileJson)
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : 'Unable to load booking catalogue.')
    }).finally(() => {
      if (alive) setLoading(false)
    })

    return () => { alive = false }
  }, [slug])

  const gallery = useMemo<GalleryImage[]>(() => {
    if (!catalog) return []
    const rows: GalleryImage[] = []
    const seen = new Set<string>()
    const add = (entry: GalleryImage) => {
      if (!entry.url || seen.has(entry.url) || rows.length >= 10) return
      seen.add(entry.url)
      rows.push(entry)
    }

    const cover = profile?.provider?.coverImageUrl || catalog.provider.coverImageUrl || fallbackCover
    if (cover) add({ id: 'provider-cover', url: cover, altText: `${catalog.provider.displayName} profile cover`, caption: `${catalog.provider.displayName} · published profile cover` })

    for (const item of catalog.items) {
      for (const media of item.media || []) {
        if (media.type !== 'image') continue
        add({
          id: `catalog-${media.id}`,
          url: media.url,
          altText: media.altText || item.name,
          caption: media.caption || `${item.name} · catalogue image`,
        })
      }
    }

    for (const offering of profile?.provider?.offerings || []) {
      for (const media of offering.portfolio || []) {
        if (media.type !== 'image') continue
        add({
          id: `portfolio-${media.id}`,
          url: media.url,
          altText: media.altText || catalog.provider.displayName,
          caption: media.caption || `${catalog.provider.displayName} · published portfolio image`,
        })
      }
    }

    return rows
  }, [catalog, fallbackCover, profile])

  useEffect(() => {
    if (activeGallery >= gallery.length) setActiveGallery(0)
  }, [activeGallery, gallery.length])

  const canonicalShare = useMemo(() => `https://wewed.pro/vendors/${encodeURIComponent(slug)}`, [slug])

  async function openShare() {
    setShareOpen((current) => !current)
    setQrCode(null)
    if (share) return
    try {
      const response = await fetch(`/api/providers/${encodeURIComponent(slug)}/share`, { cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: SharePayload }
      if (!response.ok || !payload.success || !payload.data) throw new Error('Unable to prepare sharing.')
      setShare(payload.data)
    } catch {
      setShare({ shareUrl: canonicalShare, qrEndpoint: `/api/qrcode?data=${encodeURIComponent(canonicalShare)}` })
    }
  }

  async function loadQr() {
    const endpoint = share?.qrEndpoint || `/api/qrcode?data=${encodeURIComponent(canonicalShare)}`
    const response = await fetch(endpoint)
    const payload = await response.json() as { qrCode?: string }
    if (response.ok && payload.qrCode) setQrCode(payload.qrCode)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(share?.shareUrl || canonicalShare)
  }

  async function shareNative() {
    const url = share?.shareUrl || canonicalShare
    if (navigator.share) {
      await navigator.share({ title: catalog?.provider.displayName || 'Wewed provider', url }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  if (!portalTarget) return null

  const content = (
    <section className="mt-8 border-t border-[#e7dccb] pt-8" aria-labelledby="book-provider-services">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#a57d31]"><ShoppingBag className="size-4" /> Booking & catalogue</div>
          <h2 id="book-provider-services" className="mt-1 font-serif text-3xl leading-tight text-[#211a15] sm:text-4xl">Browse and book {catalog?.provider.displayName || 'this provider'}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6e6256]">Choose a service and send the appropriate booking, appointment or quote request without leaving the vendor profile.</p>
        </div>
        <button type="button" onClick={openShare} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#d9cbb6] bg-white px-3 text-sm font-semibold text-[#302820] shadow-sm hover:bg-[#fbf8f3]"><QrCode className="size-4" /> Share / QR</button>
      </div>

      {loading ? (
        <div className="mt-5 rounded-xl border border-[#e7dccb] bg-white p-4 text-sm text-[#71665a]">Loading booking options…</div>
      ) : error || !catalog ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Booking options are temporarily unavailable.</div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
            <div className="overflow-hidden rounded-xl border border-[#e3d7c5] bg-white">
              {gallery.length ? (
                <>
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#eee8de] sm:aspect-[16/8]">
                    <img src={gallery[activeGallery].url} alt={gallery[activeGallery].altText} className="h-full w-full object-cover" />
                    {gallery.length > 1 ? (
                      <>
                        <button type="button" aria-label="Previous image" onClick={() => setActiveGallery((index) => (index - 1 + gallery.length) % gallery.length)} className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white"><ChevronLeft className="size-5" /></button>
                        <button type="button" aria-label="Next image" onClick={() => setActiveGallery((index) => (index + 1) % gallery.length)} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white"><ChevronRight className="size-5" /></button>
                      </>
                    ) : null}
                    <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">{activeGallery + 1} / {gallery.length}</div>
                  </div>
                  <div className="border-t border-[#eee4d6] px-3 py-2.5">
                    <p className="text-xs leading-5 text-[#665b50]">{gallery[activeGallery].caption}</p>
                    {gallery.length > 1 ? (
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {gallery.map((image, index) => (
                          <button key={image.id} type="button" onClick={() => setActiveGallery(index)} aria-label={`View image ${index + 1}`} className={`h-14 w-16 shrink-0 overflow-hidden rounded-md border ${index === activeGallery ? 'border-[#9d7731] ring-1 ring-[#9d7731]' : 'border-[#ddd1c0]'}`}>
                            <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 bg-[#f2ece3] px-6 text-center text-sm text-[#766b60]"><Images className="size-6" /><strong>No verified gallery media published yet</strong><span className="max-w-md text-xs leading-5">The catalogue supports up to 10 marketplace images per item. Wewed does not substitute generic stock photography as vendor evidence.</span></div>
              )}
            </div>

            <div className="rounded-xl border border-[#e3d7c5] bg-[#faf7f1] p-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a7938]">Marketplace gallery</div>
              <div className="mt-2 text-2xl font-semibold text-[#211a15]">{gallery.length} verified image{gallery.length === 1 ? '' : 's'}</div>
              <p className="mt-2 text-xs leading-5 text-[#6f6358]">The gallery accepts 5–10 useful angles as the vendor publishes them: front, side, detail, setup, scale, finish and in-use context. Only published vendor media is presented as vendor content.</p>
              <div className="mt-4 border-t border-[#e7dccb] pt-3 text-xs leading-5 text-[#7a6e62]">Catalogue media and the vendor portfolio are merged here so users do not have to hunt through separate oversized sections.</div>
            </div>
          </div>

          {catalog.items.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#d8cbb9] bg-white p-5 text-sm text-[#6f6358]">This provider accepts enquiries, but has not published bookable catalogue items yet.</div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {catalog.items.map((item) => {
                const image = item.media.find((entry) => entry.type === 'image')?.url || null
                return (
                  <article key={item.id} className="grid min-h-0 grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[#e3d7c5] bg-white shadow-[0_5px_18px_rgba(58,42,25,.05)] sm:grid-cols-[128px_minmax(0,1fr)] md:block">
                    <div className="aspect-square min-h-full overflow-hidden bg-[#eee8de] md:aspect-[16/9] md:min-h-0"><CatalogImage src={image} alt={item.name} /></div>
                    <div className="min-w-0 p-3.5">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8d7d6c]">
                        <span>{item.category.replaceAll('-', ' ')}</span>
                        {item.variants.length ? <span>· {item.variants.length} option{item.variants.length === 1 ? '' : 's'}</span> : null}
                      </div>
                      <h3 className="mt-1.5 text-base font-bold leading-5 text-[#211a15]">{item.name}</h3>
                      {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6f6358]">{item.description}</p> : null}
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#211a15]">{formatMoney(item.basePriceCents, item.currency)}</div>
                          <div className="mt-0.5 text-[11px] text-[#827568]">{item.bookingMode === 'instant' ? 'Live availability' : 'Vendor confirms availability'}</div>
                        </div>
                        <Link href={`/vendors/${encodeURIComponent(slug)}/book/${encodeURIComponent(item.slug)}`} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#211a15] px-3 text-xs font-bold text-white hover:bg-[#342921]"><CalendarDays className="size-3.5" /> {modeLabel[item.bookingMode] || 'View'}</Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {shareOpen ? (
            <div className="mt-4 rounded-xl border border-[#e3d7c5] bg-white p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={shareNative} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d9cbb6] px-3 text-xs font-semibold"><Share2 className="size-3.5" /> Share</button>
                <button type="button" onClick={copyUrl} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d9cbb6] px-3 text-xs font-semibold"><Copy className="size-3.5" /> Copy link</button>
                <a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`View ${catalog.provider.displayName} on Wewed: ${share?.shareUrl || canonicalShare}`)}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#d9cbb6] px-3 text-xs font-semibold">WhatsApp</a>
                <a target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share?.shareUrl || canonicalShare)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d9cbb6] px-3 text-xs font-semibold"><Facebook className="size-3.5" /> Facebook</a>
                <button type="button" onClick={loadQr} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d9cbb6] px-3 text-xs font-semibold"><QrCode className="size-3.5" /> QR</button>
                {qrCode ? <img src={qrCode} alt={`QR code for ${catalog.provider.displayName}`} className="ml-auto size-24 rounded-lg border border-[#e3d7c5] bg-white p-1" /> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )

  return createPortal(content, portalTarget)
}
