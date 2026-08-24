'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Copy, ExternalLink, Images, QrCode, Share2, ShoppingBag, X } from 'lucide-react'

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
type ProviderPortfolio = { id: string; type: string; url: string; thumbnailUrl: string | null; altText: string; caption: string | null }
type ProfilePayload = { provider?: { coverImageUrl?: string | null; offerings?: Array<{ portfolio?: ProviderPortfolio[] }> } }
type GalleryImage = { id: string; url: string; altText: string; caption: string; provenance: 'Vendor photo' | 'Wewed editorial' }
type SharePayload = { shareUrl: string; qrEndpoint: string }

const modeLabel: Record<string, string> = { instant: 'Book now', request: 'Request booking', quote: 'Request quote', appointment: 'Schedule', plan_only: 'Add to plan' }

const editorialVisuals: GalleryImage[] = [
  { id: 'wewed-gown', url: '/media/wewed/attire-gown-editorial.svg', altText: 'Wewed bridal gown editorial visual', caption: 'Bridal gown inspiration · original Wewed editorial artwork', provenance: 'Wewed editorial' },
  { id: 'wewed-accessories', url: '/media/wewed/attire-accessories-editorial.svg', altText: 'Wewed bridal accessories editorial visual', caption: 'Bridal accessory inspiration · original Wewed editorial artwork', provenance: 'Wewed editorial' },
  { id: 'wewed-ceremony', url: '/media/wewed/decor-ceremony-editorial.svg', altText: 'Wewed ceremony decor editorial visual', caption: 'Ceremony seating & décor inspiration · original Wewed editorial artwork', provenance: 'Wewed editorial' },
  { id: 'wewed-table', url: '/media/wewed/decor-tablescape-editorial.svg', altText: 'Wewed reception tablescape editorial visual', caption: 'Reception styling inspiration · original Wewed editorial artwork', provenance: 'Wewed editorial' },
  { id: 'wewed-tent-exterior', url: '/media/wewed/tent-exterior-editorial.svg', altText: 'Wewed marquee exterior editorial visual', caption: 'Marquee exterior inspiration · original Wewed editorial artwork', provenance: 'Wewed editorial' },
  { id: 'wewed-tent-interior', url: '/media/wewed/tent-interior-editorial.svg', altText: 'Wewed marquee interior editorial visual', caption: 'Marquee interior inspiration · original Wewed editorial artwork', provenance: 'Wewed editorial' },
]

function formatMoney(cents: number | null, currency: string) {
  if (cents == null) return 'Vendor quote'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100) }
  catch { return `${currency} ${(cents / 100).toFixed(2)}` }
}

function editorialFor(item: CatalogItem) {
  const category = item.category.toLowerCase()
  const slug = item.slug.toLowerCase()
  if (category.includes('attire') || slug.includes('gown') || slug.includes('bridal')) return editorialVisuals[0]
  if (category.includes('tent') || slug.includes('tent') || slug.includes('marquee')) return editorialVisuals[4]
  if (category.includes('decor') || slug.includes('chair') || slug.includes('decor')) return editorialVisuals[2]
  return editorialVisuals[3]
}

export function ProviderBookingShowcaseV2({ slug, fallbackCover }: { slug: string; fallbackCover?: string | null }) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null)
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null)
  const [share, setShare] = useState<SharePayload | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    const locate = () => {
      const target = document.querySelector<HTMLElement>('#provider-booking-slot')
      if (target) setPortalTarget(target)
      return Boolean(target)
    }
    if (locate()) return
    const observer = new MutationObserver(() => { if (locate()) observer.disconnect() })
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
      if (!catalogResponse.ok || !catalogJson.success || !catalogJson.data) throw new Error(catalogJson.error || 'Unable to load booking catalogue.')
      if (!alive) return
      setCatalog(catalogJson.data); setProfile(profileJson)
    }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Unable to load booking catalogue.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug])

  const gallery = useMemo<GalleryImage[]>(() => {
    if (!catalog) return editorialVisuals
    const rows: GalleryImage[] = []
    const seen = new Set<string>()
    const add = (entry: GalleryImage) => {
      if (!entry.url || seen.has(entry.url) || rows.length >= 10) return
      seen.add(entry.url); rows.push(entry)
    }

    const cover = profile?.provider?.coverImageUrl || catalog.provider.coverImageUrl || fallbackCover
    if (cover) add({ id: 'provider-cover', url: cover, altText: `${catalog.provider.displayName} published profile cover`, caption: `${catalog.provider.displayName} · published profile cover`, provenance: 'Vendor photo' })
    for (const item of catalog.items) for (const media of item.media || []) if (media.type === 'image') add({ id: `catalog-${media.id}`, url: media.url, altText: media.altText || item.name, caption: media.caption || `${item.name} · published catalogue image`, provenance: 'Vendor photo' })
    for (const offering of profile?.provider?.offerings || []) for (const media of offering.portfolio || []) if (media.type === 'image') add({ id: `portfolio-${media.id}`, url: media.url, altText: media.altText || catalog.provider.displayName, caption: media.caption || `${catalog.provider.displayName} · published portfolio image`, provenance: 'Vendor photo' })
    for (const editorial of editorialVisuals) add(editorial)
    return rows
  }, [catalog, fallbackCover, profile])

  const canonicalShare = useMemo(() => `https://wewed.pro/vendors/${encodeURIComponent(slug)}`, [slug])

  async function openShare() {
    setShareOpen((current) => !current)
    setShareError('')
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
    setShareError('')
    try {
      const endpoint = share?.qrEndpoint || `/api/qrcode?data=${encodeURIComponent(canonicalShare)}`
      const response = await fetch(endpoint, { cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; qr?: string; error?: string }
      if (!response.ok || !payload.qr) throw new Error(payload.error || 'Unable to generate QR code.')
      setQrCode(payload.qr)
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : 'Unable to generate QR code.')
    }
  }

  async function copyUrl() { await navigator.clipboard.writeText(share?.shareUrl || canonicalShare) }
  async function shareNative() {
    const url = share?.shareUrl || canonicalShare
    if (navigator.share) await navigator.share({ title: catalog?.provider.displayName || 'Wewed provider', url }).catch(() => undefined)
    else await navigator.clipboard.writeText(url)
  }

  if (!portalTarget) return null

  const content = (
    <section className="pb-10" aria-labelledby="book-provider-services">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a7938]"><ShoppingBag className="size-4" /> Services & booking</div>
          <h2 id="book-provider-services" className="mt-1 font-serif text-4xl leading-tight text-[#211a15] sm:text-5xl">Choose what you need</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e6256]">Start with a service. Wewed reveals only the dates and details needed for that booking type.</p>
        </div>
        <div className="relative">
          <button type="button" onClick={openShare} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d9cbb6] bg-white px-4 text-sm font-semibold text-[#302820] hover:bg-[#fbf8f3]"><QrCode className="size-4" /> Share / QR</button>
          {shareOpen ? <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-[#ded0bd] bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><strong className="text-sm text-[#2d241e]">Share this provider</strong><button type="button" onClick={() => setShareOpen(false)} aria-label="Close share"><X className="size-4" /></button></div><p className="mt-1 break-all text-[11px] leading-4 text-[#7b6e61]">{share?.shareUrl || canonicalShare}</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={copyUrl} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#ded0bd] text-xs font-semibold"><Copy className="size-3.5" /> Copy link</button><button type="button" onClick={shareNative} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#ded0bd] text-xs font-semibold"><Share2 className="size-3.5" /> Share</button></div><button type="button" onClick={loadQr} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#211a15] text-xs font-semibold text-white"><QrCode className="size-3.5" /> {qrCode ? 'Refresh QR' : 'Show QR code'}</button>{shareError ? <p className="mt-2 text-xs text-red-700">{shareError}</p> : null}{qrCode ? <div className="mt-3 rounded-xl bg-[#fbf6ee] p-3"><img src={qrCode} alt={`QR code for ${catalog?.provider.displayName || 'provider'}`} className="mx-auto size-44" /><p className="mt-2 text-center text-[10px] text-[#786c60]">Scan to open the canonical wewed.pro profile.</p></div> : null}</div> : null}
        </div>
      </div>

      {loading ? <div className="mt-5 rounded-xl border border-[#e7dccb] bg-white p-4 text-sm text-[#71665a]">Loading booking options…</div> : error || !catalog ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Booking options are temporarily unavailable.</div> : catalog.items.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-[#d8cbb9] bg-white p-5 text-sm text-[#6f6358]">This provider accepts enquiries, but has not published bookable catalogue items yet.</div> : <>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalog.items.map((item) => {
            const vendorImage = item.media.find((entry) => entry.type === 'image')?.url || null
            const fallback = editorialFor(item)
            const image = vendorImage || fallback.url
            return <Link key={item.id} href={`/vendors/${encodeURIComponent(slug)}/book/${encodeURIComponent(item.slug)}`} className="group overflow-hidden rounded-2xl border border-[#e2d5c4] bg-white shadow-[0_8px_24px_rgba(53,39,25,.05)] transition hover:-translate-y-0.5 hover:border-[#c3ab83] hover:shadow-[0_14px_36px_rgba(53,39,25,.1)]">
              <div className="relative aspect-[16/9] overflow-hidden bg-[#eee7dc]"><img src={image} alt={vendorImage ? item.name : fallback.altText} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /><span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${vendorImage ? 'bg-black/70 text-white' : 'bg-[#fbf6ee]/92 text-[#5e4c36]'}`}>{vendorImage ? 'Vendor photo' : 'Wewed visual'}</span></div>
              <div className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8d7d6c]">{item.category.replaceAll('-', ' ')}</span><span className="text-[11px] font-semibold text-[#8b682d]">{modeLabel[item.bookingMode] || 'View'}</span></div><h3 className="mt-1.5 text-lg font-bold leading-6 text-[#211a15]">{item.name}</h3>{item.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6f6358]">{item.description}</p> : null}<div className="mt-4 flex items-end justify-between gap-2"><div><div className="text-sm font-bold text-[#211a15]">{formatMoney(item.basePriceCents, item.currency)}</div><div className="mt-0.5 text-[10px] text-[#827568]">{item.bookingMode === 'instant' ? 'Live availability' : 'Vendor confirms availability'}</div></div><span className="inline-flex size-9 items-center justify-center rounded-full bg-[#211a15] text-white"><CalendarDays className="size-4" /></span></div></div>
            </Link>
          })}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a7938]"><Images className="size-4" /> Visual inspiration</div><h3 className="mt-1 font-serif text-3xl text-[#211a15]">See the mood, not a wall of images</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-[#73675c]">Published vendor photography and original Wewed editorial art are labelled separately. Tap any visual to focus on it.</p></div><span className="shrink-0 text-xs font-semibold text-[#887050]">{gallery.length} visuals</span></div>
        <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-3">
          {gallery.map((image) => <button key={image.id} type="button" onClick={() => setLightbox(image)} className="group relative aspect-[3/2] w-[78vw] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#e2d5c4] bg-[#eee7dc] text-left sm:w-[310px]"><img src={image.url} alt={image.altText} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="lazy" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/38 to-transparent p-3 pt-10"><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${image.provenance === 'Vendor photo' ? 'bg-white text-[#211a15]' : 'bg-[#c9a25d] text-[#211a15]'}`}>{image.provenance}</span><p className="mt-1 line-clamp-1 text-xs font-medium text-white">{image.caption}</p></div></button>)}
        </div>
      </>}

      {lightbox ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/88 p-4" role="dialog" aria-modal="true" aria-label="Visual preview" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null) }}><div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-[#17120f] shadow-2xl"><button type="button" onClick={() => setLightbox(null)} className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-black/65 text-white" aria-label="Close visual"><X className="size-5" /></button><img src={lightbox.url} alt={lightbox.altText} className="max-h-[76dvh] w-full object-contain" /><div className="flex flex-col gap-2 border-t border-white/10 p-4 text-white sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#d1aa61]">{lightbox.provenance}</span><p className="mt-1 text-sm text-white/78">{lightbox.caption}</p></div>{lightbox.provenance === 'Wewed editorial' ? <span className="text-[10px] text-white/45">Illustrative Wewed-owned art; not vendor inventory.</span> : <span className="inline-flex items-center gap-1 text-[10px] text-white/45"><ExternalLink className="size-3" />Published vendor media</span>}</div></div></div> : null}
    </section>
  )

  return createPortal(content, portalTarget)
}
