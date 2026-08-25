'use client'

import { useMemo, useState } from 'react'
import { Copy, QrCode, Share2, X } from 'lucide-react'

type SharePayload = { shareUrl: string; qrEndpoint: string }

export function ProviderShareQrButton({ slug, itemSlug, compact = false }: { slug: string; itemSlug?: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState<SharePayload | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canonical = useMemo(() => {
    const base = `https://wewed.pro/vendors/${encodeURIComponent(slug)}`
    return itemSlug ? `${base}/book/${encodeURIComponent(itemSlug)}` : base
  }, [itemSlug, slug])

  async function ensureShare() {
    if (share) return share
    const suffix = itemSlug ? `?item=${encodeURIComponent(itemSlug)}` : ''
    const response = await fetch(`/api/providers/${encodeURIComponent(slug)}/share${suffix}`, { cache: 'no-store' })
    const payload = await response.json() as { success?: boolean; data?: SharePayload }
    const resolved = response.ok && payload.success && payload.data ? payload.data : { shareUrl: canonical, qrEndpoint: `/api/qrcode?data=${encodeURIComponent(canonical)}` }
    setShare(resolved)
    return resolved
  }

  async function openPanel() {
    setOpen(true); setBusy(true); setError('')
    try {
      const resolved = await ensureShare()
      const response = await fetch(resolved.qrEndpoint, { cache: 'no-store' })
      const payload = await response.json() as { qr?: string; error?: string }
      if (!response.ok || !payload.qr) throw new Error(payload.error || 'Unable to generate QR code.')
      setQr(payload.qr)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to prepare sharing.')
    } finally { setBusy(false) }
  }

  async function copy() {
    const resolved = await ensureShare()
    await navigator.clipboard.writeText(resolved.shareUrl)
  }

  async function nativeShare() {
    const resolved = await ensureShare()
    if (navigator.share) await navigator.share({ title: 'Wewed booking', url: resolved.shareUrl }).catch(() => undefined)
    else await navigator.clipboard.writeText(resolved.shareUrl)
  }

  return <div className="relative">
    <button type="button" onClick={openPanel} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#ddd0bf] bg-white font-semibold text-[#4e4238] hover:bg-[#faf7f2] ${compact ? 'min-h-9 px-3 text-xs' : 'min-h-10 px-4 text-sm'}`}><QrCode className="size-4" /> Share / QR</button>
    {open ? <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[#ddcfbd] bg-white p-4 text-[#2b221c] shadow-2xl"><div className="flex items-center justify-between gap-2"><strong className="text-sm">Share this page</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close share"><X className="size-4" /></button></div><p className="mt-1 break-all text-[10px] leading-4 text-[#7c7064]">{share?.shareUrl || canonical}</p>{busy ? <div className="mt-4 flex h-44 items-center justify-center rounded-xl bg-[#faf6ef] text-xs text-[#7b6e61]">Preparing QR…</div> : qr ? <div className="mt-3 rounded-xl bg-[#fbf6ee] p-3"><img src={qr} alt="QR code for this Wewed page" className="mx-auto size-44" /></div> : <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error || 'QR unavailable.'}</div>}<div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={copy} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#ddcfbd] text-xs font-semibold"><Copy className="size-3.5" />Copy link</button><button type="button" onClick={nativeShare} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#ddcfbd] text-xs font-semibold"><Share2 className="size-3.5" />Share</button></div></div> : null}
  </div>
}
